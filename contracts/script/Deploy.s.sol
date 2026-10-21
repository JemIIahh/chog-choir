// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ChogChoir} from "../src/ChogChoir.sol";
import {ChogReplica} from "../src/ChogReplica.sol";
import {ChogToken} from "../src/ChogToken.sol";

/// forge script script/Deploy.s.sol --rpc-url $RPC --broadcast
///   NFT unset    -> also deploys the free-to-claim replica (testnet / local)
///   NFT=0xc96d.. -> points the choir at the real Chog Genesis collection (mainnet)
///   TOKEN unset  -> also deploys the free stand-in token (testnet / local)
///   TOKEN=0x..   -> encores burn that token (mainnet: the real $CHOG); TOKEN=0x0 turns encores off
///   ENCORE_PRICE is in the token's smallest unit (default 1,000 tokens at 18 decimals)
///   EPOCH_SECONDS defaults to one hour
contract Deploy is Script {
    string constant META_BASE = "ipfs://bafybeid4ybujnscdipkno7ps5utqelp5ry5ryreqhay3zhgk3a6x4jruqu/";

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint64 epochSeconds = uint64(vm.envOr("EPOCH_SECONDS", uint256(3600)));
        address nft = vm.envOr("NFT", address(0));
        bool deployToken = !vm.envExists("TOKEN");
        address token = vm.envOr("TOKEN", address(0));
        uint256 price = vm.envOr("ENCORE_PRICE", uint256(1000 ether));

        vm.startBroadcast(pk);
        if (nft == address(0)) nft = address(new ChogReplica(META_BASE));
        if (deployToken) token = address(new ChogToken());
        ChogChoir choir = new ChogChoir(nft, epochSeconds, token, price);
        vm.stopBroadcast();

        console.log("NFT", nft);
        console.log("TOKEN", token);
        console.log("CHOIR", address(choir));
        console.log("EPOCH_SECONDS", epochSeconds);
    }
}
