import { CHAINS } from '../config/chains';
import type { RawTransaction, ProcessedTransaction } from '../data/types';
import { isWhale } from './WhaleDetector';
import { hexToRgb, lerpColor } from '../utils/color';

const MAX_VALUE = 50;
const MAX_GAS_GWEI = 200;

export function mapTransaction(raw: RawTransaction): ProcessedTransaction {
  const config = CHAINS[raw.chainId];
  const valueInToken = Number(raw.value) / 1e18;
  const gasPriceGwei = Number(raw.gasPrice) / 1e9;
  const whale = isWhale(raw);

  const sizeNorm = Math.min(valueInToken / MAX_VALUE, 1);
  const size = whale ? 1 : Math.pow(sizeNorm, 0.4) * 0.6 + 0.05;
  const heat = Math.min(gasPriceGwei / MAX_GAS_GWEI, 1);
  const intensity = whale ? 1 : Math.pow(sizeNorm, 0.3) * 0.7 + 0.3;

  const primary = hexToRgb(config?.color.primary ?? '#ffffff');
  const accent = hexToRgb(config?.color.accent ?? '#ffffff');
  const color = lerpColor(primary, accent, heat);

  return {
    hash: raw.hash,
    from: raw.from,
    to: raw.to,
    value: valueInToken,
    gasPrice: gasPriceGwei,
    blockNumber: raw.blockNumber,
    chainId: raw.chainId,
    timestamp: raw.timestamp,
    isWhale: whale,
    visual: { size, intensity, heat, color },
  };
}
