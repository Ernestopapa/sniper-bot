import { ethers } from 'ethers';
import { config, assertSafeToRun, killSwitchActive } from './config.js';
import { watchNewPairs } from './listener-token.js';
import { startNftPolling } from './listener-nft.js';
import { simulateToken } from './filter.js';
import { tokenGate } from './rules.js';
import { buyToken, mintNft } from './executor.js';

// Entry point. Default mode is dry-run: listeners run, gates run, and
// every would-be trade is logged instead of sent.
//
// To run live you must, on purpose:
//   DRY_RUN=false LIVE_TRADING=true CONFIRM_LIVE=I_UNDERSTAND_RISK
// plus a SNIPE_PRIVATE_KEY for a dedicated, limited-funds wallet.
// See README.md before doing that.

async function main() {
  const safety = assertSafeToRun();
  console.log(`Starting BSC launch sniper. ${safety.reason}`);
  console.log(`Dry run: ${config.dryRun}. Max buy: ${config.maxBuyBnb} BNB. Max tax: ${config.maxTaxPercent}%.`);

  if (!config.rpcWs) {
    console.log('No BSC_RPC_URL set. Set a WebSocket RPC in .env to run the live listener.');
    console.log('Try the self-test instead: npm run selftest');
    return;
  }

  const wsProvider = new ethers.WebSocketProvider(config.rpcWs);
  const httpProvider = new ethers.JsonRpcProvider(config.rpcHttp);
  const wallet = config.privateKey ? new ethers.Wallet(config.privateKey, httpProvider) : null;
  if (wallet) console.log('Snipe wallet:', wallet.address);
  if (!wallet && !config.dryRun) throw new Error('No wallet for live mode.');

  const limits = {
    maxTaxPercent: config.maxTaxPercent,
    minLiquidityBnb: config.minLiquidityBnb,
  };

  // Token path: PairCreated -> simulate -> gate -> (dry-run) buy log.
  watchNewPairs({
    wsProvider,
    factoryAddress: config.factory,
    wbnb: config.wbnb,
    onPair: async ({ token, pair }) => {
      if (killSwitchActive()) {
        console.log('STOP file present; skipping trade.');
        return;
      }
      const sim = await simulateToken({
        provider: httpProvider,
        routerAddress: config.router,
        wbnb: config.wbnb,
        token,
        buyBnb: config.maxBuyBnb,
        limits,
      });
      // Liquidity must be measured from the pair reserves before live use.
      // The skeleton reports the gate with liquidity unknown, so it will
      // correctly refuse to pass a live trade until that check is added.
      const gate = tokenGate({ sim, liquidityBnb: 0, limits });
      console.log(`Token ${token}: sim=${JSON.stringify(sim)} gate pass=${gate.pass} reasons=${gate.reasons.join('; ')}`);
      if (!gate.pass) return;
      await buyToken({
        provider: httpProvider,
        wallet,
        routerAddress: config.router,
        wbnb: config.wbnb,
        token,
        buyBnb: config.maxBuyBnb,
        slippagePercent: 5,
        dryRun: config.dryRun,
      });
    },
  });

  // NFT path: poll known contracts -> gate -> (dry-run) mint log.
  // The mint calldata is contract-specific and must be supplied per
  // project after verifying it against that project's own guide.
  startNftPolling({
    provider: httpProvider,
    contracts: config.nftContracts,
    walletAddress: wallet?.address || ethers.ZeroAddress,
    limits,
    onOpen: async ({ contractAddress }) => {
      if (killSwitchActive()) {
        console.log('STOP file present; skipping mint.');
        return;
      }
      console.log(`NFT mint gate passed for ${contractAddress}. Mint calldata must be set per-project before live minting.`);
      await mintNft({
        wallet,
        contractAddress,
        mintCalldata: '0x',
        valueBnb: 0,
        dryRun: config.dryRun,
      });
    },
  });

  console.log('Sniper running. Create a file named STOP in the project folder to halt it.');
}

main().catch((err) => {
  console.error('Sniper failed:', err);
  process.exit(1);
});
