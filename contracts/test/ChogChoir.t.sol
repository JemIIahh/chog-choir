// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ChogChoir} from "../src/ChogChoir.sol";
import {ChogReplica} from "../src/ChogReplica.sol";
import {ChogToken} from "../src/ChogToken.sol";

contract ChogChoirTest is Test {
    ChogReplica nft;
    ChogChoir choir;
    ChogToken token;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    uint64 constant EPOCH = 1 hours;

    function setUp() public {
        nft = new ChogReplica("ipfs://base/");
        token = new ChogToken();
        choir = new ChogChoir(address(nft), EPOCH, address(token), 100 ether);
        vm.prank(alice);
        nft.claim(1);
        vm.prank(alice);
        nft.claim(2);
        vm.prank(bob);
        nft.claim(3);
    }

    function test_ownerCanPlace() public {
        vm.prank(alice);
        choir.place(1, 4, 7);
        assertEq(choir.noteCount(0), 1);
        assertTrue(choir.hasSung(0, 1));
        uint32[] memory n = choir.notesOf(0);
        assertEq(n[0], choir.pack(1, 4, 7));
    }

    function test_strangerCannotPlaceOthersChog() public {
        vm.prank(bob);
        vm.expectRevert(ChogChoir.NotYourChog.selector);
        choir.place(1, 0, 0);
    }

    function test_unmintedChogReverts() public {
        vm.prank(alice);
        vm.expectRevert(); // ERC721NonexistentToken from ownerOf
        choir.place(999, 0, 0);
    }

    function test_oneNotePerChogPerEpoch() public {
        vm.startPrank(alice);
        choir.place(1, 0, 0);
        vm.expectRevert(ChogChoir.AlreadySang.selector);
        choir.place(1, 1, 1);
        // her other Chog is still free to sing
        choir.place(2, 1, 1);
        vm.stopPrank();
        assertEq(choir.noteCount(0), 2);
    }

    function test_singsAgainNextEpoch() public {
        vm.prank(alice);
        choir.place(1, 0, 0);
        vm.warp(block.timestamp + EPOCH);
        assertEq(choir.currentEpoch(), 1);
        vm.prank(alice);
        choir.place(1, 2, 3);
        assertEq(choir.noteCount(0), 1);
        assertEq(choir.noteCount(1), 1);
    }

    function test_rangeChecks() public {
        vm.startPrank(alice);
        vm.expectRevert(ChogChoir.OutOfRange.selector);
        choir.place(1, 16, 0);
        vm.expectRevert(ChogChoir.OutOfRange.selector);
        choir.place(1, 0, 12);
        choir.place(1, 15, 11); // upper bounds are valid
        vm.stopPrank();
    }

    function test_boughtChogSingsForNewOwner() public {
        vm.prank(alice);
        nft.transferFrom(alice, bob, 1);
        vm.prank(alice);
        vm.expectRevert(ChogChoir.NotYourChog.selector);
        choir.place(1, 0, 0);
        vm.prank(bob);
        choir.place(1, 0, 0);
    }

    function test_sealFreezesFinishedEpoch() public {
        vm.prank(alice);
        choir.place(1, 0, 0);
        vm.prank(bob);
        choir.place(3, 8, 5);

        vm.expectRevert(ChogChoir.EpochNotOver.selector);
        choir.seal(0);

        vm.warp(block.timestamp + EPOCH);
        vm.prank(bob);
        choir.seal(0);

        assertEq(choir.sealedBy(0), bob);
        assertEq(choir.trackHash(0), keccak256(abi.encode(choir.notesOf(0))));
        assertEq(choir.sealedCount(), 1);
        assertEq(choir.sealedEpochs()[0], 0);

        vm.expectRevert(ChogChoir.AlreadySealed.selector);
        choir.seal(0);
    }

    function test_cannotSealSilence() public {
        vm.warp(block.timestamp + 3 * EPOCH);
        vm.expectRevert(ChogChoir.Silent.selector);
        choir.seal(1);
    }

    function test_epochKeyInRangeAndStable() public view {
        for (uint256 e = 0; e < 200; e++) {
            (uint8 r, uint8 m) = choir.epochKey(e);
            assertLt(r, 12);
            assertLt(m, choir.MODES());
            (uint8 r2, uint8 m2) = choir.epochKey(e);
            assertEq(r, r2);
            assertEq(m, m2);
        }
    }

    function test_epochKeyVaries() public view {
        uint256 distinct;
        (uint8 r0, uint8 m0) = choir.epochKey(0);
        for (uint256 e = 1; e < 50; e++) {
            (uint8 r, uint8 m) = choir.epochKey(e);
            if (r != r0 || m != m0) distinct++;
        }
        assertGt(distinct, 30);
    }

    function testFuzz_packRoundTrip(uint16 id, uint8 step, uint8 pitch) public view {
        uint32 p = choir.pack(id, step, pitch);
        assertEq(uint16(p >> 16), id);
        assertEq(uint8(p >> 8), step);
        assertEq(uint8(p), pitch);
    }

    function test_replicaMetadataMatchesRealCollection() public {
        // values read from the real contract on Monad mainnet: tokenURI(1) -> 1462, (2) -> 1463, (1968) -> 1460, (1969) -> 1461
        assertEq(nft.tokenURI(1), "ipfs://base/1462.json");
        assertEq(nft.tokenURI(2), "ipfs://base/1463.json");
        vm.prank(alice);
        nft.claim(1968);
        vm.prank(alice);
        nft.claim(1969);
        assertEq(nft.tokenURI(1968), "ipfs://base/1460.json");
        assertEq(nft.tokenURI(1969), "ipfs://base/1461.json");
    }

    function test_replicaClaimBounds() public {
        vm.expectRevert(ChogReplica.BadId.selector);
        nft.claim(0);
        vm.expectRevert(ChogReplica.BadId.selector);
        nft.claim(1970);
        vm.expectRevert(); // already claimed by alice
        nft.claim(1);
    }

    // ───────────── streaks, totals, loft ─────────────

    function test_streakCountsConsecutiveRounds() public {
        for (uint256 r = 0; r < 3; r++) {
            vm.prank(alice);
            choir.place(1, 0, 0);
            vm.warp(block.timestamp + EPOCH);
        }
        (uint32 total, uint32 last, uint16 streak, uint16 best) = choir.stats(1);
        assertEq(total, 3);
        assertEq(last, 3); // last sang in round index 2, stored +1
        assertEq(streak, 3);
        assertEq(best, 3);
    }

    function test_missingARoundBreaksTheStreakButKeepsTheBest() public {
        vm.prank(alice);
        choir.place(1, 0, 0); // round 0
        vm.warp(block.timestamp + EPOCH);
        vm.prank(alice);
        choir.place(1, 0, 0); // round 1, streak 2
        vm.warp(block.timestamp + 2 * EPOCH); // skip round 2
        vm.prank(alice);
        choir.place(1, 0, 0); // round 3
        (uint32 total,, uint16 streak, uint16 best) = choir.stats(1);
        assertEq(total, 3);
        assertEq(streak, 1);
        assertEq(best, 2);
    }

    function test_collectiveCounters() public {
        vm.prank(alice);
        choir.place(1, 0, 0);
        vm.prank(alice);
        choir.place(2, 1, 1);
        vm.prank(bob);
        choir.place(3, 2, 2);
        vm.warp(block.timestamp + EPOCH);
        vm.prank(alice);
        choir.place(1, 0, 0); // same Chog again: a voice, not a new singer
        assertEq(choir.singers(), 3);
        assertEq(choir.voices(), 4);
    }

    function test_loftReadsARange() public {
        vm.prank(alice);
        choir.place(2, 0, 0);
        ChogChoir.Stat[] memory s = choir.loft(1, 3);
        assertEq(s.length, 3);
        assertEq(s[0].total, 0); // id 1
        assertEq(s[1].total, 1); // id 2
        assertEq(s[2].total, 0); // id 3
    }

    // ───────────── encores ─────────────

    function _fund(address who) internal {
        vm.startPrank(who);
        token.faucet();
        token.approve(address(choir), type(uint256).max);
        vm.stopPrank();
    }

    function test_encoreBurnsChogForASecondNote() public {
        _fund(alice);
        vm.startPrank(alice);
        choir.place(1, 0, 0);
        choir.encore(1, 8, 4);
        vm.stopPrank();
        assertEq(choir.noteCount(0), 2);
        assertEq(token.balanceOf(choir.DEAD()), 100 ether);
        assertEq(token.balanceOf(alice), 900 ether);
        assertTrue(choir.encored(0, 1));
        assertEq(choir.voices(), 2);
        // an encore is not a new singer and does not change the streak
        (uint32 total,, uint16 streak,) = choir.stats(1);
        assertEq(total, 1);
        assertEq(streak, 1);
    }

    function test_encoreNeedsASongFirst() public {
        _fund(alice);
        vm.prank(alice);
        vm.expectRevert(ChogChoir.SingFirst.selector);
        choir.encore(1, 0, 0);
    }

    function test_onlyOneEncorePerRound() public {
        _fund(alice);
        vm.startPrank(alice);
        choir.place(1, 0, 0);
        choir.encore(1, 1, 1);
        vm.expectRevert(ChogChoir.AlreadyEncored.selector);
        choir.encore(1, 2, 2);
        vm.stopPrank();
    }

    function test_encoreIsOwnerOnlyAndNeedsFunds() public {
        _fund(alice);
        vm.prank(alice);
        choir.place(1, 0, 0);
        _fund(bob);
        vm.prank(bob);
        vm.expectRevert(ChogChoir.NotYourChog.selector);
        choir.encore(1, 1, 1);
        // alice spends her tokens elsewhere, then cannot pay
        vm.startPrank(alice);
        token.transfer(bob, 1000 ether);
        vm.expectRevert(); // ERC20InsufficientBalance
        choir.encore(1, 1, 1);
        vm.stopPrank();
        assertFalse(choir.encored(0, 1));
    }

    function test_encoreCanBeSwitchedOff() public {
        ChogChoir plain = new ChogChoir(address(nft), EPOCH, address(0), 0);
        vm.startPrank(alice);
        plain.place(1, 0, 0);
        vm.expectRevert(ChogChoir.EncoreOff.selector);
        plain.encore(1, 1, 1);
        vm.stopPrank();
    }

    function test_sealCoversEncoreNotes() public {
        _fund(alice);
        vm.startPrank(alice);
        choir.place(1, 0, 0);
        choir.encore(1, 8, 4);
        vm.stopPrank();
        vm.warp(block.timestamp + EPOCH);
        choir.seal(0);
        assertEq(choir.notesOf(0).length, 2);
    }
}
