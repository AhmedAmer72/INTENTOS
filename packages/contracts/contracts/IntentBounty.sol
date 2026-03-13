// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./IIntentRegistry.sol";

/// @title IntentBounty
/// @notice Native-0G escrow released only if the (intent, action) pair is APPROVE.
contract IntentBounty {
    uint8 private constant STATUS_NONE = 0;
    uint8 private constant STATUS_INVALIDATED = 2;

    IIntentRegistry public immutable registry;

    struct Bounty {
        address funder;
        uint256 amount;
        bool claimed;
    }

    mapping(bytes32 => mapping(bytes32 => Bounty)) public bounties;

    event Funded(bytes32 indexed intentId, bytes32 indexed actionHash, address indexed funder, uint256 amount);
    event Claimed(bytes32 indexed intentId, bytes32 indexed actionHash, address indexed beneficiary, uint256 amount);
    event Refunded(bytes32 indexed intentId, bytes32 indexed actionHash, address indexed funder, uint256 amount);

    error ZeroRegistry();
    error ZeroBeneficiary();
    error ZeroAmount();
    error AlreadyClaimed();
    error EmptyBounty();
    error IntentNotApproved();
    error RefundBlocked();
    error AlreadyFunded();

    constructor(address registry_) {
        if (registry_ == address(0)) revert ZeroRegistry();
        registry = IIntentRegistry(registry_);
    }

    function fund(bytes32 intentId, bytes32 actionHash) external payable {
        if (msg.value == 0) revert ZeroAmount();
        Bounty storage b = bounties[intentId][actionHash];
        if (b.claimed) revert AlreadyClaimed();
        if (b.funder != address(0) && b.funder != msg.sender) revert AlreadyFunded();
        if (b.funder == address(0)) b.funder = msg.sender;
        b.amount += msg.value;
        emit Funded(intentId, actionHash, msg.sender, msg.value);
    }

    function claim(bytes32 intentId, bytes32 actionHash, address beneficiary) external {
        if (beneficiary == address(0)) revert ZeroBeneficiary();
        Bounty storage b = bounties[intentId][actionHash];
        if (b.amount == 0) revert EmptyBounty();
        if (b.claimed) revert AlreadyClaimed();
        if (!registry.isApproved(intentId, actionHash)) revert IntentNotApproved();
        b.claimed = true;
        uint256 amount = b.amount;
        b.amount = 0;
        (bool ok, ) = beneficiary.call{value: amount}("");
        require(ok, "claim failed");
        emit Claimed(intentId, actionHash, beneficiary, amount);
    }

    function refund(bytes32 intentId, bytes32 actionHash) external {
        Bounty storage b = bounties[intentId][actionHash];
        if (b.amount == 0) revert EmptyBounty();
        if (b.claimed) revert AlreadyClaimed();
        if (msg.sender != b.funder) revert RefundBlocked();

        (, , , , uint64 expiresAt, uint8 status) = registry.getIntent(intentId);
        bool invalidated = status == STATUS_INVALIDATED || status == STATUS_NONE;
        bool expiredUnapproved = block.timestamp > expiresAt && !registry.isApproved(intentId, actionHash);
        if (!invalidated && !expiredUnapproved) revert RefundBlocked();

        uint256 amount = b.amount;
        b.amount = 0;
        b.claimed = true;
        (bool ok, ) = b.funder.call{value: amount}("");
        require(ok, "refund failed");
        emit Refunded(intentId, actionHash, b.funder, amount);
    }
}
