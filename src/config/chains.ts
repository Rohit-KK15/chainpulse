export interface ChainConfig {
  id: string;
  name: string;
  chainId: number;
  rpcWs: string;
  rpcHttp: string;
  nativeCurrency: string;
  blockTime: number;
  color: {
    primary: string;
    secondary: string;
    accent: string;
  };
  whaleThreshold: number;
  center: [number, number, number];
}

export const CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    rpcWs: 'wss://ethereum-rpc.publicnode.com',
    rpcHttp: 'https://ethereum-rpc.publicnode.com',
    nativeCurrency: 'ETH',
    blockTime: 12,
    color: {
      primary: '#627EEA',
      secondary: '#8B9FEF',
      accent: '#C0CCFF',
    },
    whaleThreshold: 5,
    center: [0, 3.5, 0],
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    chainId: 137,
    rpcWs: 'wss://polygon-bor-rpc.publicnode.com',
    rpcHttp: 'https://polygon-bor-rpc.publicnode.com',
    nativeCurrency: 'MATIC',
    blockTime: 2,
    color: {
      primary: '#8247E5',
      secondary: '#A77BF0',
      accent: '#D4B8FF',
    },
    whaleThreshold: 25000,
    center: [-5, -2.5, 0],
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum',
    chainId: 42161,
    rpcWs: 'wss://arbitrum-one-rpc.publicnode.com',
    rpcHttp: 'https://arbitrum-one-rpc.publicnode.com',
    nativeCurrency: 'ETH',
    blockTime: 0.25,
    color: {
      primary: '#28A0F0',
      secondary: '#5BB8F5',
      accent: '#96D4FF',
    },
    whaleThreshold: 5,
    center: [5, -2.5, 0],
  },
};

export const DEFAULT_CHAIN = 'ethereum';
