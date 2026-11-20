# LifeOS audit and development plan

Reviewed the tracked files and recent history on main at 260f0d5. Production dashboards, Supabase project settings and live user data were outside this review.

| Area | Finding | Impact |
| --- | --- | --- |
| Home and Kitchen | The Home screen read the original dinner array while Meals read AI selections. AI cooking opened a browser alert. | The dinner displayed or marked cooked could differ from the plan. |
| Shopping | AI recipes needed a separate shopping action. Recipe results and logs used day and snack array indexes. | Shopping looked complete with recipes missing. Removing a snack could shift recipes onto the wrong item. |
| Leftovers | The weekday range included Saturday, and a link could look like food was already available. | Packed lunch could depend on unconfirmed leftovers. |
| Supabase | The schema enables per-user RLS. The client syncs a single JSON snapshot and has conditional updates, but first saves and manual saves can replace whole snapshots. | Simultaneous edits still require a choice. Signing out leaves the shared browser snapshot behind. Account isolation on a device needs work. |
| Worker | OpenAI credentials stay in a Worker binding. Authentication calls Supabase and the binding rate-limits each user. The endpoint previously trusted the request length header and recipe array presence. | Requests and model output needed stronger validation. Per-user minute limits alone cannot enforce a monthly spend target. |
| Releases | Recent history consists of repeated file uploads and paired UI and Worker fixes. The README described older behavior and there was no automated test suite. | Changes to request formats, cache versions and state transitions were easy to miss during releases. |

## Keep

Keep Cloudflare Workers and static hosting, Supabase email authentication and RLS, the existing pantry and backups, offline shell, user preferences, and the signed-in AI endpoint. Existing data stays in its current storage shape. This first change needs no database migration.

## Stage the work

1. Connect Today, the weekly planner, recipe steps, pantry and shopping. Run dependency-free tests in GitHub. Use the existing snapshot storage and add cooking records without replacing the database.
2. Isolate local drafts by account, use server-issued sync revisions, test two-user RLS and concurrent writes on an isolated Supabase project, and run a database backup and restore before applying any later migration.
3. Give meals, recipes, prepared batches and pantry items stable IDs. Add storage location, expiry, matched ingredient identities and pack sizes. Build shopping and reminders from the same plan and explicit event records.
4. Add private response caching, request and usage metrics without raw prompts, and an enforced monthly allowance. Keep OpenAI and Supabase server configuration in Worker bindings and use a separate preview Worker and test data for phone testing.
5. Add conversational cooking adjustments, sourced nutrition with clear estimates and separate profiles, then notifications and additional modules. Keep insulin dosing and medication changes outside the app.

## Verification

Use Node.js 24 and run `node --test` at the repository root. Tests cover selected Kitchen rules, snapshot conflict decisions and mocked Worker authentication and request limits. The SQL policies still need an integration test against a non-production Supabase instance.

For a phone smoke test, use a separate development URL and Supabase project. Generate a week, swap the dinner before a linked lunch, open the new recipe, check serving count, advance the cooking steps and confirm. Compare Pantry and Shopping before and after. Export a backup from Settings, import it in a separate browser profile and compare the plan, pantry and history. Use a second test account and two devices to verify access boundaries and conflicting edits before expanding sync.

## Sync follow-up

Manual saves now read the current cloud version before offering to replace it. Every update checks that version, and the first save leaves a row created concurrently by another device alone. This uses the existing schema. The new tests mock Supabase responses for concurrent creation and stale updates. Live two-device and row-level security checks remain pending.
