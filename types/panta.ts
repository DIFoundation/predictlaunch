export interface PantaMarketRaw {
  marketId: string;
  category?: string | null;
  title?: string | null;
  description?: string | null;
  images?: string[] | null;
  phase?: string | number | null;
  marketType?: string | number | null;
  startTime?: number | string | null;
  endTime?: number | string | null;
  resolutionTime?: number | string | null;
  region?: string | null;
  resolved?: boolean;
  status?: string | null;
  volumeUsdc?: string | number | null;
  yesPrice?: string | number | null;
  noPrice?: string | number | null;
  primaryYesPrice?: string | number | null;
  primaryNoPrice?: string | number | null;
  secondaryYesPrice?: string | number | null;
  secondaryNoPrice?: string | number | null;
}

export interface PantaMarket {
  marketId: string;
  title: string;
  textQuality: "full" | "description-only" | "none";
  description?: string;
  category: string;
  phase: string;
  volumeUsdc: number;
  yesPrice: number | null; // 0..1
  noPrice: number | null; // 0..1
  imageUrl?: string;
  endTime?: number; // unix seconds
}

export interface CreateQuoteInput {
  wallet: string;
  question: string;
  description?: string;
  category: string;
  imageUrl?: string;
}
