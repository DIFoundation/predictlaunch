import { LinkedMarket, ConvictionResult, ConvictionLevel } from "@/types/conviction";

/**
 * Transparent 0-100 conviction model.
 *
 * 35% volume quality, 35% consensus strength, 15% market breadth,
 * 15% cross-market agreement. The model is deliberately explainable so a
 * creator can see exactly why the launch configuration changed.
 */
export function levelForScore(score: number): ConvictionLevel {
  if (score >= 75) return "Very High";
  if (score >= 55) return "High";
  if (score >= 30) return "Medium";
  return "Low";
}

/** Higher conviction unlocks a lower Meteora DBC base trading fee. */
export function feeBpsForScore(score: number): number {
  if (score >= 75) return 50;
  if (score >= 55) return 100;
  if (score >= 30) return 150;
  return 200;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function volumeQuality(volume: number): number {
  if (!Number.isFinite(volume) || volume <= 0) return 0;
  // Log scaling rewards meaningful activity without allowing one whale-sized
  // market to dominate every other signal.
  return Math.round(clamp(Math.log10(volume + 1) / Math.log10(10_001), 0, 1) * 35);
}

function consensusStrength(markets: LinkedMarket[]): number {
  const priced = markets.filter((m) => m.yesPrice !== null && Number.isFinite(m.yesPrice));
  if (!priced.length) return 0;

  // Strength measures distance from a neutral 50/50 market. We use the
  // absolute distance so both strong YES and strong NO conviction count.
  const weighted = priced.reduce((sum, market) => {
    const weight = Math.log10(Math.max(1, market.volumeUsdc) + 1);
    return sum + Math.abs((market.yesPrice ?? 0.5) - 0.5) * 2 * weight;
  }, 0);
  const weights = priced.reduce((sum, market) => sum + Math.log10(Math.max(1, market.volumeUsdc) + 1), 0);
  return Math.round(clamp(weights ? weighted / weights : 0) * 35);
}

function breadth(markets: LinkedMarket[]): number {
  return Math.round(clamp(Math.log2(markets.length + 1) / Math.log2(9)) * 15);
}

function crossMarketAgreement(markets: LinkedMarket[]): number {
  const priced = markets.filter((m) => m.yesPrice !== null && Number.isFinite(m.yesPrice));
  if (priced.length < 2) return 0;

  const mean = priced.reduce((sum, m) => sum + (m.yesPrice ?? 0.5), 0) / priced.length;
  const meanDistance = priced.reduce((sum, m) => sum + Math.abs((m.yesPrice ?? 0.5) - mean), 0) / priced.length;
  return Math.round(clamp(1 - meanDistance / 0.5) * 15);
}

export function calculateConviction(markets: LinkedMarket[]): ConvictionResult {
  const unique = Array.from(new Map((markets ?? []).map((m) => [m.marketId, m])).values());
  if (!unique.length) {
    return {
      score: 0,
      level: "Low",
      reasons: ["No linked prediction markets"],
      breakdown: [
        { label: "Volume quality", points: 0, max: 35 },
        { label: "Consensus strength", points: 0, max: 35 },
        { label: "Market breadth", points: 0, max: 15 },
        { label: "Cross-market agreement", points: 0, max: 15 },
      ],
      unlockedBenefits: [],
    };
  }

  const volume = volumeQuality(Math.max(...unique.map((m) => m.volumeUsdc || 0)));
  const consensus = consensusStrength(unique);
  const marketBreadth = breadth(unique);
  const agreement = crossMarketAgreement(unique);
  const score = Math.min(100, volume + consensus + marketBreadth + agreement);

  const reasons: string[] = [];
  reasons.push(volume ? `Trading activity contributes ${volume}/35 points` : "Limited trading activity so far");
  reasons.push(consensus ? `Market consensus contributes ${consensus}/35 points` : "No live probability data yet");
  reasons.push(`${unique.length} linked market${unique.length === 1 ? "" : "s"} contribute ${marketBreadth}/15 breadth points`);
  if (unique.length > 1) {
    reasons.push(`Cross-market agreement contributes ${agreement}/15 points`);
  } else {
    reasons.push("Add another market to measure cross-market agreement");
  }

  const benefits = ["Explainable conviction score"];
  if (score >= 30) benefits.push("Lower trading fee on the bonding curve");

  return {
    score,
    level: levelForScore(score),
    reasons,
    breakdown: [
      { label: "Volume quality", points: volume, max: 35 },
      { label: "Consensus strength", points: consensus, max: 35 },
      { label: "Market breadth", points: marketBreadth, max: 15 },
      { label: "Cross-market agreement", points: agreement, max: 15 },
    ],
    unlockedBenefits: benefits,
  };
}
