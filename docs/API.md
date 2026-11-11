# Week 1 API

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
| POST | /jobs | Client only; 201 `{id}` |
| PUT | /jobs/:id | Client owner only; `{id}` |
| DELETE | /jobs/:id | Client owner only; 204 |

Profile updates replace editable fields: `{name,bio,skills,experience,portfolio,organization}`. They cannot change email or role.

Job bodies: `{title,description,requiredSkills,category,budget,status}`. Categories: Development, Design, Writing, Marketing, Other. Statuses: open, in_progress, closed. Budget: positive USD amount, at most 1,000,000. IDs and owners are generated/resolved by the server.

Job query parameters: search, skill, category, minBudget, maxBudget, page (default 1), mine=true. Matching is intentionally absent until Week 2. Required skills are string arrays, up to 30 skills of 50 characters each. Job title: 5–150 characters. Description: 20–10,000 characters. Password: 10–128 characters. Name: 2–100 characters.

Errors: 400 validation, 401 authentication, 403 role/ownership/origin, 404 missing or non-owned job mutation, 409 duplicate email, 413 oversized body, 429 rate limit. Auth: 30 attempts/15 min/IP. API: 300 requests/min/IP. Use one API process locally; production needs a shared rate limiter before scaling.
