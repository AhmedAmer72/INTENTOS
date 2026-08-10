// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./IIntentRegistry.sol";

/// @title CertificateConsumer
/// @notice Presents an INTENTOS certificate as a one-time credential. The gate is registry.isApproved.
contract CertificateConsumer {
    IIntentRegistry public immutable registry;

    mapping(bytes32 => mapping(bytes32 => bool)) public consumed;

    event CredentialAccepted(bytes32 indexed intentId, bytes32 indexed actionHash, address indexed presenter);

    error ZeroRegistry();
    error IntentNotApproved();
    error AlreadyConsumed();

    constructor(address registry_) {
        if (registry_ == address(0)) revert ZeroRegistry();
        registry = IIntentRegistry(registry_);
    }

    function accept(bytes32 intentId, bytes32 actionHash) external {
        if (!registry.isApproved(intentId, actionHash)) revert IntentNotApproved();
        if (consumed[intentId][actionHash]) revert AlreadyConsumed();
        consumed[intentId][actionHash] = true;
        emit CredentialAccepted(intentId, actionHash, msg.sender);
    }
}
