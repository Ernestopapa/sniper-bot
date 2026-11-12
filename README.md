# BSC Launch Sniper

A BNB Smart Chain launch sniper — PairCreated listener, mint-window poller, filters and a tranche seller.

## What this is

A small Node/ethers v6 bot that watches PancakeSwap for new pairs and NFT mints, simulates, and (only in live mode) executes.

## Status

Ships in `DRY_RUN` mode. Live trading needs `DRY_RUN=false`, `LIVE_TRADING=true` and `CONFIRM_LIVE=I_UNDERSTAND_RISK`, plus a dedicated snipe wallet. Never commit a real `.env`.
