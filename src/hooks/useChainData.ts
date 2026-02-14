import { useEffect, useRef } from 'react';
import { useStore } from '../stores/useStore';
import { ConnectionManager } from '../data/ConnectionManager';
import { SimulationProvider } from '../data/SimulationProvider';
import { mapTransaction } from '../processing/TransactionMapper';
import { txQueue } from '../processing/TransactionQueue';
import { CHAINS } from '../config/chains';
import type { RawTransaction } from '../data/types';

type Provider = ConnectionManager | SimulationProvider;

export function useChainData(): void {
  const isSimulation = useStore((s) => s.isSimulation);
  const providersRef = useRef<Provider[]>([]);

  useEffect(() => {
    cleanupAll();
    txQueue.clear();

    const store = useStore.getState();
    store.resetTxCount();
    store.clearWhales();

    const chainIds = Object.keys(CHAINS);

    for (const chainId of chainIds) {
      store.setChainConnected(chainId, false);

      const handleRawTransactions = (rawTxs: RawTransaction[]) => {
        const processed = rawTxs.map(mapTransaction);
        txQueue.push(processed);

        const s = useStore.getState();
        s.incrementTxCount(processed.length);
        s.addGasPrices(processed.map((tx) => tx.gasPrice));

        if (processed.length > 0) {
          s.setLatestBlock(chainId, processed[0].blockNumber);
        }

        for (const tx of processed) {
          if (tx.isWhale) {
            useStore.getState().addWhale(tx);
          }
        }
      };

      if (isSimulation) {
        const sim = new SimulationProvider(chainId, handleRawTransactions);
        sim.start();
        providersRef.current.push(sim);
        useStore.getState().setChainConnected(chainId, true);
      } else {
        const conn = new ConnectionManager(chainId, handleRawTransactions);
        conn.setStatusCallback((status) => {
          if (status === 'connected') {
            useStore.getState().setChainConnected(chainId, true);
          } else {
            // Fallback this chain to simulation
            const sim = new SimulationProvider(chainId, handleRawTransactions);
            sim.start();
            providersRef.current.push(sim);
            useStore.getState().setChainConnected(chainId, true);
          }
        });
        providersRef.current.push(conn);
        conn.connect().catch(() => {
          const sim = new SimulationProvider(chainId, handleRawTransactions);
          sim.start();
          providersRef.current.push(sim);
          useStore.getState().setChainConnected(chainId, true);
        });
      }
    }

    function cleanupAll() {
      for (const p of providersRef.current) {
        if (p instanceof ConnectionManager) {
          p.disconnect();
        } else {
          p.stop();
        }
      }
      providersRef.current = [];
    }

    return cleanupAll;
  }, [isSimulation]);
}
