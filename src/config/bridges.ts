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
];

export function detectBridge(toAddress: string | null): BridgeContract | null {
  if (!toAddress) return null;
  const lower = toAddress.toLowerCase();
  return BRIDGE_CONTRACTS.find((b) => b.address === lower) ?? null;
}
