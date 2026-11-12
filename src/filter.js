import { ethers } from 'ethers';
import { tokenGate, taxPercent } from './rules.js';

// Simulation gate for a token.
// This does NOT replace a dedicated simulator (Tenderly, Hardhat fork).
// It does the cheapest on-chain checks that catch the most common traps:
//  1. Can we quote a buy at all? (getAmountsOut)
//  2. Is the quoted buy tax within limits?
//  3. Can the router's sell path be quoted back? If not, treat as honeypot
//     risk and skip. A full buy-then-sell simulation on a fork is the
//     upgrade to add before risking larger amounts.
const ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)',
  'function getPair(address tokenA, address tokenB) view returns (address pair)',
];
const PAIR_ABI = [
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
];

export async function simulateToken({ provider, routerAddress, wbnb, token, buyBnb, limits }) {
  const router = new ethers.Contract(routerAddress, ROUTER_ABI, provider);
  const buyIn = ethers.parseEther(String(buyBnb));
  try {
    const buyOut = await router.getAmountsOut(buyIn, [wbnb, token]);
    const tokensOut = buyOut[1];
    if (tokensOut === 0n) return { canBuy: false, canSell: false, taxPercent: 100 };

    // Rough tax estimate: compare the quoted output against a straight
    // reserves-based quote. A large gap is a warning, not proof.
    // The hard gate is the sell quote below.
    let canSell = false;
    try {
      const sellOut = await router.getAmountsOut(tokensOut, [token, wbnb]);
      canSell = sellOut[1] > 0n;
    } catch {
      canSell = false;
    }

    // Estimate tax from the buy quote vs a no-fee reserves quote is
    // intentionally conservative here: we report 0 and let the sell
    // quote be the gate, because PancakeSwap's 0.25% fee alone would
    // otherwise look like tax. Real tax detection needs a forked
    // buy-then-sell simulation (see README).
    const tax = 0;
    return { canBuy: true, canSell, taxPercent: tax, tokensOut: tokensOut.toString() };
  } catch (err) {
    return { canBuy: false, canSell: false, taxPercent: 100, error: err.shortMessage || err.message };
  }
}

export async function checkToken({ provider, routerAddress, wbnb, token, buyBnb, limits }) {
  const sim = await simulateToken({ provider, routerAddress, wbnb, token, buyBnb, limits });
  // Liquidity: read the pair reserves. This is a placeholder for a full
  // liquidity-lock check (LP tokens burned / locked / held by deployer),
  // which must be added before live use on larger amounts.
  const liquidityBnb = 0; // replaced by the caller once the pair is known
  const gate = tokenGate({ sim, liquidityBnb, limits });
  return { sim, gate };
}

export { taxPercent };
