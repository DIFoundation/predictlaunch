# Contributing

Thank you for your interest in PredictLaunch.

## Development

```bash
pnpm install
pnpm dev
```

## Code Style

- TypeScript strict mode
- Tailwind for styling
- Prefer server components where possible
- Keep client components focused

## Commit Messages

Use clear, descriptive messages. Example:

```
feat: add conviction score panel
fix: handle missing market data gracefully
docs: update architecture overview
```
```

---

### 6. `.env.example`

```env
# RPC Fast
NEXT_PUBLIC_RPC_ENDPOINT=https://your-rpc-fast-endpoint.com

# Panta
PANTA_API_KEY=pk_test_or_live_xxx
PANTA_API_BASE_URL=https://live-api.panta.market/api/v1

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
