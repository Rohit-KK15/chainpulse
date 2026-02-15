import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore, InspectedTx } from '../stores/useStore';
import { CHAINS } from '../config/chains';

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

// ── Copyable field ─────────────────────────────

function CopyField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className={`detail-value ${mono ? 'mono' : ''}`}>{value}</span>
      <button
        className="whale-copy"
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}

// ── Tx Detail Panel ────────────────────────────

function TxDetail({ tx, onClose }: { tx: InspectedTx; onClose: () => void }) {
  const chain = CHAINS[tx.chainId];
  const panelRef = useRef<HTMLDivElement>(null);

  // Position the panel near the click, clamped to viewport
  const style: React.CSSProperties = {
    left: Math.min(tx.screenX + 12, window.innerWidth - 320),
    top: Math.min(tx.screenY - 20, window.innerHeight - 280),
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
        <span className="detail-value">{tx.value.toFixed(4)} {chain?.nativeCurrency}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Gas</span>
        <span className="detail-value">{tx.gasPrice.toFixed(1)} gwei</span>
      </div>
    </div>
  );
}

// ── Connection Toast ──────────────────────────

function ConnectionToast() {
  const chainConnected = useStore((s) => s.chainConnected);
  const isSimulation = useStore((s) => s.isSimulation);

  if (isSimulation) return null;

  const chains = Object.values(CHAINS);
  const disconnected = chains.filter((c) => chainConnected[c.id] === false);

  if (disconnected.length === 0) return null;

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
    </div>
  );
}

// ── Stats Strip ────────────────────────────────

function StatsStrip() {
  const txCount = useStore((s) => s.txCount);
  const avgGas = useStore((s) => s.avgGas);
  const recentWhales = useStore((s) => s.recentWhales);
  const latestBlocks = useStore((s) => s.latestBlocks);
  const chainConnected = useStore((s) => s.chainConnected);

  const [txRate, setTxRate] = useState(0);
  const prevCountRef = useRef(txCount);

  useEffect(() => {
    const id = setInterval(() => {
      const current = useStore.getState().txCount;
      setTxRate(current - prevCountRef.current);
      prevCountRef.current = current;
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
        <span className="stat-value">{avgGas.toFixed(0)}</span>
        <span className="stat-label">GWEI</span>
      </div>
      <div className="stat">
        <span className="stat-value">{recentWhales.length}</span>
        <span className="stat-label">WHALES</span>
      </div>
      <div className="stat-divider" />
      {Object.values(CHAINS).map((chain) => {
        const block = latestBlocks[chain.id];
        const connected = chainConnected[chain.id];
        return (
          <div key={chain.id} className="stat chain-stat">
            <span
              className={`status-dot ${connected ? 'connected' : ''}`}
              style={{ background: connected ? chain.color.primary : undefined }}
            />
            <span className="stat-label">{chain.name.slice(0, 3).toUpperCase()}</span>
            {block ? (
              <span className="stat-block">#{block.toLocaleString()}</span>
            ) : (
              <span className="stat-block">--</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Overlay ───────────────────────────────

export function Overlay() {
  const focusedChain = useStore((s) => s.focusedChain);
  const setFocusedChain = useStore((s) => s.setFocusedChain);
  const isSimulation = useStore((s) => s.isSimulation);
  const setSimulation = useStore((s) => s.setSimulation);
  const txCount = useStore((s) => s.txCount);
  const recentWhales = useStore((s) => s.recentWhales);
  const inspectedTx = useStore((s) => s.inspectedTx);
  const transitioning = useStore((s) => s.transitioning);

  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const handleCloseDetail = useCallback(() => {
    useStore.getState().setInspectedTx(null);
  }, []);

  return (
    <div className="overlay">
      {/* Transition overlay */}
      {transitioning && <div className="transition-overlay" />}

      {/* Connection toast */}
      <ConnectionToast />

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
          <div className="hud-item">
            <span className="hud-label">Total TX</span>
            <span className="hud-value">{txCount.toLocaleString()}</span>
          </div>
          <button
            className="mode-toggle"
            onClick={() => setSimulation(!isSimulation)}
          >
            {isSimulation ? 'Go Live' : 'Simulate'}
          </button>
        </div>

        <div className="whale-alerts">
          {recentWhales.map((whale) => (
            <div
              key={whale.hash}
              className="whale-alert"
              style={{
                '--chain-color': CHAINS[whale.chainId]?.color.primary ?? '#fff',
              } as React.CSSProperties}
            >
              <span className="whale-emoji">🐋</span>
              <span className="whale-value">
                {whale.value.toFixed(2)} {CHAINS[whale.chainId]?.nativeCurrency}
              </span>
              <span className="whale-hash">
                {whale.hash.slice(0, 10)}...{whale.hash.slice(-4)}
              </span>
              <button
                className="whale-copy"
                onClick={() => {
                  navigator.clipboard.writeText(whale.hash);
                  setCopiedHash(whale.hash);
                  setTimeout(() => setCopiedHash(null), 1500);
                }}
              >
                {copiedHash === whale.hash ? <CheckIcon /> : <CopyIcon />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Tx detail panel */}
      {inspectedTx && (
        <TxDetail tx={inspectedTx} onClose={handleCloseDetail} />
      )}
    </div>
  );
}
