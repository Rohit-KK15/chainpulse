export interface TokenTransfer {
  contractAddress: string;
  from: string;
  to: string;
  rawValue: bigint;
  symbol: string;
  decimals: number;
  color: string;
  isStablecoin: boolean;
}

export interface TokenInfo {
  symbol: string;
  displayValue: number;
  isStablecoin: boolean;
}

export interface RawTransaction {
  hash: string;
  from: string;
  to: string | null;
  value: bigint;
  gasPrice: bigint;
  gasLimit: bigint;
  blockNumber: number;
  chainId: string;
  timestamp: number;
  tokenTransfer?: TokenTransfer;
}

export interface ProcessedTransaction {
  hash: string;
  from: string;
  to: string | null;
  value: number;
  gasPrice: number;
  blockNumber: number;
  chainId: string;
  timestamp: number;
  isWhale: boolean;
  visual: {
    size: number;
    intensity: number;
    heat: number;
    color: [number, number, number];
  };
  tokenInfo?: TokenInfo;
}
