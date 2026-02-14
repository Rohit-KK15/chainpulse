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
}
