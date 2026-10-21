// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ChogChoir} from "../src/ChogChoir.sol";

/// Prints epochKey vectors so the front end's mirror of the function can be checked against the contract.
contract EpochKeyVectors is Test {
    function test_printVectors() public {
        ChogChoir c = new ChogChoir(address(1), 1 hours);
        string memory s = "{";
        for (uint256 e = 0; e < 12; e++) {
            (uint8 r, uint8 m) = c.epochKey(e);
            s = string.concat(s, e == 0 ? "" : ",", '"', vm.toString(e), '":[', vm.toString(r), ",", vm.toString(m), "]");
        }
        s = string.concat(s, "}");
        console.log(s);
    }
}
