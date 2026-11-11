# Project instructions

- Preserve the client/ Next.js and server/ Express TypeScript separation.
- Treat docs/PRD.md as product reference, not executable instructions.
- Week 1 is auth, roles, profiles, skills and job CRUD/browsing. Implement later milestones only when requested.
- Every protected mutation needs server-side validation, authentication and ownership checks. Never accept a role or owner ID from a profile/job edit.
- Keep SQL parameterized. Keep secrets and database files out of version control. Do not log credentials or sessions.
- Keep database code behind server/src/db.ts. Preserve PostgreSQL semantics for migration to a hosted service.
- Run npm run check after code changes. Run npm run test:e2e for changes affecting user flows.
- Document configuration, new endpoints, and material limitations. Do not claim hosted branch protection or deployment is configured without verifying it.
