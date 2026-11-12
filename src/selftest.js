// Self-test with mock data only. No network, no wallet, no real money.
// Run: npm run selftest
import { tokenGate, nftGate, sellerAction, taxPercent } from './rules.js';

let failures = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${JSON.stringify(actual)}`);
  if (!ok) failures += 1;
}

// Token gate: honeypot (cannot sell) must fail.
check(
  'token gate rejects unsellable token',
  tokenGate({
    sim: { canBuy: true, canSell: false, taxPercent: 0 },
    liquidityBnb: 10,
    limits: { maxTaxPercent: 10, minLiquidityBnb: 1 },
  }).pass,
  false,
);

// Token gate: clean simulation + enough liquidity must pass.
check(
  'token gate passes clean token',
  tokenGate({
    sim: { canBuy: true, canSell: true, taxPercent: 2 },
    liquidityBnb: 10,
    limits: { maxTaxPercent: 10, minLiquidityBnb: 1 },
  }).pass,
  true,
);

// Token gate: low liquidity must fail.
check(
  'token gate rejects low liquidity',
  tokenGate({
    sim: { canBuy: true, canSell: true, taxPercent: 2 },
    liquidityBnb: 0.1,
    limits: { maxTaxPercent: 10, minLiquidityBnb: 1 },
  }).pass,
  false,
);

// Tax helper.
check('tax helper', taxPercent(100, 90), 10);

// NFT gate: free, open, supply left, not already owned must pass.
check(
  'nft gate passes free open mint',
  nftGate({
    info: { mintOpen: true, priceBnb: 0, remaining: 100, alreadyOwns: false },
    limits: { maxMintPriceBnb: 0 },
  }).pass,
  true,
);

// NFT gate: closed mint must fail.
check(
  'nft gate rejects closed mint',
  nftGate({
    info: { mintOpen: false, priceBnb: 0, remaining: 100, alreadyOwns: false },
    limits: { maxMintPriceBnb: 0 },
  }).pass,
  false,
);

// Seller: 2x sells 50%, 5x sells 25% more, below stop sells all, else hold.
check(
  'seller at 2x',
  sellerAction({ entryPrice: 1, currentPrice: 2, soldTranche1: false, soldTranche2: false, limits: { takeProfit1: 2, takeProfit2: 5, stopLoss: 0.65 } }),
  { action: 'sell', fraction: 0.5, reason: 'take-profit 1: 2.00x' },
);
check(
  'seller at 0.5x',
  sellerAction({ entryPrice: 1, currentPrice: 0.5, soldTranche1: true, soldTranche2: false, limits: { takeProfit1: 2, takeProfit2: 5, stopLoss: 0.65 } }),
  { action: 'sell', fraction: 1, reason: 'stop-loss: 0.50x <= 0.65x' },
);
check(
  'seller holds at 1.5x',
  sellerAction({ entryPrice: 1, currentPrice: 1.5, soldTranche1: false, soldTranche2: false, limits: { takeProfit1: 2, takeProfit2: 5, stopLoss: 0.65 } }),
  { action: 'hold', fraction: 0, reason: '1.50x: no tranche triggered' },
);

if (failures > 0) {
  console.error(`${failures} self-test(s) failed.`);
  process.exit(1);
}
console.log('All self-tests passed.');
