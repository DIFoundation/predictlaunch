enum Phase {
    primary,
    secondary,
    resolved,
    cancelled,
}

enum MarketType { standard, breaking }

export interface PantaMarket {
  marketId: string;
  category: string;
  title: string;
  description?: string;
  images: string[];
  phase: Phase;
  marketType: MarketType;
  startTime: number;
  endTime: number;
  resolutionTime: number;
  region: string;
  resolved: boolean;
  status: string;
  volumeUsdc: string;
  campaignId: string | null;
  createdByPartner: boolean;
  yesPrice: string | null;
  noPrice: string | null;
  primaryYesPrice: string | null;
  primaryNoPrice: string | null;
  secondaryYesPrice: string | null;
  secondaryNoPrice: string | null;
}

export interface PantaPosition {
  marketId: string;
  category: string | null;
  side: string;
  shares: string;
  phase: Phase;
  claimable: boolean
  claimed: boolean;
  outcome?: string | null;
}

export interface CreateMarketParams {
  question: string;
  description?: string;
  imageUrl?: string;
  endTime?: string;
  category?: string;
}