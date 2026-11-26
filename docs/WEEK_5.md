# Week 5 — Ratings, security testing, and deployment

## Product behavior

The client opens Payments and selects Mark work complete on a paid payment. This confirmation is idempotent and does not alter the Stripe payment or transfer. Payment alone and a manually closed job do not grant review eligibility.

Both participants can then submit one immutable review each: an integer score from 1 to 5 and a nonempty comment up to 2,000 characters. The server derives the recipient and job from the payment; callers cannot choose another recipient. A database uniqueness constraint prevents duplicate submissions, including concurrent requests. Unrelated users and unpaid or unfinished work cannot receive reviews through this flow.

Review history survives deletion of the job because the payment and review retain the job ID. Existing payments remain paid and become eligible when their client marks work complete. Earlier accounts, jobs, messages, snapshots, and Stripe mappings are retained.

Ratings and comments appear in My profile, client reputation in job details, and freelancer reputation under matched candidates. Averages include all reviews; the newest 50 comments are returned. Reviews are available to signed-in users and contain reviewer names, scores, comments and dates, without emails or private payment fields. Comments render as escaped text.

## API additions

- POST /api/payments/:id/complete — paying client only, paid payment required; returns {completed:true}.
- POST /api/reviews — {paymentId,rating,comment}; one per participant per completed payment; returns 201 or 409 when ineligible/duplicate.
- GET /api/users/:id/reviews — authenticated reputation {count,average,reviews}; 50 most recent comments.
- GET /api/payments and /api/payments/:id now include completedAt and reviewed for the authenticated participant.

The additive startup migration adds payments.completed_at and reviews. No data reset is performed. The next persisted mutation saves the schema with the snapshot. Back up the stopped snapshot directory before a deployment. An older application can read this additive schema, but will not expose completion/reviews.

## Acceptance checks

1. Finish a sandbox payment between a client and freelancer.
2. Before client confirmation, neither participant can review.
3. Client selects Mark work complete in Payments.
4. Each participant submits a review from Payments; submitting twice is rejected.
5. Check reputation in My profile, job details and matched freelancer reviews.
6. Reload and sign in again: saved reviews remain visible.
7. An unrelated account cannot complete the payment or review that work.

## Security and deployment

Existing CodeQL workflow supplies SAST. CI retains type checks, integration tests, browser regression and dependency audits. security.yml builds the container, runs Trivy, deploys an isolated Compose environment, and runs a ZAP passive baseline with a report artifact. These hosted checks run after changes are pushed; configuration alone is not evidence that hosted scans passed.

Dockerfile uses a separate build stage and a non-root runtime. Compose drops capabilities, prevents privilege escalation, uses a read-only root with explicit writable locations, publishes only the web port on loopback, and retains snapshots in a named volume. The Express API stays private within the same container. One app replica only; the PGlite adapter is not a shared multi-instance database.

Local HTTP deployment:

    docker compose up --build -d --wait

Open http://localhost:3100. Stop an existing development server on that port first. Compose uses a separate named database volume; it does not import or replace your local server/data. For Stripe in containers, inject the same sandbox keys through environment variables or an ignored Compose env file; do not put secrets in YAML or images. The API is reachable through the frontend proxy, so forward Stripe webhooks to http://127.0.0.1:3100/api/stripe/webhook for this container setup.

HTTPS deployment:

    docker compose -f docker-compose.yml -f docker-compose.production.yml up --build -d --wait

Set APP_ORIGIN to the exact public HTTPS URL, supply Stripe sandbox secrets, terminate TLS in a trusted reverse proxy on the host to loopback port 3100, configure a Stripe webhook to the public /api/stripe/webhook URL, and use that endpoint's signing secret. Production uses Secure cookies and requires HTTPS. Never expose raw API port 4100.

No cloud host, domain, TLS certificate, hosted branch protection, or live payment activation is created by these files. Those require a selected deployment destination. Refunds, disputes, moderation/reporting and multi-instance PostgreSQL remain future work.

References:
- https://docs.docker.com/reference/compose-file/services/
- https://www.zaproxy.org/docs/docker/baseline-scan/
- https://github.com/github/codeql-action

## Verified locally (2026-11-18)

- npm run check passed: client/server types, all 10 server tests, and production builds.
- Browser regression passed, including completion and review submission plus Weeks 1–4 flows. Stripe itself is stubbed in the browser suite; the prior manual sandbox payment was confirmed by the user.
- Root, server and client dependency audits reported zero vulnerabilities.
- docker compose config validated successfully.
- Docker engine was unavailable despite startup attempts; image build, Trivy and ZAP execution remain unverified. CodeQL and hosted security workflows have not been run for these local changes.
- Hosted deployment was explicitly deferred by the user.
- Test databases were isolated from existing user data.
