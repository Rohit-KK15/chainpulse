// Known bridge contract addresses to detect cross-chain transfers
export interface BridgeContract {
  address: string;
  name: string;
  fromChain: string;
  toChain: string;
}

export const BRIDGE_CONTRACTS: BridgeContract[] = [
  // Polygon Bridge (Ethereum → Polygon)
  {
    address: '0xa0c68c638235ee32657e8f720a23cec1bfc6c9a8',
    name: 'Polygon Bridge',
    fromChain: 'ethereum',
    toChain: 'polygon',
  },
  {
    address: '0x401f6c983ea34274ec46f84d70b31c151321188b',
    name: 'Polygon ERC20 Bridge',
    fromChain: 'ethereum',
    toChain: 'polygon',
  },
  // Arbitrum Bridge (Ethereum → Arbitrum)
  {
    address: '0x8315177ab297ba92a06054ce80a67ed4dbd7ed3a',
    name: 'Arbitrum Bridge',
    fromChain: 'ethereum',
    toChain: 'arbitrum',
  },
  {
    address: '0x4dbd4fc535ac27206064b68ffcf827b0a60bab3f',
    name: 'Arbitrum Delayed Inbox',
    fromChain: 'ethereum',
    toChain: 'arbitrum',
  },
  // Base Bridge (Ethereum → Base)
  {
    address: '0x3154cf16ccdb4c6d922629664174b904d80f2c35',
    name: 'Base Bridge',
    fromChain: 'ethereum',
    toChain: 'base',
  },
  // Optimism Gateway (Ethereum → Optimism)
  {
    address: '0x99c9fc46f92e8a1c0dec1b1747d010903e884be1',
    name: 'Optimism Gateway',
    fromChain: 'ethereum',
    toChain: 'optimism',
  },
  // Avalanche Bridge (Ethereum → Avalanche)
  {
    address: '0x8eb8a3b98659cce290402893d0123abb75e3ab28',
    name: 'Avalanche Bridge',
    fromChain: 'ethereum',
    toChain: 'avalanche',
  },
];

export function detectBridge(toAddress: string | null): BridgeContract | null {
  if (!toAddress) return null;
  const lower = toAddress.toLowerCase();
  return BRIDGE_CONTRACTS.find((b) => b.address === lower) ?? null;
}
