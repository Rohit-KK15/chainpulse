import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore, InspectedTx, WhaleRecord } from '../stores/useStore';
import { CHAINS } from '../config/chains';
import { walletManager } from '../wallet/WalletManager';
import { useENSName } from '../utils/ensCache';
import { soundEngine } from '../audio/SoundEngine';
import { fetchPortfolio } from '../wallet/PortfolioTracker';
import { sceneCanvas } from '../visualization/Scene';
import { fetchAllChainHistory } from '../wallet/HistoryFetcher';
import { fetchPrices, formatUsdValue } from '../data/PriceFeed';
import { replayBuffer, ReplaySpeed } from '../data/ReplayBuffer';

// ── Clipboard helper ───────────────────────────

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers / insecure contexts
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}

// ── Icons ──────────────────────────────────────

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

// ── Gas formatting ────────────────────────────

function formatGwei(gwei: number): string {
  if (!Number.isFinite(gwei) || gwei <= 0) return '0';
  if (gwei < 0.01) return '<0.01';
  if (gwei < 1) return gwei.toFixed(3);
  if (gwei < 10) return gwei.toFixed(1);
  return Math.round(gwei).toString();
}

// ── Copyable field ─────────────────────────────

function CopyField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className={`detail-value ${mono ? 'mono' : ''}`}>{value}</span>
      <button
        className="whale-copy"
        onClick={async () => {
          const ok = await copyToClipboard(value);
          if (ok) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}

// ── Address formatting ────────────────────────

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ── Time formatting ───────────────────────────

function formatRelativeTime(timestamp: number): string {
  const diff = Math.floor(Date.now() / 1000 - timestamp);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Tx Detail Panel ────────────────────────────

function TxDetail({ tx, onClose }: { tx: InspectedTx; onClose: () => void }) {
  const chain = CHAINS[tx.chainId];
  const panelRef = useRef<HTMLDivElement>(null);
  const fromENS = useENSName(tx.from);
  const toENS = useENSName(tx.to);

  // Position the panel near the click, clamped to viewport using visualViewport
  const vw = window.visualViewport?.width ?? document.documentElement.clientWidth;
  const vh = window.visualViewport?.height ?? document.documentElement.clientHeight;
  const style: React.CSSProperties = {
    left: Math.max(0, Math.min(tx.screenX + 12, vw - 320)),
    top: Math.max(0, Math.min(tx.screenY - 20, vh - 400)),
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const safeValue = Number.isFinite(tx.value) ? tx.value.toFixed(4) : '0';
  const safeGas = formatGwei(tx.gasPrice);
  const valueUnit = tx.tokenSymbol ?? chain?.nativeCurrency ?? '';
  const usdValue = formatUsdValue(tx.value, valueUnit);
  const explorerUrl = `${chain?.explorerTx ?? 'https://etherscan.io/tx/'}${tx.hash}`;

  return (
    <div
      ref={panelRef}
      className="tx-detail"
      style={{
        ...style,
        '--chain-color': chain?.color.primary ?? '#fff',
      } as React.CSSProperties}
    >
      <div className="detail-header">
        <span className="detail-chain-dot" style={{ background: chain?.color.primary }} />
        <span className="detail-chain-name">{chain?.name ?? tx.chainId}</span>
        <span className="detail-time">{formatRelativeTime(tx.timestamp)}</span>
        <button className="detail-close" onClick={onClose}>x</button>
      </div>
      <CopyField label="Hash" value={tx.hash} mono />
      {fromENS && <div className="detail-row"><span className="detail-label">From</span><span className="detail-value detail-ens">{fromENS}</span></div>}
      <CopyField label={fromENS ? '' : 'From'} value={tx.from} mono />
      {toENS && <div className="detail-row"><span className="detail-label">To</span><span className="detail-value detail-ens">{toENS}</span></div>}
      <CopyField
        label={toENS ? '' : 'To'}
        value={tx.to ?? 'Contract Creation'}
        mono={!!tx.to}
      />
      <div className="detail-row">
        <span className="detail-label">Value</span>
        <span className="detail-value">
          {safeValue} {valueUnit}
          {usdValue && <span className="detail-usd">{usdValue}</span>}
          {tx.isStablecoin && <span className="detail-badge">Stablecoin</span>}
        </span>
      </div>
      {tx.blockNumber > 0 && (
        <div className="detail-row">
          <span className="detail-label">Block</span>
          <span className="detail-value">#{tx.blockNumber.toLocaleString()}</span>
        </div>
      )}
      <div className="detail-row">
        <span className="detail-label">Gas</span>
        <span className="detail-value">{safeGas} gwei</span>
      </div>
      <div className="detail-footer">
        <a
          className="detail-explorer-link"
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on Explorer <ExternalLinkIcon />
        </a>
      </div>
    </div>
  );
}

// ── Connection Toast ──────────────────────────

const ConnectionToast = React.memo(function ConnectionToast() {
  const chainConnected = useStore((s) => s.chainConnected);
  const chainFailed = useStore((s) => s.chainFailed);
  const isSimulation = useStore((s) => s.isSimulation);

  if (isSimulation) return null;

  const chains = Object.values(CHAINS);
  const disconnected = chains.filter((c) => chainConnected[c.id] === false);
  const failed = chains.filter((c) => chainFailed[c.id] === true && chainConnected[c.id] === true);

  if (disconnected.length === 0 && failed.length === 0) return null;

  return (
    <div className="connection-toast">
      {disconnected.map((chain) => (
        <div key={chain.id} className="toast-item">
          <span
            className="toast-dot"
            style={{ background: chain.color.primary }}
          />
          <span>Connecting to {chain.name}...</span>
        </div>
      ))}
      {failed.map((chain) => (
        <div key={`${chain.id}-failed`} className="toast-item toast-item--fallback">
          <span
            className="toast-dot"
            style={{ background: chain.color.primary, opacity: 0.5 }}
          />
          <span>{chain.name}: using simulation</span>
        </div>
      ))}
    </div>
  );
});

// ── Loading Indicator ──────────────────────────

const LoadingIndicator = React.memo(function LoadingIndicator() {
  const initialized = useStore((s) => s.initialized);
  if (initialized) return null;
  return (
    <div className="loading-indicator">
      <div className="loading-pulse" />
      <span>Connecting to chains...</span>
    </div>
  );
});

// ── TX Counter (extracted to avoid re-rendering siblings) ──

const TxCounter = React.memo(function TxCounter() {
  const txCount = useStore((s) => s.txCount);
  return (
    <div className="hud-item">
      <span className="hud-label">Total TX</span>
      <span className="hud-value">{txCount.toLocaleString()}</span>
    </div>
  );
});

// ── Stats Strip ────────────────────────────────

function getConnectionHealth(chainId: string, blockTime: number): 'healthy' | 'warning' | 'stale' | 'disconnected' {
  const s = useStore.getState();
  if (!s.chainConnected[chainId]) return 'disconnected';
  const lastBlockTs = s.lastBlockTimestamps[chainId];
  if (!lastBlockTs) return 'healthy';
  const elapsed = (Date.now() - lastBlockTs) / 1000;
  if (elapsed > blockTime * 5) return 'stale';
  if (elapsed > blockTime * 2) return 'warning';
  return 'healthy';
}

const StatsStrip = React.memo(function StatsStrip() {
  const txCount = useStore((s) => s.txCount);
  const avgGasPerChain = useStore((s) => s.avgGasPerChain);
  const recentWhales = useStore((s) => s.recentWhales);
  const latestBlocks = useStore((s) => s.latestBlocks);
  const chainConnected = useStore((s) => s.chainConnected);
  const isWalletConnected = useStore((s) => s.isWalletConnected);
  const netFlow = useStore((s) => s.netFlow);

  const [txRate, setTxRate] = useState(0);
  // Force re-render every second for health indicators
  const [, setTick] = useState(0);
  const prevCountRef = useRef(0);

  useEffect(() => {
    prevCountRef.current = useStore.getState().txCount;
    const id = setInterval(() => {
      const current = useStore.getState().txCount;
      setTxRate(current - prevCountRef.current);
      prevCountRef.current = current;
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="stats-strip">
      <div className="stat">
        <span className="stat-value">{txRate}</span>
        <span className="stat-label">TX/S</span>
      </div>
      <div className="stat">
        <span className="stat-value">{recentWhales.length}</span>
        <span className="stat-label">WHALES</span>
      </div>
      {isWalletConnected && (netFlow.sent > 0 || netFlow.received > 0) && (
        <>
          <div className="stat-divider" />
          <div className="stat net-flow-stat">
            {netFlow.received >= netFlow.sent ? (
              <span className="net-flow-arrow net-flow-in" title="Net receiving">↑</span>
            ) : (
              <span className="net-flow-arrow net-flow-out" title="Net sending">↓</span>
            )}
            <span className="stat-value">
              {Math.abs(netFlow.received - netFlow.sent).toFixed(4)}
            </span>
            <span className="stat-label">NET</span>
          </div>
        </>
      )}
      <div className="stat-divider" />
      {Object.values(CHAINS).map((chain) => {
        const block = latestBlocks[chain.id];
        const connected = chainConnected[chain.id];
        const health = getConnectionHealth(chain.id, chain.blockTime);
        const chainGas = avgGasPerChain[chain.id];
        const healthClass = health === 'warning' ? 'health-warning'
          : health === 'stale' ? 'health-stale'
          : connected ? 'connected' : '';
        const statusLabel = health === 'stale' ? `${chain.name}: stale`
          : health === 'warning' ? `${chain.name}: delayed`
          : connected ? `${chain.name}: connected`
          : `${chain.name}: disconnected`;
        return (
          <div key={chain.id} className="stat chain-stat">
            <span
              className={`status-dot ${healthClass}`}
              style={{ background: connected ? chain.color.primary : undefined }}
              role="status"
              aria-label={statusLabel}
              title={statusLabel}
            />
            <span className="stat-label">{chain.abbr}</span>
            {block ? (
              <span className="stat-block">#{block.toLocaleString()}</span>
            ) : (
              <span className="stat-block">--</span>
            )}
            {chainGas !== undefined && (
              <span className="stat-gas">{formatGwei(chainGas)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
});

// ── Mode Toggle ────────────────────────────────

function ModeToggle() {
  const isSimulation = useStore((s) => s.isSimulation);
  const setSimulation = useStore((s) => s.setSimulation);
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = () => {
    if (confirming) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setConfirming(false);
      setSimulation(!isSimulation);
    } else {
      setConfirming(true);
      timerRef.current = setTimeout(() => setConfirming(false), 2000);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <button
      className={`mode-toggle ${confirming ? 'mode-toggle--confirm' : ''}`}
      onClick={handleClick}
    >
      {confirming
        ? 'Click to confirm'
        : isSimulation
          ? 'Go Live'
          : 'Simulate'}
    </button>
  );
}

// ── Info / Legend Panel ────────────────────────

const CHAIN_LEGEND = Object.values(CHAINS).map((c) => ({
  name: c.name,
  color: c.color.primary,
}));

const TOKEN_LEGEND = [
  { symbol: 'USDC', color: '#2775CA' },
  { symbol: 'USDT', color: '#26A17B' },
  { symbol: 'DAI', color: '#F5AC37' },
  { symbol: 'WETH', color: '#EC1C79' },
  { symbol: 'WBTC', color: '#F7931A' },
];

const SLIDER_MIN = 1_000;
const SLIDER_MAX = 1_000_000;

function logToLinear(value: number): number {
  const minLog = Math.log10(SLIDER_MIN);
  const maxLog = Math.log10(SLIDER_MAX);
  return (Math.log10(value) - minLog) / (maxLog - minLog);
}

function linearToLog(t: number): number {
  const minLog = Math.log10(SLIDER_MIN);
  const maxLog = Math.log10(SLIDER_MAX);
  return Math.round(Math.pow(10, minLog + t * (maxLog - minLog)));
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

const InfoButton = React.memo(function InfoButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="info-btn" onClick={onClick} aria-label="Show legend">
      i
    </button>
  );
});

const GAS_ESTIMATES = [
  { label: 'ETH Transfer', gas: 21_000 },
  { label: 'ERC-20 Transfer', gas: 65_000 },
  { label: 'DEX Swap', gas: 150_000 },
  { label: 'NFT Mint', gas: 100_000 },
];

function GasEstimator() {
  const avgGasPerChain = useStore((s) => s.avgGasPerChain);
  const tokenPrices = useStore((s) => s.tokenPrices);
  const chains = Object.values(CHAINS);

  // Only show if we have gas data for at least one chain
  const hasData = chains.some((c) => avgGasPerChain[c.id] !== undefined);
  if (!hasData) return null;

  return (
    <>
      <div className="info-divider" />
      <div className="info-section">
        <div className="info-slider-header">
          <span>Gas Estimates</span>
        </div>
        <div className="gas-estimator">
          <div className="gas-est-header">
            <span className="gas-est-label-col">Type</span>
            {chains.map((c) => (
              <span key={c.id} className="gas-est-chain" style={{ color: c.color.primary }}>{c.abbr}</span>
            ))}
          </div>
          {GAS_ESTIMATES.map((est) => (
            <div key={est.label} className="gas-est-row">
              <span className="gas-est-label-col">{est.label}</span>
              {chains.map((c) => {
                const gasPrice = avgGasPerChain[c.id];
                if (gasPrice === undefined) return <span key={c.id} className="gas-est-val">--</span>;
                const costGwei = gasPrice * est.gas;
                const costEth = costGwei / 1e9;
                const nativePrice = tokenPrices[c.nativeCurrency];
                const usdCost = nativePrice ? costEth * nativePrice : null;
                return (
                  <span key={c.id} className="gas-est-val" title={`${costEth.toFixed(6)} ${c.nativeCurrency}`}>
                    {usdCost !== null ? (usdCost < 0.01 ? '<$0.01' : `$${usdCost.toFixed(2)}`) : (costEth < 0.0001 ? '<0.0001' : costEth.toFixed(4))}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        <div className="info-slider-note">
          {Object.keys(tokenPrices).length > 0 ? 'Estimated USD cost' : `Cost in native token (${chains.map((c) => c.nativeCurrency).filter((v, i, a) => a.indexOf(v) === i).join('/')})`}
        </div>
      </div>
    </>
  );
}

function InfoPanel({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const whaleThresholdUsd = useStore((s) => s.whaleThresholdUsd);
  const setWhaleThresholdUsd = useStore((s) => s.setWhaleThresholdUsd);

  const sliderValue = whaleThresholdUsd > 0 ? logToLinear(whaleThresholdUsd) : 0;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Ignore clicks on the info button itself
        if ((e.target as HTMLElement).closest('.info-btn')) return;
        onClose();
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div ref={panelRef} className="info-panel">
      <div className="info-panel-header">
        <span>Legend</span>
        <button className="detail-close" onClick={onClose}>x</button>
      </div>

      <div className="info-section">
        <div className="info-row">
          <span className="info-icon info-dot" />
          <span>Each particle is a transaction — size = value</span>
        </div>

        <div className="info-row info-sub">
          {CHAIN_LEGEND.map((c) => (
            <span key={c.name} className="info-chip">
              <span className="info-dot info-dot--pulse" style={{ background: c.color }} />
              {c.name}
            </span>
          ))}
        </div>

        <div className="info-row">
          <span className="info-icon info-token-swatch" />
          <span>Token transfers colored by token</span>
        </div>

        <div className="info-row info-sub">
          {TOKEN_LEGEND.map((t) => (
            <span key={t.symbol} className="info-chip">
              <span className="info-dot" style={{ background: t.color }} />
              {t.symbol}
            </span>
          ))}
        </div>

        <div className="info-row">
          <span className="info-icon info-whale-glow" />
          <span>Large glowing particles = high-value whale txns</span>
        </div>

        <div className="info-row">
          <span className="info-icon info-ring info-ring--expand" />
          <span>Expanding rings = new blocks arriving</span>
        </div>

        <div className="info-row">
          <span className="info-icon">👆</span>
          <span>Click any particle to inspect tx details</span>
        </div>
      </div>

      <div className="info-divider" />

      <div className="info-section">
        <div className="info-slider-header">
          <span>Whale Threshold</span>
          <span className="info-slider-value">
            {whaleThresholdUsd > 0 ? formatUsd(whaleThresholdUsd) : 'Auto'}
          </span>
        </div>
        <div className="info-slider-note">Applies to stablecoins (USDC, USDT, DAI)</div>
        <input
          type="range"
          className="info-slider"
          min={0}
          max={1}
          step={0.001}
          value={sliderValue}
          onChange={(e) => {
            const t = parseFloat(e.target.value);
            setWhaleThresholdUsd(t <= 0.001 ? 0 : linearToLog(t));
          }}
        />
        <div className="info-slider-labels">
          <span>Auto</span>
          <span>$10K</span>
          <span>$100K</span>
          <span>$1M</span>
        </div>
      </div>

      <GasEstimator />
    </div>
  );
}

// ── Wallet Button ─────────────────────────────

function WalletButton() {
  const isConnected = useStore((s) => s.isWalletConnected);
  const address = useStore((s) => s.walletAddress);
  const balance = useStore((s) => s.walletBalance);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const unsub = walletManager.subscribe((state) => {
      if (state) {
        useStore.getState().setWalletState(state.address, state.chainId, state.balance);
      } else {
        useStore.getState().setWalletState(null, null, null);
      }
    });
    walletManager.tryAutoConnect();
    return unsub;
  }, []);

  const handleClick = async () => {
    if (isConnected) {
      walletManager.disconnect();
    } else {
      setConnecting(true);
      await walletManager.connect();
      setConnecting(false);
    }
  };

  if (isConnected && address) {
    return (
      <button className="wallet-btn wallet-btn--connected" onClick={handleClick}>
        <span className="wallet-dot" />
        <span className="wallet-addr">{truncateAddress(address)}</span>
        {balance && <span className="wallet-balance">{parseFloat(balance).toFixed(4)} ETH</span>}
      </button>
    );
  }

  if (!walletManager.isAvailable) return null;

  return (
    <button className="wallet-btn" onClick={handleClick} disabled={connecting}>
      {connecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}

// ── Whale History Panel ───────────────────────

function WhaleHistoryItem({ record }: { record: WhaleRecord }) {
  const chain = CHAINS[record.chainId];
  return (
    <a
      className="whale-history-item"
      href={`${chain?.explorerTx ?? 'https://etherscan.io/tx/'}${record.hash}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="whale-history-dot" style={{ background: chain?.color.primary }} />
      <span className="whale-history-value">
        {record.value.toFixed(2)} {record.tokenSymbol ?? chain?.nativeCurrency}
      </span>
      <span className="whale-history-addr">{truncateAddress(record.from)}</span>
      <span className="whale-history-time">{formatRelativeTime(record.timestamp)}</span>
    </a>
  );
}

function WhaleHistoryPanel({ onClose }: { onClose: () => void }) {
  const whaleHistory = useStore((s) => s.whaleHistory);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        if ((e.target as HTMLElement).closest('.whale-history-toggle')) return;
        onClose();
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div ref={panelRef} className="whale-history-panel">
      <div className="info-panel-header">
        <span>Whale History</span>
        <button className="detail-close" onClick={onClose}>x</button>
      </div>
      {whaleHistory.length === 0 ? (
        <div className="whale-history-empty">No whale transactions yet</div>
      ) : (
        <div className="whale-history-list">
          {whaleHistory.map((record) => (
            <WhaleHistoryItem key={record.hash} record={record} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Whale Alerts Panel ────────────────────────

const MAX_VISIBLE_WHALES = 6;
const WHALE_EXIT_MS = 450;

function WhaleAlertsPanel({ recentWhales }: { recentWhales: import('../data/types').ProcessedTransaction[] }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exiting, setExiting] = useState<import('../data/types').ProcessedTransaction[]>([]);
  const prevRef = useRef<import('../data/types').ProcessedTransaction[]>([]);

  useEffect(() => {
    const prev = prevRef.current;
    const visible = recentWhales.slice(0, MAX_VISIBLE_WHALES);
    const visibleHashes = new Set(visible.map((w) => w.hash));

    // Detect items that fell off the visible list
    const removed = prev.filter((w) => !visibleHashes.has(w.hash));

    if (removed.length > 0) {
      const removedHashes = removed.map((w) => w.hash);
      setExiting((prev) => [...prev, ...removed]);
      setTimeout(() => {
        setExiting((prev) => prev.filter((w) => !removedHashes.includes(w.hash)));
      }, WHALE_EXIT_MS);
    }

    prevRef.current = visible;
  }, [recentWhales]);

  const visible = recentWhales.slice(0, MAX_VISIBLE_WHALES);
  const exitHashes = new Set(exiting.map((w) => w.hash));
  const displayList = [...visible, ...exiting];

  return (
    <div className="whale-alerts-container">
      <div className="whale-alerts">
        {displayList.map((whale) => {
          const chain = CHAINS[whale.chainId];
          const isExit = exitHashes.has(whale.hash);
          return (
            <div
              key={whale.hash}
              className={`whale-alert-wrap${isExit ? ' whale-alert-wrap--exit' : ''}`}
            >
              <a
                className="whale-alert"
                href={`${chain?.explorerTx ?? 'https://etherscan.io/tx/'}${whale.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  '--chain-color': chain?.color.primary ?? '#fff',
                } as React.CSSProperties}
              >
                <span className="whale-alert-chain-dot" style={{ background: chain?.color.primary }} />
                <span className="whale-alert-chain-name">{chain?.abbr}</span>
                <span className="whale-value">
                  {whale.value.toFixed(2)} {whale.tokenInfo?.symbol ?? chain?.nativeCurrency}
                </span>
                <span className="whale-alert-from">{truncateAddress(whale.from)}</span>
                <span className="whale-alert-time">{formatRelativeTime(whale.timestamp)}</span>
              </a>
            </div>
          );
        })}
      </div>
      <button
        className="whale-history-toggle"
        onClick={() => setHistoryOpen((prev) => !prev)}
        title="Whale history"
      >
        🐋
      </button>
      {historyOpen && <WhaleHistoryPanel onClose={() => setHistoryOpen(false)} />}
    </div>
  );
}

// ── Portfolio Panel ───────────────────────────

function formatPortfolioUsd(value: number): string {
  if (value < 0.01) return '<$0.01';
  if (value < 1_000) return `$${value.toFixed(2)}`;
  if (value < 10_000) return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (value < 1_000_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${(value / 1_000_000).toFixed(2)}M`;
}

function PortfolioPanel() {
  const isWalletConnected = useStore((s) => s.isWalletConnected);
  const walletAddress = useStore((s) => s.walletAddress);
  const portfolio = useStore((s) => s.portfolio);
  const portfolioVisible = useStore((s) => s.portfolioVisible);
  const tokenPrices = useStore((s) => s.tokenPrices);
  const netFlow = useStore((s) => s.netFlow);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isWalletConnected || !walletAddress) return;
    let cancelled = false;
    setLoading(true);
    fetchPortfolio(walletAddress)
      .then((balances) => {
        if (!cancelled) useStore.getState().setPortfolio(balances);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isWalletConnected, walletAddress]);

  if (!isWalletConnected) return null;

  const toggleVisible = () => useStore.getState().setPortfolioVisible(!portfolioVisible);

  // Enrich portfolio items with USD values
  const enriched = portfolio.map((item) => {
    const price = tokenPrices[item.symbol] ?? 0;
    const usdValue = item.balance * price;
    return { ...item, usdValue };
  });

  const totalUsd = enriched.reduce((sum, item) => sum + item.usdValue, 0);

  // Chain allocation totals
  const chainTotals: Record<string, number> = {};
  for (const item of enriched) {
    chainTotals[item.chain] = (chainTotals[item.chain] ?? 0) + item.usdValue;
  }

  // Sort by USD value descending
  const sorted = [...enriched].sort((a, b) => b.usdValue - a.usdValue);

  // Build conic-gradient for ring chart
  const chainEntries = Object.entries(chainTotals)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  let conicGradient = '';
  if (totalUsd > 0 && chainEntries.length > 0) {
    const segments: string[] = [];
    let cumulative = 0;
    for (const [chainId, value] of chainEntries) {
      const chain = CHAINS[chainId];
      const pct = (value / totalUsd) * 100;
      const start = cumulative;
      cumulative += pct;
      segments.push(`${chain?.color.primary ?? '#666'} ${start.toFixed(2)}% ${cumulative.toFixed(2)}%`);
    }
    conicGradient = `conic-gradient(from 220deg, ${segments.join(', ')})`;
  }

  return (
    <>
      <button
        className="portfolio-toggle"
        onClick={toggleVisible}
        title={portfolioVisible ? 'Hide portfolio' : 'Show portfolio'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 20V10" />
          <path d="M12 20V4" />
          <path d="M6 20v-6" />
        </svg>
      </button>
      {portfolioVisible && (
        <div className="portfolio-panel">
          <div className="portfolio-header">
            <span className="portfolio-title">PORTFOLIO</span>
            <button className="detail-close" onClick={toggleVisible}>&times;</button>
          </div>

          {loading ? (
            <div className="portfolio-loading">
              <div className="portfolio-loading-spinner" />
              <span>Scanning chains...</span>
            </div>
          ) : portfolio.length === 0 ? (
            <div className="portfolio-empty">
              <div className="portfolio-empty-icon">&loz;</div>
              <span>No balances found</span>
            </div>
          ) : (
            <>
              {/* Hero: Ring chart + Total value */}
              <div className="portfolio-hero">
                <div className="portfolio-ring-wrap">
                  <div
                    className={`portfolio-ring${conicGradient ? '' : ' portfolio-ring--empty'}`}
                    style={conicGradient ? { background: conicGradient } : undefined}
                  />
                  <div className="portfolio-ring-inner">
                    <span className="portfolio-ring-count">{chainEntries.length || '--'}</span>
                    <span className="portfolio-ring-sub">chains</span>
                  </div>
                </div>
                <div className="portfolio-hero-data">
                  <span className="portfolio-hero-label">Total Value</span>
                  <span className="portfolio-hero-value">
                    {totalUsd > 0 ? formatPortfolioUsd(totalUsd) : '--'}
                  </span>
                  <span className="portfolio-hero-count">{sorted.length} asset{sorted.length !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {/* Chain allocation pills */}
              {chainEntries.length > 0 && (
                <div className="portfolio-alloc">
                  {chainEntries.map(([chainId, value]) => {
                    const chain = CHAINS[chainId];
                    const pct = totalUsd > 0 ? (value / totalUsd) * 100 : 0;
                    return (
                      <div
                        key={chainId}
                        className="portfolio-alloc-pill"
                        style={{ '--pill-color': chain?.color.primary } as React.CSSProperties}
                      >
                        <span className="portfolio-alloc-dot" style={{ background: chain?.color.primary }} />
                        <span className="portfolio-alloc-name">{chain?.name ?? chainId}</span>
                        <span className="portfolio-alloc-pct">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Net flow */}
              {(netFlow.sent > 0 || netFlow.received > 0) && (
                <div className="portfolio-flow">
                  <div className="portfolio-flow-item">
                    <span className="portfolio-flow-arrow portfolio-flow-in">&uarr;</span>
                    <div className="portfolio-flow-data">
                      <span className="portfolio-flow-value">{netFlow.received.toFixed(4)}</span>
                      <span className="portfolio-flow-label">Received</span>
                    </div>
                  </div>
                  <div className="portfolio-flow-divider" />
                  <div className="portfolio-flow-item">
                    <span className="portfolio-flow-arrow portfolio-flow-out">&darr;</span>
                    <div className="portfolio-flow-data">
                      <span className="portfolio-flow-value">{netFlow.sent.toFixed(4)}</span>
                      <span className="portfolio-flow-label">Sent</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Gradient divider */}
              <div className="portfolio-divider" />

              {/* Token list */}
              <div className="portfolio-list">
                {sorted.map((item, i) => {
                  const chain = CHAINS[item.chain];
                  const pct = totalUsd > 0 ? (item.usdValue / totalUsd) * 100 : 0;
                  return (
                    <div
                      key={`${item.chain}-${item.symbol}-${i}`}
                      className="portfolio-item"
                      style={{ animationDelay: `${i * 50}ms` } as React.CSSProperties}
                    >
                      <div className="portfolio-item-accent" style={{ background: item.color }} />
                      <div className="portfolio-item-body">
                        <div className="portfolio-item-top">
                          <span className="portfolio-symbol">{item.symbol}</span>
                          <span
                            className="portfolio-chain-badge"
                            style={{ color: chain?.color.primary, borderColor: (chain?.color.primary ?? '#666') + '40' }}
                          >
                            {chain?.abbr ?? item.chain}
                          </span>
                          <span className="portfolio-usd">
                            {item.usdValue > 0.01 ? formatPortfolioUsd(item.usdValue) : ''}
                          </span>
                        </div>
                        <div className="portfolio-item-bottom">
                          <span className="portfolio-balance">
                            {item.balance < 0.01
                              ? '<0.01'
                              : item.balance < 1
                                ? item.balance.toFixed(4)
                                : item.balance < 10_000
                                  ? item.balance.toFixed(2)
                                  : item.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                          {pct > 0 && (
                            <div className="portfolio-pct-track">
                              <div
                                className="portfolio-pct-fill"
                                style={{ width: `${Math.max(pct, 2)}%`, background: item.color }}
                              />
                            </div>
                          )}
                          {pct > 0 && (
                            <span className="portfolio-pct-text">{pct.toFixed(0)}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

// ── Audio Toggle ──────────────────────────────

function AudioToggle() {
  const audioEnabled = useStore((s) => s.audioEnabled);

  const handleToggle = () => {
    const next = !audioEnabled;
    useStore.getState().setAudioEnabled(next);
    if (next) {
      soundEngine.enable();
    } else {
      soundEngine.disable();
    }
  };

  return (
    <button
      className={`audio-toggle ${audioEnabled ? 'audio-toggle--on' : ''}`}
      onClick={handleToggle}
      title={audioEnabled ? 'Mute audio' : 'Enable audio'}
      aria-label={audioEnabled ? 'Mute audio' : 'Enable audio'}
    >
      {audioEnabled ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      )}
    </button>
  );
}

// ── Replay Timeline ──────────────────────────

function ReplayTimeline() {
  const isWalletConnected = useStore((s) => s.isWalletConnected);
  const walletAddress = useStore((s) => s.walletAddress);
  const replayMode = useStore((s) => s.replayMode);
  const replayLoading = useStore((s) => s.replayLoading);
  const replayCursor = useStore((s) => s.replayCursor);
  const replayTotal = useStore((s) => s.replayTotal);
  const [speed, setSpeed] = useState<ReplaySpeed>(5);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    replayBuffer.setOnProgress((cursor, total) => {
      useStore.getState().setReplayProgress(cursor, total);
      if (cursor >= total && total > 0) setPlaying(false);
    });
  }, []);

  const startReplay = async () => {
    if (!walletAddress) return;
    const store = useStore.getState();
    store.setReplayLoading(true);
    store.setReplayMode(true);

    const txs = await fetchAllChainHistory(walletAddress);
    store.setReplayLoading(false);

    if (txs.length === 0) {
      store.setReplayMode(false);
      return;
    }

    replayBuffer.load(txs);
    store.setReplayProgress(0, txs.length);
    replayBuffer.setSpeed(speed);
    replayBuffer.play();
    setPlaying(true);
  };

  const stopReplay = () => {
    replayBuffer.stop();
    setPlaying(false);
    useStore.getState().setReplayMode(false);
    useStore.getState().setReplayProgress(0, 0);
  };

  const togglePlay = () => {
    if (playing) {
      replayBuffer.pause();
      setPlaying(false);
    } else {
      replayBuffer.setSpeed(speed);
      replayBuffer.play();
      setPlaying(true);
    }
  };

  const handleSpeedChange = (s: ReplaySpeed) => {
    setSpeed(s);
    replayBuffer.setSpeed(s);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pos = parseInt(e.target.value, 10);
    replayBuffer.seek(pos);
  };

  if (!isWalletConnected) return null;

  if (!replayMode) {
    return (
      <button className="replay-start-btn" onClick={startReplay} disabled={replayLoading}>
        {replayLoading ? 'Loading...' : 'Replay History'}
      </button>
    );
  }

  const progress = replayTotal > 0 ? Math.round((replayCursor / replayTotal) * 100) : 0;

  return (
    <div className="replay-timeline">
      <div className="replay-controls">
        <button className="replay-btn" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
          {playing ? '⏸' : '▶'}
        </button>
        <button className="replay-btn" onClick={stopReplay} title="Stop">⏹</button>
        <div className="replay-speed">
          {([1, 5, 20] as ReplaySpeed[]).map((s) => (
            <button
              key={s}
              className={`replay-speed-btn ${speed === s ? 'active' : ''}`}
              onClick={() => handleSpeedChange(s)}
            >
              {s}x
            </button>
          ))}
        </div>
        <span className="replay-progress">{progress}%</span>
      </div>
      <input
        type="range"
        className="replay-scrubber"
        min={0}
        max={replayTotal}
        value={replayCursor}
        onChange={handleSeek}
      />
      <div className="replay-info">
        <span>{replayCursor.toLocaleString()} / {replayTotal.toLocaleString()} txns</span>
      </div>
    </div>
  );
}

// ── Screenshot Button + Modal ─────────────────

function ScreenshotButton() {
  const [preview, setPreview] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const capture = () => {
    if (!sceneCanvas) return;
    const dataUrl = sceneCanvas.toDataURL('image/png');

    // Composite with watermark
    const img = new Image();
    img.onload = () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = img.width;
      offscreen.height = img.height;
      const ctx = offscreen.getContext('2d');
      if (!ctx) { setPreview(dataUrl); return; }
      ctx.drawImage(img, 0, 0);

      // Watermark bar at bottom
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, img.height - 28, img.width, 28);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '12px monospace';
      const s = useStore.getState();
      const text = `ChainPulse | TX: ${s.txCount.toLocaleString()} | Whales: ${s.recentWhales.length}`;
      ctx.fillText(text, 8, img.height - 10);

      setPreview(offscreen.toDataURL('image/png'));
    };
    img.src = dataUrl;
  };

  const download = () => {
    if (!preview) return;
    const link = document.createElement('a');
    link.download = `chainpulse-${Date.now()}.png`;
    link.href = preview;
    link.click();
  };

  const copyImage = async () => {
    if (!preview) return;
    try {
      const res = await fetch(preview);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard API may not support images */ }
  };

  return (
    <>
      <button
        className="screenshot-btn"
        onClick={capture}
        title="Capture screenshot"
        aria-label="Capture screenshot"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </button>
      {preview && (
        <div className="screenshot-modal-backdrop" onClick={() => setPreview(null)}>
          <div className="screenshot-modal" onClick={(e) => e.stopPropagation()}>
            <img src={preview} alt="Screenshot preview" className="screenshot-preview" />
            <div className="screenshot-actions">
              <button className="screenshot-action" onClick={download}>Download</button>
              <button className="screenshot-action" onClick={copyImage}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button className="screenshot-action screenshot-action--close" onClick={() => setPreview(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Onboarding Welcome Card ───────────────────

const ONBOARDING_KEY = 'chainpulse_onboarded';

function OnboardingCard() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(ONBOARDING_KEY) === '1'; } catch { return false; }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch { /* ignore */ }
  };

  return (
    <div className="onboarding-backdrop">
      <div className="onboarding-card">
        <div className="onboarding-title">Welcome to ChainPulse</div>
        <div className="onboarding-body">
          <div className="onboarding-item">
            <span className="info-dot" style={{ background: '#627EEA' }} /> Particles are live transactions — size reflects value
          </div>
          <div className="onboarding-item">
            <span className="info-dot" style={{ background: '#8247E5' }} /> Colors represent chains: Ethereum, Polygon, Arbitrum
          </div>
          <div className="onboarding-item">
            <span className="onboarding-glow" /> Large glowing particles are whale transactions
          </div>
          <div className="onboarding-item">
            <span className="info-ring" /> Expanding rings signal new blocks arriving
          </div>
          <div className="onboarding-item">
            <span className="onboarding-click">+</span> Click any particle to inspect transaction details
          </div>
        </div>
        <button className="onboarding-dismiss" onClick={handleDismiss}>Got it</button>
      </div>
    </div>
  );
}

// ── Main Overlay ───────────────────────────────

export function Overlay() {
  const focusedChain = useStore((s) => s.focusedChain);
  const setFocusedChain = useStore((s) => s.setFocusedChain);
  const recentWhales = useStore((s) => s.recentWhales);
  const inspectedTx = useStore((s) => s.inspectedTx);
  const transitioning = useStore((s) => s.transitioning);
  const [infoOpen, setInfoOpen] = useState(false);

  // Fetch token prices on mount and refresh every 60s
  useEffect(() => {
    const load = () => {
      fetchPrices().then((prices) => {
        useStore.getState().setTokenPrices(prices);
      }).catch(() => {});
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const handleCloseDetail = useCallback(() => {
    useStore.getState().setInspectedTx(null);
  }, []);

  const handleToggleInfo = useCallback(() => {
    setInfoOpen((prev) => !prev);
  }, []);

  const handleCloseInfo = useCallback(() => {
    setInfoOpen(false);
  }, []);

  return (
    <div className="overlay">
      {/* Onboarding */}
      <OnboardingCard />

      {/* Transition overlay */}
      {transitioning && <div className="transition-overlay" />}

      {/* Connection toast */}
      <ConnectionToast />

      {/* Loading indicator */}
      <LoadingIndicator />

      {/* Header */}
      <div className="overlay-header">
        <div className="logo">
          <span className="logo-icon">◉</span>
          <span className="logo-text">ChainPulse</span>
        </div>

        <div className="header-right">
        <div className="chain-selector">
          <button
            className={`chain-btn ${focusedChain === null ? 'active' : ''}`}
            style={{
              '--chain-color': '#888',
              '--chain-color-dim': '#88888840',
            } as React.CSSProperties}
            onClick={() => setFocusedChain(null)}
          >
            All
          </button>
          {Object.values(CHAINS).map((chain) => (
            <button
              key={chain.id}
              className={`chain-btn ${focusedChain === chain.id ? 'active' : ''}`}
              style={{
                '--chain-color': chain.color.primary,
                '--chain-color-dim': chain.color.primary + '40',
              } as React.CSSProperties}
              onClick={() =>
                setFocusedChain(focusedChain === chain.id ? null : chain.id)
              }
            >
              {chain.name}
            </button>
          ))}
        </div>
        <WalletButton />
        </div>
      </div>

      {/* Stats strip */}
      <StatsStrip />

      {/* Footer */}
      <div className="overlay-footer">
        <div className="hud-left">
          <TxCounter />
          <ModeToggle />
          <InfoButton onClick={handleToggleInfo} />
          <AudioToggle />
          <ScreenshotButton />
          <PortfolioPanel />
          {infoOpen && <InfoPanel onClose={handleCloseInfo} />}
        </div>

        <WhaleAlertsPanel recentWhales={recentWhales} />
      </div>

      {/* Replay timeline */}
      <ReplayTimeline />

      {/* Tx detail panel */}
      {inspectedTx && (
        <TxDetail tx={inspectedTx} onClose={handleCloseDetail} />
      )}
    </div>
  );
}
