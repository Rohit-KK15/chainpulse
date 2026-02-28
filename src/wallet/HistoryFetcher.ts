import { CHAINS } from '../config/chains';
import type { RawTransaction } from '../data/types';

const EXPLORER_APIS: Record<string, string> = {
  ethereum: 'https://api.etherscan.io/api',
  polygon: 'https://api.polygonscan.com/api',
  arbitrum: 'https://api.arbiscan.io/api',
};

interface EtherscanTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gas: string;
  blockNumber: string;
  timeStamp: string;
}

export async function fetchHistory(
  walletAddress: string,
  chainId: string,
  page = 1,
  pageSize = 50,
): Promise<RawTransaction[]> {
  const apiBase = EXPLORER_APIS[chainId];
  if (!apiBase) return [];

  const url = `${apiBase}?module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&page=${page}&offset=${pageSize}&sort=desc`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status !== '1' || !Array.isArray(data.result)) return [];

    return (data.result as EtherscanTx[]).map((tx) => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to || null,
      value: BigInt(tx.value),
      gasPrice: BigInt(tx.gasPrice || '0'),
      gasLimit: BigInt(tx.gas || '21000'),
      blockNumber: parseInt(tx.blockNumber, 10),
      chainId,
      timestamp: parseInt(tx.timeStamp, 10),
    }));
  } catch {
    return [];
  }
}

export async function fetchAllChainHistory(
  walletAddress: string,
): Promise<RawTransaction[]> {
  const chainIds = Object.keys(CHAINS);
  const results = await Promise.allSettled(
    chainIds.map((chainId) => fetchHistory(walletAddress, chainId)),
  );

  const allTxs: RawTransaction[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allTxs.push(...result.value);
    }
  }

  // Sort by timestamp ascending for replay
  allTxs.sort((a, b) => a.timestamp - b.timestamp);
  return allTxs;
}
