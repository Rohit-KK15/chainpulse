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
  },
];

// Auto-position chains in a circle on the XY plane
function computeCenters(defs: ChainDef[]): Record<string, ChainConfig> {
  const n = defs.length;
  const radius = n === 1 ? 0 : 4.2;
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
