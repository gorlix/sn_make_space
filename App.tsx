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

function App(): React.JSX.Element {
  const {t} = useTranslation();
  const [ctx, setCtx] = useState<PageContext | null>(null);
  const [failed, setFailed] = useState(false);
  // Measured height of the overlay (DP). Seeded with the window height so the
  // first tap still maps sensibly if it lands before onLayout fires.
  const viewHeight = useRef(Dimensions.get('window').height);
  // Guards against a second tap while the lasso/close flow is in flight.
  const busy = useRef(false);

  // Load the current note + page size once on mount.
  useEffect(() => {
    (async () => {
      try {
        const fp = await getCurrentFilePath();
        const pn = await getCurrentPageNum();
        if (!fp?.success || !fp.result || !pn?.success || pn.result == null) {
          setFailed(true);
          return;
        }
        const ps = await getPageSize(fp.result, pn.result);
        if (!ps?.success || !ps.result) {
          setFailed(true);
          return;
        }
        setCtx({
          path: fp.result,
          page: pn.result,
          width: ps.result.width,
          height: ps.result.height,
        });
      } catch {
        setFailed(true);
      }
    })();
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) {
      viewHeight.current = h;
    }
  };

  /**
   * Build a lasso of everything below the tapped line, then hand control back
   * to NOTE so the user can drag the selection.
   */
  const onTap = async (e: GestureResponderEvent) => {
    if (!ctx || busy.current) {
      return;
    }
    busy.current = true;
    try {
      const rect = computeLassoRect(
        e.nativeEvent.locationY,
        viewHeight.current,
        ctx.width,
        ctx.height,
      );
      const res = await lassoElements(rect);
      if (res?.success && res.result) {
        // 0 = show the selection box so the user sees what will move.
        await setLassoBoxState(0);
      }
    } finally {
      // Always return control to the note, even if the lasso found nothing.
      await closePluginView();
    }
  };

  return (
    <View style={styles.frame} onLayout={onLayout}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onTap}>
        <View style={styles.hintBar} pointerEvents="none">
          <Text style={styles.hintText}>
            {failed ? t('error.noNote') : t('hint.tapToInsertSpace')}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const BORDER = '#9e9e9e';

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 8,
    borderColor: BORDER,
  },
  hintBar: {
    position: 'absolute',
    top: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 18,
    color: BORDER,
  },
});

export default App;
