# `make_space` — Implementation Reference (v2)

Task-specific recipe for THIS repo. For generic API signatures use the `supernote-docs` MCP first,
then `api-quick-ref.md` / `types.md`. Full execution plan:
`/home/gorlix/.claude/plans/valuterei-che-quando-si-compiled-eagle.md`.

---

## 1. What the plugin does

OneNote-style "insert extra writing space". User taps a horizontal Y line; everything below is
selected as a **native lasso**; the user then drags that selection by hand to open blank space.
The plugin only **creates the selection** — the move and undo are native NOTE behavior.

Flow:

```
button(id 100, NOTE, showType 1)  →  App mounts
  load filePath / pageNum / pageSize        (PluginCommAPI + PluginFileAPI)
  render transparent fullscreen View + thick grey border (visual cue)
  user taps Y  →  computeLassoRect(tapY, viewH, pageW, pageH)
  PluginCommAPI.lassoElements(rect)         (rect in PIXELS; this ALSO shows the box)
  PluginManager.closePluginView()           (hand control back to NOTE)
  → user drags selection natively

  ⚠️ Do NOT call setLassoBoxState(0) here — see §3.
```

## 2. Coordinates — everything is PIXELS here

No EMR conversion needed. The tap is in screen pixels; `lassoElements` wants a pixel `Rect`.
Map the tap's Y (DP within the view) to page pixels by **proportion**, which sidesteps pixel-density
and view-scaling issues:

```ts
// src/makeSpace.ts — pure, no SDK, unit-testable
export type Rect = {left: number; top: number; right: number; bottom: number};

/**
 * Map a tap Y (in DP, relative to the fullscreen plugin view) to the lasso rect
 * covering everything BELOW that line, in page pixel coordinates.
 *
 * Proportional mapping (tapY/viewH) avoids density/scale mismatches between the
 * RN view (DP) and the note page (px). `top` is clamped to [0, pageH] so an
 * out-of-bounds tap can never produce an invalid rect.
 *
 * @param tapY   tap Y in DP, from PressEvent.nativeEvent.locationY
 * @param viewH  measured height of the plugin view in DP (onLayout)
 * @param pageW  page width  in pixels (PluginFileAPI.getPageSize)
 * @param pageH  page height in pixels
 * @returns lasso rect in page pixels: {left:0, top, right:pageW, bottom:pageH}
 */
export function computeLassoRect(
  tapY: number, viewH: number, pageW: number, pageH: number,
): Rect {
  const top = Math.round((tapY / viewH) * pageH);
  return {left: 0, top: Math.max(0, Math.min(top, pageH)), right: pageW, bottom: pageH};
}
```

Keep this logic out of `App.tsx` so Jest can test it without a device.

## 3. The lasso recipe (the core)

```ts
const res = await PluginCommAPI.lassoElements(rect);   // APIResponse<boolean>
// lassoElements ALREADY creates AND shows the selection box (auto-fit to the
// content, like a hand-drawn lasso). That's all we need — just hand control back.
await PluginManager.closePluginView();
```

**⚠️ Do NOT call `setLassoBoxState(0)` after `lassoElements` (verified on-device, #34).**
`lassoElements` already shows the box, so the call is redundant — and worse, it puts
the firmware into the native **transfer/paste mode** (`TransferModeView`,
`isPenFloatingOnTheScreen`). If the user has anything in the Supernote clipboard, the
next tap-to-deselect **pastes that clipboard content (scaled up)** instead of
deselecting. A native hand-drawn lasso never calls `setLassoBoxState` and never
pastes; that one call was the only difference. Leave `setLassoBoxState` for flows that
genuinely need to hide/remove the box (states 1/2/3) — not for "show".

**Critical caveat — strokes must be FULLY inside the rect.** `lassoElements` uses
`findTrailsContourInBox`: any stroke with a contour point outside the rect is **not** selected. For
"insert space between two lines" you tap in the gap, so the lines below are fully inside → fine. A
stroke that *crosses* the cut line will be missed. Do **not** add top padding to compensate — it
would grab the line above. Accept this limit in v1; document it for the user.

Other notes:
- Always check `APIResponse.success` before `.result` (see SKILL.md "API Response Pattern").
- `lassoElements` is layer-scoped to the current layer in practice → the "all layers" toggle may
  not be achievable via SDK. Verify on-device before promising it; fall back to current-layer.
- Do NOT call `deleteElements` before/around the lasso (triggers a ~300ms page reload that starves
  the binder pool — see `pen-emr.md` Pattern 14). Not needed here anyway.

## 4. UI — transparent frame (+ fallback)

Primary: root `View` `backgroundColor:'transparent'`, `borderWidth: 8`, `borderColor:'#9e9e9e'`.
A `Pressable` over `StyleSheet.absoluteFill` captures the tap; measure height with `onLayout`.

**Transparency is unconfirmed on PluginHost.** Test first. If the view renders opaque (the note
isn't visible underneath, so the user can't see where to cut), use the fallback: render the page to
an image and tap on that.

```ts
// fallback: snapshot the current page as a white-background PNG, show as <Image> background
await PluginFileAPI.generateNotePng({
  NOTEPath: filePath, page: pageNum, times: 1,
  pngPath: pluginDir + '/preview.png', type: 1,   // 1 = white bg
});
```

The tap-Y math and the lasso call are identical in both UI variants.

**Transparency verified on-device (A5X2 / SN100): the overlay IS transparent** — the note shows
through the grey frame, no `generateNotePng` fallback needed. Keep the fallback documented for other
firmware, but the primary path works.

### ⚠️ PluginHost REUSES the App instance across open/close (verified on-device)

When the plugin view is closed (`closePluginView`) and reopened, PluginHost does **not** remount the
React tree — there is **one** `App mounted`, then every later open only re-renders. Confirmed by
logcat: tap → close → reopen → tap shows no `App unmounted`/`App mounted` between them.

Consequences:
- `useRef` / module-level state **persists** across opens. A guard ref (e.g. `busy` to debounce the
  tap) that you set on tap **must be reset in `finally`**, or the second open is frozen with the
  guard stuck `true` (this was the real "second open stuck on the grey frame" bug).
- `useEffect(() => …, [])` runs **once**, not per open. Do not rely on it to refresh per-open state.
  Fetch the page context (`getCurrentFilePath/PageNum/PageSize`) **fresh inside the tap handler**, so
  it is always current even if the user switched note/page between opens.

## 5. i18n (en + it)

`i18next` + `react-i18next` only (**no `react-native-localize`** — pure JS, avoids the PluginHost
`reactPackages` native-linking issue). Initial language from RN core
`NativeModules.I18nManager.localeIdentifier`; runtime changes via `registerLangListener`. Init in
`src/i18n/index.ts`, imported once from `index.js`. Locales `src/i18n/locales/{en_US,it_IT}.json`.
All UI strings via `t('key')`. Button name = serialized JSON so it follows device language:

```js
name: JSON.stringify({en: 'Make Space', it: 'Fai Spazio'})
```

`registerLangListener` callback uses `onMsg`, and `msg.lang` uses underscores (`it_IT`) → convert
with `.replace('_','-')` before `i18n.changeLanguage` (SKILL.md gotcha #13). Structure is
extendable: add a locale = new JSON + one entry in `resources`.

## 6. Files & layout

```
index.js                       single toolbar button (NOTE, id 100) + init + import ./src/i18n
App.tsx                        transparent frame + tap capture + lasso + close (uses computeLassoRect, t())
src/makeSpace.ts               pure computeLassoRect
src/i18n/index.ts              i18next init + registerLangListener
src/i18n/locales/en_US.json
src/i18n/locales/it_IT.json
__tests__/makeSpace.test.ts    Jest tests for computeLassoRect
jest.config.js                 mock sn-plugin-lib NativeModules
.github/workflows/ci.yml       typecheck + lint + format + test on push/PR
.github/workflows/release.yml  build .snplg + GitHub release on tag v*
```

## 7. Quality gates

Scripts: `typecheck` (`tsc --noEmit`), `lint` (`eslint .`), `format` (`prettier --check .`),
`test` (`jest`), `test:ci` (`jest --ci --coverage`). Run order locally: typecheck → lint → format
→ test. `computeLassoRect` tests: mid-view, top (tapY=0 → full page), past-bottom (clamp),
view≠page scaling, and that `left=0`/`right=pageW`/`bottom=pageH` always hold. Mock
`sn-plugin-lib` in Jest so `App.tsx` imports don't pull NativeModules.

## 8. Git / CI / Release workflow

- **No commits on `main`.** Each unit on its own branch → PR. Branches: `chore/tooling-scripts`,
  `feat/make-space-core`, `feat/i18n`, `feat/make-space-ui`, `ci/pipeline`, `ci/release`.
- Conventional Commits; footer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Remote: **private** GitHub repo (`gh repo create gorlix/sn_make_space --private`). The repo has
  no remote yet; add a proper RN `.gitignore` and push `main` first.
- CI `ci.yml`: Node 20, `npm ci`, typecheck + lint + format + test:ci. No Android (fast).
- Release `release.yml`: trigger on tag `v*`. Build `.snplg` via `buildPlugin.sh` (needs Android
  toolchain + JDK 17), use the **annotated tag message** as release notes, attach the `.snplg`.
  Create release tags with `git tag -a vX.Y.Z -m "..."` + `git push origin vX.Y.Z`. Verify
  `buildPlugin.sh` is non-interactive in CI (it generates `pluginID` on first build).

## 9. Build / deploy / debug (on-device)

```bash
./buildPlugin.sh                                   # → build/outputs/*.snplg
adb push build/outputs/*.snplg /storage/emulated/0/MyStyle/
# install via Settings → Apps → Plugins
adb logcat -c; <do action>; adb logcat -d -s ReactNativeJS:V
adb logcat -P ""                                   # if NativeModules look null (chatty filter)
```

Confirm `build/generated/PluginConfig.json` has `pluginKey === "sn_make_space"` (must equal the
first arg of `AppRegistry.registerComponent`). See SKILL.md gotcha #33 about `reactPackages`.

## 10. Out of scope (v2-advanced, later)

True one-gesture auto-move: read `getElements`, shift each element's position (strokes: every EMR
point via `ElementDataAccessor.setRange` + `maxY`; geometry/textbox/picture/title: pixel fields),
then `modifyElements` + `saveCurrentNote` + `reloadFile`. Also page-overflow handling
(`insertNotePage`) and multi-layer shifting. Not in v1.
