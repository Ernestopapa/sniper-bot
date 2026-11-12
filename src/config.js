import 'dotenv/config';
import { existsSync } from 'node:fs';

// All limits in one place. The bot refuses to run live unless every
// live-trading guard below is satisfied on purpose, not by accident.
export const config = {
  rpcWs: process.env.BSC_RPC_URL || '',
  rpcHttp: process.env.BSC_HTTP_URL || 'https://bsc-dataseed.binance.org/',
  privateKey: process.env.SNIPE_PRIVATE_KEY || '',
  dryRun: process.env.DRY_RUN !== 'false',
  liveTrading: process.env.LIVE_TRADING === 'true',
  confirmLive: process.env.CONFIRM_LIVE || '',
  maxBuyBnb: Number(process.env.MAX_BUY_BNB || 0.01),
  maxGasGwei: Number(process.env.MAX_GAS_GWEI || 5),
  maxTaxPercent: Number(process.env.MAX_TAX_PERCENT || 10),
  minLiquidityBnb: Number(process.env.MIN_LIQUIDITY_BNB || 1),
  takeProfit1: Number(process.env.SELL_TAKE_PROFIT_1 || 2),
  takeProfit2: Number(process.env.SELL_TAKE_PROFIT_2 || 5),
  stopLoss: Number(process.env.SELL_STOP_LOSS || 0.65),
  nftContracts: (process.env.NFT_CONTRACTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  factory: process.env.PANCAKE_FACTORY || '0xca143ce32fe78f1f7019d7d551a6402fc5350c73',
  wbnb: process.env.WBNB || '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc381',
  router: process.env.PANCAKE_ROUTER || '0x10ED43C718714eb63d5aA57B78B54704E256024E',
};

export function assertSafeToRun() {
  if (config.dryRun) return { live: false, reason: 'DRY_RUN is on: no real transactions will be sent.' };
  if (!config.liveTrading) throw new Error('Refusing to trade: LIVE_TRADING is not true.');
  if (config.confirmLive !== 'I_UNDERSTAND_RISK') {
    throw new Error('Refusing to trade: set CONFIRM_LIVE=I_UNDERSTAND_RISK explicitly.');
  }
  if (!config.privateKey) throw new Error('Refusing to trade: no SNIPE_PRIVATE_KEY set.');
  return { live: true, reason: 'Live guards passed.' };
}

// Kill switch: if a file named STOP exists next to this project, stop.
// Create it with `touch STOP` to halt the bot immediately.
export function killSwitchActive() {
  return existsSync(new URL('../../STOP', import.meta.url).pathname);
}
