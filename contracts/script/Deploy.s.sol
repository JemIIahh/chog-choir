// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ChogChoir} from "../src/ChogChoir.sol";
import {ChogReplica} from "../src/ChogReplica.sol";

/// forge script script/Deploy.s.sol --rpc-url $RPC --broadcast
///   NFT unset    -> also deploys the free-to-claim replica (testnet / local)
///   NFT=0xc96d.. -> points the choir at the real Chog Genesis collection (mainnet)
///   EPOCH_SECONDS defaults to one hour
contract Deploy is Script {
    string constant META_BASE = "ipfs://bafybeid4ybujnscdipkno7ps5utqelp5ry5ryreqhay3zhgk3a6x4jruqu/";

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint64 epochSeconds = uint64(vm.envOr("EPOCH_SECONDS", uint256(3600)));
        address nft = vm.envOr("NFT", address(0));

        vm.startBroadcast(pk);
        if (nft == address(0)) nft = address(new ChogReplica(META_BASE));
        ChogChoir choir = new ChogChoir(nft, epochSeconds);
        vm.stopBroadcast();

        console.log("NFT", nft);
        console.log("CHOIR", address(choir));
        console.log("EPOCH_SECONDS", epochSeconds);
    }
}
