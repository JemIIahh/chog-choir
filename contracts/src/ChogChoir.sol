// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IChogOwner {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IERC20Burnable {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function burn(uint256 amount) external;
}

/// @title Chog Choir
/// @notice One shared loop per epoch. Every Chog may add exactly one note to it per epoch, and only
///         its current owner can place it. When the epoch is over anyone can seal it: the loop is
///         frozen into a track hash and listed in the archive.
/// @dev    The NFT is a constructor argument. On Monad mainnet it is the real Chog Genesis
///         collection; on testnet it is `ChogReplica`. Nothing else in here knows the difference.
///         A Chog that has already sung can take an encore: burn `encorePrice` of $CHOG for a second note.
///         The burn is a real `burn()`, so the token's total supply goes down by exactly what the choir burned.
contract ChogChoir {
    uint8 public constant STEPS = 16;
    uint8 public constant PITCHES = 12;
    uint8 public constant MODES = 5;

    IChogOwner public immutable chog;
    IERC20Burnable public immutable chogToken; // address(0) turns encores off
    uint256 public immutable encorePrice;
    uint64 public immutable epochSeconds;
    uint64 public immutable startTime;

    /// One slot per Chog: how often it has sung, when it last did, and its run of consecutive rounds.
    struct Stat {
        uint32 total;
        uint32 lastPlusOne; // last round sung + 1, so 0 means never
        uint16 streak;
        uint16 best;
    }
    mapping(uint16 tokenId => Stat) public stats;
    mapping(uint256 epoch => mapping(uint16 tokenId => bool)) public encored;
    uint256 public voices; // every note ever placed, encores included
    uint32 public singers; // distinct Chogs that have sung at least once
    uint256 public totalBurned; // $CHOG burned by encores, in the token's smallest unit

    /// notes are packed as tokenId << 16 | step << 8 | pitch
    mapping(uint256 epoch => uint32[]) private _notes;
    mapping(uint256 epoch => mapping(uint16 tokenId => bool)) public hasSung;
    mapping(uint256 epoch => bytes32) public trackHash;
    mapping(uint256 epoch => address) public sealedBy;
    uint256[] private _sealed;

    event NotePlaced(uint256 indexed epoch, uint16 indexed tokenId, address indexed singer, uint8 step, uint8 pitch);
    event Encore(uint256 indexed epoch, uint16 indexed tokenId, address indexed singer, uint8 step, uint8 pitch, uint256 burned);
    event Sealed(uint256 indexed epoch, bytes32 trackHash, uint256 voices, address indexed sealedBy);

    error NotYourChog();
    error AlreadySang();
    error OutOfRange();
    error EpochNotOver();
    error AlreadySealed();
    error Silent();
    error EncoreOff();
    error SingFirst();
    error AlreadyEncored();
    error BurnFailed();
    error BadBatch();
    error NotAContract();

    constructor(address chog_, uint64 epochSeconds_, address token_, uint256 encorePrice_) {
        require(epochSeconds_ > 0, "bad args");
        require(token_ == address(0) || encorePrice_ > 0, "free encore");
        if (chog_.code.length == 0 || (token_ != address(0) && token_.code.length == 0)) revert NotAContract();
        chog = IChogOwner(chog_);
        chogToken = IERC20Burnable(token_);
        encorePrice = encorePrice_;
        epochSeconds = epochSeconds_;
        // rounds start on multiples of their length (a one-day round turns over at 00:00 UTC), so "ends in 3:12:00" reads naturally.
        // The first round is simply shorter than the rest.
        startTime = uint64(block.timestamp - (block.timestamp % epochSeconds_));
    }

    // ───────────────────────────── singing ─────────────────────────────

    /// @notice Add this Chog's one note to the current loop.
    function place(uint16 tokenId, uint8 step, uint8 pitch) external {
        _place(currentEpoch(), tokenId, step, pitch);
    }

    /// @notice Add one note for each of several Chogs in a single transaction. All or nothing: if any Chog is not yours
    ///         or has already sung this round, the whole batch reverts.
    function placeMany(uint16[] calldata ids, uint8[] calldata steps, uint8[] calldata pitches) external {
        uint256 n = ids.length;
        if (n == 0 || n != steps.length || n != pitches.length) revert BadBatch();
        uint256 epoch = currentEpoch();
        for (uint256 i = 0; i < n; i++) _place(epoch, ids[i], steps[i], pitches[i]);
    }

    function _place(uint256 epoch, uint16 tokenId, uint8 step, uint8 pitch) internal {
        if (step >= STEPS || pitch >= PITCHES) revert OutOfRange();
        if (chog.ownerOf(tokenId) != msg.sender) revert NotYourChog();
        if (hasSung[epoch][tokenId]) revert AlreadySang();

        hasSung[epoch][tokenId] = true;
        _notes[epoch].push(pack(tokenId, step, pitch));

        Stat storage st = stats[tokenId];
        if (st.total == 0) singers++;
        st.streak = st.lastPlusOne == epoch ? st.streak + 1 : 1; // sung last round too?
        if (st.streak > st.best) st.best = st.streak;
        st.total++;
        st.lastPlusOne = uint32(epoch + 1);
        voices++;

        emit NotePlaced(epoch, tokenId, msg.sender, step, pitch);
    }

    /// @notice A Chog that already sang this round burns $CHOG to sing a second note.
    function encore(uint16 tokenId, uint8 step, uint8 pitch) external {
        if (address(chogToken) == address(0)) revert EncoreOff();
        if (step >= STEPS || pitch >= PITCHES) revert OutOfRange();
        if (chog.ownerOf(tokenId) != msg.sender) revert NotYourChog();
        uint256 epoch = currentEpoch();
        if (!hasSung[epoch][tokenId]) revert SingFirst();
        if (encored[epoch][tokenId]) revert AlreadyEncored();

        encored[epoch][tokenId] = true;
        _notes[epoch].push(pack(tokenId, step, pitch));
        voices++;
        totalBurned += encorePrice;
        // pull the tokens in, then burn them: the token's total supply drops by exactly `encorePrice`
        if (!chogToken.transferFrom(msg.sender, address(this), encorePrice)) revert BurnFailed();
        chogToken.burn(encorePrice);
        emit Encore(epoch, tokenId, msg.sender, step, pitch, encorePrice);
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

    /// @notice Stats for a range of Chogs in one call, so the loft can draw all 1,969 at once.
    function loft(uint256 from, uint256 count) external view returns (Stat[] memory out) {
        out = new Stat[](count);
        for (uint256 i = 0; i < count; i++) out[i] = stats[uint16(from + i)];
    }

    function pack(uint16 tokenId, uint8 step, uint8 pitch) public pure returns (uint32) {
        return (uint32(tokenId) << 16) | (uint32(step) << 8) | uint32(pitch);
    }
}
