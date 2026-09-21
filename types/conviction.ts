export interface LinkedMarket {
  marketId: string;
  question: string;
  volumeUsdc: number;
  /** 0..1, or null when the market has no live price. */
  yesPrice: number | null;
}

export type ConvictionLevel = "Low" | "Medium" | "High" | "Very High";

export interface LaunchRecord {
  id: string;
  name: string;
  symbol: string;
  mint?: string;
  signature?: string;
  description?: string;
  linkedMarketIds: string[];
  convictionScore: number;
  /** Base trading fee (bps) that the conviction level unlocked at launch. */
  feeBps?: number;
  /** "onchain" = pool created via Meteora DBC; "record" = MVP record only. */
  mode: "onchain" | "record";
  createdAt: string;
  creator: string;
}

export interface ConvictionResult {
  score: number; // 0-100
  level: ConvictionLevel;
  reasons: string[];
  unlockedBenefits: string[];
}
