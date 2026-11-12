// Pure decision logic, with no network or wallet dependency, so it can be
// unit-tested without an RPC endpoint or a private key.
//
// A candidate passes only if EVERY gate passes. A single failure = skip.
// This is deliberate: in launch sniping, a missed launch costs nothing,
// a bad launch can cost the whole buy.

export function taxPercent(expectedOut, actualOut) {
  if (!expectedOut || expectedOut <= 0) return 100;
  return ((expectedOut - actualOut) / expectedOut) * 100;
}

// Token gate. `sim` is the result of simulating a buy and then a sell
// (see filter.js). All amounts are in the same units.
export function tokenGate({ sim, liquidityBnb, limits }) {
  const reasons = [];
  if (!sim) reasons.push('no simulation result');
  if (sim && !sim.canBuy) reasons.push('buy simulation failed');
  if (sim && !sim.canSell) reasons.push('sell simulation failed (honeypot risk)');
  if (sim && sim.taxPercent > limits.maxTaxPercent) {
    reasons.push(`tax ${sim.taxPercent.toFixed(2)}% exceeds ${limits.maxTaxPercent}%`);
  }
  if (liquidityBnb < limits.minLiquidityBnb) {
    reasons.push(`liquidity ${liquidityBnb} BNB below minimum ${limits.minLiquidityBnb} BNB`);
  }
  return { pass: reasons.length === 0, reasons };
}

// NFT gate. `info` comes from reading the contract directly.
export function nftGate({ info, limits }) {
  const reasons = [];
  if (!info) reasons.push('no contract info');
  if (info && !info.mintOpen) reasons.push('mint is not open');
  if (info && info.priceBnb !== 0 && info.priceBnb > limits.maxMintPriceBnb) {
    reasons.push(`mint price ${info.priceBnb} BNB exceeds ${limits.maxMintPriceBnb} BNB`);
  }
  if (info && info.remaining <= 0) reasons.push('no supply remaining');
  if (info && info.alreadyOwns) reasons.push('wallet already owns one from this contract');
  return { pass: reasons.length === 0, reasons };
}

// Seller: returns what fraction of the remaining position to sell now,
// given entry price and current price. Tranches: 50% at take-profit 1,
// 25% at take-profit 2, 100% at stop-loss. Otherwise hold.
export function sellerAction({ entryPrice, currentPrice, soldTranche1, soldTranche2, limits }) {
  if (!entryPrice || entryPrice <= 0) return { action: 'hold', fraction: 0, reason: 'no entry price' };
  const multiple = currentPrice / entryPrice;
  if (multiple <= limits.stopLoss) {
    return { action: 'sell', fraction: 1, reason: `stop-loss: ${multiple.toFixed(2)}x <= ${limits.stopLoss}x` };
  }
  if (multiple >= limits.takeProfit2 && !soldTranche2) {
    return { action: 'sell', fraction: 0.25, reason: `take-profit 2: ${multiple.toFixed(2)}x` };
  }
  if (multiple >= limits.takeProfit1 && !soldTranche1) {
    return { action: 'sell', fraction: 0.5, reason: `take-profit 1: ${multiple.toFixed(2)}x` };
  }
  return { action: 'hold', fraction: 0, reason: `${multiple.toFixed(2)}x: no tranche triggered` };
}
