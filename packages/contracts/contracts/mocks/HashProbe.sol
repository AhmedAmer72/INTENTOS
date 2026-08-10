// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Test helper: keccak256 of UTF-8 bytes, matching keccak256(utf8(JCS(object))) off-chain.
contract HashProbe {
    function keccakUtf8(string calldata s) external pure returns (bytes32) {
        return keccak256(bytes(s));
    }
}
