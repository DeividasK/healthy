/**
 * Healthy's Google token service, a Cloudflare Worker.
 *
 * Google only gives a web app a refresh token in exchange for its client
 * secret, which cannot ship inside the public app. This Worker holds the
 * secret and does the two token requests that need it, so the web app can
 * renew Drive access in the background. It sees Google tokens only, never
 * health data, and stores nothing.
 */

export interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  /** Comma-separated origins allowed to call the service. */
  ALLOWED_ORIGINS: string;
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(origin),
    },
  });
}

/** Builds Google's token request for an endpoint, or null if malformed. */
function googleParams(
  path: string,
  body: Record<string, unknown>,
  env: Env
): URLSearchParams | null {
  const str = (key: string) =>
    typeof body[key] === 'string' && body[key] ? (body[key] as string) : null;
  const client = {
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
  };
  if (path === '/token') {
    const code = str('code');
    const verifier = str('code_verifier');
    const redirectUri = str('redirect_uri');
    if (!code || !verifier || !redirectUri) return null;
    return new URLSearchParams({
      ...client,
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    });
  }
  if (path === '/refresh') {
    const refreshToken = str('refresh_token');
    if (!refreshToken) return null;
    return new URLSearchParams({
      ...client,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';
    const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
    if (!allowed.includes(origin))
      return new Response('Origin not allowed', { status: 403 });
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== 'POST')
      return json({ error: 'method_not_allowed' }, 405, origin);

    const { pathname } = new URL(request.url);
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const params = body && googleParams(pathname, body, env);
    if (!params) return json({ error: 'invalid_request' }, 400, origin);

    const google = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = (await google.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!google.ok)
      return json(
        { error: data.error ?? 'google_error' },
        google.status >= 500 ? 502 : 400,
        origin
      );
    return json(
      {
        access_token: data.access_token,
        expires_in: data.expires_in,
        refresh_token: data.refresh_token,
      },
      200,
      origin
    );
  },
};
