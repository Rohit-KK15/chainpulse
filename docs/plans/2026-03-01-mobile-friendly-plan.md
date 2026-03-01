# Mobile-Friendly ChainPulse Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make ChainPulse fully mobile-friendly with a collapsible drawer, enlarged touch targets, safe area support, and 3D scene optimizations.

**Architecture:** CSS-first approach. One new `useIsMobile` hook (matchMedia) and one new `MobileDrawer` component added inline to Overlay.tsx. The mobile breakpoint is 768px. Desktop UI is unchanged. The 3D scene gets mobile-aware defaults for camera, bloom, and DPR.

**Tech Stack:** React, CSS custom properties, matchMedia API, Three.js/R3F

**No test suite exists in this project** — skip TDD steps. Verify with `npx tsc --noEmit` and `npx vite build` after each task.

---

### Task 1: Viewport Meta + Safe Area Foundation

**Files:**
- Modify: `index.html:5`
- Modify: `src/App.css:1999-2066` (mobile media query section)

**Step 1: Update viewport meta tag**

In `index.html`, change line 5 from:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```
to:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

**Step 2: Add safe area insets to overlay**

In `src/App.css`, find the `.overlay` rule (around line 88) and add safe area padding:
```css
.overlay {
  /* existing styles stay */
  padding: var(--space-3xl);
  padding-top: max(var(--space-3xl), env(safe-area-inset-top));
  padding-bottom: max(var(--space-3xl), env(safe-area-inset-bottom));
  padding-left: max(var(--space-3xl), env(safe-area-inset-left));
  padding-right: max(var(--space-3xl), env(safe-area-inset-right));
}
```

**Step 3: Update mobile media query breakpoint**

Replace the existing `@media (max-width: 640px)` block (lines 2001-2066) with `@media (max-width: 768px)` and keep all existing rules inside it. Also add font size overrides:
```css
@media (max-width: 768px) {
  :root {
    --font-size-xs: 10px;
    --font-size-sm: 11px;
    --font-size-base: 12px;
    --font-size-md: 13px;
  }

  /* ... keep all existing mobile rules ... */
}
```

**Step 4: Verify**

Run: `npx tsc --noEmit && npx vite build`
Expected: Clean build, no errors.

**Step 5: Commit**

```bash
git add index.html src/App.css
git commit -m "feat: add viewport-fit=cover, safe areas, and bump mobile breakpoint to 768px"
```

---

### Task 2: useIsMobile Hook + MobileDrawer Component

**Files:**
- Modify: `src/ui/Overlay.tsx:1-8` (imports), `src/ui/Overlay.tsx:1219-1370` (Overlay component)

**Step 1: Add useIsMobile hook**

Add this hook after the imports section (after line 8) in `src/ui/Overlay.tsx`:

```tsx
// ── Mobile detection ──────────────────────────

function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth <= breakpoint
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}
```

**Step 2: Add MobileDrawer component**

Add this component before the `Overlay` function (before line 1219):

```tsx
// ── Mobile Drawer ─────────────────────────────

function MobileDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`mobile-drawer-backdrop ${open ? 'open' : ''}`}
        onClick={onClose}
      />
      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className={`mobile-drawer ${open ? 'open' : ''}`}
      >
        <div className="mobile-drawer-header">
          <span className="mobile-drawer-title">Controls</span>
          <button className="mobile-drawer-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="mobile-drawer-body">
          {children}
        </div>
      </div>
    </>
  );
}
```

**Step 3: Update the Overlay component to use mobile drawer**

In the `Overlay` function, add state and conditional rendering:

1. Add `useIsMobile` and drawer state after existing state (after line 1230):
```tsx
const isMobile = useIsMobile();
const [drawerOpen, setDrawerOpen] = useState(false);
```

2. Replace the `{/* Header */}` section (lines 1282-1323) with:
```tsx
      {/* Header */}
      <div className="overlay-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">◉</span>
            <span className="logo-text">ChainPulse</span>
          </div>
          {!isMobile && <StatsStrip />}
        </div>

        {isMobile ? (
          <button
            className="mobile-menu-btn"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        ) : (
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
          </div>
        )}
      </div>

      {/* Mobile drawer */}
      {isMobile && (
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          <div className="mobile-drawer-section">
            <div className="mobile-drawer-section-label">Stats</div>
            <StatsStrip />
          </div>
          <div className="mobile-drawer-section">
            <div className="mobile-drawer-section-label">Chains</div>
            <div className="chain-selector mobile-chain-selector">
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
                All Chains
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
          </div>
          <div className="mobile-drawer-section">
            <div className="mobile-drawer-section-label">Tokens</div>
            <TokenFilter />
          </div>
        </MobileDrawer>
      )}
```

3. Update the HoverTooltip rendering (line 1367) to skip on mobile:
```tsx
      {/* Hover tooltip — desktop only */}
      {!isMobile && <HoverTooltip />}
```

**Step 4: Verify**

Run: `npx tsc --noEmit && npx vite build`
Expected: Clean build.

**Step 5: Commit**

```bash
git add src/ui/Overlay.tsx
git commit -m "feat: add mobile drawer with hamburger menu and useIsMobile hook"
```

---

### Task 3: Mobile Drawer CSS + Touch Target Styles

**Files:**
- Modify: `src/App.css` — add drawer styles and enlarge touch targets in mobile query

**Step 1: Add mobile drawer styles**

Insert before the responsive section (before line 1999) in `src/App.css`:

```css
/* ── Mobile Drawer ──────────────────────────── */

.mobile-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: var(--bg-surface);
  border: 1px solid var(--border-dim);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  pointer-events: auto;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.mobile-menu-btn:hover {
  background: var(--bg-surface-hover);
  border-color: var(--border-medium);
  color: var(--text-primary);
}

.mobile-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 150;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.mobile-drawer-backdrop.open {
  pointer-events: auto;
  opacity: 1;
}

.mobile-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(320px, 85vw);
  background: rgba(8, 8, 20, 0.96);
  backdrop-filter: blur(24px) saturate(1.3);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 200;
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) 0;
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.5);
}

.mobile-drawer.open {
  transform: translateX(0);
}

.mobile-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-xl);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.mobile-drawer-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text-primary);
}

.mobile-drawer-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: none;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
}

.mobile-drawer-close:hover {
  color: var(--text-primary);
  border-color: var(--border-medium);
}

.mobile-drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.06) transparent;
}

.mobile-drawer-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.mobile-drawer-section-label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 1.2px;
  font-weight: 600;
  color: var(--text-faint);
}

.mobile-chain-selector {
  flex-direction: column !important;
  gap: var(--space-sm) !important;
}

.mobile-chain-selector .chain-btn {
  width: 100%;
  justify-content: flex-start;
  min-height: 44px;
  padding: var(--space-md) var(--space-lg) !important;
  font-size: var(--font-size-md) !important;
}
```

**Step 2: Update mobile media query with enlarged touch targets**

Update the `@media (max-width: 768px)` block to include touch target and drawer-aware rules:

```css
@media (max-width: 768px) {
  :root {
    --font-size-xs: 10px;
    --font-size-sm: 11px;
    --font-size-base: 12px;
    --font-size-md: 13px;
  }

  .overlay {
    padding: var(--space-xl);
    padding-top: max(var(--space-xl), env(safe-area-inset-top));
    padding-bottom: max(var(--space-xl), env(safe-area-inset-bottom));
    padding-left: max(var(--space-xl), env(safe-area-inset-left));
    padding-right: max(var(--space-xl), env(safe-area-inset-right));
  }

  .overlay-header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .header-left {
    gap: var(--space-md);
  }

  /* Enlarge toolbar buttons for touch */
  .info-btn,
  .screenshot-btn {
    width: 36px;
    height: 36px;
  }

  .info-btn svg,
  .screenshot-btn svg {
    width: 14px;
    height: 14px;
  }

  /* Whale slider thumb enlarged for touch */
  .whale-slider-input::-webkit-slider-thumb {
    width: 20px;
    height: 20px;
    margin-top: -8.5px;
  }

  .whale-slider-input {
    width: 80px;
    height: 20px;
  }

  /* Stats strip in drawer: full width */
  .mobile-drawer .stats-strip {
    width: 100%;
    flex-wrap: wrap;
    padding: var(--space-md);
    gap: var(--space-md);
  }

  .stat-divider {
    display: none;
  }

  /* Token filter in drawer: full width */
  .mobile-drawer .token-filter-wrapper {
    width: 100%;
  }

  .mobile-drawer .token-filter-btn {
    width: 100%;
    min-height: 44px;
    justify-content: center;
  }

  .mobile-drawer .token-filter-dropdown {
    position: relative;
    width: 100%;
    right: 0;
    top: var(--space-md);
    max-height: 50vh;
  }

  .token-filter-dropdown {
    width: calc(100vw - 32px);
    right: -60px;
  }

  /* Whale alerts compact */
  .whale-alert {
    font-size: var(--font-size-base);
    padding: var(--space-sm) var(--space-lg);
    min-height: 36px;
  }

  .whale-alert-from {
    display: none;
  }

  .whale-history-toggle {
    min-height: 36px;
    padding: var(--space-sm) var(--space-lg);
  }

  /* Tx detail: bottom-sheet style */
  .tx-detail {
    width: calc(100vw - 32px);
    left: 16px !important;
    top: auto !important;
    bottom: 16px;
    bottom: max(16px, env(safe-area-inset-bottom));
  }

  /* Info panel: full width */
  .ip {
    width: calc(100vw - 32px);
    left: 0;
  }

  /* Whale history panel: full width */
  .whale-history-panel {
    width: calc(100vw - 32px);
    right: 0;
  }

  /* Footer toolbar wrap */
  .toolbar {
    flex-wrap: wrap;
    gap: var(--space-sm);
  }
}
```

**Step 3: Verify**

Run: `npx tsc --noEmit && npx vite build`
Expected: Clean build.

**Step 4: Commit**

```bash
git add src/App.css
git commit -m "feat: add mobile drawer CSS, enlarged touch targets, and responsive overrides"
```

---

### Task 4: 3D Scene Mobile Optimizations

**Files:**
- Modify: `src/visualization/Scene.tsx:16-21` (useIsTouchDevice), `src/visualization/Scene.tsx:66-131` (Scene component)

**Step 1: Add useIsMobile to Scene**

Add a `useIsMobile` hook in Scene.tsx (after the existing `useIsTouchDevice` on line 16). Since we can't import from Overlay, duplicate the hook here:

```tsx
function useIsMobile(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(max-width: 768px)');
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia('(max-width: 768px)').matches,
  );
}
```

**Step 2: Use mobile flag in Scene component**

In the `Scene` function (line 66), add:
```tsx
const isMobile = useIsMobile();
```

Then update the Canvas and its children:

1. Change `dpr` (line 95):
```tsx
dpr={isMobile ? [1, 1.5] : [1, 2]}
```

2. Change camera position (line 94):
```tsx
camera={{ position: [0, 0, isMobile ? 26 : 22], fov: 60, near: 0.1, far: 100 }}
```

3. Change Bloom intensity (line 110):
```tsx
<Bloom
  intensity={isMobile ? 1.0 : 1.5}
  luminanceThreshold={0.12}
  luminanceSmoothing={0.9}
  mipmapBlur
/>
```

4. Change autoRotate (line 123) — enable on touch at slower speed:
```tsx
autoRotate={!reducedMotion}
autoRotateSpeed={isTouch ? 0.1 : 0.2}
```

**Step 3: Verify**

Run: `npx tsc --noEmit && npx vite build`
Expected: Clean build.

**Step 4: Commit**

```bash
git add src/visualization/Scene.tsx
git commit -m "feat: optimize 3D scene for mobile — lower DPR, wider camera, reduced bloom"
```

---

### Task 5: Tx Detail Bottom-Sheet on Mobile + Final Polish

**Files:**
- Modify: `src/ui/Overlay.tsx:129-160` (TxDetail positioning)

**Step 1: Make TxDetail mobile-aware**

In the `TxDetail` function (line 129), the positioning logic currently calculates `left` and `top` from click coordinates. On mobile, override to use bottom-sheet positioning.

Add mobile detection and override the style:

```tsx
function TxDetail({ tx, onClose }: { tx: InspectedTx; onClose: () => void }) {
  const chain = CHAINS[tx.chainId];
  const panelRef = useRef<HTMLDivElement>(null);
  const fromENS = useENSName(tx.from);
  const toENS = useENSName(tx.to);
  const isMobile = useIsMobile();

  // Position the panel near the click, clamped to viewport using visualViewport
  const vw = window.visualViewport?.width ?? document.documentElement.clientWidth;
  const vh = window.visualViewport?.height ?? document.documentElement.clientHeight;
  const style: React.CSSProperties = isMobile
    ? {} // CSS handles bottom-sheet positioning via .tx-detail on mobile
    : {
        left: Math.max(0, Math.min(tx.screenX + 12, vw - 320)),
        top: Math.max(0, Math.min(tx.screenY - 20, vh - 400)),
      };
  // ... rest unchanged
```

**Step 2: Verify full build**

Run: `npx tsc --noEmit && npx vite build`
Expected: Clean build, zero errors.

**Step 3: Commit**

```bash
git add src/ui/Overlay.tsx
git commit -m "feat: position tx detail as bottom-sheet on mobile"
```

---

### Task 6: Final Verification + Landscape Polish

**Files:**
- Modify: `src/App.css` (landscape media query)

**Step 1: Update landscape query**

Expand the landscape query from `max-height: 480px` to `max-height: 500px` and add drawer awareness:

```css
@media (max-height: 500px) and (orientation: landscape) {
  .overlay {
    padding: var(--space-md) var(--space-xl);
  }

  .stats-strip {
    padding: var(--space-xs) var(--space-md);
  }

  .whale-alerts {
    max-height: 60px;
    overflow: hidden;
  }

  .ip-body {
    max-height: 30vh;
  }

  .mobile-drawer-body {
    padding: var(--space-md);
    gap: var(--space-md);
  }
}
```

**Step 2: Run full verification**

Run: `npx tsc --noEmit && npx vite build`
Expected: Clean build.

**Step 3: Commit all remaining changes**

```bash
git add src/App.css
git commit -m "feat: improve landscape mobile layout"
```

---

## Summary of Changes

| File | Changes |
|------|---------|
| `index.html` | `viewport-fit=cover` |
| `src/ui/Overlay.tsx` | `useIsMobile` hook, `MobileDrawer` component, conditional mobile header with hamburger, skip HoverTooltip on mobile, TxDetail bottom-sheet positioning |
| `src/App.css` | Mobile drawer styles, 768px breakpoint, enlarged touch targets (44px min), safe area insets, font size bumps, bottom-sheet tx detail, landscape improvements |
| `src/visualization/Scene.tsx` | `useIsMobile` hook, mobile-aware camera (z=26), DPR cap (1.5), bloom reduction (1.0), autoRotate on touch (0.1 speed) |
