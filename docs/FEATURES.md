# Features

## Current (MVP)

### Prediction Markets
- Browse existing Panta markets
- Market detail page
- Placeholder Buy YES / Buy NO UI
- Create Market flow (API integration in progress)

### Token Launches
- Launch creation form
- Link a prediction market to a launch
- Real-time Conviction Score calculation
- Visual conviction panel with level, reasons, and unlocked benefits
- Launches list with score badges

### Conviction System
- Score from 0–100 based on:
  - Market volume
  - YES probability
  - Number of linked markets
- Levels: Low → Medium → High → Very High
- Unlocked benefits:
  - High Conviction badge
  - Better curve parameters
  - Priority placement
  - Marketing boost eligibility

### Infrastructure
- Solana wallet connection (Phantom, Solflare)
- RPC Fast as primary RPC endpoint
- Clean dark UI with Tailwind

## Planned

- Full Panta create + buy flow
- Real Meteora DBC pool creation with conviction-adjusted parameters
- Persistent storage (database or on-chain)
- Portfolio page (user markets + launches + positions)
- Nigeria / local highlights section
- Shareable launch + market cards
- On-chain conviction proof
