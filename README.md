# Freelancer Stability Network

Week 1 marketplace foundation, Week 2 skill matching, Week 3 private messaging, and Week 4 Stripe Connect test payments. Next.js + TypeScript client, Express + TypeScript REST API, and persistent embedded PostgreSQL (PGlite).

## Quick start

Requires Node.js 24 LTS and npm. From this folder:

```sh
npm ci
npm run dev
```

Open http://localhost:3100. API health: http://localhost:4100/api/health.
Both processes run together; Ctrl+C stops them. No database install, Docker, API keys, or demo credentials are needed. Register a client to post a job, then log out and register a freelancer to browse it and edit skills.

The development launcher waits for its own API process to finish database initialization and start listening before starting the frontend. A backend failure stops startup instead of leaving a disconnected page running. The frontend proxy and API origin are configured together. Changes under `server/src` restart the development API after it closes the database, while Next.js reloads frontend edits. If Inbox shows “Endpoint not found” after updating from an older version, stop the old terminal and rerun `npm.cmd run dev` from the project root. For alternate local ports, set `PORT` (API) and `WEB_PORT` (frontend) before running the root command.

The root install script installs the client and server automatically using their own lockfiles. Production builds use `client/.next-production`; development uses `client/.next` so their output files stay separate.

If registration reports "Request origin is not allowed", stop this project's terminal with Ctrl+C and run `npm.cmd run dev` again, then open exactly `http://localhost:3100`. This project uses frontend port 3100 and API port 4100 to avoid older local apps on 3000/4000. If you created environment files, set `APP_ORIGIN=http://localhost:3100` and `PORT=4100` in `server/.env`, and `API_URL=http://127.0.0.1:4100` in `client/.env.local`. Restart both processes after changing these settings. Local development also permits the equivalent `http://127.0.0.1:3100` origin; production accepts only the configured origin.

## Structure

```text
client/           Next.js App Router, React, TypeScript
server/           Express REST API, validation, auth, database
docs/PRD.md       Text extracted from the supplied PRD
docs/WEEK_1.md    Acceptance checklist, boundaries, Week 2 handoff
docs/API.md       Endpoint contract
AGENTS.md         Repository working instructions
.github/workflows/ci.yml
```

Docker Compose is intentionally deferred until the container milestone.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run API on 4100 and web on 3100 |
| `npm run typecheck` | Check both TypeScript projects |
| `npm test` | Integration tests against real embedded PostgreSQL |
| `npm run build` | Compile API and production frontend |
| `npm start` | Serve the built application |
| `npx playwright install chromium` | Install browser for end-to-end tests |
| `npm run test:e2e` | Exercise registration, profiles, job CRUD, browsing and responsive layout |
| `npm run audit` | Scan root, client and server dependencies |

Use `npm.cmd` / `npx.cmd` in PowerShell if execution policy prevents running npm.ps1.

## Configuration and data

Defaults work without .env files. Optionally copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env.local`. Never commit real .env files.

The API runs PostgreSQL in memory and persists complete compressed snapshots to `server/data/snapshots/database.tar.gz`, ignored by Git. Every mutation is saved and flushed to a temporary file, then atomically replaces the snapshot before success is returned. The previous snapshot is retained as `database.tar.gz.previous`. Data survives restarts and acknowledged writes survive forced process termination. A heartbeat lock prevents a second API process from opening the same store. After an abrupt stop, allow 10 seconds for the lock to expire before restarting. Snapshot errors stop writes and startup never silently resets existing files.

The old native filesystem directory `server/data/postgres` developed a damaged WAL checkpoint. It was preserved and copied to `server/data/backups/postgres-20261109-132016/postgres`. Recovery on a copy failed. With user approval, the app now uses a fresh snapshot store; accounts in the damaged legacy directory have not been recovered and must be re-created. Do not set DATABASE_PATH to the old directory. Use `DATABASE_PATH=./data/snapshots` if you have a custom `server/.env`.

There are no seeded accounts or fake projects. Tests use isolated databases; the browser test creates then deletes its project (test accounts remain in whichever test database is selected). Before restoring a previous snapshot, stop the API and back up the entire snapshot directory; restoration can roll back newer changes and must be an explicit recovery action.

PGlite runs PostgreSQL in-process and is suitable for this local, single-process milestone. Before multi-instance/cloud deployment, move the database adapter to a PostgreSQL service, add versioned migrations and backups, and configure HTTPS. Do not start multiple API processes against the same data directory. The production cookie is Secure; use HTTPS when NODE_ENV=production. Local `npm start` defaults to development cookie settings unless NODE_ENV is explicitly set.

## Security

Passwords use salted scrypt. Session tokens are random, opaque, hashed in the database, and expire after seven days. The browser receives only an HttpOnly, SameSite=Lax cookie; logout revokes it server-side. Session issuance replaces the current browser session. Mutations require the configured Origin (CSRF defense). Production cookies require HTTPS. Queries use parameters and bodies are validated with Zod. Jobs require the client role and ownership; profiles require ownership. Public authenticated profiles exclude email. Authentication and API traffic are rate limited. Raw passwords, tokens and request bodies are never logged.

The browser talks to `/api` through a Next.js rewrite, keeping cookies same-origin. The API binds to loopback for local development. Server-rendered user text uses React escaping; no raw HTML injection.

## Repository setup

CI checks types, integration tests, production build, browser tests, and dependency vulnerabilities. CodeQL is configured separately. In your Git hosting settings, protect `main`, require pull requests, one reviewer, and passing CI; enable secret scanning and push protection where available. These hosted settings cannot be enabled until a remote repository exists. The project has not been pushed or deployed.

## Implementation references

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [PGlite documentation](https://pglite.dev/docs/)

To try matching, save `React, Node.js, Python` on a freelancer profile and post a job requiring `React, Node.js, MongoDB` from a client account. In **Discover jobs**, select **Best skill match** and open the job to see **67%** with MongoDB listed as missing. On the client account, open the same job from **My job postings** to see matching freelancers. Scores are calculated from existing profile and job data, including records created in Week 1. The local MVP ranks the filtered job set in memory before returning a page.

To try private messaging, open a posting as a freelancer and choose **Message client**. A client can also start a conversation from **Matching freelancers** on their posting. Sign in as the other participant, open **Inbox**, and reply. Use **Refresh inbox** or **Refresh messages** to fetch new activity. Each pair shares one conversation across jobs. Conversations persist independently of a posting, including after it is deleted. The API adds the messaging tables when it opens an existing database.

## Stripe Connect test payments

1. Enable Connect for your Stripe test environment and configure hosted onboarding for Express accounts. The platform and freelancer test accounts should use a supported domestic USD setup for this MVP. [Stripe Connect Express onboarding](https://docs.stripe.com/connect/express-accounts)
2. Sign in to the Stripe CLI with `stripe login`, select the same test environment as your API key, and keep this listener running in a separate terminal. This listens for platform Checkout events. [Stripe webhook development guide](https://docs.stripe.com/webhooks)

   ```powershell
   stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired --forward-to http://127.0.0.1:4100/api/stripe/webhook
   ```

3. In `server/.env`, set `STRIPE_SECRET_KEY` to your environment's `sk_test_` key and `STRIPE_WEBHOOK_SECRET` to the `whsec_` secret printed by the listener. Restart `npm.cmd run dev`. The app accepts only a test secret key. When the credentials are absent, accounts, jobs, matching and messaging remain usable.
4. As a freelancer, open **Payments → Connect with Stripe** and complete test onboarding. Return to **Payments** and verify the account is ready. As the client, start or reuse a conversation with that freelancer, open a job you own from **My job postings**, choose the freelancer, and start **Test payment**.
5. In hosted Checkout, use Stripe's `4242 4242 4242 4242` test card with a future expiry and any three-digit CVC. After returning, open **Payments** and refresh its status. Both participants should see **paid** once the webhook arrives. Try a declined test card to verify Stripe lets the client retry the same session. [Stripe test cards](https://docs.stripe.com/testing)

Checkout charges the saved USD job budget and routes the funds to the freelancer's connected account using a Stripe destination charge. Each job has at most one pending or paid attempt. A pending Checkout session can be reopened from the job, and a verified expiration or failure allows another attempt. If a session never gets recorded and Stripe's response was ambiguous, the reservation is retained after its retry window to avoid a duplicate charge. Inspect the corresponding Checkout event or session in Stripe before deciding how to resolve it. Payment history remains available after a job is deleted. [Stripe destination charges](https://docs.stripe.com/connect/destination-charges)
