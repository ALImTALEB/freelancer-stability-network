# Week 1 acceptance and Week 2 handoff

## Implemented

- Registration with name, normalized unique email, password, and freelancer/client role.
- Login, persistent seven-day sessions, expiration and server-side logout revocation.
- Freelancer profile: name, biography, skills, experience, HTTP(S) portfolio URL.
- Client profile: name, organization, description (bio).
- Clients create, view, edit, close and delete only their own jobs.
- Job title, description, required skills, category, USD budget, status and timestamp.
- Public open-job browsing and detail; title/description search, exact case-insensitive skill filter, category and budget filters.
- Pagination of 20 jobs per page; client workspace includes all their job statuses.
- Server-side input validation, password hashing, ownership enforcement, email privacy, rate limits, Origin protection, security headers.
- Persistent PostgreSQL data without an external local database installation.
- API integration tests and browser acceptance test; CI and source scanning configuration.

## Scope decisions

The PRD suggests PostgreSQL or MongoDB. This implementation uses PGlite, an embedded PostgreSQL engine, for frictionless local startup. It is a local development choice; multi-process deployment requires an external PostgreSQL adapter and operational configuration.

Local persistence now uses atomic full PostgreSQL snapshots and a single-process heartbeat lock, rather than PGlite's native filesystem directory. The legacy directory developed checkpoint corruption and was preserved with a backup. After recovery on a copy failed, the user approved a fresh snapshot store. Existing legacy accounts were not recovered. See README for paths and restart guidance.

FR-04 mentions applicants, but Week 1 does not define an application flow or application data model. There are no invented applicants or nonfunctional Apply buttons. Applications require a future product decision. Matching (Week 2), messaging (Week 3), Stripe (Week 4), reviews and deployment/security scans (Week 5) remain deferred. Docker Compose is deferred per the request.

There is no account recovery, email verification, admin interface, portfolio upload, currency conversion, or payment handling. Existing open jobs are visible to visitors. Authenticated profile readers see profile information but not another user's email.

## Manual acceptance

1. Run `npm ci` then `npm run dev`.
2. Register a client, edit its organization and description, and save.
3. Post a job with React, Node.js, MongoDB; verify it in My job postings and Discover jobs.
4. Edit budget/status. Closed/in-progress jobs remain in the owner's workspace and leave public browsing.
5. Log out. Register a freelancer, save React, Node.js, Python skills and portfolio URL.
6. Filter jobs by React and budget, inspect details, reload and confirm session/profile persistence.
7. Log out and log back in as the client; delete the test job.
8. Restart the servers and verify existing accounts/profiles persist.

## Week 2 next steps

Add a pure, tested `calculateMatchScore(requiredSkills, freelancerSkills)` function: normalize case/whitespace, deduplicate, count overlap divided by unique required skills, multiply by 100 and round. Decide explicit behavior for empty required-skill input (job creation currently forbids it).

Add authenticated matching endpoints with ownership/privacy checks. Return only public profile fields. Preserve the Week 1 tests. Add score examples (2/3 = 67%), disjoint skills, duplicates, case variations, and authorization tests. Add recommendations to the existing browse view only once the backend works.

Before remote collaboration: initialize or attach the desired Git repository, set protected branches and required checks, and enable secret scanning in repository settings. No remote was supplied in this task.
