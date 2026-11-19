# LifeOS Kitchen v2 — deployable PWA starter

A real multi-file installable progressive web application. Open it over HTTPS (not by opening index.html locally). You control hosting and database accounts.

## Current working features
- Local-first Pantry with quantity deduction and shopping aggregation; dinner selection and cooking.
- Equipment inventory, Snack Lab, rotating local dinner *ideas*, favourites/dislikes, general supermarket comparisons, evening prep reminders.
- Backup and restore JSON. Browser data persists on the same browser/device.
- Optional Supabase email sign-in plus **manual cloud save/load backup**. Each account's data protected by row-level security.

## Not yet implemented
- True live AI recipe discovery or generated cooking instructions in the app. Ideas screen rotates from a curated list. Copy AI prompts to use in ChatGPT until a secure backend AI service is implemented.
- Automatic cloud sync, shared household accounts, push notifications, live supermarket product prices, receipt/barcode scanning, or verified nutrition.
- Automated pantry deductions only occur when you log cooking; nothing can infer the food you consumed.
- A safety-validated ingredient and recipe engine for unrestricted AI recipe generation.

## Deploy to Cloudflare Pages / Netlify
1. Extract this folder and upload the entire folder (not the ZIP itself) using your hosting provider's static-site deployment interface.
2. Use HTTPS URL from the host. Open on Android and use Chrome menu > Add to Home screen / Install app.
3. You can use the app locally immediately, but cloud is not connected until next steps.

## Optional Supabase account backup
1. Create Supabase project under your control. Keep all sensitive/secret keys private.
2. Paste schema.sql into the Supabase SQL Editor and execute.
3. In Supabase Authentication settings, enable email accounts and set your deployed website as a valid site / redirect URL.
4. Edit config.js: `supabaseUrl` = Project URL, `supabaseAnonKey` = the **publishable key or legacy anon key**, NEVER a service-role key.
5. Redeploy site. Open Cloud tab, create and verify your account, sign in, then Save to cloud. On another phone sign in and Load cloud backup.
6. Cloud backups do not auto-merge changes; avoid editing on multiple devices until real sync with conflict detection is added.

## Security notes
- This starter does not collect bank account, medical or blood glucose records. Do not add medical data until access controls, privacy design and backups are reviewed.
- Never put AI model API secrets into HTML, browser JavaScript or config.js; AI calls need a secured server/edge function with authentication and abuse/cost limits.
- Credentials in this app are passed directly to your Supabase project over HTTPS, not to ChatGPT.
- Browser localStorage is not encrypted; avoid storing sensitive data in this prototype.

## Run locally on a PC
`python3 -m http.server 8080` from this folder, then visit `http://localhost:8080`.


## Phone-friendly Supabase setup (this release)
1. Redeploy this ZIP to the existing `lifeos-zac` Cloudflare Worker as a new version.
2. Open LifeOS -> Cloud, enter Project URL and a `sb_publishable_` key, then tap Save connection. Never use a `sb_secret_` key.
3. In Supabase Authentication -> URL Configuration, set Site URL to the deployed Worker address. Email confirmation must be enabled.
4. In LifeOS -> Cloud, create a user account, confirm the email, log in and press Save to cloud.
5. Cloud storage is a MANUAL BACKUP and does not merge data across devices.
