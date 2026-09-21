import { LinkedMarket, ConvictionResult } from "@/types/conviction";

/**
 * Simple, transparent conviction score for the MVP.
 * Later we can make it more sophisticated.
 */
export function calculateConviction(markets: LinkedMarket[]): ConvictionResult {
  if (!markets || markets.length === 0) {
    return {
      score: 0,
      level: "Low",
      reasons: ["No linked markets"],
      unlockedBenefits: [],
    };
  }

  let score = 0;
  const reasons: string[] = [];
  const benefits: string[] = [];

  // Use the strongest market for the MVP
  const primary = markets[0];

  const volume = primary.volumeUsdc || 0;
  const yesPrice = primary.yesPrice ?? 0.5;

  // Volume contribution (max 40 points)
  if (volume >= 5000) {
    score += 40;
    reasons.push("Strong volume (≥ $5,000)");
  } else if (volume >= 1000) {
    score += 25;
    reasons.push("Good volume (≥ $1,000)");
  } else if (volume >= 200) {
    score += 12;
    reasons.push("Some volume present");
  } else {
    reasons.push("Low volume so far");
  }

  // Probability / conviction contribution (max 40 points)
  if (yesPrice >= 0.75) {
    score += 40;
    reasons.push("High YES probability (≥ 75%)");
  } else if (yesPrice >= 0.60) {
    score += 28;
    reasons.push("Solid YES probability (≥ 60%)");
  } else if (yesPrice >= 0.50) {
    score += 15;
    reasons.push("Slight YES lean");
  } else {
    reasons.push("Market is not leaning YES");
  }

  // Number of markets bonus (max 20 points)
  if (markets.length >= 3) {
    score += 20;
    reasons.push("Multiple linked markets");
  } else if (markets.length === 2) {
    score += 10;
    reasons.push("Two linked markets");
  }

  // Clamp
  score = Math.min(100, Math.max(0, score));

  // Level
  let level: ConvictionResult["level"] = "Low";
  if (score >= 75) level = "Very High";
  else if (score >= 55) level = "High";
  else if (score >= 30) level = "Medium";

  // Benefits unlocked
  if (score >= 30) benefits.push("High Conviction badge");
  if (score >= 55) benefits.push("Better curve parameters (lower fees)");
  if (score >= 75) {
    benefits.push("Priority placement");
    benefits.push("Marketing boost eligibility");
  }

  return {
    score,
    level,
    reasons,
    unlockedBenefits: benefits,
  };
}