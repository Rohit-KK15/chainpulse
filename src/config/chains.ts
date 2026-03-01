export interface ChainConfig {
  id: string;
  name: string;
  abbr: string;
  chainId: number;
  rpcWs: string;
  rpcHttp: string;
  nativeCurrency: string;
  blockTime: number;
  explorerTx: string;
  color: {
    primary: string;
    secondary: string;
    accent: string;
  };
  whaleThreshold: number;
  coingeckoPlatformId: string | null;
  center: [number, number, number];
}

interface ChainDef {
  id: string;
  name: string;
  abbr: string;
  chainId: number;
  rpcWs: string;
  rpcHttp: string;
  nativeCurrency: string;
  blockTime: number;
  explorerTx: string;
  color: {
    primary: string;
    secondary: string;
    accent: string;
  };
  whaleThreshold: number;
  coingeckoPlatformId: string | null;
}

// Define chains without centers — positions are auto-calculated
const CHAIN_DEFS: ChainDef[] = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    abbr: 'ETH',
    chainId: 1,
    rpcWs: 'wss://ethereum-rpc.publicnode.com',
    rpcHttp: 'https://ethereum-rpc.publicnode.com',
    nativeCurrency: 'ETH',
    blockTime: 12,
    explorerTx: 'https://etherscan.io/tx/',
    color: {
      primary: '#627EEA',
      secondary: '#8B9FEF',
      accent: '#C0CCFF',
    },
    whaleThreshold: 5,
    coingeckoPlatformId: 'ethereum',
  },
  {
    id: 'polygon',
    name: 'Polygon',
    abbr: 'POLY',
    chainId: 137,
    rpcWs: 'wss://polygon-bor-rpc.publicnode.com',
    rpcHttp: 'https://polygon-bor-rpc.publicnode.com',
    nativeCurrency: 'MATIC',
    blockTime: 2,
    explorerTx: 'https://polygonscan.com/tx/',
    color: {
      primary: '#8247E5',
      secondary: '#A77BF0',
      accent: '#D4B8FF',
    },
    whaleThreshold: 25000,
    coingeckoPlatformId: 'polygon-pos',
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    abbr: 'ARB',
    chainId: 42161,
    rpcWs: 'wss://arbitrum-one-rpc.publicnode.com',
    rpcHttp: 'https://arbitrum-one-rpc.publicnode.com',
    nativeCurrency: 'ETH',
    blockTime: 0.25,
    explorerTx: 'https://arbiscan.io/tx/',
    color: {
      primary: '#28A0F0',
      secondary: '#5BB8F5',
      accent: '#96D4FF',
    },
    whaleThreshold: 5,
    coingeckoPlatformId: 'arbitrum-one',
  },
  {
    id: 'base',
    name: 'Base',
    abbr: 'BASE',
    chainId: 8453,
    rpcWs: 'wss://base-rpc.publicnode.com',
    rpcHttp: 'https://base-rpc.publicnode.com',
    nativeCurrency: 'ETH',
    blockTime: 2,
    explorerTx: 'https://basescan.org/tx/',
    color: {
      primary: '#0052FF',
      secondary: '#3378FF',
      accent: '#80B3FF',
    },
    whaleThreshold: 5,
    coingeckoPlatformId: 'base',
  },
  {
    id: 'optimism',
    name: 'Optimism',
    abbr: 'OP',
    chainId: 10,
    rpcWs: 'wss://optimism-rpc.publicnode.com',
    rpcHttp: 'https://optimism-rpc.publicnode.com',
    nativeCurrency: 'ETH',
    blockTime: 2,
    explorerTx: 'https://optimistic.etherscan.io/tx/',
    color: {
      primary: '#FF0420',
      secondary: '#FF3B50',
      accent: '#FF8090',
    },
    whaleThreshold: 5,
    coingeckoPlatformId: 'optimistic-ethereum',
  },
  {
    id: 'avalanche',
    name: 'Avalanche',
    abbr: 'AVAX',
    chainId: 43114,
    rpcWs: 'wss://avalanche-c-chain-rpc.publicnode.com',
    rpcHttp: 'https://avalanche-c-chain-rpc.publicnode.com',
    nativeCurrency: 'AVAX',
    blockTime: 2,
    explorerTx: 'https://snowtrace.io/tx/',
    color: {
      primary: '#E84142',
      secondary: '#EE6A6B',
      accent: '#F5A0A0',
    },
    whaleThreshold: 50,
    coingeckoPlatformId: 'avalanche',
  },
  {
    id: 'bsc',
    name: 'BSC',
    abbr: 'BSC',
    chainId: 56,
    rpcWs: 'wss://bsc-rpc.publicnode.com',
    rpcHttp: 'https://bsc-rpc.publicnode.com',
    nativeCurrency: 'BNB',
    blockTime: 3,
    explorerTx: 'https://bscscan.com/tx/',
    color: {
      primary: '#F0B90B',
      secondary: '#F5CC3D',
      accent: '#F9E080',
    },
    whaleThreshold: 10,
    coingeckoPlatformId: 'binance-smart-chain',
  },
];

// Auto-position chains in a circle on the XY plane
function computeCenters(defs: ChainDef[]): Record<string, ChainConfig> {
  const n = defs.length;
  const radius = n === 1 ? 0 : Math.max(4.2, n * 0.8);
  const result: Record<string, ChainConfig> = {};

  for (let i = 0; i < n; i++) {
    // Start from top (pi/2) and go clockwise
    const angle = (Math.PI / 2) + (2 * Math.PI * i) / n;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    result[defs[i].id] = {
      ...defs[i],
      center: [
        Math.round(x * 10) / 10,
        Math.round(y * 10) / 10,
        0,
      ],
    };
  }

  return result;
}

export const CHAINS: Record<string, ChainConfig> = computeCenters(CHAIN_DEFS);

export const DEFAULT_CHAIN = 'ethereum';
