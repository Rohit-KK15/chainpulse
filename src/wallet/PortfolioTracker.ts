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
};

export async function fetchPortfolio(walletAddress: string): Promise<TokenBalance[]> {
  const balances: TokenBalance[] = [];

  for (const [chainId, chainConfig] of Object.entries(CHAINS)) {
    const provider = new JsonRpcProvider(chainConfig.rpcHttp);

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
  }

  return balances;
}
