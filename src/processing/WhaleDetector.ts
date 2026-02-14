import { CHAINS } from '../config/chains';
import type { RawTransaction } from '../data/types';

export function isWhale(tx: RawTransaction): boolean {
  const config = CHAINS[tx.chainId];
  if (!config) return false;
  const valueInToken = Number(tx.value) / 1e18;
  return valueInToken >= config.whaleThreshold;
}
