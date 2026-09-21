export interface LinkedMarket {
  marketId: string;
  question: string;
  volumeUsdc?: number;
  yesPrice?: number;      // 0–1
  noPrice?: number;
  uniqueTraders?: number;
  status?: string;
}

export interface LaunchRecord {
  id: string;             // internal id
  name: string;
  symbol: string;
  mint?: string;
  description?: string;
  linkedMarketIds: string[];
  convictionScore: number;
  createdAt: string;
  creator: string;
}

export interface ConvictionResult {
  score: number;          // 0–100
  level: "Low" | "Medium" | "High" | "Very High";
  reasons: string[];
  unlockedBenefits: string[];
}