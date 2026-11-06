# B2G INVENTORY

A B2G Engineering stock inventory workbook app built with Next.js, TypeScript, and Supabase. It follows the `B2G_Engineering_Stock_Inventory_Upgraded (TEST).xlsx` structure: Dashboard, Materials Register, Assets & Tools, Requests, Material/Asset Movements, Project Sites, Check Schedule, and Verification Matrix. Users sign in with email and password; each account can manage only its own records.

## Run locally

1. Install Node.js 20.9 or later.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. In the Supabase SQL Editor, run migrations in order:
   - [`supabase/migrations/20261030000000_create_products.sql`](./supabase/migrations/20261030000000_create_products.sql)
   - [`supabase/migrations/20261104000000_add_product_extra_data.sql`](./supabase/migrations/20261104000000_add_product_extra_data.sql)
   - [`supabase/migrations/20261106000000_b2g_workbook_schema.sql`](./supabase/migrations/20261106000000_b2g_workbook_schema.sql)
5. Start the development server with `npm run dev`.

## Workbook behavior

- **Upload Excel** imports a B2G workbook (`.xlsx`) by sheet name and headers into the matching Supabase tables for the signed-in user. Existing workbook rows for that user are replaced during import so the app reflects the uploaded workbook.
- **Dashboard** summarizes materials, inventory value, low/out stock, assets, requests, overdue returns, and inventory checking/verification metrics from the loaded registers.
- **Registers/matrices** display workbook-aligned columns. Unrecognized columns from uploaded sheets are preserved in `extra_data`.
- Material/asset status, balances, and exceptions are derived in the app from available records; keep master registers and movement ledgers accurate for the best dashboard results.

## Deploy to Vercel

1. Import the project into Vercel or run `npx vercel`.
2. Use **Framework Preset: Next.js** and keep **Root Directory** at the project root.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Configure Supabase Auth site/redirect URLs for your Vercel domain.

Only the Supabase publishable key belongs in the browser. Never expose a secret/service-role key as `NEXT_PUBLIC_`.
