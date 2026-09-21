# Integrations Notes

This document captures everything we know about the external services so an agent (or future developer) can continue without starting from zero.

---

## 1. RPC Fast

- **Purpose:** All Solana RPC reads and writes
- **Implementation:** `src/lib/rpc/connection.ts`
- **Env var:** `NEXT_PUBLIC_RPC_ENDPOINT`
- **Status:** Ready. Just point the env var to a real RPC Fast endpoint.
- **Requirement for track:** Document that all `Connection` instances use this endpoint.

---

## 2. Panta API (Prediction Markets)

**Base URL:** `https://live-api.panta.market/api/v1`  
**Auth:** Header `X-Api-Key: <key>`  
**Important:** Trailing slashes are required.

### Key Endpoints We Use / Plan to Use

| Action              | Method + Path                     | Notes |
|---------------------|-----------------------------------|-------|
| List markets        | `GET /markets/`                   | Working |
| Get market          | `GET /markets/{id}/`              | Needed for real conviction data |
| Create – Quote      | `POST /markets/create/quote/`     | Currently failing validation |
| Create – Build      | `POST /markets/create/build/`     | Expects `createId` |
| Create – Register   | `POST /markets/register/`         | After broadcast |
| Primary buy quote   | `POST /...` (orders)              | Not yet implemented |

### Required fields for Create Quote (from official docs)

```json
{
  "wallet": "string (base58)",
  "question": "string",
  "resolutionRule": "string",
  "sourcesOfTruth": ["https://...", "..."],
  "category": "crypto | sports | politics | ...",
  "startTime": 1234567890,          // Unix seconds, ≥ now + 3600
  "endTime": 1234567890,
  "resolutionTime": 1234567890,
  "imageUrl": "https://public-image-url",  // required, no localhost
  "marketType": "standard",
  "title": "optional",
  "description": "optional",
  "region": "Global"
}