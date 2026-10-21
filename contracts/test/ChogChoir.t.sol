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
        // a real burn: the tokens are gone from circulation, not parked somewhere
        assertEq(token.balanceOf(address(choir)), 0);
        assertEq(token.balanceOf(alice), 900 ether);
        assertEq(token.totalSupply(), 900 ether);
        assertEq(choir.totalBurned(), 100 ether);
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

    // ───────────── real burn, totals, edge cases ─────────────

    function test_totalBurnedAddsUpAcrossEncores() public {
        _fund(alice);
        vm.startPrank(alice);
        choir.place(1, 0, 0);
        choir.place(2, 1, 1);
        choir.encore(1, 2, 2);
        choir.encore(2, 3, 3);
        vm.stopPrank();
        assertEq(choir.totalBurned(), 200 ether);
        assertEq(token.totalSupply(), 800 ether);
    }

    function test_encoreWithoutApprovalChangesNothing() public {
        vm.startPrank(alice);
        token.faucet(); // funded, but never approved the choir
        choir.place(1, 0, 0);
        vm.expectRevert(); // ERC20InsufficientAllowance
        choir.encore(1, 1, 1);
        vm.stopPrank();
        assertFalse(choir.encored(0, 1));
        assertEq(choir.noteCount(0), 1);
        assertEq(choir.totalBurned(), 0);
        assertEq(token.balanceOf(alice), 1000 ether);
    }

    function test_encoreExactApprovalIsEnough() public {
        vm.startPrank(alice);
        token.faucet();
        token.approve(address(choir), 100 ether); // exactly the price, not unlimited
        choir.place(1, 0, 0);
        choir.encore(1, 1, 1);
        vm.stopPrank();
        assertEq(token.allowance(alice, address(choir)), 0);
    }

    function test_encoreRevertsIfTokenSaysNo() public {
        ChogChoir picky = new ChogChoir(address(nft), EPOCH, address(new RefusingToken()), 100 ether);
        vm.startPrank(alice);
        picky.place(1, 0, 0);
        vm.expectRevert(ChogChoir.BurnFailed.selector);
        picky.encore(1, 1, 1);
        vm.stopPrank();
        assertEq(picky.noteCount(0), 1);
        assertEq(picky.totalBurned(), 0);
    }

    function test_encoreRevertsIfBurnFails() public {
        ChogChoir stuck = new ChogChoir(address(nft), EPOCH, address(new UnburnableToken()), 100 ether);
        vm.startPrank(alice);
        stuck.place(1, 0, 0);
        vm.expectRevert(bytes("no burn"));
        stuck.encore(1, 1, 1);
        vm.stopPrank();
        assertFalse(stuck.encored(0, 1));
        assertEq(stuck.totalBurned(), 0);
    }

    // ───────────── placeMany ─────────────

    function _batch(uint16 a, uint16 b) internal pure returns (uint16[] memory ids, uint8[] memory steps, uint8[] memory pitches) {
        ids = new uint16[](2);
        steps = new uint8[](2);
        pitches = new uint8[](2);
        ids[0] = a; ids[1] = b;
        steps[0] = 3; steps[1] = 9;
        pitches[0] = 4; pitches[1] = 10;
    }

    function test_placeManySingsForSeveralChogsAtOnce() public {
        (uint16[] memory ids, uint8[] memory steps, uint8[] memory pitches) = _batch(1, 2);
        vm.prank(alice);
        choir.placeMany(ids, steps, pitches);
        assertEq(choir.noteCount(0), 2);
        assertTrue(choir.hasSung(0, 1));
        assertTrue(choir.hasSung(0, 2));
        assertEq(choir.voices(), 2);
        assertEq(choir.singers(), 2);
        uint32[] memory n = choir.notesOf(0);
        assertEq(n[0], choir.pack(1, 3, 4));
        assertEq(n[1], choir.pack(2, 9, 10));
        (uint32 total,, uint16 streak,) = choir.stats(2);
        assertEq(total, 1);
        assertEq(streak, 1);
    }

    function test_placeManyIsAllOrNothing() public {
        (uint16[] memory ids, uint8[] memory steps, uint8[] memory pitches) = _batch(1, 3); // 3 is bob's
        vm.prank(alice);
        vm.expectRevert(ChogChoir.NotYourChog.selector);
        choir.placeMany(ids, steps, pitches);
        assertEq(choir.noteCount(0), 0);
        assertFalse(choir.hasSung(0, 1));
        assertEq(choir.singers(), 0);
    }

    function test_placeManyRejectsAChogThatAlreadySang() public {
        vm.prank(alice);
        choir.place(1, 0, 0);
        (uint16[] memory ids, uint8[] memory steps, uint8[] memory pitches) = _batch(1, 2);
        vm.prank(alice);
        vm.expectRevert(ChogChoir.AlreadySang.selector);
        choir.placeMany(ids, steps, pitches);
        assertEq(choir.noteCount(0), 1);
        assertFalse(choir.hasSung(0, 2));
    }

    function test_placeManyRejectsTheSameChogTwice() public {
        (uint16[] memory ids, uint8[] memory steps, uint8[] memory pitches) = _batch(1, 1);
        vm.prank(alice);
        vm.expectRevert(ChogChoir.AlreadySang.selector);
        choir.placeMany(ids, steps, pitches);
    }

    function test_placeManyChecksShapeAndRange() public {
        uint16[] memory none = new uint16[](0);
        uint8[] memory noneU = new uint8[](0);
        vm.startPrank(alice);
        vm.expectRevert(ChogChoir.BadBatch.selector);
        choir.placeMany(none, noneU, noneU);

        (uint16[] memory ids, uint8[] memory steps, uint8[] memory pitches) = _batch(1, 2);
        uint8[] memory short = new uint8[](1);
        vm.expectRevert(ChogChoir.BadBatch.selector);
        choir.placeMany(ids, short, pitches);
        vm.expectRevert(ChogChoir.BadBatch.selector);
        choir.placeMany(ids, steps, short);

        steps[1] = 16;
        vm.expectRevert(ChogChoir.OutOfRange.selector);
        choir.placeMany(ids, steps, pitches);
        vm.stopPrank();
    }

    function test_placeManyKeepsStreaksPerChog() public {
        (uint16[] memory ids, uint8[] memory steps, uint8[] memory pitches) = _batch(1, 2);
        for (uint256 r = 0; r < 3; r++) {
            vm.prank(alice);
            choir.placeMany(ids, steps, pitches);
            vm.warp(block.timestamp + EPOCH);
        }
        (, , uint16 streak, uint16 best) = choir.stats(1);
        assertEq(streak, 3);
        assertEq(best, 3);
        assertEq(choir.singers(), 2);
        assertEq(choir.voices(), 6);
    }

    function test_placeManyGasForAWhale() public {
        // the biggest holder on mainnet has 73 Chogs; make sure one transaction for 73 stays far below a block
        vm.startPrank(alice);
        for (uint256 i = 10; i < 83; i++) nft.claim(i);
        uint16[] memory ids = new uint16[](73);
        uint8[] memory steps = new uint8[](73);
        uint8[] memory pitches = new uint8[](73);
        for (uint256 i = 0; i < 73; i++) { ids[i] = uint16(10 + i); steps[i] = uint8(i % 16); pitches[i] = uint8(i % 12); }
        uint256 g = gasleft();
        choir.placeMany(ids, steps, pitches);
        uint256 used = g - gasleft();
        vm.stopPrank();
        assertEq(choir.noteCount(0), 73);
        assertLt(used, 12_000_000);
    }

    // ───────────── rounds line up with the clock ─────────────

    function test_roundsStartOnMultiplesOfTheirLength() public {
        vm.warp(1_700_000_123);
        ChogChoir c = new ChogChoir(address(nft), 1 days, address(0), 0);
        assertEq(c.startTime() % 1 days, 0);
        assertEq(c.epochStart(0), c.startTime());
        assertEq(c.epochStart(1) % 1 days, 0);
        assertEq(c.currentEpoch(), 0);
        vm.warp(c.epochStart(1) - 1);
        assertEq(c.currentEpoch(), 0);
        vm.warp(c.epochStart(1));
        assertEq(c.currentEpoch(), 1);
        // an on-the-hour choir deployed exactly on the hour starts a full round straight away
        vm.warp(1_700_000_000 - (1_700_000_000 % 1800));
        ChogChoir h = new ChogChoir(address(nft), 1800, address(0), 0);
        assertEq(h.startTime(), block.timestamp);
    }

    // ───────────── constructor guards ─────────────

    function test_constructorNeedsRealContracts() public {
        vm.expectRevert(ChogChoir.NotAContract.selector);
        new ChogChoir(makeAddr("not a nft"), EPOCH, address(0), 0);
        vm.expectRevert(ChogChoir.NotAContract.selector);
        new ChogChoir(address(nft), EPOCH, makeAddr("not a token"), 100 ether);
        vm.expectRevert(bytes("bad args"));
        new ChogChoir(address(nft), 0, address(0), 0);
        vm.expectRevert(bytes("free encore"));
        new ChogChoir(address(nft), EPOCH, address(token), 0);
    }
}

/// A token that answers `false` instead of reverting when it cannot move funds.
contract RefusingToken {
    function transferFrom(address, address, uint256) external pure returns (bool) { return false; }
    function burn(uint256) external pure {}
}

/// A token whose burn always reverts.
contract UnburnableToken {
    function transferFrom(address, address, uint256) external pure returns (bool) { return true; }
    function burn(uint256) external pure { revert("no burn"); }
}
