# Supabase launch registry setup

1. Create a Supabase project.
2. Open **SQL Editor**, paste and run `supabase/schema.sql`.
3. In **Project Settings → API**, copy the Project URL and the **service_role** key.
4. Add these as server-side environment variables in Vercel (Production and Preview as needed):

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

Do not use the service-role key in a `NEXT_PUBLIC_*` variable, expose it to the browser, or commit it to Git. The registry API uses it only in server-side route handlers. RLS is enabled and no public table policies are created.

The registry is separated by the app's configured Solana network. After adding the variables, redeploy Vercel. A token appears in the shared directory after its successful launch transaction is confirmed and registered. Older launches stored only in individual browsers need a one-time backfill if they should also appear.
