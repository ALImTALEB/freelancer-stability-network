# Stripe sandbox integration plan

Accepted Stripe implementation planner guide: iguide_61VmX2na2LbsdD1HM41GDSgHTrcO4.

## Confirmed demo configuration

USD one-time hosted Checkout payments, domestic freelancers, immediate destination transfers, no platform fee, Express dashboard. The platform bears Stripe fees and payment losses in the equivalent live model. This is a sandbox-only academic demonstration.

## Implementation review

Preserved server-calculated amounts, authentication and job ownership, conversation eligibility, persistent checkout attempts, idempotency keys, signed raw-body webhooks, asynchronous success/failure handling, participant-only history, and paid-state replay protection.

Updated new connected account creation and hosted onboarding to Accounts v2. Existing mapped account IDs are retained. Readiness checks use the recipient stripe_transfers capability, with country eligibility checked before checkout. Checkout uses dynamic payment methods and an integration identifier. Test secret and restricted keys are accepted; prefer a restricted test key with the necessary permissions.

Express account management remains available through Stripe onboarding. Recommended follow-up: add an authenticated Express dashboard login link, embedded notification_banner and account_management components, and capability-change event monitoring.

## Local setup and test

1. Keep credentials in ignored server/.env. server/.env.example is a blank template. Hosted Checkout does not need a publishable key in the browser.
2. Enable Connect on the Stripe sandbox account that owns the local key. The connected plugin account and local key account may differ.
3. From the project root run npm.cmd run stripe:listen in a separate PowerShell window. This uses the local test key, forwards to the configured API port (default 4100), and saves the listener signing secret without printing it.
4. Leave the listener open, then restart npm.cmd run dev. Open http://localhost:3100.
5. As a freelancer, open Payments, connect Stripe, and complete hosted test onboarding.
6. As a client, message that freelancer, create a job, and open its Test payment checkout.
7. Pay with Stripe's 4242 4242 4242 4242 test card, a future expiration and any valid CVC. Both participants should see Paid after the signed webhook arrives and payment status is refreshed.

The CLI is installed. CLI agent setup did not support the Codex marketplace installation; the Stripe plugin was connected separately and the planner accepted through MCP.

## Verification and limitations

The local key authenticates successfully. A signing secret was retrieved and stored locally. Actual account creation returned non_connect_platform_accounts_v2_access_blocked: Connect must be enabled on the local key's sandbox. No successful end-to-end Stripe payment is claimed.

No live payments, escrow, delayed release, refunds/dispute operations, tax collection, or production deployment are included. Account IDs from another sandbox cannot be reused; keep the same sandbox key for existing mappings. Newly created legacy accounts can take time to become available through v2.

## Sources

- https://docs.stripe.com/connect/marketplace/tasks/create
- https://docs.stripe.com/connect/accounts-v2/migrate-integration
- https://docs.stripe.com/checkout/fulfillment
- https://docs.stripe.com/testing
