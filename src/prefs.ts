/**
 * In-session preferences (module-level singletons).
 *
 * Durable storage on Supernote would require a native module (sqlite / fs),
 * which forces a heavyweight Android build — not worth it for a single
 * "don't show the intro again" flag. PluginHost keeps the JS context (and this
 * module) alive across plugin open/close, so an in-memory flag suppresses the
 * intro for the whole session. It resets only when PluginHost or the device
 * restarts, where showing the one-time intro again is harmless.
 */

let introDismissed = false;

/** True once the user chose "don't show again" this session. */
export function isIntroDismissed(): boolean {
  return introDismissed;
}

/** Suppress the intro for the rest of the session. */
export function dismissIntro(): void {
  introDismissed = true;
}

/** Test-only: restore defaults so cases don't leak into each other. */
export function resetPrefsForTests(): void {
  introDismissed = false;
}
