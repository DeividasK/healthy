import { useEffect, useState, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import {
  loadGisScript,
  requestWebAccessToken,
} from '@/src/services/googleAuthWebService';

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
 *
 * @param isMounted - A function that returns false once the calling effect has
 *   cleaned up. The resolver checks this immediately before invoking onSuccess
 *   so that a stale native-effect response cannot update sync state after the
 *   user has already navigated away.
 */
async function resolveUserAndNotify(
  accessToken: string,
  tokenExpiresAt: number,
  refreshToken: string | undefined,
  onSuccess: (authData: GoogleAuthPayload) => Promise<void>,
  isMounted: () => boolean
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
  // Guard: don't call onSuccess if the effect has already cleaned up (e.g.
  // the user navigated away while the user-info fetch was in flight).
  if (!isMounted()) return;
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
  // Track whether the GIS script has finished loading so the button is only
  // enabled once requestWebAccessToken() can actually be called synchronously
  // within the user gesture (browsers block popups opened outside of a direct
  // user gesture, and GIS itself requires the script to be ready).
  const [isGisReady, setIsGisReady] = useState(false);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  // Pre-load the GIS script on web so the button is ready when the user taps.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    loadGisScript().then((loaded) => {
      setIsGisReady(loaded);
    });
  }, []);

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
    let mounted = true;
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
          if (!mounted) return;
          setIsLoading(true);
          try {
            await resolveUserAndNotify(
              accessToken,
              tokenExpiresAt,
              refreshToken,
              onSuccessRef.current,
              () => mounted
            );
          } catch (err) {
            console.error('Google profile fetch failed:', err);
          } finally {
            if (mounted) {
              setIsLoading(false);
            }
          }
        })();
      }
    }

    return () => {
      mounted = false;
    };
  }, [response]);

  // ── signIn: web uses GIS (no redirect URI), native uses expo-auth-session ──
  const signIn = useCallback(async () => {
    setIsLoading(true);
    try {
      if (Platform.OS === 'web') {
        // GIS manages its own popup — no redirect URI needed, so no 404 on
        // GitHub Pages subpath deployments. The GIS script is guaranteed to be
        // loaded before this callback fires (isGisReady gates the button).
        const { accessToken, expiresIn } = await requestWebAccessToken({
          prompt: 'select_account',
        });
        const tokenExpiresAt = Date.now() + expiresIn * 1000;
        // Web signIn() is always called within the user gesture; no mounted
        // check needed here — the component is still mounted at call time.
        await resolveUserAndNotify(
          accessToken,
          tokenExpiresAt,
          undefined, // GIS implicit flow does not return a refresh token
          onSuccessRef.current,
          () => true
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
  }, [request, promptAsync]);

  return {
    signIn,
    isLoading,
    // On web: ready once the GIS script has loaded (so the popup is available
    // synchronously inside the user gesture). On native: ready once the
    // auth request has been prepared by expo-auth-session.
    isReady: Platform.OS === 'web' ? isGisReady : Boolean(request),
  };
}
