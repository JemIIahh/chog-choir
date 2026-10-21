import { parseAbi } from 'viem'

export const choirAbi = parseAbi([
  'function chog() view returns (address)',
  'function epochSeconds() view returns (uint64)',
  'function startTime() view returns (uint64)',
  'function currentEpoch() view returns (uint256)',
  'function epochStart(uint256 epoch) view returns (uint256)',
  'function notesOf(uint256 epoch) view returns (uint32[])',
  'function hasSung(uint256 epoch, uint16 tokenId) view returns (bool)',
  'function noteCount(uint256 epoch) view returns (uint256)',
  'function sealedEpochs() view returns (uint256[])',
  'function sealedBy(uint256 epoch) view returns (address)',
  'function trackHash(uint256 epoch) view returns (bytes32)',
  'function place(uint16 tokenId, uint8 step, uint8 pitch)',
  'function seal(uint256 epoch)',
  'error NotYourChog()',
  'error AlreadySang()',
  'error OutOfRange()',
  'error EpochNotOver()',
  'error AlreadySealed()',
  'error Silent()',
])

export const nftAbi = parseAbi([
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function claim(uint256 id)',
])
