import { create } from 'zustand';
import type { ProcessedTransaction } from '../data/types';

export interface InspectedTx {
  hash: string;
  from: string;
  to: string | null;
  value: number;
  gasPrice: number;
  chainId: string;
  timestamp: number;
  screenX: number;
  screenY: number;
}

interface AppState {
  // null = all chains equally visible, string = that chain highlighted
  focusedChain: string | null;
  setFocusedChain: (chain: string | null) => void;

  isSimulation: boolean;
  setSimulation: (sim: boolean) => void;

  chainConnected: Record<string, boolean>;
  setChainConnected: (chainId: string, connected: boolean) => void;

  txCount: number;
  incrementTxCount: (n: number) => void;
  resetTxCount: () => void;

  latestBlocks: Record<string, number>;
  setLatestBlock: (chainId: string, block: number) => void;

  gasPrices: number[];
  addGasPrices: (prices: number[]) => void;

  recentWhales: ProcessedTransaction[];
  addWhale: (tx: ProcessedTransaction) => void;
  clearWhales: () => void;

  inspectedTx: InspectedTx | null;
  setInspectedTx: (tx: InspectedTx | null) => void;
}

const MAX_RECENT_WHALES = 5;
const MAX_GAS_SAMPLES = 100;

export const useStore = create<AppState>((set) => ({
  focusedChain: null,
  setFocusedChain: (chain) => set({ focusedChain: chain }),

  isSimulation: true,
  setSimulation: (sim) => set({ isSimulation: sim }),

  chainConnected: {},
  setChainConnected: (chainId, connected) =>
    set((s) => ({
      chainConnected: { ...s.chainConnected, [chainId]: connected },
    })),

  txCount: 0,
  incrementTxCount: (n) => set((s) => ({ txCount: s.txCount + n })),
  resetTxCount: () => set({ txCount: 0 }),

  latestBlocks: {},
  setLatestBlock: (chainId, block) =>
    set((s) => ({
      latestBlocks: { ...s.latestBlocks, [chainId]: block },
    })),

  gasPrices: [],
  addGasPrices: (prices) =>
    set((s) => ({
      gasPrices: [...s.gasPrices, ...prices].slice(-MAX_GAS_SAMPLES),
    })),

  recentWhales: [],
  addWhale: (tx) =>
    set((s) => ({
      recentWhales: [tx, ...s.recentWhales].slice(0, MAX_RECENT_WHALES),
    })),
  clearWhales: () => set({ recentWhales: [] }),

  inspectedTx: null,
  setInspectedTx: (tx) => set({ inspectedTx: tx }),
}));
