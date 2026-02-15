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

export interface WhaleRecord {
  hash: string;
  chainId: string;
  value: number;
  timestamp: number;
}

interface AppState {
  focusedChain: string | null;
  setFocusedChain: (chain: string | null) => void;

  isSimulation: boolean;
  setSimulation: (sim: boolean) => void;

  // Mode transition fade
  transitioning: boolean;
  setTransitioning: (t: boolean) => void;

  chainConnected: Record<string, boolean>;
  setChainConnected: (chainId: string, connected: boolean) => void;

  txCount: number;
  incrementTxCount: (n: number) => void;
  resetTxCount: () => void;

  latestBlocks: Record<string, number>;
  setLatestBlock: (chainId: string, block: number) => void;

  gasPrices: number[];
  avgGas: number;
  addGasPrices: (prices: number[]) => void;

  recentWhales: ProcessedTransaction[];
  addWhale: (tx: ProcessedTransaction) => void;
  clearWhales: () => void;

  // Persisted whale history
  whaleHistory: WhaleRecord[];

  inspectedTx: InspectedTx | null;
  setInspectedTx: (tx: InspectedTx | null) => void;
}

const MAX_RECENT_WHALES = 5;
const MAX_GAS_SAMPLES = 100;
const MAX_WHALE_HISTORY = 50;

const STORAGE_KEY = 'chainpulse_prefs';

function loadPrefs(): { isSimulation: boolean; whaleHistory: WhaleRecord[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        isSimulation: parsed.isSimulation ?? true,
        whaleHistory: Array.isArray(parsed.whaleHistory) ? parsed.whaleHistory.slice(0, MAX_WHALE_HISTORY) : [],
      };
    }
  } catch { /* ignore */ }
  return { isSimulation: true, whaleHistory: [] };
}

function savePrefs(state: { isSimulation: boolean; whaleHistory: WhaleRecord[] }): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      isSimulation: state.isSimulation,
      whaleHistory: state.whaleHistory,
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
    savePrefs({ isSimulation: sim, whaleHistory: get().whaleHistory });
  },

  transitioning: false,
  setTransitioning: (t) => set({ transitioning: t }),

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
  avgGas: 0,
  addGasPrices: (prices) =>
    set((s) => {
      const updated = [...s.gasPrices, ...prices].slice(-MAX_GAS_SAMPLES);
      const avg = updated.length > 0
        ? updated.reduce((a, b) => a + b, 0) / updated.length
        : 0;
      return { gasPrices: updated, avgGas: avg };
    }),

  recentWhales: [],
  addWhale: (tx) =>
    set((s) => {
      const record: WhaleRecord = {
        hash: tx.hash,
        chainId: tx.chainId,
        value: tx.value,
        timestamp: tx.timestamp,
      };
      const history = [record, ...s.whaleHistory].slice(0, MAX_WHALE_HISTORY);
      savePrefs({ isSimulation: get().isSimulation, whaleHistory: history });
      return {
        recentWhales: [tx, ...s.recentWhales].slice(0, MAX_RECENT_WHALES),
        whaleHistory: history,
      };
    }),
  clearWhales: () => set({ recentWhales: [] }),

  whaleHistory: prefs.whaleHistory,

  inspectedTx: null,
  setInspectedTx: (tx) => set({ inspectedTx: tx }),
}));
