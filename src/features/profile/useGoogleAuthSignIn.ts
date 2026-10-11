import { useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { requestWebAccessToken } from '@/src/services/googleAuthWebService';

WebBrowser.maybeCompleteAuthSession();

const googleDiscovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
  userInfoEndpoint: 'https://www.googleapis.com/oauth2/v3/userinfo',
};

export interface GoogleAuthPayload {
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt: number;
  userSub: string;
  userEmail?: string;
  userName?: string;
}

/**
 * Fetches Google user info using a bearer token and calls onSuccess.
 * Shared between the web (GIS) and native (expo-auth-session) paths.
 */
async function resolveUserAndNotify(
  accessToken: string,
  tokenExpiresAt: number,
  refreshToken: string | undefined,
  onSuccess: (authData: GoogleAuthPayload) => Promise<void>
): Promise<void> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch user info: HTTP ${res.status}`);
  }
  const userInfo = await res.json();
  if (!userInfo.sub) {
    throw new Error(
      'Google user info response did not contain a user ID (sub).'
    );
  }
  await onSuccess({
    accessToken,
    refreshToken,
    tokenExpiresAt,
    userSub: userInfo.sub,
    userEmail: userInfo.email,
    userName: userInfo.name,
  });
}

export function useGoogleAuthSignIn(
  onSuccess: (authData: GoogleAuthPayload) => Promise<void>
) {
  const [isLoading, setIsLoading] = useState(false);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  // ── Native path: expo-auth-session ──────────────────────────────────────────
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'healthy',
    preferLocalhost: true,
  });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId,
      scopes: [
        'openid',
        'profile',
        'email',
        'https://www.googleapis.com/auth/drive.appdata',
      ],
      responseType: AuthSession.ResponseType.Token,
      usePKCE: false,
      redirectUri,
      extraParams: {
        prompt: 'select_account',
      },
    },
    googleDiscovery
  );

  // Handle native auth-session response
  useEffect(() => {
    if (Platform.OS === 'web') return; // handled in signIn() for web
    let isMounted = true;
    if (response?.type === 'success') {
      const accessToken =
        response.authentication?.accessToken ||
        response.params.access_token ||
        '';

      const refreshToken =
        response.authentication?.refreshToken ||
        response.params.refresh_token ||
        undefined;

      const expiresInSeconds = response.authentication?.expiresIn
        ? Number(response.authentication.expiresIn)
        : response.params.expires_in
          ? Number(response.params.expires_in)
          : 3600;

      const tokenExpiresAt = Date.now() + expiresInSeconds * 1000;

      if (accessToken) {
        (async () => {
          if (!isMounted) return;
          setIsLoading(true);
          try {
            await resolveUserAndNotify(
              accessToken,
              tokenExpiresAt,
              refreshToken,
              onSuccessRef.current
            );
          } catch (err) {
            console.error('Google profile fetch failed:', err);
          } finally {
            if (isMounted) {
              setIsLoading(false);
            }
          }
        })();
      }
    }

    return () => {
      isMounted = false;
    };
  }, [response]);

  // ── signIn: web uses GIS (no redirect URI), native uses expo-auth-session ──
  const signIn = async () => {
    setIsLoading(true);
    try {
      if (Platform.OS === 'web') {
        // GIS manages its own popup — no redirect URI needed, so no 404 on
        // GitHub Pages subpath deployments.
        const { accessToken, expiresIn } = await requestWebAccessToken({
          prompt: 'select_account',
        });
        const tokenExpiresAt = Date.now() + expiresIn * 1000;
        await resolveUserAndNotify(
          accessToken,
          tokenExpiresAt,
          undefined, // GIS implicit flow does not return a refresh token
          onSuccessRef.current
        );
      } else {
        if (!request) return;
        await promptAsync();
        // result is handled by the useEffect above
      }
    } catch (err) {
      console.error('Google sign-in failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signIn,
    isLoading,
    // On web the GIS script load is async but happens in signIn(); treat as always ready.
    isReady: Platform.OS === 'web' ? true : Boolean(request),
  };
}
