import { ethers } from 'ethers';

// Executor. In dry-run mode it logs exactly what WOULD have been sent
// and sends nothing. In live mode it sends through the configured wallet.
// Live mode is only reached if config.assertSafeToRun() passed.
const ROUTER_ABI = [
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)',
];

export async function buyToken({ provider, wallet, routerAddress, wbnb, token, buyBnb, slippagePercent, dryRun }) {
  const log = { kind: 'token-buy', token, buyBnb, slippagePercent, dryRun };
  if (dryRun) {
    console.log('[DRY RUN] would buy token', log);
    return { dryRun: true, ...log };
  }
  const router = new ethers.Contract(routerAddress, ROUTER_ABI, wallet);
  const deadline = Math.floor(Date.now() / 1000) + 60;
  // amountOutMin is intentionally set from a fresh quote by the caller in
  // live code; 0 here would be reckless, so live callers must pass it.
  throw new Error('Live buy requires a caller-supplied amountOutMin; see README. This path is blocked by design in the skeleton.');
}

export async function mintNft({ wallet, contractAddress, mintCalldata, valueBnb, dryRun }) {
  const log = { kind: 'nft-mint', contractAddress, valueBnb, dryRun };
  if (dryRun) {
    console.log('[DRY RUN] would mint NFT', log);
    return { dryRun: true, ...log };
  }
  const tx = await wallet.sendTransaction({
    to: contractAddress,
    data: mintCalldata,
    value: ethers.parseEther(String(valueBnb)),
  });
  console.log('Mint sent:', tx.hash);
  const receipt = await tx.wait();
  console.log('Mint receipt status:', receipt.status);
  return { txHash: tx.hash, status: receipt.status };
}
