import type { GoogleTokens } from './tokenStore';

export type { GoogleTokens };

// Browsers have no OS key store; tokens stay with the rest of the config.
export const secureTokenStore: {
  save(tokens: GoogleTokens): Promise<void>;
  load(): Promise<GoogleTokens | null>;
  clear(): Promise<void>;
} | null = null;
