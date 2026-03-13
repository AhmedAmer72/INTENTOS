// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./IIntentRegistry.sol";

/// @title IntentExecutor
/// @notice Generic settlement: an APPROVE binding unlocks one call after a challenge delay.
/// @dev Live IntentRegistry is unchanged. Principal can invalidateIntent during the delay.
contract IntentExecutor {
    IIntentRegistry public immutable registry;
    uint64 public immutable challengeDelay;

    mapping(bytes32 => mapping(bytes32 => bool)) public executed;

    event Executed(
        bytes32 indexed intentId,
        bytes32 indexed actionHash,
        address indexed target,
        uint256 value
    );

    error ZeroRegistry();
    error IntentNotApproved();
    error ChallengePending();
    error BindingMismatch();
    error AlreadyExecuted();
    error CallFailed();
    error ZeroTarget();

    constructor(address registry_, uint64 challengeDelay_) {
        if (registry_ == address(0)) revert ZeroRegistry();
        registry = IIntentRegistry(registry_);
        challengeDelay = challengeDelay_;
    }

    function execute(
        bytes32 intentId,
        bytes32 actionHash,
        address target,
        bytes calldata data
    ) external payable {
        if (target == address(0)) revert ZeroTarget();
        if (!registry.isApproved(intentId, actionHash)) revert IntentNotApproved();
        if (executed[intentId][actionHash]) revert AlreadyExecuted();

        (, , , , , uint64 timestamp, bytes32 bound) = registry.getVerification(intentId, actionHash);
        if (block.timestamp < uint256(timestamp) + uint256(challengeDelay)) revert ChallengePending();

        bytes32 expected = keccak256(
            abi.encode(intentId, actionHash, target, keccak256(data), msg.value)
        );
        if (bound != expected) revert BindingMismatch();

        executed[intentId][actionHash] = true;
        (bool ok, ) = target.call{value: msg.value}(data);
        if (!ok) revert CallFailed();
        emit Executed(intentId, actionHash, target, msg.value);
    }
}
