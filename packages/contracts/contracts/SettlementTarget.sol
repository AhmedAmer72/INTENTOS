// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title SettlementTarget
/// @notice Live Galileo callee for IntentExecutor. Records the approved call; not a DEX.
contract SettlementTarget {
    address public lastCaller;
    bytes public lastData;
    uint256 public lastValue;

    event Settled(address indexed caller, bytes data, uint256 value);

    receive() external payable {
        lastCaller = msg.sender;
        lastData = "";
        lastValue = msg.value;
        emit Settled(msg.sender, "", msg.value);
    }

    function ping(bytes calldata data) external payable {
        lastCaller = msg.sender;
        lastData = data;
        lastValue = msg.value;
        emit Settled(msg.sender, data, msg.value);
    }
}
