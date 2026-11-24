# DayForge — Android app project

DayForge is a React + Vite + Capacitor app with Supabase accounts/database, a seven-day trial, task tracking, reminders, subscription access gating, and a server-side Razorpay subscription flow. This is source code, not a finished published APK.

## Global pricing: automatic exchange-rate conversion

- Base prices: ₹399/month and ₹3,999/year; the optional AI Coach base price is ₹100/month.
- The server fetches the latest available INR exchange rates from `open.er-api.com`, converts the base price to the currency mapped to the account's selected country, and rounds it (INR to whole rupees, NGN to the nearest ₦100, other supported currencies to a familiar `.99` ending).
- Country/currency mapping currently includes INR, USD, GBP, NGN, CAD, AUD, AED and EUR for selected Euro-area countries. Other countries currently fall back to INR.
- The quote is refreshed when the app loads. Checkout recalculates on the server, so the exact amount can differ slightly if the exchange rate updates between quote and checkout; the secure Razorpay Checkout amount is the final amount.
- Currency availability for recurring subscriptions depends on your Razorpay merchant account, enabled international payments, payment method, and current Razorpay product rules. The backend returns an error instead of silently charging in a different currency if Razorpay rejects a currency. Test every target currency in Test Mode before launch.
- Each checkout creates a Razorpay plan from the current server-side quote and then creates the subscription. Monitor plan creation in the Razorpay dashboard; consider adding caching/reuse before scaling.

## Required setup before the app can work

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Deploy the Edge Functions: `get-pricing`, `create-razorpay-subscription`, and `razorpay-webhook`.
4. Add Edge Function secrets in Supabase: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Keep the service-role and Razorpay secret keys server-side only.
5. Configure the Razorpay webhook to the deployed `razorpay-webhook` function URL and subscribe to subscription lifecycle events, including activated, charged, authenticated, pending, halted, cancelled, completed, paused, and resumed.
6. In Supabase SQL Editor, run `supabase/ADMIN_SETUP.sql` after verifying the requested admin email `shubhamshxrma987@gmail.com`. Do not grant admin access based on an unverified email alone.
7. Add GitHub repository Actions secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The included workflow builds a debug APK.
8. Test sign-up, email verification, the seven-day trial, expired-trial lock, checkout, webhook signature validation, active access, cancellation, failed payment, and each target currency in Razorpay Test Mode.

Never put `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, or `SUPABASE_SERVICE_ROLE_KEY` in GitHub source, APK environment variables, or chat.

## Admin and access rules

The admin account is `shubhamshxrma987@gmail.com`, with admin role assigned through the SQL setup. The trial starts at account creation and lasts seven days. After it expires, access requires an active subscription confirmed by a signed Razorpay webhook; unknown status is not treated as paid.

## Features included

- Email/password account flow with selected country at sign-up
- Supabase-backed task list and reminders
- Local notification scheduling where the native Android permission/plugin supports it
- Seven-day trial and paid-access gate
- Currency quote endpoint and server-created Razorpay plans/subscriptions
- HMAC-verified Razorpay webhook to update subscription status
- Admin dashboard for user/subscription overview and coupon management scaffold

## Important limitations

- The separate AI Coach recurring add-on is **not enabled yet**. The UI keeps the option visible for continuity, but the backend blocks checkout if it is selected to prevent accidental incorrect billing.
- Coupon creation is present in the admin UI, but coupon discounts are not applied to recurring Razorpay checkout yet; checkout stops if a coupon is entered.
- Reminder delivery when the app is closed varies by device; production-grade push reminders require additional push-notification infrastructure.
- Global currency quotes do not guarantee Razorpay subscription eligibility in every currency. Verify the merchant account and test payments before public launch.
- The GitHub Actions output is a debug APK, not a release-signed Play Store build. Add privacy policy, terms, cancellation/refund policy, tax disclosures, and support contact before public launch.

## Local development

Requires Node.js 20+ and npm.

```bash
npm install
cp .env.example .env
npm run dev
```

For Android APK, upload the **contents** of this ZIP to a GitHub repository (do not upload the ZIP as the app source). Push to GitHub, then download the APK from Actions → completed workflow → Artifacts.
