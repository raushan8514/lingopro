# Razorpay Payment Integration

Phase 12 adds server-verified Razorpay payments for paid courses and
administrator-configured finite subscription plans. The integration is
implemented, but it has not been exercised against a configured Supabase
project or a Razorpay Test Mode account.

## Required environment

Copy `.env.example` to `.env.local` and configure:

| Variable | Use |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable/anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only trusted webhook/payment writes. Never prefix with `NEXT_PUBLIC_` or expose it to a browser. |
| `RAZORPAY_MODE` | `test` until Test Mode verification and explicit live approval; defaults to `test`. |
| `RAZORPAY_KEY_ID` | Server-side Razorpay key ID. Its `rzp_test_`/`rzp_live_` prefix must match the configured mode. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Same public key ID as `RAZORPAY_KEY_ID`; only the public ID is sent to Checkout. |
| `RAZORPAY_KEY_SECRET` | Server-only API and checkout-signature secret. |
| `RAZORPAY_WEBHOOK_SECRET` | Server-only webhook-signature secret configured for the webhook endpoint. |
| `BILLING_BUSINESS_NAME` | Optional receipt issuer name; defaults to the LingoPro brand. |
| `BILLING_BUSINESS_ADDRESS` | Optional business address displayed on receipts. |
| `BILLING_SUPPORT_EMAIL` | Optional support email displayed on receipts. |

Use the Test Mode key ID and secret from the Razorpay Dashboard first. Never
commit `.env.local`, live credentials, or service-role credentials. Payment
operations are not initialized at app startup; missing credentials produce an
explicit checkout or webhook configuration error.
Optional receipt branding does not configure tax rates or tax registrations and
does not make the receipt a tax invoice.

## Database and Dashboard setup

1. Apply the pending Phase 12 migrations
   `20261109100000_add_razorpay_payment_lifecycle.sql` and
   `20261109110000_subscription_plan_activation_and_payment_search.sql` to a
   local/isolated Supabase database with the project's migration workflow, then
   run `supabase test db`. Do not reset a database containing data just to
   apply or test these additive migrations. Confirm the migrations and tests
   against a disposable Supabase project before applying them to production.
2. Set `SUPABASE_SERVICE_ROLE_KEY` only in the trusted server environment.
   The payment service client bypasses RLS by design and is server-only.
3. Configure a Razorpay webhook at
   `https://<your-https-host>/api/razorpay/webhook`. Keep Test Mode and Live
   Mode webhook secrets separate, and set the matching value in
   `RAZORPAY_WEBHOOK_SECRET`.
4. Subscribe the endpoint to these events:
   - `payment.authorized`
   - `payment.captured`
   - `payment.failed`
   - `subscription.authenticated`
   - `subscription.activated`
   - `subscription.charged`
   - `subscription.pending`
   - `subscription.halted`
   - `subscription.paused`
   - `subscription.resumed`
   - `subscription.cancelled`
   - `subscription.completed`
5. Enable automatic capture for course orders. Course access is granted only
   for a provider-confirmed captured payment. An authorized-but-not-captured
   payment remains pending and does not create an enrollment.

### Local Test Mode webhook procedure

1. Start the app with `npm run dev` and configured Supabase and Razorpay Test
   Mode environment variables.
2. Expose the local app through an HTTPS tunnel you control, and configure the
   Razorpay Test Mode webhook URL as
   `https://<your-tunnel-host>/api/razorpay/webhook`.
3. Configure the event list above in the Razorpay Dashboard, copy that
   endpoint's webhook secret into `RAZORPAY_WEBHOOK_SECRET`, and restart the
   server. Do not use the API key secret as the webhook secret.
4. Generate the configured payment and subscription events using Razorpay
   Test Mode. Confirm a valid delivery is accepted, a repeated event ID is
   idempotent, and invalid signatures are rejected. Verify resulting records
   in the student and admin billing pages.
5. Remove or disable the temporary tunnel after testing. Never expose the
   Supabase service-role key or use production credentials in a tunnel session.

Razorpay documents raw-body webhook signature verification, the
`x-razorpay-event-id` deduplication header, retries, and out-of-order delivery
in its [webhook validation guide](https://razorpay.com/docs/webhooks/validate-test/)
and [subscription event reference](https://razorpay.com/docs/webhooks/subscriptions/).

## Checkout behavior

- The course price and currency come from the published course row; the
  browser cannot choose either value.
- A paid course enrollment is created transactionally only after server-side
  callback signature verification and a Razorpay API fetch confirms the
  matching order, captured payment, amount, and currency. Webhook capture is
  also supported and idempotent. Students can safely refresh a pending course
  payment from Razorpay's order/payment API; enrollment still requires a
  matching captured payment.
- Subscription plan prices, currencies, intervals, and cycle counts must be
  supplied by an administrator. The cycle count is finite and passed as
  Razorpay's `total_count`; the app does not assume unlimited renewal. New
  plans are inactive until an administrator explicitly activates them.
- Public pricing shows only active plans with valid finite checkout terms and
  reports database/configuration/empty states without inventing plan benefits.
  The student transaction page is paginated; admin payment search can be
  narrowed to a subscription.
- A subscription is a billing record only. No subscription-to-course
  entitlement relationship exists in the current schema, so checkout does
  not enroll students in courses or unlock course content.
- Cancellation is requested at the end of the current billing period. The
  local record changes only after Razorpay confirms the request or sends a
  verified webhook.
- Student transaction records and printable, owner/admin-only receipts are
  available in the student billing area. Receipt issuer branding can be
  configured with the optional billing variables above. Receipts are not GST
  tax invoices; customer billing addresses, tax calculation, tax registration,
  and legal invoice details are not configured.
- Admin payment records are read-only. Refund execution, tax calculation,
  coupons, and subscription course entitlements are not implemented.

## Verification checklist

- [ ] Apply migrations and run all database tests against a local or isolated
      Supabase project.
- [ ] Configure Razorpay Test Mode keys and a reachable HTTPS webhook URL.
- [ ] Confirm an order callback with a valid signature and a captured Test Mode
      payment creates exactly one payment and enrollment.
- [ ] Verify a pending course payment can be safely refreshed from Razorpay
      without granting access unless a matching captured payment is found.
- [ ] Confirm a tampered signature, amount, currency, student, order, or
      provider reference cannot create course access.
- [ ] Deliver duplicate and out-of-order webhook events and confirm records
      remain idempotent and newer state is preserved.
- [ ] Verify subscription creation, first authorization, activation, recurring
      charge, failed charge, scheduled cancellation, and terminal lifecycle
      events using Razorpay's Test Mode tools.
- [ ] Verify student/admin authorization for billing views and receipts.
- [ ] Confirm production deployment uses Live Mode only after explicit
      approval, separate Live credentials/secrets, and successful Test Mode
      verification.

Current automated application checks are `npm run test:payments`, `npm run lint`,
and `npm run build`. They do not prove Supabase migration/RLS behavior or a
real provider transaction. Do not mark Phase 12 complete until the checklist
has been run in the intended environment.
