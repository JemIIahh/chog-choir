// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @title $CHOG (testnet stand-in)
/// @notice Free to mint and burnable like the real one, so anyone can try encores on testnet. This is NOT the real $CHOG and has no value.
contract ChogToken is ERC20, ERC20Burnable {
    constructor() ERC20("Chog (testnet)", "CHOGT") {}

    /// @notice 1,000 tokens to yourself, as often as you like.
    function faucet() external {
        _mint(msg.sender, 1_000 ether);
    }
}
