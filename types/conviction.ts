export interface LinkedMarket {
  marketId: string;
  question: string;
  volumeUsdc: number;
  /** 0..1, or null when the market has no live price. */
  yesPrice: number | null;
}

export type ConvictionLevel = "Low" | "Medium" | "High" | "Very High";

export interface LaunchRecord {
  mint: string;
  /** DBC pool + config addresses, so the pool can be read without getProgramAccounts */
  pool: string;
  config: string;
  signature: string;
  name: string;
  symbol: string;
  description?: string;
  linkedMarketIds: string[];
  convictionScore: number;
  feeBps: number;
  createdAt: string;
  creator: string;
}

export interface ConvictionResult {
  score: number; // 0-100
  level: ConvictionLevel;
  reasons: string[];
  unlockedBenefits: string[];
}
