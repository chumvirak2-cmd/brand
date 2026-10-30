# B2G INVENTORY

A stock inventory dashboard built with Next.js, TypeScript, and Supabase. Users sign in with email and password; each account can manage only its own products. The app is ready to deploy to Vercel.

## Run locally

1. Install Node.js 20.9 or later.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and add the project URL and publishable key from your Supabase project's API settings.
4. In the Supabase SQL Editor, run [`supabase/migrations/20261030000000_create_products.sql`](./supabase/migrations/20261030000000_create_products.sql).
5. Start the development server with `npm run dev`.

The app supports email/password sign-in and account creation. To allow signup without email confirmation, open your Supabase project and go to **Authentication → Sign In / Providers → Email**. Turn off **Confirm email** and save. This is a Supabase project setting and cannot be changed using the app's publishable key. New signups will then be able to sign in without confirming an email.

Products with fewer than 5 units in stock appear in the dashboard's stock alerts. Products with zero units are also included.

## Deploy to Vercel

1. Push this project to a Git provider and import it into Vercel, or run `npx vercel` from the project root.
2. In Vercel's project settings, set **Framework Preset** to **Next.js**, **Root Directory** to the project root, and **Output Directory** to blank/default. Do not set it to `public`; Vercel should use the Next.js build output automatically.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the Vercel project's environment variables for the deployments you want to use. Copy the values from your local `.env.local`; do not commit `.env.local`.
4. Deploy. Vercel detects and builds the Next.js app automatically.
5. In Supabase Auth URL Configuration, set the site URL to your production Vercel domain and add your Vercel preview URLs to the allowed redirect URLs if you use previews.

Only the Supabase publishable key belongs in the browser. Never expose a Supabase secret or service-role key as a `NEXT_PUBLIC_` variable.
