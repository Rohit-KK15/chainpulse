import { useEffect, useRef } from 'react';
import { useStore } from '../stores/useStore';
import { ConnectionManager } from '../data/ConnectionManager';
import { SimulationProvider } from '../data/SimulationProvider';
import { mapTransaction } from '../processing/TransactionMapper';
import { txQueue } from '../processing/TransactionQueue';
import { CHAINS } from '../config/chains';
import { activityMonitor } from '../processing/ActivityMonitor';
import { queueBlockPulse } from '../visualization/blockPulseEvents';
import { hexToRgb } from '../utils/color';
import type { RawTransaction } from '../data/types';
import { soundEngine } from '../audio/SoundEngine';
import { detectBridge } from '../config/bridges';
import { queueBridgeArc } from '../visualization/bridgeArcEvents';

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
    store.setTransitioning(true);

    // Brief delay so the fade-out is visible before spawning new particles
    const startTimer = setTimeout(() => {
      store.setTransitioning(false);
      setupProviders();
    }, 400);

    const chainIds = Object.keys(CHAINS);

    function setupProviders() {
      let hasData = false;

      for (const chainId of chainIds) {
        store.setChainConnected(chainId, false);

        const handleRawTransactions = (rawTxs: RawTransaction[]) => {
          const processed = rawTxs.map(mapTransaction);
          txQueue.push(processed);

          // Feed activity monitor for network stress dynamics
          activityMonitor.record(chainId, processed.length);

          const s = useStore.getState();
          s.incrementTxCount(processed.length);
          const gasPrices = processed.map((tx) => tx.gasPrice);
          s.addGasPrices(gasPrices);
          s.addChainGasPrices(chainId, gasPrices);

          if (!hasData) {
            hasData = true;
            s.setInitialized(true);
          }

          // Audio: ping for high-value transactions
          if (useStore.getState().audioEnabled) {
            for (const tx of processed) {
              if (tx.value > 1) {
                soundEngine.playTxPing(tx.value, chainId);
                break; // One ping per batch to avoid noise
              }
            }
            soundEngine.updateAmbient(activityMonitor.getActivityLevel(chainId));
          }

          if (processed.length > 0) {
            const prevBlock = s.latestBlocks[chainId];
            const newBlock = processed[0].blockNumber;
            if (newBlock !== prevBlock) {
              s.setLatestBlock(chainId, newBlock);
              // Audio: block chime
              if (useStore.getState().audioEnabled) {
                soundEngine.playBlockChime();
              }
              // Emit block pulse wave
              const chainConfig = CHAINS[chainId];
              if (chainConfig) {
                queueBlockPulse({
                  chainId,
                  center: chainConfig.center as [number, number, number],
                  color: hexToRgb(chainConfig.color.primary),
                });
              }
            }
          }

          for (const tx of processed) {
            if (tx.isWhale) {
              useStore.getState().addWhale(tx);
              if (useStore.getState().audioEnabled) {
                soundEngine.playWhaleAlert();
              }
            }

            // Detect bridge transactions for cross-chain arcs
            const bridge = detectBridge(tx.to);
            if (bridge) {
              const fromChainConfig = CHAINS[bridge.fromChain];
              const toChainConfig = CHAINS[bridge.toChain];
              if (fromChainConfig && toChainConfig) {
                queueBridgeArc({
                  fromChain: bridge.fromChain,
                  toChain: bridge.toChain,
                  fromCenter: fromChainConfig.center as [number, number, number],
                  toCenter: toChainConfig.center as [number, number, number],
                  color: hexToRgb(fromChainConfig.color.primary),
                  value: tx.value,
                  timestamp: tx.timestamp,
                });
              }
            }

            // Track net flow for connected wallet
            const wallet = useStore.getState().walletAddress;
            if (wallet) {
              const walletLower = wallet.toLowerCase();
              if (tx.from.toLowerCase() === walletLower) {
                useStore.getState().addNetFlow('sent', tx.value);
              } else if (tx.to?.toLowerCase() === walletLower) {
                useStore.getState().addNetFlow('received', tx.value);
              }
            }
          }
        };

        const fallbackToSimulation = () => {
          const sim = new SimulationProvider(chainId, handleRawTransactions);
          sim.start();
          providersRef.current.push(sim);
          useStore.getState().setChainConnected(chainId, true);
          useStore.getState().setChainFailed(chainId, true);
        };

        if (isSimulation) {
          const sim = new SimulationProvider(chainId, handleRawTransactions);
          sim.start();
          providersRef.current.push(sim);
          useStore.getState().setChainConnected(chainId, true);
        } else {
          try {
            const conn = new ConnectionManager(chainId, handleRawTransactions);
            conn.setStatusCallback((status) => {
              if (status === 'connected') {
                useStore.getState().setChainConnected(chainId, true);
              } else {
                useStore.getState().setChainConnected(chainId, false);
              }
            });
            providersRef.current.push(conn);
            conn.connect().catch(() => {
              fallbackToSimulation();
            });
          } catch {
            fallbackToSimulation();
          }
        }
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

    return () => {
      clearTimeout(startTimer);
      cleanupAll();
    };
  }, [isSimulation]);
}
