import { adaptiveWhaleDetector } from './AdaptiveWhaleDetector';
import type { RawTransaction } from '../data/types';

export function isWhale(tx: RawTransaction): boolean {
  const valueInToken = Number(tx.value) / 1e18;
  return adaptiveWhaleDetector.isWhale(tx.chainId, valueInToken);
}
