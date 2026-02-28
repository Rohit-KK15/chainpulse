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
  blockNumber: number;
  screenX: number;
  screenY: number;
  tokenSymbol?: string;
  isStablecoin?: boolean;
}

export interface WhaleRecord {
  hash: string;
  chainId: string;
  value: number;
  timestamp: number;
  tokenSymbol?: string;
  from: string;
  to: string | null;
}

interface AppState {
  focusedChain: string | null;
  setFocusedChain: (chain: string | null) => void;

  isSimulation: boolean;
  setSimulation: (sim: boolean) => void;

  // Mode transition fade
  transitioning: boolean;
  setTransitioning: (t: boolean) => void;

  // Data initialization flag
  initialized: boolean;
  setInitialized: (v: boolean) => void;

  chainConnected: Record<string, boolean>;
  setChainConnected: (chainId: string, connected: boolean) => void;

  // Tracks chains that fell back to simulation
  chainFailed: Record<string, boolean>;
  setChainFailed: (chainId: string, failed: boolean) => void;

  txCount: number;
  incrementTxCount: (n: number) => void;
  resetTxCount: () => void;

  latestBlocks: Record<string, number>;
  lastBlockTimestamps: Record<string, number>;
  setLatestBlock: (chainId: string, block: number) => void;

  gasPrices: number[];
  avgGas: number;
  addGasPrices: (prices: number[]) => void;

  gasPricesPerChain: Record<string, number[]>;
  avgGasPerChain: Record<string, number>;
  addChainGasPrices: (chainId: string, prices: number[]) => void;

  recentWhales: ProcessedTransaction[];
  addWhale: (tx: ProcessedTransaction) => void;
  clearWhales: () => void;

  // Persisted whale history
  whaleHistory: WhaleRecord[];

  inspectedTx: InspectedTx | null;
  setInspectedTx: (tx: InspectedTx | null) => void;

  whaleThresholdUsd: number;
  setWhaleThresholdUsd: (v: number) => void;
}

const MAX_RECENT_WHALES = 5;
const MAX_GAS_SAMPLES = 100;
const MAX_WHALE_HISTORY = 50;

const STORAGE_KEY = 'chainpulse_prefs';

function loadPrefs(): { isSimulation: boolean; whaleHistory: WhaleRecord[]; whaleThresholdUsd: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        isSimulation: parsed.isSimulation ?? true,
        whaleHistory: Array.isArray(parsed.whaleHistory) ? parsed.whaleHistory.slice(0, MAX_WHALE_HISTORY) : [],
        whaleThresholdUsd: typeof parsed.whaleThresholdUsd === 'number' ? parsed.whaleThresholdUsd : 0,
      };
    }
  } catch { /* ignore */ }
  return { isSimulation: true, whaleHistory: [], whaleThresholdUsd: 0 };
}

function savePrefs(state: { isSimulation: boolean; whaleHistory: WhaleRecord[]; whaleThresholdUsd: number }): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      isSimulation: state.isSimulation,
      whaleHistory: state.whaleHistory,
      whaleThresholdUsd: state.whaleThresholdUsd,
    }));
  } catch { /* ignore */ }
}

const prefs = loadPrefs();

export const useStore = create<AppState>((set, get) => ({
  focusedChain: null,
  setFocusedChain: (chain) => set({ focusedChain: chain }),

  isSimulation: prefs.isSimulation,
  setSimulation: (sim) => {
    set({ isSimulation: sim });
    savePrefs({ isSimulation: sim, whaleHistory: get().whaleHistory, whaleThresholdUsd: get().whaleThresholdUsd });
  },

  transitioning: false,
  setTransitioning: (t) => set({ transitioning: t }),

  initialized: false,
  setInitialized: (v) => set({ initialized: v }),

  chainConnected: {},
  setChainConnected: (chainId, connected) =>
    set((s) => ({
      chainConnected: { ...s.chainConnected, [chainId]: connected },
    })),

  chainFailed: {},
  setChainFailed: (chainId, failed) =>
    set((s) => ({
      chainFailed: { ...s.chainFailed, [chainId]: failed },
    })),

  txCount: 0,
  incrementTxCount: (n) => set((s) => ({ txCount: s.txCount + n })),
  resetTxCount: () => set({ txCount: 0 }),

  latestBlocks: {},
  lastBlockTimestamps: {},
  setLatestBlock: (chainId, block) =>
    set((s) => ({
      latestBlocks: { ...s.latestBlocks, [chainId]: block },
      lastBlockTimestamps: { ...s.lastBlockTimestamps, [chainId]: Date.now() },
    })),

  gasPrices: [],
  avgGas: 0,
  addGasPrices: (prices) =>
    set((s) => {
      const valid = prices.filter((p) => Number.isFinite(p));
      if (valid.length === 0) return s;
      const updated = [...s.gasPrices, ...valid].slice(-MAX_GAS_SAMPLES);
      const avg = updated.length > 0
        ? updated.reduce((a, b) => a + b, 0) / updated.length
        : 0;
      return { gasPrices: updated, avgGas: avg };
    }),

  gasPricesPerChain: {},
  avgGasPerChain: {},
  addChainGasPrices: (chainId, prices) =>
    set((s) => {
      const valid = prices.filter((p) => Number.isFinite(p));
      if (valid.length === 0) return s;
      const existing = s.gasPricesPerChain[chainId] ?? [];
      const updated = [...existing, ...valid].slice(-MAX_GAS_SAMPLES);
      const avg = updated.reduce((a, b) => a + b, 0) / updated.length;
      return {
        gasPricesPerChain: { ...s.gasPricesPerChain, [chainId]: updated },
        avgGasPerChain: { ...s.avgGasPerChain, [chainId]: avg },
      };
    }),

  recentWhales: [],
  addWhale: (tx) =>
    set((s) => {
      const record: WhaleRecord = {
        hash: tx.hash,
        chainId: tx.chainId,
        value: tx.value,
        timestamp: tx.timestamp,
        tokenSymbol: tx.tokenInfo?.symbol,
        from: tx.from,
        to: tx.to,
      };
      const history = [record, ...s.whaleHistory].slice(0, MAX_WHALE_HISTORY);
      savePrefs({ isSimulation: get().isSimulation, whaleHistory: history, whaleThresholdUsd: get().whaleThresholdUsd });
      return {
        recentWhales: [tx, ...s.recentWhales].slice(0, MAX_RECENT_WHALES),
        whaleHistory: history,
      };
    }),
  clearWhales: () => set({ recentWhales: [] }),

  whaleHistory: prefs.whaleHistory,

  inspectedTx: null,
  setInspectedTx: (tx) => set({ inspectedTx: tx }),

  whaleThresholdUsd: prefs.whaleThresholdUsd,
  setWhaleThresholdUsd: (v) => {
    set({ whaleThresholdUsd: v });
    savePrefs({ isSimulation: get().isSimulation, whaleHistory: get().whaleHistory, whaleThresholdUsd: v });
  },
}));
