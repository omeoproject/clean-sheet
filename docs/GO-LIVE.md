# Turning Pro on: what you must do

**State of the code:** Pro is fully built on the app side (license checking, limits, upgrade UI, pricing copy) and tested, but it is **OFF in production**. Until you complete the steps below, everyone still gets every feature free and no pricing is shown. Nothing can be bought.

What is **not** built and is yours to set up: the payment provider account, your signing keys, and a way to deliver keys to buyers.

## How it works

1. A customer pays on your payment provider's hosted checkout page (their page, not ours).
2. You issue them a signed license key (`cs1.…`) with `tools/license-tool.mjs` and email it to them.
3. They paste it into **Upgrade to Pro** in CleanSheet. The browser verifies the signature offline against your public key, stores it locally, and unlocks Pro until the key's expiry date. No files and no keys are ever sent to a server.

## Free vs Pro as built (edit `src/core/plans.ts` to change)

| | Free | Pro |
| --- | --- | --- |
| Rows per file | 1,000 | up to 500,000 |
| Key columns | 1 | several |
| Blank-value modes | default only | all |
| Ignore capitals, trim, keep first/last | yes | yes |
| Export | CSV | CSV + XLSX |

"Advanced matching" was undefined in the plan, so I made it multi-column keys and blank-value modes. Change it in one place if you disagree.

## Steps

1. **Payment provider (you).** Create the account yourself and a recurring product "CleanSheet Pro". Get its hosted checkout / payment link (must be `https://`). Before choosing, compare fees, payout countries and who handles sales tax/VAT (merchant-of-record providers do; others make it your job). Check current terms on their sites.
2. **Signing keys (you, once).**
   ```bash
   node tools/license-tool.mjs keygen
   ```
   This writes `keys/license-private.jwk.json` (git-ignored) and prints the public key. **Back the private key up somewhere safe and offline.** If it is lost you cannot issue keys; if it leaks anyone can mint licenses, and you would have to rotate keys and reissue everything.
3. **Configure the site (you).** In the GitHub repo: Settings → Secrets and variables → Actions → **Variables** (not secrets; these are public):
   - `VITE_CHECKOUT_URL`: your checkout link
   - `VITE_LICENSE_PUBLIC_KEY`: the public key JSON printed by keygen
   - `VITE_PRO_PRICE`: e.g. `$4.99/month` (must match what the checkout charges)
   - `VITE_SUPPORT_EMAIL`: where customers reach you
   Then re-run the deploy workflow. Pro turns on only when both the checkout URL and public key are set.
4. **Test before taking real money.** Use the provider's **test mode**: do a test purchase, issue a key (`node tools/license-tool.mjs issue --private keys/license-private.jwk.json --id TEST-1 --email you@example.com --days 35`), activate it on the deployed site, confirm the unlock, an expired key, a wrong key, and reload persistence. Do the refund and cancellation flows too.
5. **Policies (you).** Publish terms, a refund policy, and a note on what purchase data is kept and by whom before charging anyone. I have not written these; they should be reviewed by someone qualified for your country.
6. **Go live** by switching the provider to live mode and updating the checkout URL variable.

## Fulfilment today is manual

For each paid order (and each monthly renewal), run the `issue` command and email the key. That is fine for the first handful of customers and a good way to learn, but it does not scale and renewals are easy to forget. Keys are issued for 35 days by default so a monthly renewal has a few days of grace.

Once people actually pay, the next build is automation: a small serverless function that receives the provider's webhook, verifies it, and emails a fresh key. It holds the private key, so it needs careful secret handling. That depends on which provider you pick, so I have not built it yet.

## Known limits

- **Not tamper-proof.** Checking happens in the browser and the code is open source. A determined person can edit their own copy to skip it. Expiry stops casual key sharing, not a motivated bypass. If this matters, see the options in `PRO-PLAN.md` (for example keeping Pro features in a private module).
- **Keys can be shared** with friends until they expire.
- **Stored per browser.** A customer must paste the key on each browser/device they use.
- **Clock-based expiry** uses the device's clock.
