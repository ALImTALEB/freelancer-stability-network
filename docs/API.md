# Marketplace API

Development frontend: `http://localhost:3100`; backend: `http://localhost:4100`. The equivalent `http://127.0.0.1:3100` origin is allowed only in development. Other ports and external origins remain blocked for mutations.

Base: `/api`. JSON bodies. Responses use `{error: string}` on failure. Mutations require `Origin: http://localhost:3100` by default; use the HttpOnly `session` cookie for authenticated calls. Browser requests use same-origin Next.js proxying. No bearer token or JWT secret is required.

| Method | Path | Access / response |
| --- | --- | --- |
| GET | /health | Database health |
| POST | /auth/register | `{name,email,password,role}`; 201 profile + cookie |
| POST | /auth/login | `{email,password}`; profile + cookie |
| POST | /auth/logout | Revoke current session; 204 |
| GET | /auth/me | Authenticated own profile |
| GET | /users/:id | Authenticated; other users' emails excluded |
| PUT | /users/:id | Own profile only |
| GET | /jobs | Open jobs, `{jobs,total,page,pageSize}` |
| GET | /jobs?mine=true | Authenticated own jobs, all statuses |
| GET | /jobs/:id | Public if open, otherwise owner only |
| GET | /jobs?sort=match | Freelancer only. Open jobs ranked by skill score before pagination, with a `match` object per job. Existing filters apply. |
| GET | /jobs/:id/matches | Freelancer sees their own score for an open job. The job's client sees up to 20 freelancers with positive scores and the total number of matches. |
| POST | /jobs | Client only; 201 `{id}` |
| PUT | /jobs/:id | Client owner only; `{id}` |
| DELETE | /jobs/:id | Client owner only; 204 |
| GET | /conversations | Signed-in user’s conversations, newest activity first. Returns peer name, peer ID, latest message and activity time. |
| GET | /conversations/:id | Participants only. Returns the conversation and latest 50 messages in chronological order. Pass the returned `nextBefore` as `?before=` to load older messages. |
| POST | /messages | Send `{recipientId,content}` to start or reuse a client–freelancer conversation, or `{conversationId,content}` to reply. Returns 201 and the saved message. |
| GET | /payments | Signed-in participant’s payment history and whether Stripe test payments are configured. |
| GET | /payments/:id | Payment status for its client or freelancer. |
| GET / POST | /stripe/connect | Freelancer only. GET returns onboarding readiness. POST creates or reuses the account and returns a hosted onboarding URL. |
| POST | /payments | Job owner only. Send `{jobId,freelancerId}` for a freelancer with an existing conversation and a ready Stripe account. Returns the payment ID and hosted Checkout URL. |
| POST | /stripe/webhook | Stripe platform test events only. Verifies the signature against the raw request body. |

Profile updates replace editable fields: `{name,bio,skills,experience,portfolio,organization}`. They cannot change email or role.

Job bodies: `{title,description,requiredSkills,category,budget,status}`. Categories: Development, Design, Writing, Marketing, Other. Statuses: open, in_progress, closed. Budget: positive USD amount, at most 1,000,000. IDs and owners are generated/resolved by the server.

Job query parameters: search, skill, category, minBudget, maxBudget, page (default 1), mine=true, sort=match. Required skills are string arrays, up to 30 skills of 50 characters each. Job title: 5–150 characters. Description: 20–10,000 characters. Password: 10–128 characters. Name: 2–100 characters.

Match objects contain `score`, `matchedSkills`, and `missingSkills`. Matching ignores letter case, surrounding spaces, and duplicate requirements. The score is the percentage of distinct requirements met, rounded to the nearest whole number. Empty requirements score zero. Ties in job discovery keep the newest-first ordering. The client response also includes each candidate's name and ID. Personalized responses are marked private and non-cacheable.

Errors: 400 validation, 401 authentication, 403 role/ownership/origin, 404 missing or non-owned job mutation, 409 duplicate email, 413 oversized body, 429 rate limit. Auth: 30 attempts/15 min/IP. API: 300 requests/min/IP. Use one API process locally; production needs a shared rate limiter before scaling.

Messaging accepts plain text of 1–4,000 characters after trimming. The sender comes from the session. A conversation ID that does not belong to the signed-in user returns 404 for both reading and sending. Messaging responses use private, no-store caching.

The server sets the payment amount from the job budget, in USD cents. It accepts `pending`, `paid`, `failed`, and `expired` as internal states. Webhook updates verify the session, currency and amount, and repeated notifications cannot change a terminal status. A browser return from Checkout does not change the payment state. Card entry is hosted by Stripe.

## Week 5

See [Week 5 API additions](WEEK_5.md) for completion and review endpoints, authorization and limits.
