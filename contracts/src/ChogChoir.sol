// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IChogOwner {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @title Chog Choir
/// @notice One shared loop per epoch. Every Chog may add exactly one note to it per epoch, and only
///         its current owner can place it. When the epoch is over anyone can seal it: the loop is
///         frozen into a track hash and listed in the archive.
/// @dev    The NFT is a constructor argument. On Monad mainnet it is the real Chog Genesis
///         collection; on testnet it is `ChogReplica`. Nothing else in here knows the difference.
contract ChogChoir {
    uint8 public constant STEPS = 16;
    uint8 public constant PITCHES = 12;
    uint8 public constant MODES = 5;

    IChogOwner public immutable chog;
    uint64 public immutable epochSeconds;
    uint64 public immutable startTime;

    /// notes are packed as tokenId << 16 | step << 8 | pitch
    mapping(uint256 epoch => uint32[]) private _notes;
    mapping(uint256 epoch => mapping(uint16 tokenId => bool)) public hasSung;
    mapping(uint256 epoch => bytes32) public trackHash;
    mapping(uint256 epoch => address) public sealedBy;
    uint256[] private _sealed;

    event NotePlaced(uint256 indexed epoch, uint16 indexed tokenId, address indexed singer, uint8 step, uint8 pitch);
    event Sealed(uint256 indexed epoch, bytes32 trackHash, uint256 voices, address indexed sealedBy);

    error NotYourChog();
    error AlreadySang();
    error OutOfRange();
    error EpochNotOver();
    error AlreadySealed();
    error Silent();

    constructor(address chog_, uint64 epochSeconds_) {
        require(chog_ != address(0) && epochSeconds_ > 0, "bad args");
        chog = IChogOwner(chog_);
        epochSeconds = epochSeconds_;
        startTime = uint64(block.timestamp);
    }

    // ───────────────────────────── singing ─────────────────────────────

    /// @notice Add this Chog's one note to the current loop.
    function place(uint16 tokenId, uint8 step, uint8 pitch) external {
        if (step >= STEPS || pitch >= PITCHES) revert OutOfRange();
        if (chog.ownerOf(tokenId) != msg.sender) revert NotYourChog();
        uint256 epoch = currentEpoch();
        if (hasSung[epoch][tokenId]) revert AlreadySang();

        hasSung[epoch][tokenId] = true;
        _notes[epoch].push(pack(tokenId, step, pitch));
        emit NotePlaced(epoch, tokenId, msg.sender, step, pitch);
    }

    /// @notice Freeze a finished epoch into the archive. Anyone can call it.
    function seal(uint256 epoch) external {
        if (epoch >= currentEpoch()) revert EpochNotOver();
        if (sealedBy[epoch] != address(0)) revert AlreadySealed();
        uint32[] memory n = _notes[epoch];
        if (n.length == 0) revert Silent();

        bytes32 h = keccak256(abi.encode(n));
        trackHash[epoch] = h;
        sealedBy[epoch] = msg.sender;
        _sealed.push(epoch);
        emit Sealed(epoch, h, n.length, msg.sender);
    }

    // ───────────────────────────── reading ─────────────────────────────

    function currentEpoch() public view returns (uint256) {
        return (block.timestamp - startTime) / epochSeconds;
    }

    function epochStart(uint256 epoch) public view returns (uint256) {
        return startTime + epoch * epochSeconds;
    }

    /// @notice Every epoch is sung in its own key. Same rule the front end uses.
    function epochKey(uint256 epoch) public pure returns (uint8 root, uint8 mode) {
        uint256 h = uint256(keccak256(abi.encode(epoch, "chog-choir")));
        root = uint8(h % 12);
        mode = uint8((h >> 8) % MODES);
    }

    function notesOf(uint256 epoch) external view returns (uint32[] memory) {
        return _notes[epoch];
    }

    function noteCount(uint256 epoch) external view returns (uint256) {
        return _notes[epoch].length;
    }

    function sealedEpochs() external view returns (uint256[] memory) {
        return _sealed;
    }

    function sealedCount() external view returns (uint256) {
        return _sealed.length;
    }

    function pack(uint16 tokenId, uint8 step, uint8 pitch) public pure returns (uint32) {
        return (uint32(tokenId) << 16) | (uint32(step) << 8) | uint32(pitch);
    }
}
