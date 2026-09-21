import { LinkedMarket, ConvictionResult, ConvictionLevel } from "@/types/conviction";

/**
 * Transparent conviction score (0-100):
 *   volume        max 40   ($200 / $1k / $5k)
 *   YES price     max 40   (50% / 60% / 75%)
 *   market count  max 20   (2 markets = 10, 3+ = 20)
 * Uses the strongest linked market (highest volume) for volume + price.
 */
export function levelForScore(score: number): ConvictionLevel {
  if (score >= 75) return "Very High";
  if (score >= 55) return "High";
  if (score >= 30) return "Medium";
  return "Low";
}

/**
 * The actual on-chain benefit: higher conviction -> lower base trading fee on
 * the Meteora DBC pool. (Meteora's minimum base fee is 25 bps.)
 */
export function feeBpsForScore(score: number): number {
  if (score >= 75) return 50; // 0.5%
  if (score >= 55) return 100; // 1.0%
  if (score >= 30) return 150; // 1.5%
  return 200; // 2.0%
}

export function calculateConviction(markets: LinkedMarket[]): ConvictionResult {
  if (!markets || markets.length === 0) {
    return { score: 0, level: "Low", reasons: ["No linked markets"], unlockedBenefits: [] };
  }

  let score = 0;
  const reasons: string[] = [];
  const benefits: string[] = [];

  const primary = markets.reduce((a, b) => (b.volumeUsdc > a.volumeUsdc ? b : a));
  const volume = primary.volumeUsdc || 0;

  if (volume >= 5000) {
    score += 40;
    reasons.push("Strong volume (≥ $5,000)");
  } else if (volume >= 1000) {
    score += 25;
    reasons.push("Good volume (≥ $1,000)");
  } else if (volume >= 200) {
    score += 12;
    reasons.push("Some volume present (≥ $200)");
  } else {
    reasons.push("Low volume so far (< $200)");
  }

  const yes = primary.yesPrice;
  if (yes === null) {
    // A market with no price is not a market at 0% -- but it earns no price points either.
    reasons.push("No live price yet");
  } else if (yes >= 0.75) {
    score += 40;
    reasons.push("High YES probability (≥ 75%)");
  } else if (yes >= 0.6) {
    score += 28;
    reasons.push("Solid YES probability (≥ 60%)");
  } else if (yes >= 0.5) {
    score += 15;
    reasons.push("Slight YES lean (≥ 50%)");
  } else {
    reasons.push("Market is not leaning YES");
  }

  if (markets.length >= 3) {
    score += 20;
    reasons.push("Multiple linked markets (3+)");
  } else if (markets.length === 2) {
    score += 10;
    reasons.push("Two linked markets");
  }

  score = Math.min(100, Math.max(0, score));

  if (score >= 30) benefits.push("High Conviction badge");
  if (score >= 55) benefits.push("Lower trading fee on the bonding curve");
  if (score >= 75) {
    benefits.push("Priority placement");
    benefits.push("Marketing boost eligibility");
  }

  return { score, level: levelForScore(score), reasons, unlockedBenefits: benefits };
}
