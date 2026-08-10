// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IIntentRegistry {
    function isApproved(bytes32 intentId, bytes32 actionHash) external view returns (bool);

    function getSettlementBinding(bytes32 intentId, bytes32 actionHash) external view returns (bytes32);
}
