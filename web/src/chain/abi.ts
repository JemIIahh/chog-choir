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
  'function stats(uint16 tokenId) view returns (uint32 total, uint32 lastPlusOne, uint16 streak, uint16 best)',
  'function loft(uint256 from, uint256 count) view returns ((uint32 total, uint32 lastPlusOne, uint16 streak, uint16 best)[])',
  'function encorePrice() view returns (uint256)',
  'function voices() view returns (uint256)',
  'function totalBurned() view returns (uint256)',
  'function singers() view returns (uint32)',
  'function encored(uint256 epoch, uint16 tokenId) view returns (bool)',
  'function place(uint16 tokenId, uint8 step, uint8 pitch)',
  'function placeMany(uint16[] ids, uint8[] steps, uint8[] pitches)',
  'function encore(uint16 tokenId, uint8 step, uint8 pitch)',
  'function seal(uint256 epoch)',
  'error NotYourChog()',
  'error AlreadySang()',
  'error OutOfRange()',
  'error EpochNotOver()',
  'error AlreadySealed()',
  'error Silent()',
  'error EncoreOff()',
  'error SingFirst()',
  'error AlreadyEncored()',
  'error BurnFailed()',
  'error BadBatch()',
  'error NotAContract()',
])

export const nftAbi = parseAbi([
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function claim(uint256 id)',
])

export const tokenAbi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function faucet()',
])
