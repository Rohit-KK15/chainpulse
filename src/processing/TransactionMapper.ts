import { CHAINS } from '../config/chains';
import type { RawTransaction, ProcessedTransaction } from '../data/types';
import { isWhale } from './WhaleDetector';
import { adaptiveWhaleDetector } from './AdaptiveWhaleDetector';
import { hexToRgb, lerpColor } from '../utils/color';

const MAX_VALUE = 50;
const MAX_VALUE_STABLECOIN = 500_000;
const MAX_GAS_GWEI = 200;
const LOG_MAX = Math.log(1 + MAX_VALUE);
const LOG_MAX_STABLE = Math.log(1 + MAX_VALUE_STABLECOIN);

export function mapTransaction(raw: RawTransaction): ProcessedTransaction {
  const config = CHAINS[raw.chainId];
  const tt = raw.tokenTransfer;

  // Determine value and whale key based on whether this is a token transfer
  let valueInToken: number;
  let whaleKey: string;
  let logMax: number;

  if (tt) {
    valueInToken = Number(tt.rawValue) / Math.pow(10, tt.decimals);
    whaleKey = `${raw.chainId}:${tt.symbol}`;
    logMax = tt.isStablecoin ? LOG_MAX_STABLE : LOG_MAX;
  } else {
    valueInToken = Number(raw.value) / 1e18;
    whaleKey = raw.chainId;
    logMax = LOG_MAX;
  }

  const gasPriceGwei = Number(raw.gasPrice) / 1e9;

  // Feed value into adaptive threshold before whale check
  adaptiveWhaleDetector.recordValue(whaleKey, valueInToken);
  const whale = tt
    ? adaptiveWhaleDetector.isWhale(whaleKey, valueInToken)
    : isWhale(raw);

  // Logarithmic normalization: spreads small values, compresses large ones
  const logNorm = Math.min(Math.log(1 + valueInToken) / logMax, 1);
  const size = whale ? 1 : Math.pow(logNorm, 0.5) * 0.8 + 0.05;
  const heat = Math.min(gasPriceGwei / MAX_GAS_GWEI, 1);
  const intensity = whale ? 1 : Math.pow(logNorm, 0.4) * 0.8 + 0.2;

  // Color: blend chain primary toward token accent color (if token) or chain accent (if native)
  const primary = hexToRgb(config?.color.primary ?? '#ffffff');
  let color: [number, number, number];
  if (tt) {
    const tokenAccent = hexToRgb(tt.color);
    const blendFactor = 0.5 + heat * 0.3;
    color = lerpColor(primary, tokenAccent, blendFactor);
  } else {
    const accent = hexToRgb(config?.color.accent ?? '#ffffff');
    color = lerpColor(primary, accent, heat);
  }

  const result: ProcessedTransaction = {
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

  if (tt) {
    result.tokenInfo = {
      symbol: tt.symbol,
      displayValue: valueInToken,
      isStablecoin: tt.isStablecoin,
    };
  }

  return result;
}
