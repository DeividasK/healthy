# Google token service

Google gives the web app a one-hour access token. Renewing it without the
user needs a refresh token, and Google only hands out refresh tokens in
exchange for the web client's secret, which cannot ship in the public app.
`workers/google-token` is a Cloudflare Worker that holds the secret and does
the two requests that need it:

- `POST /token` swaps the code from Google's sign-in popup (with its PKCE
  verifier) for an access token and a refresh token.
- `POST /refresh` swaps a refresh token for a new access token.

It stores nothing and only sees Google tokens, never health data. It only
answers origins listed in `ALLOWED_ORIGINS` (`wrangler.toml`). It runs on
Cloudflare's free plan (100,000 requests a day; one renewal per active user
per hour).

The app turns it on when `EXPO_PUBLIC_GOOGLE_TOKEN_SERVICE_URL` is set
(`.env`). Without it, web sign-in falls back to Google Identity Services
tokens, which only renew when the user syncs by hand.

On web the refresh token is kept with the rest of the Google connection in
local storage. Disconnecting revokes it.

## Setup

1. **Google Cloud Console** → APIs & Services → Credentials → the web OAuth
   client: add these **Authorized redirect URIs**, and copy the **client
   secret**:
   - `https://usehealthy.app/a/oauth-callback.html`
   - `http://localhost:8081/oauth-callback.html`
2. **Cloudflare**: create a free account, then an API token from the
   "Edit Cloudflare Workers" template. Note your account ID.
3. **GitHub** → repository Settings → Secrets and variables → Actions: add
   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `GOOGLE_CLIENT_SECRET`.
4. Run the **Google Token Service** workflow (it also runs when the Worker
   changes on `main`). It prints the Worker's URL, for example
   `https://healthy-google-token.<account>.workers.dev`.
5. Set `EXPO_PUBLIC_GOOGLE_TOKEN_SERVICE_URL` to that URL in `.env`. The web
   app uses it from the next release.

## Refresh token lifetime

While the OAuth consent screen's publishing status is **Testing**, Google
expires refresh tokens after 7 days, so users sign in again weekly. Publish
the app (OAuth consent screen → Publish app) for refresh tokens that last
until the user revokes them.
