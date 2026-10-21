/**
 * Hands the Welcome heart over to the header logo. Welcome records where its
 * heart is before moving on; the header then starts its logo there and
 * animates it home, so the heart appears to fly into the header. Saving the
 * first profile asks the header for one heartbeat on arrival at Home.
 */
export interface LogoRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

let heroRect: LogoRect | null = null;
let beatPending = false;

export function setHeroLogoRect(rect: LogoRect) {
  heroRect = rect;
}

/** The recorded Welcome heart, once; later calls get `null`. */
export function takeHeroLogoRect(): LogoRect | null {
  const rect = heroRect;
  heroRect = null;
  return rect;
}

export function requestLogoBeat() {
  beatPending = true;
}

/** Whether a heartbeat was requested, once. */
export function takeLogoBeat(): boolean {
  const pending = beatPending;
  beatPending = false;
  return pending;
}
