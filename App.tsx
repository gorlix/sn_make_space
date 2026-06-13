/**
 * make_space — plugin UI.
 *
 * A full-screen, transparent overlay framed by a thick grey border (the visual
 * cue "do something here"). The user taps a horizontal position; everything on
 * the current NOTE page below that line is selected as a native lasso, and the
 * plugin closes so the user can drag the selection by hand to open space.
 *
 * The move and its undo are native NOTE behavior — this plugin only builds the
 * selection. See .claude/skills/supernote-plugin-dev/references/make-space.md.
 *
 * @format
 */

import React, {useEffect, useRef, useState} from 'react';
import {
  Dimensions,
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useTranslation} from 'react-i18next';

import {computeLassoRect} from './src/makeSpace';
import {dismissIntro, isIntroDismissed} from './src/prefs';
import {
  closePluginView,
  getCurrentFilePath,
  getCurrentPageNum,
  getPageSize,
  lassoElements,
  setLassoBoxState,
} from './src/sdk';

/** Current NOTE page context needed to build the lasso rect. */
type PageContext = {path: string; page: number; width: number; height: number};

const TAG = '[make_space]';
// Verbose logging so the whole flow is visible in `adb logcat -s ReactNativeJS:V`.
// Gated behind __DEV__ so release bundles (built with `--dev false`) stay silent.
const log = (...args: unknown[]) => {
  if (__DEV__) {
    console.log(TAG, ...args);
  }
};

/**
 * Read the current note path + page + pixel size. Returns null (and logs why)
 * if anything is missing — e.g. no note open. Called both on mount (for the
 * hint) and fresh on every tap (so it never acts on a stale page).
 */
async function loadContext(where: string): Promise<PageContext | null> {
  try {
    const fp = await getCurrentFilePath();
    log(where, 'getCurrentFilePath ->', fp);
    const pn = await getCurrentPageNum();
    log(where, 'getCurrentPageNum ->', pn);
    if (!fp?.success || !fp.result || !pn?.success || pn.result == null) {
      log(where, 'context unavailable (no note?)');
      return null;
    }
    const ps = await getPageSize(fp.result, pn.result);
    log(where, 'getPageSize ->', ps);
    if (!ps?.success || !ps.result) {
      log(where, 'page size unavailable');
      return null;
    }
    return {
      path: fp.result,
      page: pn.result,
      width: ps.result.width,
      height: ps.result.height,
    };
  } catch (err) {
    log(where, 'loadContext threw:', String(err));
    return null;
  }
}

function App(): React.JSX.Element {
  const {t} = useTranslation();
  const [failed, setFailed] = useState(false);
  // First-run intro popup. Initialised from the in-session flag so it shows once
  // per session (and not at all after "don't show again"). See src/prefs.ts.
  const [showIntro, setShowIntro] = useState(() => !isIntroDismissed());
  // Measured height of the overlay (DP). Seeded with the window height so the
  // first tap still maps sensibly if it lands before onLayout fires.
  const viewHeight = useRef(Dimensions.get('window').height);
  // Guards against a second tap while the lasso/close flow is in flight. MUST be
  // reset in the finally below — PluginHost can keep this App instance alive
  // across open/close cycles, so a stuck `true` would freeze every later open.
  const busy = useRef(false);

  useEffect(() => {
    log('App mounted; window=', Dimensions.get('window'));
    // Make sure a reused instance never reopens locked.
    busy.current = false;
    (async () => {
      const ctx = await loadContext('mount');
      setFailed(ctx == null);
    })();
    return () => log('App unmounted');
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    log('onLayout height=', h);
    if (h > 0) {
      viewHeight.current = h;
    }
  };

  /**
   * Build a lasso of everything below the tapped line, then hand control back
   * to NOTE so the user can drag the selection.
   */
  const onTap = async (e: GestureResponderEvent) => {
    // Ignore taps while the intro is up — the popup handles its own buttons.
    if (showIntro) {
      return;
    }
    const tapY = e.nativeEvent.locationY;
    log(
      'onTap tapY=',
      tapY,
      'viewH=',
      viewHeight.current,
      'busy=',
      busy.current,
    );
    if (busy.current) {
      log('onTap ignored: busy');
      return;
    }
    busy.current = true;
    try {
      const ctx = await loadContext('tap');
      if (!ctx) {
        setFailed(true);
        return;
      }
      const rect = computeLassoRect(
        tapY,
        viewHeight.current,
        ctx.width,
        ctx.height,
      );
      log('lasso rect=', rect);
      const res = await lassoElements(rect);
      log('lassoElements ->', res);
      if (res?.success && res.result) {
        const box = await setLassoBoxState(0);
        log('setLassoBoxState ->', box);
      }
    } catch (err) {
      log('onTap threw:', String(err));
    } finally {
      log('closePluginView…');
      try {
        const closed = await closePluginView();
        log('closePluginView ->', closed);
      } catch (err) {
        log('closePluginView threw:', String(err));
      }
      // Release the guard so the next open is usable even if App is reused.
      busy.current = false;
      log('onTap done; busy reset');
    }
  };

  log('App render; failed=', failed, 'showIntro=', showIntro);

  return (
    <View style={styles.frame} onLayout={onLayout}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onTap}>
        <View style={styles.hintBar} pointerEvents="none">
          <View style={styles.hintPill}>
            <Text style={styles.hintText}>
              {failed ? t('error.noNote') : t('hint.tapToInsertSpace')}
            </Text>
          </View>
        </View>
      </Pressable>

      {showIntro && (
        // Backdrop is a Pressable so taps on it are absorbed (never reach the
        // lasso layer); it only dims the page so the card reads clearly.
        <Pressable style={styles.introBackdrop} onPress={() => {}}>
          <View style={styles.introCard}>
            <Text style={styles.introTitle}>{t('intro.title')}</Text>
            <Text style={styles.introBody}>{t('intro.body')}</Text>
            <View style={styles.introButtons}>
              <Pressable
                style={styles.introBtnGhost}
                onPress={() => {
                  dismissIntro();
                  setShowIntro(false);
                }}>
                <Text style={styles.introBtnGhostText}>
                  {t('intro.dontShowAgain')}
                </Text>
              </Pressable>
              <Pressable
                style={styles.introBtn}
                onPress={() => setShowIntro(false)}>
                <Text style={styles.introBtnText}>{t('intro.gotIt')}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      )}
    </View>
  );
}

const FRAME = '#9e9e9e';
const INK = '#000000';

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 8,
    borderColor: FRAME,
  },
  hintBar: {
    position: 'absolute',
    top: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  // High-contrast pill so the hint is clearly visible over the note on e-ink.
  hintPill: {
    backgroundColor: INK,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  hintText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
  },
  introBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  introCard: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 16,
    padding: 28,
  },
  introTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: INK,
    marginBottom: 14,
  },
  introBody: {
    fontSize: 19,
    lineHeight: 28,
    color: INK,
  },
  introButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 28,
  },
  introBtn: {
    backgroundColor: INK,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginLeft: 12,
  },
  introBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  introBtnGhost: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: INK,
  },
  introBtnGhostText: {
    fontSize: 18,
    fontWeight: '600',
    color: INK,
  },
});

export default App;
