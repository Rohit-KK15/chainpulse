import { CHAINS } from '../config/chains';
import type { RawTransaction, ProcessedTransaction } from '../data/types';
import { isWhale } from './WhaleDetector';
import { adaptiveWhaleDetector } from './AdaptiveWhaleDetector';
import { hexToRgb, lerpColor } from '../utils/color';

const MAX_VALUE = 50;
const MAX_GAS_GWEI = 200;
const LOG_MAX = Math.log(1 + MAX_VALUE);

export function mapTransaction(raw: RawTransaction): ProcessedTransaction {
  const config = CHAINS[raw.chainId];
  const valueInToken = Number(raw.value) / 1e18;
  const gasPriceGwei = Number(raw.gasPrice) / 1e9;

  // Feed value into adaptive threshold before whale check
  adaptiveWhaleDetector.recordValue(raw.chainId, valueInToken);
  const whale = isWhale(raw);

  // Logarithmic normalization: spreads small values, compresses large ones
  const logNorm = Math.min(Math.log(1 + valueInToken) / LOG_MAX, 1);
  const size = whale ? 1 : Math.pow(logNorm, 0.5) * 0.8 + 0.05;
  const heat = Math.min(gasPriceGwei / MAX_GAS_GWEI, 1);
  const intensity = whale ? 1 : Math.pow(logNorm, 0.4) * 0.8 + 0.2;

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
