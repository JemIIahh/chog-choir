// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title Chog Genesis (testnet replica)
/// @notice Same ids, same metadata as the real collection on Monad mainnet, but free to claim, so
///         anyone can try Chog Choir on testnet. This is NOT the real NFT and carries no value.
contract ChogReplica is ERC721 {
    uint256 public constant SUPPLY = 1969;
    string private _base;

    error BadId();

    constructor(string memory base_) ERC721("Chog Genesis (testnet replica)", "CHOGT") {
        _base = base_;
    }

    /// @notice Claim any unclaimed id for yourself.
    function claim(uint256 id) external {
        if (id == 0 || id > SUPPLY) revert BadId();
        _mint(msg.sender, id);
    }

    /// @notice The real collection's metadata is a rotation of the ids: token 1 is "CHOG #1462". Same here.
    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        return string.concat(_base, Strings.toString(((id + 1460) % SUPPLY) + 1), ".json");
    }
}
