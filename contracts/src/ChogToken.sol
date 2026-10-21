// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title $CHOG (testnet stand-in)
/// @notice Free to mint, so anyone can try encores on testnet. This is NOT the real $CHOG and has no value.
contract ChogToken is ERC20 {
    constructor() ERC20("Chog (testnet)", "CHOGT") {}

    /// @notice 1,000 tokens to yourself, as often as you like.
    function faucet() external {
        _mint(msg.sender, 1_000 ether);
    }
}
