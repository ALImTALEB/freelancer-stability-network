# Week 1 verification

## Database corruption and persistence replacement

The actual legacy database failed to reopen with `invalid xl_info in checkpoint record` and `could not locate a valid checkpoint record`. It was copied to `server/data/backups/postgres-20261109-132016/postgres`; recovery from an archived copy into in-memory PostgreSQL failed with the same error. The original directory was not deleted. The user explicitly approved a fresh store if recovery failed.

The new default store is `server/data/snapshots`. PostgreSQL runs in memory; mutations are serialized and a complete gzip snapshot is flushed and atomically renamed before returning success. A previous snapshot is retained, and proper-lockfile prevents concurrent writers. Invalid snapshots fail startup without automatic deletion/reset. An integration test kills the writer process without closing PostgreSQL, waits for lock expiry, reloads the snapshot, and verifies its acknowledged write. Another test rejects a second writer and checks that invalid snapshot contents remain untouched.

After this replacement: all six API/persistence test groups passed, type checks and production build passed, and the complete browser acceptance flow passed through the combined launcher on isolated ports 3200/4200 (14.8 seconds). Dependency scans reported zero vulnerabilities. The actual default fresh snapshot store was initialized successfully with zero accounts; browser-test accounts were confined to a separate scratch store.

## Combined startup fix

Diagnosed a running frontend forwarding requests to 4100 while no API was listening there; an older API remained on 4000. The root development command now launches its API directly, waits for a readiness message from that specific child after database initialization/listening, and only then starts Next.js. Both children receive consistent origin/proxy settings. API failures stop the launcher rather than leaving a disconnected frontend running. IPC shutdown allows the embedded database to close cleanly.

Verified the combined launcher on isolated frontend/API ports 3200/4200 with a separate scratch database. The full Playwright registration/login/profile/job flow passed with exit code 0. API tests (four groups), TypeScript and the production build also passed. The developer must restart the existing project terminal to adopt the new launcher. Existing account data was not reset.

## Registration origin fix

The app now uses frontend port 3100 and API port 4100, avoiding the older API process observed on port 4000 during troubleshooting. Local development accepts localhost and 127.0.0.1 only on the configured frontend port. Production remains restricted to its configured origin. A full restart is required for previously running processes to adopt these settings.

After this change, `npm run check` passed with four integration test groups, including allowed and rejected origins. The browser acceptance flow passed using an isolated test database. Playwright now checks API health and frontend readiness independently, so an already-running frontend cannot cause it to skip starting the API.

Verified locally on Windows with Node.js 24.14.0 on November 9, 2026.

| Check | Result |
| --- | --- |
| `npm ci` from root (automatic nested installs) | Passed |
| `npm run typecheck` | Passed: server and client |
| `npm test` | Passed: 3 integration test groups |
| `npm run build` | Passed: Express compilation and Next.js production build |
| `npm run audit` | Passed: zero reported vulnerabilities across root, server and client |
| `npm run test:e2e` against development | Passed |
| `npm run test:e2e` against `npm start` | Passed |
| Desktop and mobile visual review | Passed at 1440px and 390px |
| Database close/reopen | Passed: account login and posted job survive restart |

The API tests cover invalid/duplicate registrations, password hashing, cookie attributes, blocked origins, session expiration and revocation, invalid credentials, auth throttling, role escalation rejection, profile ownership, public email privacy, portfolio URL validation, unauthorized posting, negative/sub-cent budgets, browsing/search/filtering, private owner listings, editing/deleting another client's job, closed-job visibility, malformed IDs and JSON.

The browser test covers client and freelancer registration, organization/profile/skill editing, job creation and budget editing, session restoration after reload, logout/login, title and skill filtering, job details, deletion, mobile sign-out visibility, and mobile horizontal-overflow checks. Screenshots are generated in ignored `test-results/`.

The initial restart test used the execution sandbox's temporary directory and failed to reopen there. It now creates an isolated database inside the project's writable `server/data/` directory and removes that generated directory after the test. Real local data uses the same filesystem location family. Development and production build artifacts are separated to avoid Windows output-directory conflicts.

The test browser cache was placed in this chat's writable work directory because the execution sandbox changes its default browser-cache path between calls. For normal use, `npx playwright install chromium` uses your standard local cache; no special path is required.

Git was initialized on `main`. No remote was supplied: hosted CI/CodeQL execution, branch protection, reviews, secret scanning and deployment have not been verified or enabled on a host. Workflow files are provided; remote repository settings remain a hosting step. Container/DAST scans are deferred with the deployment milestone.

Week 1 is ready for local use and Week 2 development. This record is not a claim of production readiness or completion of the later milestones.
