// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title VerificationMeter
/// @notice Prepaid native-0G credits for intent verification. Settler (the API) debits after each verify.
contract VerificationMeter is AccessControl {
    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");

    uint256 public priceWei;
    mapping(address => uint256) public credits;

    event Deposited(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event Debited(address indexed account, uint256 amount, bytes32 indexed intentId);
    event PriceSet(uint256 priceWei);

    error InsufficientCredits();
    error ZeroAddress();
    error ZeroAmount();

    constructor(address admin, address settler, uint256 priceWei_) {
        if (admin == address(0) || settler == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SETTLER_ROLE, settler);
        priceWei = priceWei_;
        emit PriceSet(priceWei_);
    }

    function setPrice(uint256 next) external onlyRole(DEFAULT_ADMIN_ROLE) {
        priceWei = next;
        emit PriceSet(next);
    }

    function deposit() external payable {
        if (msg.value == 0) revert ZeroAmount();
        credits[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (credits[msg.sender] < amount) revert InsufficientCredits();
        credits[msg.sender] -= amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "withdraw failed");
        emit Withdrawn(msg.sender, amount);
    }

    function debit(address account, uint256 amount, bytes32 intentId) external onlyRole(SETTLER_ROLE) {
        if (account == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (credits[account] < amount) revert InsufficientCredits();
        credits[account] -= amount;
        emit Debited(account, amount, intentId);
    }
}
