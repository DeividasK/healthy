import { expect, test } from '@playwright/test';
import worker, { type Env } from './index';

const env: Env = {
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  ALLOWED_ORIGINS: 'https://usehealthy.app, http://localhost:8081',
};

function post(path: string, body: unknown, origin = 'https://usehealthy.app') {
  return new Request(`https://token.example${path}`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Replaces Google's token endpoint for one test. */
function mockGoogle(status: number, body: unknown) {
  const sent: URLSearchParams[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sent.push(new URLSearchParams(init.body as string));
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { sent, restore: () => (globalThis.fetch = original) };
}

test('refuses other origins', async () => {
  const res = await worker.fetch(
    post('/refresh', { refresh_token: 'r' }, 'https://evil.example'),
    env
  );
  expect(res.status).toBe(403);
});

test('answers preflight requests for allowed origins', async () => {
  const res = await worker.fetch(
    new Request('https://token.example/refresh', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:8081' },
    }),
    env
  );
  expect(res.status).toBe(204);
  expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
    'http://localhost:8081'
  );
});

test('exchanges a code with the client secret', async () => {
  const google = mockGoogle(200, {
    access_token: 'access',
    expires_in: 3599,
    refresh_token: 'refresh',
    id_token: 'not passed on',
  });
  try {
    const res = await worker.fetch(
      post('/token', {
        code: 'code',
        code_verifier: 'verifier',
        redirect_uri: 'https://usehealthy.app/a/oauth-callback.html',
      }),
      env
    );
    expect(await res.json()).toEqual({
      access_token: 'access',
      expires_in: 3599,
      refresh_token: 'refresh',
    });
    expect(Object.fromEntries(google.sent[0])).toEqual({
      client_id: 'client-id',
      client_secret: 'client-secret',
      grant_type: 'authorization_code',
      code: 'code',
      code_verifier: 'verifier',
      redirect_uri: 'https://usehealthy.app/a/oauth-callback.html',
    });
  } finally {
    google.restore();
  }
});

test('passes on a revoked refresh token as invalid_grant', async () => {
  const google = mockGoogle(400, { error: 'invalid_grant' });
  try {
    const res = await worker.fetch(
      post('/refresh', { refresh_token: 'r' }),
      env
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_grant' });
    expect(google.sent[0].get('grant_type')).toBe('refresh_token');
  } finally {
    google.restore();
  }
});

test('reports Google rate limiting as a retryable failure', async () => {
  const google = mockGoogle(429, { error: 'rate_limit_exceeded' });
  try {
    const res = await worker.fetch(
      post('/refresh', { refresh_token: 'r' }),
      env
    );
    expect(res.status).toBe(502);
  } finally {
    google.restore();
  }
});

test('rejects malformed requests without calling Google', async () => {
  const google = mockGoogle(200, {});
  try {
    const res = await worker.fetch(post('/token', { code: 'code' }), env);
    expect(res.status).toBe(400);
    expect(google.sent).toEqual([]);
  } finally {
    google.restore();
  }
});
