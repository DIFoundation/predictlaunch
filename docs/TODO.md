# TODO – Remaining Work

## Priority 1 – Make the demo path solid (Highest)

- [ ] Create a clean happy-path demo flow even if real Panta/Meteora creation is mocked
- [ ] Ensure `/launch` → conviction score → `/launches` works reliably
- [ ] Add a clear “MVP Mode” or “Demo Mode” note in the UI when real on-chain creation is not available
- [ ] Write a short demo script (see DEMO.md if created)

## Priority 2 – Finish or properly mock the integrations

### Panta
- [ ] Fix Create Market quote payload (all required fields + valid imageUrl)
- [ ] Complete the full flow: Quote → Build → Sign → Broadcast → Register
- [ ] Replace mock market data in conviction engine with real Panta `getMarket` / list calls
- [ ] Handle API errors gracefully in the UI

### Meteora DBC
- [ ] Build a minimal valid curve + fee config that the SDK accepts
- [ ] Successfully create at least one real pool on devnet or mainnet
- [ ] (Later) Feed conviction score into curve parameters

## Priority 3 – Product polish

- [ ] Add loading and empty states consistently
- [ ] Improve error messages shown to the user
- [ ] Add a simple Portfolio page (user’s launches + linked markets)
- [ ] Make conviction panel even clearer
- [ ] Add Nigeria / local highlights section (for Superteam Nigeria track)

## Priority 4 – Submission readiness

- [ ] Final README with live demo link + video
- [ ] Record 2–3 minute demo video
- [ ] Deploy to Vercel (or similar)
- [ ] Double-check all four track requirements are visible in the submission

## Nice to Have (Post-MVP)

- [ ] Persistent database (Postgres / Supabase / etc.)
- [ ] On-chain conviction proof
- [ ] Shareable launch cards
- [ ] Better metadata / token image handling