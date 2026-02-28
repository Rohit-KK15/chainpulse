import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore, InspectedTx, WhaleRecord } from '../stores/useStore';
import { CHAINS } from '../config/chains';

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
      <CopyField label="From" value={tx.from} mono />
      <CopyField
        label="To"
        value={tx.to ?? 'Contract Creation'}
        mono={!!tx.to}
      />
      <div className="detail-row">
        <span className="detail-label">Value</span>
        <span className="detail-value">
          {safeValue} {valueUnit}
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
    </div>
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

function WhaleAlertsPanel({ recentWhales }: { recentWhales: import('../data/types').ProcessedTransaction[] }) {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <div className="whale-alerts-container">
      <div className="whale-alerts">
        {recentWhales.map((whale) => {
          const chain = CHAINS[whale.chainId];
          return (
            <a
              key={whale.hash}
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
      </div>

      {/* Stats strip */}
      <StatsStrip />

      {/* Footer */}
      <div className="overlay-footer">
        <div className="hud-left">
          <TxCounter />
          <ModeToggle />
          <InfoButton onClick={handleToggleInfo} />
          {infoOpen && <InfoPanel onClose={handleCloseInfo} />}
        </div>

        <WhaleAlertsPanel recentWhales={recentWhales} />
      </div>

      {/* Tx detail panel */}
      {inspectedTx && (
        <TxDetail tx={inspectedTx} onClose={handleCloseDetail} />
      )}
    </div>
  );
}
