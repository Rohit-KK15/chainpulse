import { JsonRpcProvider, Contract, formatUnits } from 'ethers';
import { CHAINS } from '../config/chains';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

export interface TokenBalance {
  symbol: string;
  balance: number;
  chain: string;
  color: string;
}

// Common tokens to track per chain
const TRACKED_TOKENS: Record<string, { address: string; symbol: string; decimals: number; color: string }[]> = {
  ethereum: [
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6, color: '#2775CA' },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6, color: '#26A17B' },
    { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', decimals: 18, color: '#F5AC37' },
  ],
  polygon: [
    { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', symbol: 'USDC', decimals: 6, color: '#2775CA' },
    { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', decimals: 6, color: '#26A17B' },
  ],
  arbitrum: [
    { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', decimals: 6, color: '#2775CA' },
    { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', decimals: 6, color: '#26A17B' },
  ],
  base: [
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6, color: '#2775CA' },
    { address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', symbol: 'USDT', decimals: 6, color: '#26A17B' },
  ],
  optimism: [
    { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', symbol: 'USDC', decimals: 6, color: '#2775CA' },
    { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', symbol: 'USDT', decimals: 6, color: '#26A17B' },
  ],
  avalanche: [
    { address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', symbol: 'USDC', decimals: 6, color: '#2775CA' },
    { address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', symbol: 'USDT', decimals: 6, color: '#26A17B' },
  ],
  bsc: [
    { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC', decimals: 18, color: '#2775CA' },
    { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', decimals: 18, color: '#26A17B' },
  ],
};

const providerCache = new Map<string, JsonRpcProvider>();

function getProvider(rpcUrl: string): JsonRpcProvider {
  let provider = providerCache.get(rpcUrl);
  if (!provider) {
    provider = new JsonRpcProvider(rpcUrl);
    providerCache.set(rpcUrl, provider);
  }
  return provider;
}

async function fetchChainBalances(chainId: string, walletAddress: string): Promise<TokenBalance[]> {
  const chainConfig = CHAINS[chainId];
  if (!chainConfig) return [];
  const provider = getProvider(chainConfig.rpcHttp);
  const balances: TokenBalance[] = [];

  // Fetch native balance
  try {
    const nativeBalance = await provider.getBalance(walletAddress);
    const formatted = parseFloat(formatUnits(nativeBalance, 18));
    if (formatted > 0.0001) {
      balances.push({
        symbol: chainConfig.nativeCurrency,
        balance: formatted,
        chain: chainId,
        color: chainConfig.color.primary,
      });
    }
  } catch {
    // Skip on error
  }

  // Fetch tracked token balances
  const tokens = TRACKED_TOKENS[chainId] ?? [];
  for (const token of tokens) {
    try {
      const contract = new Contract(token.address, ERC20_ABI, provider);
      const raw = await contract.balanceOf(walletAddress);
      const formatted = parseFloat(formatUnits(raw, token.decimals));
      if (formatted > 0.01) {
        balances.push({
          symbol: token.symbol,
          balance: formatted,
          chain: chainId,
          color: token.color,
        });
      }
    } catch {
      // Skip on error
    }
  }

  return balances;
}

export async function fetchPortfolio(walletAddress: string): Promise<TokenBalance[]> {
  const chainIds = Object.keys(CHAINS);
  const results = await Promise.allSettled(
    chainIds.map((chainId) => fetchChainBalances(chainId, walletAddress)),
  );

  const balances: TokenBalance[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      balances.push(...result.value);
    }
  }
  return balances;
}
