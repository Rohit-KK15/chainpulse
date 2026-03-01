import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useStore, InspectedTx, WhaleRecord } from '../stores/useStore';
import { CHAINS } from '../config/chains';
import { walletManager } from '../wallet/WalletManager';
import { useENSName } from '../utils/ensCache';
import { soundEngine } from '../audio/SoundEngine';
import { fetchPortfolio } from '../wallet/PortfolioTracker';
import { sceneCanvas } from '../visualization/Scene';
import { fetchPrices, formatUsdValue } from '../data/PriceFeed';
import { POPULAR_SYMBOLS, getChainTokens } from '../config/tokenRegistry';
import { searchTokens, initTokenLists, type CachedToken } from '../data/TokenListService';

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

// ── Value formatting (humanized) ─────────────

function formatHumanValue(v: number): string {
  if (!Number.isFinite(v) || v === 0) return '0';
  if (v < 0.0001) return '<0.0001';
  if (v < 1) return v.toPrecision(3);
  if (v < 1_000) return v.toFixed(2);
  if (v < 1_000_000) return `${(v / 1_000).toFixed(1)}K`;
  if (v < 1_000_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  return `${(v / 1_000_000_000).toFixed(2)}B`;
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

  const safeValue = formatHumanValue(tx.value);
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

// ── Hover Tooltip ──────────────────────────────

function HoverTooltip() {
  const hoveredTx = useStore((s) => s.hoveredTx);
  const inspectedTx = useStore((s) => s.inspectedTx);

  if (!hoveredTx || inspectedTx) return null;

  const chain = CHAINS[hoveredTx.chainId];
  const valueUnit = hoveredTx.tokenSymbol ?? chain?.nativeCurrency ?? '';
  const safeValue = formatHumanValue(hoveredTx.value);
  const usdValue = formatUsdValue(hoveredTx.value, valueUnit);

  // Position near cursor, clamped to viewport
  const vw = window.visualViewport?.width ?? document.documentElement.clientWidth;
  const vh = window.visualViewport?.height ?? document.documentElement.clientHeight;
  const tooltipW = 240;
  const tooltipH = 90;
  const style: React.CSSProperties = {
    left: Math.max(0, Math.min(hoveredTx.screenX + 16, vw - tooltipW - 8)),
    top: Math.max(0, Math.min(hoveredTx.screenY + 16, vh - tooltipH - 8)),
  };

  return (
    <div
      className="hover-tooltip"
      style={{
        ...style,
        '--chain-color': chain?.color.primary ?? '#fff',
      } as React.CSSProperties}
    >
      <div className="hover-tooltip-header">
        <span className="detail-chain-dot" style={{ background: chain?.color.primary }} />
        <span className="hover-tooltip-chain">{chain?.name ?? hoveredTx.chainId}</span>
        <span className="hover-tooltip-time">{formatRelativeTime(hoveredTx.timestamp)}</span>
      </div>
      <div className="hover-tooltip-row">
        <span className="hover-tooltip-value">
          {safeValue} {valueUnit}
          {usdValue && <span className="hover-tooltip-usd"> {usdValue}</span>}
        </span>
      </div>
      <div className="hover-tooltip-row hover-tooltip-hash">
        {truncateAddress(hoveredTx.hash)}
      </div>
      <div className="hover-tooltip-row hover-tooltip-addrs">
        {truncateAddress(hoveredTx.from)} → {hoveredTx.to ? truncateAddress(hoveredTx.to) : 'Contract'}
      </div>
    </div>
  );
}

// ── Connection Toast ──────────────────────────

const ConnectionToast = React.memo(function ConnectionToast() {
  const chainConnected = useStore((s) => s.chainConnected);
  const chainFailed = useStore((s) => s.chainFailed);
  const isSimulation = useStore((s) => s.isSimulation);
  const enabledChains = useStore((s) => s.enabledChains);

  if (isSimulation) return null;

  const chains = Object.values(CHAINS).filter((c) => enabledChains.has(c.id));
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
  const chainConnected = useStore((s) => s.chainConnected);
  const enabledChains = useStore((s) => s.enabledChains);

  const [txRate, setTxRate] = useState(0);
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
      <span className="stat-value">{txRate}</span>
      <span className="stat-label">tx/s</span>
      <div className="stat-divider" />
      <div className="stat-dots">
        {Object.values(CHAINS).filter((c) => enabledChains.has(c.id)).map((chain) => {
          const connected = chainConnected[chain.id];
          const health = getConnectionHealth(chain.id, chain.blockTime);
          const healthClass = health === 'warning' ? 'health-warning'
            : health === 'stale' ? 'health-stale'
            : connected ? 'connected' : '';
          return (
            <span
              key={chain.id}
              className={`status-dot ${healthClass}`}
              style={{ background: connected ? chain.color.primary : undefined }}
              title={`${chain.name}: ${connected ? 'connected' : 'connecting...'}`}
            />
          );
        })}
      </div>
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
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toLocaleString()}`;
}

const InfoButton = React.memo(function InfoButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="info-btn" onClick={onClick} aria-label="Show legend">
      i
    </button>
  );
});

const GAS_TYPES = [
  { label: 'Transfer', gas: 21_000 },
  { label: 'ERC-20', gas: 65_000 },
  { label: 'Swap', gas: 150_000 },
  { label: 'Mint', gas: 100_000 },
];

type InfoTab = 'guide' | 'gas' | 'settings';

function InfoPanel({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<InfoTab>('guide');
  const whaleThresholdUsd = useStore((s) => s.whaleThresholdUsd);
  const setWhaleThresholdUsd = useStore((s) => s.setWhaleThresholdUsd);
  const avgGasPerChain = useStore((s) => s.avgGasPerChain);
  const tokenPrices = useStore((s) => s.tokenPrices);
  const enabledChains = useStore((s) => s.enabledChains);

  const sliderValue = whaleThresholdUsd > 0 ? logToLinear(whaleThresholdUsd) : 0;

  const chains = useMemo(
    () => Object.values(CHAINS).filter((c) => enabledChains.has(c.id)),
    [enabledChains],
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
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
    <div ref={panelRef} className="ip">
      {/* Tab bar */}
      <div className="ip-tabs">
        <button className={`ip-tab ${tab === 'guide' ? 'on' : ''}`} onClick={() => setTab('guide')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          Guide
        </button>
        <button className={`ip-tab ${tab === 'gas' ? 'on' : ''}`} onClick={() => setTab('gas')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          Gas
        </button>
        <button className={`ip-tab ${tab === 'settings' ? 'on' : ''}`} onClick={() => setTab('settings')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Settings
        </button>
        <button className="ip-close" onClick={onClose}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* ── Guide tab ── */}
      {tab === 'guide' && (
        <div className="ip-body">
          <div className="ip-guide-grid">
            <div className="ip-guide-card">
              <span className="ip-guide-icon"><span className="ip-dot-anim" /></span>
              <span>Particles are transactions — bigger = higher value</span>
            </div>
            <div className="ip-guide-card">
              <span className="ip-guide-icon"><span className="ip-whale-anim" /></span>
              <span>Bright glow = whale transactions</span>
            </div>
            <div className="ip-guide-card">
              <span className="ip-guide-icon"><span className="ip-ring-anim" /></span>
              <span>Rings pulse when new blocks arrive</span>
            </div>
            <div className="ip-guide-card">
              <span className="ip-guide-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 15l-2 5L9 9l11 4-5 2z"/></svg>
              </span>
              <span>Click any particle to inspect</span>
            </div>
          </div>

          <div className="ip-sep" />

          <div className="ip-legend-label">Chains</div>
          <div className="ip-chips">
            {CHAIN_LEGEND.map((c) => (
              <span key={c.name} className="ip-chip" style={{ '--chip-color': c.color } as React.CSSProperties}>
                <span className="ip-chip-dot" />
                {c.name}
              </span>
            ))}
          </div>

          <div className="ip-legend-label" style={{ marginTop: 10 }}>Tokens</div>
          <div className="ip-chips">
            {TOKEN_LEGEND.map((t) => (
              <span key={t.symbol} className="ip-chip" style={{ '--chip-color': t.color } as React.CSSProperties}>
                <span className="ip-chip-dot" />
                {t.symbol}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Gas tab ── */}
      {tab === 'gas' && (
        <div className="ip-body">
          {chains.some((c) => avgGasPerChain[c.id] !== undefined) ? (
            <div className="ip-gas-list">
              {chains.map((c) => {
                const gasPrice = avgGasPerChain[c.id];
                if (gasPrice === undefined) return null;
                return (
                  <div key={c.id} className="ip-gas-card">
                    <div className="ip-gas-chain-row">
                      <span className="ip-gas-chain-dot" style={{ background: c.color.primary }} />
                      <span className="ip-gas-chain-name">{c.name}</span>
                      <span className="ip-gas-gwei">{formatGwei(gasPrice)} gwei</span>
                    </div>
                    <div className="ip-gas-costs">
                      {GAS_TYPES.map((est) => {
                        const costEth = (gasPrice * est.gas) / 1e9;
                        const nativePrice = tokenPrices[c.nativeCurrency];
                        const usdCost = nativePrice ? costEth * nativePrice : null;
                        const display = usdCost !== null
                          ? (usdCost < 0.01 ? '<$0.01' : `$${formatHumanValue(usdCost)}`)
                          : `${formatHumanValue(costEth)} ${c.nativeCurrency}`;
                        return (
                          <div key={est.label} className="ip-gas-cost-row">
                            <span className="ip-gas-type">{est.label}</span>
                            <span className="ip-gas-val">{display}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="ip-empty">Waiting for gas data...</div>
          )}
        </div>
      )}

      {/* ── Settings tab ── */}
      {tab === 'settings' && (
        <div className="ip-body">
          <div className="ip-setting">
            <div className="ip-setting-header">
              <span className="ip-setting-label">Whale Threshold</span>
              <span className="ip-setting-value">
                {whaleThresholdUsd > 0 ? formatUsd(whaleThresholdUsd) : 'Auto'}
              </span>
            </div>
            <div className="ip-setting-note">Minimum USD value for whale alerts on stablecoins</div>
            <input
              type="range"
              className="ip-slider"
              min={0}
              max={1}
              step={0.001}
              value={sliderValue}
              onChange={(e) => {
                const t = parseFloat(e.target.value);
                setWhaleThresholdUsd(t <= 0.001 ? 0 : linearToLog(t));
              }}
            />
            <div className="ip-slider-labels">
              <span>Auto</span>
              <span>$10K</span>
              <span>$100K</span>
              <span>$1M</span>
            </div>
          </div>
        </div>
      )}
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
        {balance && <span className="wallet-balance">{formatHumanValue(parseFloat(balance))} ETH</span>}
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
        {formatHumanValue(record.value)} {record.tokenSymbol ?? chain?.nativeCurrency}
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
  const [exitItem, setExitItem] = useState<import('../data/types').ProcessedTransaction | null>(null);
  const prevRef = useRef<import('../data/types').ProcessedTransaction[]>([]);
  const enteringHashRef = useRef<string | null>(null);

  const visible = recentWhales.slice(0, MAX_VISIBLE_WHALES);

  useEffect(() => {
    const prev = prevRef.current;
    const currentHashes = new Set(visible.map((w) => w.hash));

    // Detect the new item entering at the top
    if (visible.length > 0 && (prev.length === 0 || prev[0].hash !== visible[0].hash)) {
      enteringHashRef.current = visible[0].hash;
    }

    // Detect the item that fell off — keep the actual tx object for rendering
    const removed = prev.find((w) => !currentHashes.has(w.hash));
    if (removed) {
      setExitItem(removed);
      const timer = setTimeout(() => setExitItem(null), WHALE_EXIT_MS);
      prevRef.current = visible;
      return () => clearTimeout(timer);
    }

    prevRef.current = visible;
  }, [recentWhales]);

  // Build display: visible items + the exiting item appended at the bottom
  const displayList = exitItem
    ? [...visible, exitItem]
    : visible;

  return (
    <div className="whale-alerts-container">
      <div className="whale-alerts">
        {displayList.map((whale, i) => {
          const chain = CHAINS[whale.chainId];
          const isEntering = whale.hash === enteringHashRef.current && i === 0;
          const isExit = exitItem !== null && whale.hash === exitItem.hash;
          return (
            <div
              key={whale.hash}
              className={[
                'whale-alert-wrap',
                isEntering ? 'whale-alert-wrap--enter' : '',
                isExit ? 'whale-alert-wrap--exit' : '',
              ].filter(Boolean).join(' ')}
              onAnimationEnd={() => {
                if (isEntering) enteringHashRef.current = null;
              }}
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
                <span className="whale-alert-icon">🐋</span>
                <span className="whale-alert-chain-dot" style={{ background: chain?.color.primary }} />
                <span className="whale-alert-chain-name">{chain?.abbr}</span>
                <span className="whale-value">
                  {formatHumanValue(whale.value)} {whale.tokenInfo?.symbol ?? chain?.nativeCurrency}
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
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
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
                        <span className="portfolio-alloc-pct">{Math.round(pct)}%</span>
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
                      <span className="portfolio-flow-value">{formatHumanValue(netFlow.received)}</span>
                      <span className="portfolio-flow-label">Received</span>
                    </div>
                  </div>
                  <div className="portfolio-flow-divider" />
                  <div className="portfolio-flow-item">
                    <span className="portfolio-flow-arrow portfolio-flow-out">&darr;</span>
                    <div className="portfolio-flow-data">
                      <span className="portfolio-flow-value">{formatHumanValue(netFlow.sent)}</span>
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
                            {formatHumanValue(item.balance)}
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
                            <span className="portfolio-pct-text">{Math.round(pct)}%</span>
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

// ── Token Filter ────────────────────────────────

const TOKEN_GROUPS: { label: string; symbols: string[] }[] = [
  { label: 'Native', symbols: ['ETH', 'MATIC', 'AVAX', 'BNB'] },
  { label: 'Stablecoins', symbols: ['USDT', 'USDC', 'DAI'] },
  { label: 'Wrapped', symbols: ['WETH', 'WBTC', 'WBNB', 'WAVAX', 'cbETH', 'stETH', 'WETH.e', 'WBTC.e'] },
  { label: 'DeFi', symbols: ['UNI', 'LINK', 'AAVE', 'LDO', 'ARB', 'OP', 'POL', 'AERO', 'JOE', 'CAKE'] },
];

const TOKEN_COLORS: Record<string, string> = {
  ETH: '#627EEA', MATIC: '#8247E5', AVAX: '#E84142', BNB: '#F0B90B',
  USDT: '#26A17B', USDC: '#2775CA', DAI: '#F5AC37',
  WETH: '#EC1C79', WBTC: '#F7931A', UNI: '#FF007A',
  AAVE: '#B6509E', LINK: '#2A5ADA', LDO: '#00A3FF',
  stETH: '#00A3FF', ARB: '#28A0F0', OP: '#FF0420',
  POL: '#8247E5', cbETH: '#0052FF', AERO: '#0052FF',
  WAVAX: '#E84142', JOE: '#E84142', WBNB: '#F0B90B',
  CAKE: '#D1884F',
  'WETH.e': '#EC1C79', 'WBTC.e': '#F7931A',
};

function TokenFilter() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [cacheReady, setCacheReady] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const enabledChains = useStore((s) => s.enabledChains);
  const enabledTokens = useStore((s) => s.enabledTokens);
  const customTokens = useStore((s) => s.customTokens);
  const toggleToken = useStore((s) => s.toggleToken);
  const setAllTokens = useStore((s) => s.setAllTokens);
  const addCustomToken = useStore((s) => s.addCustomToken);

  // Signal when CoinGecko cache is ready so search useMemo re-triggers
  useEffect(() => {
    initTokenLists().then(() => setCacheReady(true)).catch(() => setCacheReady(true));
  }, []);

  // Build visible popular symbols from enabled chains
  const popularSymbols = useMemo(() => {
    const symbols = new Set<string>();
    for (const chainId of enabledChains) {
      const chainSymbols = POPULAR_SYMBOLS[chainId];
      if (chainSymbols) {
        for (const s of chainSymbols) symbols.add(s);
      }
    }
    return symbols;
  }, [enabledChains]);

  // Total and enabled counts for badge
  const totalPopular = popularSymbols.size + customTokens.size;
  const enabledCount = [...popularSymbols, ...customTokens].filter(s => enabledTokens.has(s)).length;
  const allEnabled = enabledCount === totalPopular;

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Search: try CoinGecko cache first, fall back to hardcoded token registry
  const searchResults = useMemo(() => {
    if (search.length < 2) return [];
    const known = new Set([...popularSymbols, ...customTokens]);

    // Try CoinGecko cache
    let results = searchTokens(search, [...enabledChains]);

    // If cache empty, search hardcoded registry as fallback
    if (results.length === 0) {
      const q = search.toLowerCase();
      const fallback: CachedToken[] = [];
      for (const chainId of enabledChains) {
        for (const entry of getChainTokens(chainId)) {
          if (entry.symbol.toLowerCase().includes(q)) {
            fallback.push({
              address: entry.address,
              symbol: entry.symbol,
              name: entry.symbol,
              decimals: entry.decimals,
              chainId,
            });
          }
        }
      }
      results = fallback;
    }

    return results.filter((t) => !known.has(t.symbol)).slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, enabledChains, popularSymbols, customTokens, cacheReady]);

  return (
    <div className="token-filter-wrapper" ref={dropdownRef}>
      <button
        className={`token-filter-btn ${open ? 'active' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        Tokens
        {!allEnabled && <span className="token-filter-badge">{enabledCount}</span>}
      </button>
      {open && (
        <div className="token-filter-dropdown">
          <div className="token-filter-header">
            <span className="token-filter-title">Filter Tokens</span>
            <div className="token-filter-actions">
              <button className={allEnabled ? 'active' : ''} onClick={() => setAllTokens(true)}>All</button>
              <button className={enabledCount === 0 ? 'active' : ''} onClick={() => setAllTokens(false)}>None</button>
            </div>
          </div>
          <div className="token-filter-search-wrap">
            <svg className="token-search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="token-filter-search"
              type="text"
              placeholder="Search tokens..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="token-filter-list">
            {TOKEN_GROUPS.map((group) => {
              const q = search.toLowerCase();
              const visible = group.symbols.filter(s =>
                popularSymbols.has(s) && (!q || s.toLowerCase().includes(q))
              );
              if (visible.length === 0) return null;
              return (
                <div key={group.label} className="token-group-section">
                  <div className="token-filter-group">{group.label}</div>
                  {visible.map((symbol) => {
                    const isOn = enabledTokens.has(symbol);
                    return (
                      <label key={symbol} className={`token-filter-item ${isOn ? 'on' : ''}`}>
                        <span
                          className="token-dot"
                          style={{ background: TOKEN_COLORS[symbol] ?? '#888' }}
                        />
                        <span className="token-label">{symbol}</span>
                        <span
                          className={`token-toggle ${isOn ? 'on' : ''}`}
                          onClick={(e) => { e.preventDefault(); toggleToken(symbol); }}
                        >
                          <span className="token-toggle-knob" />
                        </span>
                      </label>
                    );
                  })}
                </div>
              );
            })}
            {customTokens.size > 0 && (() => {
              const q = search.toLowerCase();
              const filtered = [...customTokens].filter(s => !q || s.toLowerCase().includes(q));
              if (filtered.length === 0) return null;
              return (
                <div className="token-group-section">
                  <div className="token-filter-group">Custom</div>
                  {filtered.map((symbol) => {
                    const isOn = enabledTokens.has(symbol);
                    return (
                      <label key={symbol} className={`token-filter-item ${isOn ? 'on' : ''}`}>
                        <span className="token-dot" style={{ background: '#888' }} />
                        <span className="token-label">{symbol}</span>
                        <span
                          className={`token-toggle ${isOn ? 'on' : ''}`}
                          onClick={(e) => { e.preventDefault(); toggleToken(symbol); }}
                        >
                          <span className="token-toggle-knob" />
                        </span>
                      </label>
                    );
                  })}
                </div>
              );
            })()}
            {searchResults.length > 0 && (
              <div className="token-group-section">
                <div className="token-filter-group">Search Results</div>
                {searchResults.map((t) => (
                  <button
                    key={`${t.chainId}:${t.address}`}
                    className="token-filter-result"
                    onClick={() => {
                      addCustomToken(t.symbol);
                      setSearch('');
                    }}
                  >
                    <span className="token-dot" style={{ background: '#888' }} />
                    <span className="token-result-info">
                      <span className="token-label">{t.symbol}</span>
                      <span className="token-result-name">{t.name}</span>
                    </span>
                    <span className="token-result-chain">{CHAINS[t.chainId]?.abbr ?? t.chainId}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Overlay ───────────────────────────────

export function Overlay() {
  const setFocusedChain = useStore((s) => s.setFocusedChain);
  const recentWhales = useStore((s) => s.recentWhales);
  const inspectedTx = useStore((s) => s.inspectedTx);
  const transitioning = useStore((s) => s.transitioning);
  const enabledChains = useStore((s) => s.enabledChains);
  const enabledTokens = useStore((s) => s.enabledTokens);
  const toggleChain = useStore((s) => s.toggleChain);
  const setAllChains = useStore((s) => s.setAllChains);
  const [infoOpen, setInfoOpen] = useState(false);

  // Filter whales to only enabled chains & tokens
  const filteredWhales = useMemo(() =>
    recentWhales.filter((w) => {
      if (!enabledChains.has(w.chainId)) return false;
      const symbol = w.tokenInfo?.symbol ?? CHAINS[w.chainId]?.nativeCurrency;
      if (symbol && !enabledTokens.has(symbol)) return false;
      return true;
    }),
    [recentWhales, enabledChains, enabledTokens],
  );

  // Fetch token prices on mount and refresh every 60s; also init token lists
  useEffect(() => {
    initTokenLists().catch(() => {});
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
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">◉</span>
            <span className="logo-text">ChainPulse</span>
          </div>
          <StatsStrip />
        </div>

        <div className="header-right">
        <div className="chain-selector">
          <button
            className={`chain-btn ${enabledChains.size === Object.keys(CHAINS).length ? 'active' : ''}`}
            style={{
              '--chain-color': '#888',
              '--chain-color-dim': '#88888840',
            } as React.CSSProperties}
            onClick={() => {
              setAllChains(true);
              setFocusedChain(null);
            }}
          >
            All
          </button>
          {Object.values(CHAINS).map((chain) => (
            <button
              key={chain.id}
              className={`chain-btn ${enabledChains.has(chain.id) ? 'active' : 'disabled'}`}
              style={{
                '--chain-color': chain.color.primary,
                '--chain-color-dim': chain.color.primary + '40',
              } as React.CSSProperties}
              onClick={() => toggleChain(chain.id)}
            >
              {chain.abbr}
            </button>
          ))}
        </div>
        <TokenFilter />
        <WalletButton />
        </div>
      </div>


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

        <WhaleAlertsPanel recentWhales={filteredWhales} />
      </div>

      {/* Tx detail panel */}
      {inspectedTx && (
        <TxDetail tx={inspectedTx} onClose={handleCloseDetail} />
      )}

      {/* Hover tooltip */}
      <HoverTooltip />
    </div>
  );
}
