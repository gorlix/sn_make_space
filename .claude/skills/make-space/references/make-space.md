# `make_space` — Implementation Reference

Task-specific recipe for THIS repo. For generic API signatures use the `supernote-docs` MCP first,
then the `supernote-plugin-dev` skill's `api-quick-ref.md` / `types.md`. Full execution plans:
`/home/gorlix/.claude/plans/valuterei-che-quando-si-compiled-eagle.md` (v1/v2 core),
`/home/gorlix/.claude/plans/functional-knitting-lantern.md` ("Make Space Above").

---

## 1. What the plugin does

OneNote-style "insert extra writing space". User taps a horizontal Y line; everything **above or
below** it (depending on which toolbar button opened the plugin) is selected as a **native lasso**;
the user then drags that selection by hand to open blank space. The plugin only **creates the
selection** — the move and undo are native NOTE behavior.

Flow:

```
button(id 100 "Below" or id 101 "Above", NOTE, showType 1) → App mounts/reused
  direction = which button was pressed (Pending Button ID pattern, see §4a)
  load current page's pixel size            (PluginCommAPI.getPageDisplaySize)
  render transparent fullscreen View + thick grey border (visual cue)
  user taps Y  →  computeLassoRect(tapY, viewH, pageW, pageH, direction)
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
export type CutDirection = 'above' | 'below';

/**
 * Map a tap Y (in DP, relative to the fullscreen plugin view) to the lasso rect
 * covering everything ABOVE or BELOW that line, in page pixel coordinates.
 *
 * Proportional mapping (tapY/viewH) avoids density/scale mismatches between the
 * RN view (DP) and the note page (px). The cut position is clamped to [0, pageH]
 * so an out-of-bounds tap can never produce an invalid rect.
 *
 * @param tapY      tap Y in DP, from PressEvent.nativeEvent.locationY
 * @param viewH     measured height of the plugin view in DP (onLayout)
 * @param pageW     page width  in pixels (PluginCommAPI.getPageDisplaySize)
 * @param pageH     page height in pixels
 * @param direction which side of the cut line to select
 * @returns lasso rect in page pixels, full width, on the requested side of the cut
 */
export function computeLassoRect(
  tapY: number, viewH: number, pageW: number, pageH: number,
  direction: CutDirection,
): Rect {
  const ratio = viewH > 0 ? tapY / viewH : 0;
  const rawCut = Math.round(ratio * pageH);
  const cutY = Math.max(0, Math.min(rawCut, pageH));
  return direction === 'below'
    ? {left: 0, top: cutY, right: pageW, bottom: pageH}
    : {left: 0, top: 0, right: pageW, bottom: cutY};
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

**⚠️ Do NOT call `setLassoBoxState(0)` after `lassoElements` (verified on-device, generic-skill
gotcha #34-equivalent, discovered here first).** `lassoElements` already shows the box, so the call
is redundant — and worse, it puts the firmware into the native **transfer/paste mode**
(`TransferModeView`, `isPenFloatingOnTheScreen`). If the user has anything in the Supernote
clipboard, the next tap-to-deselect **pastes that clipboard content (scaled up)** instead of
deselecting. A native hand-drawn lasso never calls `setLassoBoxState` and never pastes; that one
call was the only difference. Leave `setLassoBoxState` for flows that genuinely need to hide/remove
the box (states 1/2/3) — not for "show".

**Critical caveat — strokes must be FULLY inside the rect.** `lassoElements` uses
`findTrailsContourInBox`: any stroke with a contour point outside the rect is **not** selected. For
"insert space between two lines" you tap in the gap, so the lines on the selected side are fully
inside → fine. A stroke that *crosses* the cut line will be missed, on either side. Do **not** add
padding to compensate — it would grab content from the wrong side. Accept this limit; document it
for the user.

Other notes:
- Always check `APIResponse.success` before `.result` (see the generic skill's "API Response
  Pattern").
- `lassoElements` is layer-scoped to the current layer in practice → the "all layers" toggle may
  not be achievable via SDK. Verify on-device before promising it; fall back to current-layer.
- Do NOT call `deleteElements` before/around the lasso (triggers a ~300ms page reload that starves
  the binder pool — see the generic skill's `pen-emr.md` Pattern 14). Not needed here anyway.

## 4. UI — transparent frame (+ fallback)

Primary: root `View` `backgroundColor:'transparent'`, `borderWidth: 8`, `borderColor:'#9e9e9e'`.
A `Pressable` over `StyleSheet.absoluteFill` captures the tap; measure height with `onLayout`.

**Transparency verified on-device (Nomad / A5X2): the overlay IS transparent** — the note shows
through the grey frame. Fallback (untested, kept documented in case a future firmware renders the
view opaque): render the page to an image and tap on that, via `PluginFileAPI.generateNotePng`.

The tap-Y math and the lasso call are identical regardless of which button/direction opened the
plugin.

### 4a. Two buttons, one App instance — the Pending Button ID pattern

`index.js` registers both toolbar buttons (id 100 "Below", id 101 "Above"). Since PluginHost opens
the same `App.tsx` overlay for either, the plugin needs to know *which one* was pressed for the
current open:

```js
// index.js — module level, survives across opens (see §4b)
let pendingDirection = null;
PluginManager.registerButtonListener({
  onButtonPress(event) {
    pendingDirection = event.id === 101 ? 'above' : 'below';
  },
});
export const checkPendingDirection = () => {
  const d = pendingDirection;
  pendingDirection = null;
  return d;
};
```

```tsx
// App.tsx
const [direction, setDirection] = useState<CutDirection>(
  () => checkPendingDirection() ?? 'below',
);

useEffect(() => {
  // ...existing mount logic...
  const sub = PluginManager.registerButtonListener({
    onButtonPress: event => setDirection(event.id === 101 ? 'above' : 'below'),
  });
  return () => sub.remove();
}, []);
```

`checkPendingDirection()` on mount only covers the **very first** open (before `App.tsx` existed to
register its own listener). Every subsequent press is caught live by the effect's own listener,
which stays subscribed for the component's whole (reused) lifetime — see §4b for why a one-time
effect still works for this.

### ⚠️ PluginHost REUSES the App instance across open/close (verified on-device)

When the plugin view is closed (`closePluginView`) and reopened, PluginHost does **not** remount the
React tree — there is **one** `App mounted`, then every later open only re-renders. Confirmed by
logcat: tap → close → reopen → tap shows no `App unmounted`/`App mounted` between them.

Consequences:
- `useRef` / module-level state **persists** across opens. A guard ref (e.g. `busy` to debounce the
  tap) that you set on tap **must be reset in `finally`**, or the second open is frozen with the
  guard stuck `true` (this was the real "second open stuck on the grey frame" bug).
- `useEffect(() => …, [])` runs **once**, not per open. Do not rely on it to refresh per-open state
  (page context, direction from a *new* button press are exceptions — see below). Fetch the page
  context (`getPageDisplaySize`) **fresh inside the tap handler**, so it is always current even if
  the user switched note/page between opens.
- A live **subscription** (event listener) set up in that one-time effect is NOT the same problem —
  it stays registered and keeps firing on every later event, which is exactly what §4a's
  `registerButtonListener` in the mount effect relies on to track direction across reopens.

## 5. i18n (en + it)

`i18next` + `react-i18next` only (**no `react-native-localize`** — pure JS, avoids the PluginHost
`reactPackages` native-linking issue). Initial language from RN core
`NativeModules.I18nManager.localeIdentifier`; runtime changes via `registerLangListener`. Init in
`src/i18n/index.ts`, imported once from `index.js`. Locales `src/i18n/locales/{en_US,it_IT}.json`.
All UI strings via `t('key')`. Button names = serialized JSON so they follow device language:

```js
name: JSON.stringify({en: 'Make Space Below', it: 'Fai Spazio Sotto'})
name: JSON.stringify({en: 'Make Space Above', it: 'Fai Spazio Sopra'})
```

Hint/intro copy is **direction-aware**: `hint.tapToInsertSpaceBelow`/`...Above`,
`intro.bodyBelow`/`...Above` — `App.tsx` picks the key by `direction` when calling `t(...)`. No
i18next interpolation is used anywhere in this codebase; direction-dependent strings are explicit
key pairs, not a templated clause, to keep this file's style consistent.

`registerLangListener` callback uses `onMsg`, and `msg.lang` uses underscores (`it_IT`) → convert
with `.replace('_','-')` before `i18n.changeLanguage` (generic skill gotcha #13). Structure is
extendable: add a locale = new JSON + one entry in `resources`.

## 6. Files & layout

```
index.js                       2 toolbar buttons (100=below, 101=above), pending-direction export, init, import ./src/i18n
App.tsx                        transparent frame + tap capture + lasso + close (uses computeLassoRect, t())
src/makeSpace.ts                pure computeLassoRect(..., direction)
src/sdk.ts                      typed facade over sn-plugin-lib (getPageDisplaySize, lassoElements, closePluginView)
src/i18n/index.ts               i18next init + registerLangListener
src/i18n/locales/en_US.json
src/i18n/locales/it_IT.json
assets/icon.png                 app icon (bidirectional glyph)
assets/icon-below.png           button 100 icon
assets/icon-above.png           button 101 icon
__tests__/makeSpace.test.ts     Jest tests for computeLassoRect (above + below, 14 cases)
__mocks__/sn-plugin-lib.js      manual Jest mock — keep in sync with actual sdk.ts usage
jest.config.js                  mock sn-plugin-lib NativeModules
.github/workflows/ci.yml        typecheck + lint + format + test on push/PR
.github/workflows/release.yml   build .snplg + GitHub release on tag v* (fetches the real annotated tag object first — see §8)
```

## 7. Quality gates

Scripts: `typecheck` (`tsc --noEmit`), `lint` (`eslint .`), `format` (`prettier --check .`),
`test` (`jest`), `test:ci` (`jest --ci --coverage`). Run order locally: typecheck → lint → format
→ test. `computeLassoRect` tests cover both directions: mid-view, top-tap, past-bottom clamp,
negative clamp, view≠page scaling, and that `left=0`/`right=pageW` always hold (plus the
direction-specific opposite edge: `bottom=pageH` for 'below', `top=0` for 'above'). Mock
`sn-plugin-lib` in Jest (`__mocks__/sn-plugin-lib.js`) so `App.tsx` imports don't pull
NativeModules — keep this mock's API surface in sync with what `src/sdk.ts` actually calls; a
stale mock throws `TypeError: ... is not a function` the moment a test finally exercises the gap
(happened once already — `getPageDisplaySize` was missing from the mock for a while, latent since
no test imported `App.tsx`/`sdk.ts` directly).

## 8. Git / CI / Release workflow

- **No commits on `main`.** Each unit on its own branch → PR, squash-merged.
- Conventional Commits; footer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Remote: GitHub repo `gorlix/sn_make_space`.
- CI `ci.yml`: Node 20, `npm ci`, typecheck + lint + format + test:ci. No Android (fast).
- Release `release.yml`: trigger on tag `v*`. Build `.snplg` via `buildPlugin.sh` (needs Android
  toolchain + JDK 17), use the **annotated tag message** as release notes, attach the `.snplg`.
  Create release tags with `git tag -a vX.Y.Z -m "..."` + `git push origin vX.Y.Z`.
- **`actions/checkout` resolves a tag-push trigger straight to the commit SHA, losing the
  annotated tag object** — the workflow force-fetches the real tag ref right after checkout
  (`git fetch --force origin "refs/tags/${GITHUB_REF_NAME}:refs/tags/${GITHUB_REF_NAME}"`) before
  extracting release notes. Without this step the published notes silently become the tagged
  commit's message instead of the tag annotation (happened for real on `v0.5.2`, fixed in
  `v0.5.3`+).
- **⚠️ Always `git pull origin main` (not just `git checkout main`) immediately before tagging.**
  `git checkout main` only reports "up to date with origin/main" against the last-fetched local
  remote-tracking ref — it does **not** implicitly fetch. After merging a PR from a *different*
  local branch (the normal flow here), local `main` can silently be behind `origin/main` by one or
  more just-merged PRs. Tagging that stale HEAD ships a release **missing the very fix it claims to
  contain**, with no error at any step — `typecheck`/`lint`/`test:ci` all pass because they run
  against the (older, still-valid) code that got tagged. This happened for real: `v0.5.3` was
  first tagged one PR short of the fix it was supposed to ship, had to be deleted
  (`gh release delete vX.Y.Z --yes --cleanup-tag` + `git tag -d` locally) and retagged after an
  explicit `git pull`. Before pushing any release tag, sanity-check with
  `git log --oneline -1` against `git log --oneline origin/main -1` (post-fetch) — they must match.

## 9. Build / deploy / debug (on-device)

```bash
./buildPlugin.sh                                   # → build/outputs/sn_make_space.snplg
adb push build/outputs/sn_make_space.snplg /storage/emulated/0/MyStyle/Plugins/sn_make_space.snplg
# ⚠️ push to MyStyle/Plugins/ (overwrite in place) when iterating on an already-installed
# build — the host's "reinstall" reads that managed copy, NOT MyStyle/ root. See the generic
# skill's gotcha #39.
# install/reinstall via Settings → Apps → Plugins
adb logcat -c; <do action>; adb logcat -d -s ReactNativeJS:V
adb logcat -P ""                                   # if NativeModules look null (chatty filter)
```

Confirm `build/generated/PluginConfig.json` has `pluginKey === "sn_make_space"` (must equal the
first arg of `AppRegistry.registerComponent`) and `pluginID === "lome8csqs3xu38pv"` (never
changes). See the generic skill's gotcha #33 about `reactPackages`.

The startup log line `[make_space] v<versionName> (code <versionCode>) starting` in `index.js` is
deliberately **not** gated behind `__DEV__` (everything else is, and release builds are always
`--dev false`) — always check it in `adb logcat` first when debugging a sideload, to rule out
testing against a stale build before anything else (see the generic skill's gotcha #40 and the
`MyStyle/Plugins/` trap above — this line is exactly what caught that trap).

## 10. Out of scope (advanced, later)

True one-gesture auto-move: read `getElements`, shift each element's position (strokes: every EMR
point via `ElementDataAccessor.setRange` + `maxY`; geometry/textbox/picture/title: pixel fields),
then `modifyElements` + `saveCurrentNote` + `reloadFile`. Also page-overflow handling
(`insertNotePage`) and multi-layer shifting.

## 11. InkHub distribution readiness (tracking, no spec yet)

Firmware Chauvet `3.29.43_beta` (2026-08-26, Manta/Nomad) added a "Plugins" resource type to
InkHub, Supernote's in-device community sharing hub (existing for notes/templates/stickers). As of
that beta **no submission process, review criteria, or manifest requirements are published** —
Supernote's own docs/changelog say only "in the future". Current real-world plugin distribution is
still community-run: sideload via `MyStyle/` + the firmware's plugin manager (puzzle-piece sidebar
icon, requires the beta), catalogued informally on GitHub
([`fharper/awesome-supernote`](https://github.com/fharper/awesome-supernote)) and
`r/Supernote_dev`. Don't build InkHub-specific submission code against guesses.

**What's genuinely no-regret prep, done as of v0.6.0:**
- `LICENSE` (MIT) — any future listing (InkHub or community catalogue) expects clear terms.
- `PluginConfig.json` metadata (`name`, `desc`, `iconPath`, `versionName`, `homepage`) reads like a
  store listing — keep it accurate on every release, it's the likely source InkHub would pull from.
  `name` was the raw `pluginKey` string (`sn_make_space`) until the v0.6.0 presentable-name pass —
  it's independent of `pluginKey`/`pluginID` (those stay untouched, changing them would confuse the
  host's registry for anyone who already installed the plugin) and is purely the human-facing title
  shown in Settings → Apps → Plugins and the plugin detail screen. Distinct icons per button
  (`assets/icon-below.png`/`icon-above.png`) plus a redesigned `assets/icon.png` app icon replaced
  the generic puzzle-piece template default.
- Permission hygiene: this plugin declares no `uses-permissions` in `PluginConfig.json` — every SDK
  call it makes (`getPageDisplaySize`, `lassoElements`, `setLassoBoxState`) operates on the
  currently-open file via context, not a `filePath` argument. It briefly did need one by accident:
  see §12, a real incident where an unrelated call silently tripped the gate. The 0.1.65
  `hasPermission`/`requestPermission` gate is the mechanism most likely reused for any future
  InkHub review — if a feature ever reads/writes an arbitrary path, declare the permission before
  submitting anywhere.

**What to watch (re-check before doing more):** re-query the `supernote-docs` MCP and
`https://support.supernote.com/changelog-for-the-beta-versions-of-manta-and-nomad` periodically for
"InkHub" + "plugin" — that's where the real spec will land first.

## 12. Incident: `getPageSize` silently broke the cut flow under 0.1.65 (2026-09-01)

Right after the 0.1.65 SDK bump, the plugin stopped selecting anything: `lassoElements` was never
even reached. Root cause, found via `adb logcat`: `PluginFileAPI.getPageSize(filePath, page)` —
used since v1 to convert the tap into a pixel rect — got `FILE:READ`-gated by firmware Chauvet
`3.29.43_beta`. The API didn't throw; it just resolved as unavailable, so `loadContext()` returned
null and `runCut` bailed out silently before calling the lasso at all. See the generic skill's
gotcha #38 for the full log signature (`PluginSec: DENY reason=sdcard_no_read`) and gotcha #40 for
why the JS logging didn't show anything either (release builds are always `--dev false`, silencing
every `__DEV__`-gated `log()` call — the fix included one deliberately ungated startup log line for
this reason, see §9).

**Fix**: swap `PluginFileAPI.getPageSize(filePath, page)` for `PluginCommAPI.getPageDisplaySize()`
— no `filePath` argument, current-page context like `lassoElements`, not gated. This also removed
the now-pointless `getCurrentFilePath`/`getCurrentPageNum` calls that existed only to build the
`getPageSize` arguments.

**A second, unrelated trap surfaced during the same debugging session**: `adb push`-ing a rebuilt
`.snplg` to `MyStyle/` and tapping "reinstall" in Settings → Apps → Plugins re-ran the *old* build
— the host reinstalls from its own managed copy at `MyStyle/Plugins/<name>.snplg`, not from
`MyStyle/` root. Looked exactly like "the fix did nothing" until caught by comparing file
size/mtime on-device. See §9 and the generic skill's gotcha #39.
