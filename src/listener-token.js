import { ethers } from 'ethers';

// Token listener: watches PancakeSwap V2 Factory PairCreated events.
// A pair is only interesting if one side is WBNB. Everything else is
// handed to the filter gate in index.js; this file never buys on its own.
const FACTORY_ABI = [
  'event PairCreated(address indexed token0, address indexed token1, address pair, uint256)',
];

export function watchNewPairs({ wsProvider, factoryAddress, wbnb, onPair }) {
  const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, wsProvider);
  factory.on('PairCreated', (token0, token1, pair, event) => {
    const isWbnbPair =
      token0.toLowerCase() === wbnb.toLowerCase() ||
      token1.toLowerCase() === wbnb.toLowerCase();
    if (!isWbnbPair) return;
    const token = token0.toLowerCase() === wbnb.toLowerCase() ? token1 : token0;
    console.log(`New WBNB pair: token=${token} pair=${pair} block=${event?.log?.blockNumber}`);
    onPair({ token, pair });
  });
  console.log('Watching PairCreated on factory', factoryAddress);
  return factory;
}
