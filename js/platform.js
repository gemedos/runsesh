// Where is the app running? The Android app (Part B) wraps these same files in Capacitor.
// The web code must behave identically on both, except for the few checks that use this.

/** True only inside the native Capacitor shell. */
export function isNativeApp() {
  const cap = globalThis.Capacitor;
  return Boolean(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
}
