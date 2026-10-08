import { useEffect, useState, useRef } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

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

export function useGoogleAuthSignIn(
  onSuccess: (authData: GoogleAuthPayload) => Promise<void>
) {
  const [isLoading, setIsLoading] = useState(false);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

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

  useEffect(() => {
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
            const res = await fetch(
              'https://www.googleapis.com/oauth2/v3/userinfo',
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );
            if (!res.ok) {
              throw new Error(`Failed to fetch user info: HTTP ${res.status}`);
            }
            const userInfo = await res.json();
            if (!userInfo.sub) {
              throw new Error(
                'Google user info response did not contain a user ID (sub).'
              );
            }
            if (!isMounted) return;
            await onSuccessRef.current({
              accessToken,
              refreshToken,
              tokenExpiresAt,
              userSub: userInfo.sub,
              userEmail: userInfo.email,
              userName: userInfo.name,
            });
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

  const signIn = async () => {
    if (!request) return;
    setIsLoading(true);
    try {
      await promptAsync();
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signIn,
    isLoading,
    isReady: Boolean(request),
  };
}
