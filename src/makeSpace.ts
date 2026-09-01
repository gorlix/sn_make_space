/**
 * make_space — pure geometry helpers.
 *
 * This module is intentionally free of any `sn-plugin-lib` / React Native import
 * so it can be unit-tested in plain Node (Jest) without a device. All SDK calls
 * live in `App.tsx`; here we only do the coordinate math.
 */

/** Axis-aligned rectangle in page pixel coordinates (top-left origin). */
export type Rect = {left: number; top: number; right: number; bottom: number};

/** Which side of the tapped line gets selected. */
export type CutDirection = 'above' | 'below';

/**
 * Build the lasso rectangle covering everything ABOVE or BELOW the tapped line.
 *
 * The user taps a Y position inside the fullscreen plugin overlay. That Y is in
 * DP, relative to the view, so we map it to page **pixels** by proportion
 * (`tapY / viewH`) rather than assuming a 1:1 DP↔pixel ratio — this is robust to
 * screen density and to the view not matching the page resolution exactly.
 *
 * The resulting rect always spans the full page width; `direction` picks which
 * side of the clamped cut line it covers (top-to-cut for 'above', cut-to-bottom
 * for 'below') — this is what `PluginCommAPI.lassoElements(rect)` expects
 * (pixel coordinates). The cut position is clamped to `[0, pageH]` so a tap
 * outside the page (e.g. on the border frame) can never produce an
 * inverted/invalid rect.
 *
 * Note: `lassoElements` only selects strokes whose contour is *fully* inside the
 * rect, so a stroke crossing the cut line is intentionally left unselected.
 *
 * @param tapY      tap Y in DP (PressEvent.nativeEvent.locationY)
 * @param viewH     measured height of the plugin view in DP (from onLayout)
 * @param pageW     page width in pixels (PluginCommAPI.getPageDisplaySize)
 * @param pageH     page height in pixels
 * @param direction which side of the cut line to select
 * @returns lasso rect in page pixels, full width, on the requested side of the cut
 */
export function computeLassoRect(
  tapY: number,
  viewH: number,
  pageW: number,
  pageH: number,
  direction: CutDirection,
): Rect {
  // Guard against a zero/negative view height (not laid out yet): treat as top.
  const ratio = viewH > 0 ? tapY / viewH : 0;
  const rawCut = Math.round(ratio * pageH);
  const cutY = Math.max(0, Math.min(rawCut, pageH));
  return direction === 'below'
    ? {left: 0, top: cutY, right: pageW, bottom: pageH}
    : {left: 0, top: 0, right: pageW, bottom: cutY};
}
