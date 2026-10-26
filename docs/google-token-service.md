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

## Refresh token lifetime

While the OAuth consent screen's publishing status is **Testing**, Google
expires refresh tokens after 7 days, so users sign in again weekly.
