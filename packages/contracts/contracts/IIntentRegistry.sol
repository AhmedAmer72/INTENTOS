// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IIntentRegistry {
    function isApproved(bytes32 intentId, bytes32 actionHash) external view returns (bool);

    function getSettlementBinding(bytes32 intentId, bytes32 actionHash) external view returns (bytes32);

    function getVerification(
        bytes32 intentId,
        bytes32 actionHash
    )
        external
        view
        returns (
            bytes32 actionHashOut,
            bytes32 evidenceRoot,
            uint8 verdict,
            uint16 alignmentBps,
            uint16 confidenceBps,
            uint64 timestamp,
            bytes32 settlementBinding
        );

    function getIntent(
        bytes32 intentId
    )
        external
        view
        returns (
            bytes32 intentHash,
            address principal,
            bytes32 agentId,
            uint64 createdAt,
            uint64 expiresAt,
            uint8 status
        );
}
