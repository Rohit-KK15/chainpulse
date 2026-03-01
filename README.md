<div align="center">

<h1>◉ ChainPulse</h1>

Real-time 3D visualization of blockchain activity across multiple chains.

Watch transactions flow as particles, spot whale transfers, and see cross-chain bridge activity — all rendered in an interactive 3D scene.

</div>

## Features

- **7 chains** — Ethereum, Polygon, Arbitrum, Base, Optimism, Avalanche, BSC
- **Live transaction particles** — each transaction spawns a particle sized by value and colored by chain/token
- **Whale alerts** — large transfers (configurable threshold, default $1M) trigger alerts with on-chain links
- **Bridge arcs** — cross-chain transfers render as animated arcs between chain nodes
- **Block pulses** — ripple effects on each chain node when new blocks arrive
- **Chain & token filters** — toggle chains on/off, filter by token (popular tokens + CoinGecko search)
- **Transaction inspector** — click any particle to view tx details, addresses (with ENS resolution), and explorer links
- **Gas tracking** — per-chain and global average gas price stats
- **Screenshot** — capture the scene with watermarked branding

## Tech Stack

- **React 18** + **TypeScript** + **Vite**
- **Three.js** / **React Three Fiber** — 3D scene with custom GLSL shaders
- **ethers.js** — WebSocket connections to chain RPCs
- **Zustand** — state management with localStorage persistence
- **CoinGecko API** — token prices and token list search

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Production build
npm run build
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_DEV_MODE` | Set to `"true"` to enable the simulation/live toggle in the UI |

In production, the app always connects to live chain data via WebSocket RPCs. Dev mode allows switching to simulated transactions for testing.

## Project Structure

```
src/
├── config/          # Chain definitions, bridges, token registry
├── data/            # RPC connections, price feeds, token list service
├── hooks/           # useChainData hook (data pipeline)
├── processing/      # Transaction queue, whale detection, activity monitor
├── stores/          # Zustand store (app state + persistence)
├── ui/              # Overlay UI (toolbar, filters, panels, alerts)
├── utils/           # ENS cache, color helpers, WebGL check
└── visualization/   # 3D scene, particles, block pulses, bridge arcs, shaders
```

## How It Works

1. **Data** — WebSocket connections to each chain's RPC stream new blocks and transactions in real-time. If a connection fails, it falls back to simulation.
2. **Processing** — Transactions are mapped, queued per-chain with fair round-robin drain, and checked against adaptive whale thresholds.
3. **Visualization** — A GPU-instanced particle system renders transactions as glowing points in 3D space around their chain's node. Whales get oversized particles, bridges get animated arcs, and new blocks emit ripple pulses.

## License

MIT

---

Made with ❤️ by Rohit KK
