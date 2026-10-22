// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ChogChoir} from "../src/ChogChoir.sol";
import {ChogReplica} from "../src/ChogReplica.sol";
import {ChogToken} from "../src/ChogToken.sol";

/// forge script script/Deploy.s.sol --rpc-url $RPC --broadcast            (with DEPLOYER_PRIVATE_KEY set)
/// forge script script/Deploy.s.sol --rpc-url $RPC --account <name> --broadcast   (an encrypted keystore, or --ledger)
///   NFT unset    -> also deploys the free-to-claim replica (testnet / local)
///   NFT=0xc96d.. -> points the choir at the real Chog Genesis collection (mainnet)
///   TOKEN unset  -> also deploys the free stand-in token (testnet / local)
///   TOKEN=0x..   -> encores burn that token (mainnet: the real $CHOG); TOKEN=0x0 turns encores off
///   ENCORE_PRICE is in the token's smallest unit (default 1,000 tokens at 18 decimals)
///   EPOCH_SECONDS defaults to one hour
///
/// On Monad mainnet (chain 143) the script refuses to run unless NFT is the real Chog Genesis, TOKEN is the real $CHOG and
/// EPOCH_SECONDS is set on purpose. The addresses are immutable once deployed, so a forgotten variable must never silently
/// wire the real collection to a free faucet token, or deploy a free copy of the collection as the gate.
contract Deploy is Script {
    address constant REAL_CHOG_NFT = 0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763;
    address constant REAL_CHOG_TOKEN = 0x350035555E10d9AfAF1566AaebfCeD5BA6C27777;
    uint256 constant MONAD_MAINNET = 143;

    string constant META_BASE = "ipfs://bafybeid4ybujnscdipkno7ps5utqelp5ry5ryreqhay3zhgk3a6x4jruqu/";

    function run() external {
        // Signing: with DEPLOYER_PRIVATE_KEY set the script signs with it. Without it, forge signs with whatever is passed on the
        // command line (--account <keystore name>, --ledger, --trezor, or --sender with --unlocked), so a real wallet's key never
        // has to be written into a file or an environment variable.
        uint256 pk = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        uint64 epochSeconds = uint64(vm.envOr("EPOCH_SECONDS", uint256(3600)));
        address nft = vm.envOr("NFT", address(0));
        bool deployToken = !vm.envExists("TOKEN");
        address token = vm.envOr("TOKEN", address(0));
        uint256 price = vm.envOr("ENCORE_PRICE", uint256(1000 ether));

        if (block.chainid == MONAD_MAINNET) {
            require(nft == REAL_CHOG_NFT, "mainnet: NFT must be the real Chog Genesis");
            require(!deployToken && token == REAL_CHOG_TOKEN, "mainnet: TOKEN must be the real $CHOG");
            require(vm.envExists("EPOCH_SECONDS"), "mainnet: set EPOCH_SECONDS on purpose");
        }

        if (pk != 0) vm.startBroadcast(pk);
        else vm.startBroadcast();
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
