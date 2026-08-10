// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./IIntentRegistry.sol";

/// @title DemoVault
/// @notice Protected settlement gate. A deposit reverts unless the (intent, action) pair was APPROVE'd.
/// @dev Hash-substitution defense: settlementBinding = keccak256(abi.encode(intentId, actionHash, msg.value))
///      must match the binding the oracle attested at verification time.
contract DemoVault {
    IIntentRegistry public immutable registry;

    mapping(bytes32 => mapping(bytes32 => uint256)) public deposits;
    mapping(bytes32 => mapping(bytes32 => bool)) public settled;

    event Settled(bytes32 indexed intentId, bytes32 indexed actionHash, address indexed caller, uint256 amount);

    error IntentNotApproved();
    error BindingMismatch();
    error AlreadySettled();
    error ZeroRegistry();

    constructor(address registry_) {
        if (registry_ == address(0)) revert ZeroRegistry();
        registry = IIntentRegistry(registry_);
    }

    function deposit(bytes32 intentId, bytes32 actionHash) external payable {
        if (!registry.isApproved(intentId, actionHash)) revert IntentNotApproved();
        bytes32 expected = keccak256(abi.encode(intentId, actionHash, msg.value));
        bytes32 bound = registry.getSettlementBinding(intentId, actionHash);
        if (bound != expected) revert BindingMismatch();
        if (settled[intentId][actionHash]) revert AlreadySettled();
        settled[intentId][actionHash] = true;
        deposits[intentId][actionHash] += msg.value;
        emit Settled(intentId, actionHash, msg.sender, msg.value);
    }
}
