// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
contract PRCRedistributionLedger {
    address public immutable recorder = msg.sender;
    mapping(bytes32 => bytes32) public evidence;
    event Recorded(bytes32 indexed eventKey, bytes32 digest);
    function record(bytes32 eventKey, bytes32 digest) external {
        require(msg.sender == recorder, "recorder only");
        require(evidence[eventKey] == bytes32(0), "already recorded");
        require(digest != bytes32(0), "empty digest");
        evidence[eventKey] = digest;
        emit Recorded(eventKey, digest);
    }
}
