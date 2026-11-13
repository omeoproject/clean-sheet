# CleanSheet

Browser-only CSV/Excel duplicate cleaner. Vue 3, Vite, TypeScript, Tailwind CSS 4, SheetJS 0.20.3 (from the SheetJS CDN, not npm's `xlsx`). Files never leave the browser; production builds set a CSP with `connect-src 'none'`.

Live site: https://omeoproject.github.io/clean-sheet/ (GitHub Pages). Repo: `omeoproject/clean-sheet`, branch `main`.

## Commands (run from this folder)

- `npm run dev`: dev server
- `npm test`: Vitest (86 tests)
- `npm run typecheck`: vue-tsc
- `npm run build` then `npm run preview`: production build, served locally

## Layout

- `src/core/`: framework-free logic (`parse`, `dedupe`, `export`, `license`, `plans`) with tests in `tests/`
- `src/composables/`: `useCleaner`, `useLicense`
- `src/components/`, `src/App.vue`: UI
- `tools/license-tool.mjs`: seller-side license tool (`keygen`, `issue`)
- `docs/GO-LIVE.md`: how Pro is turned on; `docs/PRO-PLAN.md`, `docs/ROADMAP.md`, `docs/FEEDBACK.md`

## Pro tier (offline signed licenses)

- Pro is on only when `VITE_CHECKOUT_URL` and `VITE_LICENSE_PUBLIC_KEY` are set at build time. Local values live in `.env.local`; the live site gets them from GitHub repository **variables** (`VITE_CHECKOUT_URL`, `VITE_LICENSE_PUBLIC_KEY`, `VITE_PRO_PRICE`, `VITE_SUPPORT_EMAIL`).
- Licenses are ECDSA P-256 tokens (`cs1.<payload>.<signature>`) verified offline in the browser. Fulfilment is manual: `node tools/license-tool.mjs issue --private keys/license-private.jwk.json --id <order> --email <email> --days 35`.
- Payments run through Lemon Squeezy. The checkout is still in test mode, and the store is awaiting Lemon Squeezy's approval.

## Rules

- Never read, print, commit or log anything in `keys/` or any `.env*` file. Never put a private key in `src/` or the build. Do not run `keygen` again: it would create a different key pair, and licenses signed by the old key would stop working.
- Do not switch checkout to live mode, change the GitHub variables, or redeploy Pro changes without asking first.
- Client-side limits are bypassable (open source); don't claim otherwise.
- Keep the privacy claims true: no analytics, no uploads, no network requests from the app.
- Before finishing a change: `npm run typecheck`, `npm test`, `npm run build`.

## GitHub

- Use the `smart-ship` skill whenever work is going to GitHub (commit, push, pull request). Don't push by hand.
- This machine's cached git login belongs to a different account, so pushes need the `omeoproject` username override: `git -c credential.https://github.com.username=omeoproject push`. `gh` is installed and signed in as `omeoproject`.
- A push to `main` redeploys the live site through `.github/workflows/pages.yml`.
- Commit messages end with the co-author line the session specifies.
