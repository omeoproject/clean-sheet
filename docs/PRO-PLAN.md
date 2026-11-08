# CleanSheet Pro: readiness plan (step 5)

**Status update:** the app-side of Pro (offline license verification, plan limits, upgrade UI, pricing copy) is now built and tested, and is OFF in production until configured. See [GO-LIVE.md](GO-LIVE.md) for what remains. Payment provider setup, key delivery/automation and policies are NOT done. Nothing should be sold until every box in "Definition of ready" is checked.

*(Original note: this began as a proposed plan, written before any code existed.)*

## Proposed plans (hypothesis to test, not a commitment)

| | Free | Pro ($4.99/mo, price untested) |
| --- | --- | --- |
| Rows per file | 1,000 | Higher limit |
| Matching | Basic duplicate detection | Advanced matching |
| Export | CSV | CSV + Excel (XLSX) |

> **Today** the live app is entirely free: 500,000 rows, composite keys, case/trim/blank options, and both CSV and XLSX export. Moving those behind Pro would *remove* features current users already have. Decide deliberately, and consider grandfathering or only gating genuinely new capabilities.

## Gate: do not start building until demand is validated

Suggested bar (adjust, but write it down before you look at the results):

- [ ] 50-100 real people have tried the tool (your own target).
- [ ] At least 10 have been talked to directly (comment threads, DMs, a short call).
- [ ] At least 3 independent people hit a limit or missing capability **and** say they would pay for it, ideally naming a price.
- [ ] You can state who the paying customer is (freelancers? agency staff? someone cleaning CRM exports weekly?).

**Measuring without breaking the privacy promise.** The app has no analytics and a security policy that blocks network requests, and the landing page says "no tracking". So demand has to come from conversations, a feedback link, and GitHub issues/stars, not from usage telemetry. Do not add tracking scripts without first changing the privacy copy and the CSP, and expect that to cost trust.

## Hard design problems to solve first

1. **A client-side limit can't be enforced.** The code runs in the user's browser and is MIT-licensed, so anyone can remove a row limit by editing a copy. Options:
   - *Accept it:* charge for convenience, support, and trust (many people pay rather than self-host).
   - *Keep Pro code private:* open-source the core, keep Pro features in a separate private module/license. The repo's README and LICENSE would need updating.
   - *Gate by server:* only works by sending data to a server, which contradicts the core promise. Not recommended.
2. **Payments need a small backend.** Even with offline processing, someone must take payment and issue entitlements. Keep it limited to *purchase and license issuance*, never file data.
3. **Entitlement mechanism**
   - *Recommended to evaluate first:* signed license keys. A checkout webhook (a tiny serverless function) issues a key signed with a private key; the browser verifies it offline with an embedded public key. No accounts, no sign-up, file data never touches the network. Weakness: keys can be shared or the check bypassed (see point 1).
   - *Heavier alternative:* accounts + subscription database + login. More control, but adds sign-up friction and stored personal data.
4. **Payment provider.** Compare a merchant-of-record provider (handles sales tax/VAT for you) against Stripe Checkout/Payment Links (you handle tax). Check current fees, payout countries and your own tax obligations before choosing. These details change; verify them on the providers' sites.
5. **Legal and operational:** terms, refund policy, privacy policy for purchase data, how cancellations and failed payments are handled, and what a lapsed subscriber can still do.

## Definition of ready (all must be true before taking any money)

- [ ] Demand gate above passed.
- [ ] Entitlement design chosen and written down, including how the open-source question is handled.
- [ ] Payment provider account created **by you** (account creation and credentials are yours to enter).
- [ ] End-to-end purchase tested in the provider's **test mode**: pay, receive key, unlock, cancel, expire, refund.
- [ ] Free-tier behavior at the limit is clear and never destroys data (show a message, never silently truncate).
- [ ] Privacy copy on the landing page and in the README still true after the change (checkout may involve third parties; say so).
- [ ] Terms, refund policy and support contact published.
- [ ] Tests cover entitlement checks, including expired and tampered keys.

## What not to do

- Don't add a "Buy Pro" button before the above is functional.
- Don't collect emails or "waitlist" signups with a form that posts to a server unless the privacy copy is updated first. A plain `mailto:` link or an external survey link is the lightest way to ask people what they'd pay.
