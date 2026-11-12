import { ethers } from 'ethers';
import { nftGate } from './rules.js';

// NFT watcher: polls known contracts for a mint window opening.
// This covers the common free-mint shape seen on BSC Agent ID projects:
// mint() with no arguments, or mint(uint256), with a mintOpen-style flag.
// Contracts differ, so each entry in NFT_CONTRACTS must be verified
// against that project's own guide before it is added here. Unknown
// contracts are skipped, never guessed.
const GENERIC_ABI = [
  'function mintOpen() view returns (bool)',
  'function mintPrice() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function maxSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
];

export async function checkNftContract({ provider, contractAddress, walletAddress, limits }) {
  const contract = new ethers.Contract(contractAddress, GENERIC_ABI, provider);
  try {
    const [mintOpen, price, totalSupply, maxSupply, balance] = await Promise.allSettled([
      contract.mintOpen(),
      contract.mintPrice(),
      contract.totalSupply(),
      contract.maxSupply(),
      contract.balanceOf(walletAddress),
    ]);
    const info = {
      mintOpen: mintOpen.status === 'fulfilled' ? mintOpen.value : false,
      priceBnb: price.status === 'fulfilled' ? Number(ethers.formatEther(price.value)) : null,
      remaining:
        totalSupply.status === 'fulfilled' && maxSupply.status === 'fulfilled'
          ? Number(maxSupply.value - totalSupply.value)
          : null,
      alreadyOwns: balance.status === 'fulfilled' ? balance.value > 0n : false,
    };
    const gate = nftGate({ info, limits: { ...limits, maxMintPriceBnb: 0 } });
    return { info, gate };
  } catch (err) {
    return { info: null, gate: { pass: false, reasons: [`contract read failed: ${err.shortMessage || err.message}`] } };
  }
}

export function startNftPolling({ provider, contracts, walletAddress, limits, onOpen, intervalMs = 15000 }) {
  if (!contracts.length) {
    console.log('No NFT_CONTRACTS set; NFT watcher idle.');
    return null;
  }
  console.log(`Polling ${contracts.length} NFT contract(s) every ${intervalMs}ms`);
  const timer = setInterval(async () => {
    for (const address of contracts) {
      const { info, gate } = await checkNftContract({ provider, contractAddress: address, walletAddress, limits });
      if (gate.pass) {
        console.log(`NFT mint open and passing gate: ${address}`, info);
        onOpen({ contractAddress: address, info });
      } else {
        console.log(`NFT ${address}: not passing gate: ${gate.reasons.join('; ')}`);
      }
    }
  }, intervalMs);
  return timer;
}
