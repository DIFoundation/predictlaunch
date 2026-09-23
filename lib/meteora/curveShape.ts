import BN from "bn.js";

/**
 * Deterministic shape of a DBC bonding curve: price vs. cumulative SOL raised, from the pool's
 * own config -- no RPC, no history, nothing invented. Uses the SAME delta-reserve formulas the
 * Meteora program uses on-chain (getDeltaAmountQuoteUnsigned), so every point on the line is a
 * real point the curve passes through.
 *
 * A DBC config is a sequence of constant-liquidity segments, each an upper sqrtPrice bound. We
 * walk the segments accumulating quote (SOL) raised, sampling several points inside each segment,
 * and stop once the configured migration threshold is reached (later "safety" segments beyond
 * that, if any, are not part of the curve a trader actually experiences).
 */

export interface CurvePoint {
  quoteReserveSol: number;
  priceSol: number;
}

export interface CurveShapeInput {
  curve: { sqrtPrice: BN; liquidity: BN }[];
  sqrtStartPrice: BN;
  migrationQuoteThreshold: BN;
  tokenDecimal: number;
}

const QUOTE_DECIMALS = 9; // SOL

export function computeCurveShape(
  cfg: CurveShapeInput,
  getDeltaAmountQuoteUnsigned: (lower: BN, upper: BN, liquidity: BN, round: number) => BN,
  getPriceFromSqrtPrice: (sqrtPrice: BN, baseDecimals: number, quoteDecimals: number) => { toNumber(): number },
  roundingDown: number,
  samplesPerSegment = 14
): CurvePoint[] {
  const thresholdSol = Number(cfg.migrationQuoteThreshold.toString()) / 10 ** QUOTE_DECIMALS;
  const out: CurvePoint[] = [
    { quoteReserveSol: 0, priceSol: getPriceFromSqrtPrice(cfg.sqrtStartPrice, cfg.tokenDecimal, QUOTE_DECIMALS).toNumber() },
  ];

  let lower = cfg.sqrtStartPrice;
  let cumQuote = new BN(0);

  for (const seg of cfg.curve) {
    const upper = seg.sqrtPrice;
    const span = upper.sub(lower);
    if (span.isZero() || span.isNeg()) {
      lower = upper;
      continue;
    }

    for (let i = 1; i <= samplesPerSegment; i++) {
      const sample = lower.add(span.mul(new BN(i)).div(new BN(samplesPerSegment)));
      const dq = getDeltaAmountQuoteUnsigned(lower, sample, seg.liquidity, roundingDown);
      const total = cumQuote.add(dq);
      const totalSol = Number(total.toString()) / 10 ** QUOTE_DECIMALS;
      out.push({ quoteReserveSol: totalSol, priceSol: getPriceFromSqrtPrice(sample, cfg.tokenDecimal, QUOTE_DECIMALS).toNumber() });
      // Rounding-down math can land a hair below the threshold; a tiny tolerance avoids
      // spilling into whatever segment comes after (often a huge, practically-unreachable one).
      if (totalSol >= thresholdSol - 1e-6) return out;
    }

    const segDq = getDeltaAmountQuoteUnsigned(lower, upper, seg.liquidity, roundingDown);
    cumQuote = cumQuote.add(segDq);
    lower = upper;
    if (Number(cumQuote.toString()) / 10 ** QUOTE_DECIMALS >= thresholdSol - 1e-6) break;
  }

  return out;
}
