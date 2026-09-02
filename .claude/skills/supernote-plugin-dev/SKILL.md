---
name: supernote-plugin-dev
description: "Build, debug, and extend Supernote e-ink device plugins using the sn-plugin-lib SDK (React Native + Android). Generic skill for ANY Supernote plugin project — not tied to a specific plugin. Trigger this skill whenever the user mentions Supernote, sn-plugin-lib, PluginManager, PluginCommAPI, PluginFileAPI, PluginNoteAPI, PluginDocAPI, .snplg files, e-ink plugin development, PluginHost, lasso operations, EMR coordinates, or wants to create/modify/debug a plugin for the Supernote NOTE or DOC apps. Even if the user just says 'plugin for my notebook' or 'extend my note-taking app' in the context of Supernote hardware, use this skill. If the current repo also has a project-specific Supernote skill (e.g. named after the plugin itself), read that one FIRST for this-repo facts, then use this skill for the generic SDK/workflow knowledge it doesn't repeat."
---

# Supernote Plugin Development Skill

You are an expert Supernote plugin developer. Supernote plugins extend the NOTE (handwriting notebook) and DOC (document reader) apps on Supernote e-ink devices. Plugins run inside a **PluginHost** process that provides a React Native runtime, and communicate with NOTE/DOC via AIDL + SDK interfaces.

This skill is deliberately **project-agnostic** — it applies to any Supernote plugin. If the repo you're working in has its own project-specific skill (check `.claude/*/SKILL.md` for one named after the plugin), read that first for this-repo facts (pluginID, architecture, known pitfalls specific to that codebase); come back here for generic SDK/workflow/gotcha knowledge.

## 📦 SDK version

Check the plugin's own `package.json` for the pinned `sn-plugin-lib` version before relying on any
version-gated fact below — don't assume `0.1.65` is what a given repo uses. Notable SDK changes
between `0.1.19` and `0.1.65` that affect the reference docs below (verify against your repo's
actual pinned version and the MCP before trusting these):
`PluginManager.addPluginLifeListener` → `registerPluginLifeListener` (breaking, different callback
shape), `PluginDocAPI.generateDocImage` → `generateCurrentDocImage` (renamed + new `type` param),
`PointUtils.getNotePageSize` removed (no replacement), new `hasPermission`/`requestPermission`
runtime permission gate (see Pattern 17 in `references/patterns.md`), and new current-file
page-element CRUD (`modifyPageElements`/`insertPageElements`/`deletePageElements`/
`batchUpdatePageElements` on `PluginCommAPI`).

**react-native is pinned to `0.79.2` for every plugin, hard, by the host device itself** — not just
a per-project convention. Supernote's own docs state: *"The plugin framework uses React Native
0.79.2. Your plugin project must use the same version; otherwise it may fail to run or be
incompatible with the host."* Do not let a plugin's `react-native` drift from `0.79.2`, and treat
any request to bump it as blocked-by-design until Supernote itself updates the on-device host
runtime — re-check the `supernote-docs` MCP periodically rather than assuming this is stale.

**A React `react-native-renderer` version mismatch crashes silently on-device, not in `npm test`.**
`react-native@0.79.2` bundles its own `react-native-renderer` built against `react@19.0.0` exactly.
npm's peer range on `react-native` (`^19.0.0`) is loose enough to let `npm install` pull a newer
`react` (e.g. `19.2.x`) without any warning, but at runtime React throws `Incompatible React
versions` followed by `TypeError: Cannot read property 'default' of undefined` before the first
render — the UI never appears and there's no error visible to the user. If `react-native` stays
pinned at `0.79.2`, keep `react`/`react-test-renderer`/`@types/react` pinned at exactly `19.0.0`
too, regardless of what `npm outdated` suggests. Verify any `react` bump by watching `adb logcat`
on a real device (or emulator) before trusting `npm test` alone.

## ⚠️ Authoritative source: the `supernote-docs` MCP

A live documentation MCP (`supernote-docs`) should be configured for any serious Supernote plugin
work and **MUST be used** for any API/signature question — if it isn't configured in the current
project yet, add it: `claude mcp add --transport http --scope project supernote-docs
https://docs.supernote.com/mcp` (then approve it in an interactive session; it can't self-approve
in a non-interactive one). It has three tools: `search_supernote` (semantic search),
`query_docs_filesystem_supernote` (`rg`/`cat`/`tree` over the `.mdx` docs), and `submit_feedback`
(report a doc bug back to Supernote). The live docs are the **authoritative, up-to-date** source.
The local `references/*.md` files in this skill are a useful supplement but **may lag** — when they
disagree with the MCP, trust the MCP. Query the MCP before writing any SDK code, and especially
before assuming any version-pin, permission, or compatibility fact carried over from a previous
project or an older revision of these reference files.

## Before You Start

**Always read the appropriate reference file(s) before writing code** (and cross-check signatures
against the `supernote-docs` MCP, which is authoritative):

| Task | Read first |
|------|-----------|
| Any API call or type question | MCP `supernote-docs` → then `references/api-quick-ref.md` |
| New project / environment / build / deploy / debug | `references/setup-and-build.md` |
| Common recipes (lasso ops, coordinate conversion, pending button, permissions, etc.) | `references/patterns.md` |
| Type definitions (Element, Stroke, Geometry, TextBox, etc.) | `references/types.md` |
| i18n, multi-language buttons | `references/i18n.md` |
| Floating window overlay | `references/floating-window.md` |
| Pen lasso, EMR pen disable, scoped pen lock | `references/pen-emr.md` |
| SQLite local storage in plugins | `references/sqlite.md` |

The reference files contain **authoritative API signatures and constraints** gathered from real
plugin builds — do not rely on memory alone; the live MCP wins on any conflict.

## Architecture (30-second overview)

```
┌─────────────┐     AIDL      ┌─────────────┐    SDK (TurboModule)    ┌──────────┐
│  NOTE / DOC │ ◄──────────► │  PluginHost │ ◄──────────────────────► │  Plugin  │
│  (Host App) │              │ (RN Runtime) │                        │(Your Code)│
└─────────────┘              └─────────────┘                         └──────────┘
```

- **Plugin**: Your React Native code. Entry = `index.js` (init + buttons) + `App.tsx` (UI).
- **PluginHost**: Loads, schedules, and renders plugins. Provides the RN runtime.
- **NOTE/DOC**: Host apps. Show plugin buttons in toolbar / lasso toolbar / text-selection toolbar.

Communication: Plugin → SDK (`sn-plugin-lib`) → TurboModule → Java → C/C++ → NOTE/DOC file operations.

## Plugin Lifecycle

1. **Install**: `.snplg` copied to `MyStyle/`, user installs via Settings → Apps → Plugins
2. **Init**: PluginHost starts RN env → executes `index.js` → `PluginManager.init()` → button registration
3. **Event**: User taps plugin button → AIDL event → PluginHost → plugin listener callback
4. **UI**: If `showType=1`, PluginHost renders `App.tsx` in a full-screen container
5. **API calls**: Plugin calls `PluginCommAPI` / `PluginFileAPI` / `PluginNoteAPI` / `PluginDocAPI`
6. **Close**: `PluginManager.closePluginView()` or user navigates away

## Development Workflow

When the user wants to create a new plugin:

1. **Scaffold**: `npx @react-native-community/cli init <n> --template @supernote-plugin/sn-plugin-template --version 0.79.2`
2. **Init** in `index.js`: `PluginManager.init()` after `AppRegistry.registerComponent(...)`
3. **Register buttons**: `PluginManager.registerButton(type, appTypes, config)` — type 1=toolbar, 2=lasso, 3=text-selection(DOC only)
4. **Write UI** in `App.tsx` using React Native components
5. **Call SDK** APIs as needed: `PluginCommAPI`, `PluginFileAPI`, `PluginNoteAPI`, `PluginDocAPI`
6. **Build**: In project root, run `.\buildPlugin.ps1` (PowerShell) or `./buildPlugin.sh` (bash)
7. **Deploy**: `adb push build\outputs\<n>.snplg /storage/emulated/0/MyStyle/` → install on device
8. **Debug**: `adb logcat -c` → trigger action → wait 10s → `adb logcat -d -s ReactNativeJS:V`

## Critical Constraints (memorize these)

### Coordinate Systems
- **EMR coordinates**: Hardware pen sampling coords, higher precision. Used for stroke points, Element.maxX/maxY.
- **Pixel coordinates**: Screen pixels (left-top origin). Used for Rect params, lasso, geometry insertion, UI layout.
- **Conversion**: `PointUtils.androidPoint2Emr(point, pageSize)` / `emrPoint2Android(…)`. Get pageSize from `PluginFileAPI.getPageSize(path, page)`. See `api-quick-ref.md §6` for supported sizes.
- **Which APIs use which?** Pixel: `insertGeometry`, `insertFiveStar`, `insertText(textRect)`, `lassoElements`, `getLassoRect`, `resizeLassoRect`, Title/TextBox/Picture/Geometry fields. EMR: `Stroke.points`, `FiveStar.points` (stored), `Element.maxX/maxY`.

### Layer Restrictions
- **Main layer (layer=0)**: Supports ALL element types.
- **Custom layers (layer 1-3)**: Only strokes, pictures, text boxes, and geometry. **NO titles, links, or five-stars**.
- **DOC files**: Only have one layer (main). Cannot insert text boxes, titles, or links.

### Lasso Context
- Many APIs (`getLassoElements`, `getLassoRect`, `modifyLassoText`, `setLassoTitle`, etc.) **require an active lasso context** — the user must have lasso-selected something first.
- `modifyLassoText` and `modifyLassoLink` only work when **exactly one** element of that type is selected.
- `setLassoBoxState(2)` = permanently removes the lasso. Use only when the operation is done. `setLassoBoxState(3)` (0.1.43+) = hides all lasso UI but preserves the lasso state internally.

### Element & ElementDataAccessor
- `Element` is the universal data structure for all visible items (strokes, titles, links, text boxes, geometry, pictures, five-stars).
- Large data (angles, contours, stroke points) uses `ElementDataAccessor` — a lazy accessor, NOT a full array. Call `size()`, `get(index)`, `getRange(start, end)` to fetch data on demand.
- Always call `element.recycle()` when done to free native-side memory.
- Always call `PluginCommAPI.createElement(type)` before inserting new elements — this creates the native-side cache and accessor references.

### API Response Pattern
All async APIs return `APIResponse<T>`:
```ts
{ success: boolean; result?: T; error?: { message: string } }
```
Always check `success` before reading `result`.

### PluginConfig.json
- `pluginKey` MUST match the first argument of `AppRegistry.registerComponent(...)`. Mismatch = plugin won't load.
- `pluginID` is auto-generated on first build. Never change it after distribution — it identifies the plugin.
- `name` is what shows in Settings → Apps → Plugins. It is **not** auto-derived from the in-app
  title string — a plugin can easily ship with a friendly in-app title while the install list still
  shows the raw npm-style package slug (e.g. `sn-my-plugin`) because `name` was never edited from
  its scaffold default. Keep it in sync with whatever the plugin actually calls itself.
- `iconPath` (relative path to project root, e.g. `assets/icon.png`) is **not set by the scaffold
  script** — it must be added manually, same as `author`. Without it, the plugin ships with no
  custom icon in the install list (silently — no build warning). `buildPlugin.sh` copies the file
  and rewrites `iconPath` to `/<filename>` in the packaged config; check the generated
  `build/outputs/*.snplg`'s `PluginConfig.json` to confirm it actually landed.
- `uses-permissions` (string array, e.g. `["plugin.permission.INTERNET"]`) must list every
  permission the plugin will ever call `hasPermission`/`requestPermission` for — see Pattern 17 in
  `references/patterns.md`. Not set by the scaffold either; add manually.

## Build, Deploy & Debug

See `references/setup-and-build.md` for full details. Quick commands:

```powershell
.\buildPlugin.ps1                    # build → build/outputs/<n>.snplg
adb push build\outputs\*.snplg /storage/emulated/0/MyStyle/   # deploy
adb logcat -c; Start-Sleep 10; adb logcat -d -s ReactNativeJS:V  # debug
```

Key log tags: `ReactNativeJS` (console.log), `PluginHost` (lifecycle), `SNPlugin` (SDK native ops).

## Decision Tree: Which API Module?

```
What do you need to do?
│
├─ Manage plugin lifecycle, buttons, events, device info, touch events
│  → PluginManager (references/api-quick-ref.md §1) — includes registerMotionListener (0.1.43+),
│    registerPluginLifeListener (0.1.65+, replaces addPluginLifeListener)
│
├─ Check or request access to Document/Note/MyStyle/etc. outside the plugin's own dir
│  → PluginManager.hasPermission / requestPermission (references/api-quick-ref.md §1
│    "Permissions") + patterns.md Pattern 17 (0.1.65+)
│
├─ Work with current page context (lasso, stickers, geometry, reload)
│  → PluginCommAPI (references/api-quick-ref.md §2)
│
├─ Modify/insert/delete elements on the currently-open file (no filePath needed)
│  → PluginCommAPI.modifyPageElements / insertPageElements / deletePageElements /
│    batchUpdatePageElements (references/api-quick-ref.md §2, 0.1.65+) — call
│    getPageDisplaySize() first, not PluginFileAPI.getPageSize
│
├─ Operate on file data (pages, elements, layers, templates, keywords)
│  → PluginFileAPI (references/api-quick-ref.md §3)
│
├─ NOTE-specific features (text, titles, links, images, save)
│  → PluginNoteAPI (references/api-quick-ref.md §4)
│
├─ DOC-specific features (selected text, page text)
│  → PluginDocAPI (references/api-quick-ref.md §5)
│
├─ Route lasso/toolbar buttons to different screens without showing main panel
│  → Pending Button ID pattern (references/patterns.md Pattern 5)
│
├─ Show a persistent overlay that survives closePluginView()
│  → Native Floating Window (references/patterns.md Pattern 6)
│
├─ Disable the EMR pen during a plugin-driven gesture (e.g. pen lasso on overlay)
│  so strokes don't leak into the .note file
│  → Scoped Pen Disable (references/patterns.md Pattern 16) + see Pattern 15 for
│    architecture and the PluginApp.showPluginView reflection release recipe
│
├─ Insert text sequentially across pages (e.g. streamed from phone/AI)
│  → Page-Anchored Sequential Insertion (references/patterns.md Pattern 13)
│
├─ OCR-recognise handwritten strokes / text boxes into a string
│  → PluginCommAPI.recognizeElements(elements, pageSize) (references/api-quick-ref.md §2)
│     1. getLassoElements() to get the Element array
│     2. getCurrentFilePath() + getCurrentPageNum() + getPageSize(path, page) for the full page size
│     3. recognizeElements(elements, pageSize) → APIResponse<string>
│     4. cancelRecognize() to abort a long-running recognition if needed
│
└─ Extract hardcoded strings / add multi-language support (i18n)
   → references/i18n.md Pattern 7 (JSON button name) + Pattern 10 (registerLangListener)
   → Generic extract-translate-convert workflow for new locales: patterns.md Pattern 12
```

## Common Gotchas

1. **Forgot `PluginManager.init()`**: All subsequent SDK calls will silently fail.
2. **Wrong button type**: type=3 (text-selection) is DOC-only. Registering it for NOTE is harmless but the button won't appear.
3. **Coordinate mismatch**: Inserting a geometry with EMR coords where pixel coords are expected (or vice versa) will place elements off-screen. Always check which coordinate system the API expects. Note: `insertFiveStar` uses **pixel coords** (not EMR).
4. **Not recycling elements**: Fetching elements without calling `recycle()` leaks native memory. Especially critical in loops.
5. **Assuming full arrays**: `element.angles` and `element.contoursSrc` are accessors, not arrays. Don't try to `.map()` or `.length` them — use `size()` and `get()`.
6. **Missing lasso context**: Calling lasso APIs without an active lasso selection causes errors. Always verify the lasso context first.
7. **DOC insertion limits**: Trying to insert text boxes, titles, or links into DOC files will be rejected.
8. **React Native version lock**: Must use RN 0.79.2. Other versions may cause PluginHost incompatibility.
9. **File-level API without saving**: Call `PluginNoteAPI.saveCurrentNote()` before `insertElements`/`modifyElements`/`replaceElements` to persist the in-memory cache first; otherwise data may be inconsistent.
10. **PluginFileAPI param order is inconsistent**: Read-only queries put page first: `getElements(page, filePath)`, `getElementCounts(pageNum, filePath)`, `getElementNumList(pageNum, filePath, type)`. Write operations put filePath first: `insertElements(filePath, page, elements[])`, `modifyElements(filePath, page, …)`, `replaceElements(…)`, `deleteElements(…)`, `getElement(filePath, page, numInPage)`. Always check the signature.
11. **Lasso button always shows main screen**: If `registerButtonListener` is set up inside `App.tsx`, there's a timing gap where the button event fires before the listener is registered. Use the **pending button ID** pattern (Pattern 5): store the pressed ID as a module-level variable in `index.js`, then consume it with `checkPendingButton()` as the first thing in the mount `useEffect`.
12. **Native floating window pitfalls**: Permission, render timing, tap handling, stale bubbles, and foreground detection — see Pattern 6 in `references/patterns.md` for all details.
13. **`registerLangListener` uses `onMsg` not `onLangChange`**: The callback is `onMsg: (msg) => {}` and language code is at `msg.lang`. The lang value uses underscores (`zh_CN`) — convert with `msg.lang.replace('_', '-')` before passing to i18next.
14. **`registerButton` name must be a JSON string for localization**: Passing a plain string means the button always shows that literal text regardless of device language. For multi-language support, serialize an object: `name: JSON.stringify({en: 'Sticker', zh_CN: '贴纸', ...})`.
15. **`onButtonPress` event has a `pressEvent` field**: For lasso toolbar buttons, `event.pressEvent === 3`. Don't rely solely on `id` — check `pressEvent` to confirm the event type before routing.
16. **`NativePluginManager` vs `PluginManager`**: Two different modules. `NativePluginManager.getPluginDirPath()` returns the plugin's private **data directory** (use for databases, sticker files). Cache this value — it's a slow async native call.
17. **Rotation needs three listeners**: Use `NativePluginManager.getOrientation()` for initial value on mount, `DeviceEventEmitter.addListener('plugin_event_rotation', ...)` for rotation events, and `Dimensions.addEventListener('change', ...)` for updated pixel dimensions. All three are needed for correct layout.
18. **`generateStickerThumbnail` takes a Size object**: The third argument is `{width, height}`, not two separate numbers. Call `PluginCommAPI.getStickerSize(path)` first.
19. **`saveStickerByLasso` takes a full file path**: The argument is the destination file path (e.g. `pluginDir + '/sticker/my.sticker'`), not just a name.
20. **`PluginNoteAPI.insertText` always targets the current displayed page**: There is no page parameter — text is inserted into whichever page the user is currently viewing. If your plugin tracks a `targetPage` for sequential insertion, you **must** call `PluginCommAPI.getCurrentPageNum()` before each `insertText` and verify the user is on the expected page. Inserting without this check will silently place text on the wrong page.
21. **`getLastElement()` takes no parameters**: The official signature is `getLastElement() → APIResponse<Element>`. It returns the last element of the **currently displayed page**. Do not pass `(page, filePath)` — those parameters are not part of the API.
22. **Sequential text insertion across pages needs page-wait**: After `insertNotePage()` + `reloadFile()`, do NOT immediately resume inserting. The user must flip to the new page first (since `insertText` targets the displayed page). Use a polling loop (`getCurrentPageNum`) to detect when the user arrives on the target page, then resume. A naïve timeout fallback that blindly resumes will insert text onto the wrong page.
23. **Note file switch detection**: If your plugin does background work (text insertion, etc.), periodically call `getCurrentFilePath()` to verify the user hasn't switched to a different note. The SDK does not emit a "file changed" event — you must poll.
24. **External page count changes**: If the user manually adds or removes pages while your plugin tracks a `targetPage`, page indices shift and your target becomes stale. Periodically call `getNoteTotalPageNum(path)` and compare against your expected count to detect external changes.
25. **`recognizeElements` needs full page size, not lasso rect**: Pass the result of `getPageSize(filePath, pageNum)` as the `size` argument — NOT the lasso bounding rect. Passing the lasso rect causes the firmware to throw `IllegalArgumentException: getRealMaxX, unknown pageSize` and recognition fails entirely.
26. **`recognizeElements` only supports strokes and text boxes**: Other element types (geometry, pictures, five-stars, links) are silently ignored. Filter your element list or check `getLassoElementTypeCounts()` before calling to avoid confusing empty results.
27. **`PluginManager.closePluginView()` does NOT fire `notifyClientPluginState(0)`**: The SDK skips the state-0 notification when transitioning the PluginApp to `stop`. Anything the note app does in response to `onPluginState(state=1)` (most importantly `sendFullScreenDisableArea` for the EMR pen lock) will **not be reversed** by `closePluginView` alone. To release such state, first call `PluginApp.showPluginView(0)` by reflection (see Pattern 15), then `closePluginView` for cleanup. **Note (0.1.43):** `closePluginView` also requires a `Promise` parameter in the native module — calling it via reflection with `null` triggers a non-fatal NPE at `promise.resolve(…)` after the close logic has already executed.
28. **`PluginManager.showPluginView()` (0.1.43) / `NativePluginManager.showPluginView()` — both no-arg only**: Calling either always opens the plugin view and triggers `notifyPluginState(1)`. **SDK change in 0.1.43**: The `PluginAppAPI` abstract class removed the `showPluginView(int showType)` overload — the abstract signature is now `showPluginView()` (no-arg). However, the **device-side PluginHost firmware still has the int-arg method** on the concrete `PluginApp` class (verified on A5X2 firmware 2026-05 with sn-plugin-lib 0.1.43). The reflection trick from Pattern 15 (`pluginApp.showPluginView(0)`) therefore still works at runtime, but should be coded defensively (graceful fallback if the 1-arg method disappears in a future firmware update). Also note: logcat shows `PluginStateTaskQueue` may DISCARD state:0 tasks under certain conditions — the actual pen disable release comes from the `disableAreaChanged` path triggered by UI layout changes, not solely from `notifyPluginState(0)`.
29. **`setFullAuto(false)` does NOT cancel a `state:1`-triggered full-screen pen disable**: They are independent code paths in drawAPP. `setFullAuto` writes drawAPP's `fullAuto` flag, while `state:1` runs `HandWriteClient.sendFullScreenDisableArea` which writes the rect list. Only an explicit `state:0` event (which triggers `disableAreaChanged → sendDisableAreaInfo`) will revoke a `sendFullScreenDisableArea` rect. Use `setFullAuto(false)` only as defensive coverage, not as the primary release.
30. **EMR pen disable does NOT block finger touch**: A `TYPE_APPLICATION_OVERLAY` toolbar above an EMR-disabled plugin view continues to receive touch normally. When designing a pen-lock toggle, **do not hide the toolbar** when entering the locked state — the user needs the same toolbar button to release the lock. The lock is on the digitizer (pen) input pipeline only.
31. **Two pen input pipelines coexist; an overlay only gates one of them**: `dev/input/pen` events fan out to (a) the standard input pipeline → `View.dispatchTouchEvent` with `SOURCE_STYLUS`, and (b) a hardware direct path → drawAPP native → straight into the active `.note` file. A `WindowManager` overlay can swallow (a) but never (b). Any feature where the user draws inside your plugin's own UI (pen lasso, signature pad, etc.) must engage full-screen EMR disable for the duration — see Pattern 16 — or strokes will silently land in the user's note file. PenGuard snapshot-and-cleanup is only adequate as a fallback for the rare race window.
32. **`EinkManager.enableFullUiAuto` is misnamed and does NOT control the digitizer on A5X2 (firmware 2025)**: Despite the suggestive method name, it's e-ink regal/refresh control. Empirically verified: it does not gate pen input. Don't waste a round trip on it for pen disable scenarios — use Pattern 15's `PluginApp.showPluginView` state pair instead.
33. **PluginHost ignores `MainApplication.getPackages()` — only `PluginConfig.json` `reactPackages` matters**: PluginHost loads NativeModules via the `"reactPackages"` array in `PluginConfig.json`, NOT through the standard RN `MainApplication` → `ReactNativeHost` → `getPackages()` path. The build script auto-discovers third-party packages from `node_modules/`, but your **own** ReactPackage (the one registering custom NativeModules) must be explicitly included. If missing, all custom `NativeModules.*` will be `null` at runtime — code compiles, JS executes, but every native call silently fails. When renaming, consolidating, or refactoring Package classes, always verify the fully-qualified class name appears in `build/generated/PluginConfig.json` after build.
34. **`logcat` chatty filter hides PluginHost init logs**: Android's chatty mechanism drops repeated lines. PluginHost startup triggers this heavily, hiding diagnostic `Log.i()` output. Disable with `adb logcat -P ""` before capturing, or filter by PID: `adb logcat --pid=$(adb shell pidof com.ratta.supernote.pluginhost)`.
35. **`PluginManager.addPluginLifeListener` no longer exists (removed in 0.1.65)**: If you (or a stale example) write `PluginManager.addPluginLifeListener({onStart, onStop})`, it will be `undefined` at runtime — TypeScript will also reject it since the type was removed. Use `registerPluginLifeListener({onMsg(msg)})` instead; `msg.state` carries the lifecycle value, there's no more separate start/stop callbacks. See Pattern 9 in `references/patterns.md`.
36. **`PluginDocAPI.generateDocImage` was renamed to `generateCurrentDocImage` (0.1.65)**: The old signature took an explicit `docPath`; the new one always targets whatever document is currently open in the host and adds a required `type` param (0=default, 1=with text-selection styling). There is no way to render an arbitrary closed document's page anymore via this API.
37. **`PointUtils.getNotePageSize` was removed (0.1.65), no replacement in `PointUtils`**: Get page size from `PluginFileAPI.getPageSize(filePath, page)` (any file) or `PluginCommAPI.getPageDisplaySize()` (current file only, needed for the new page-element CRUD APIs — using `getPageSize` there can misalign coordinates).
38. **`PluginFileAPI.getPageSize(filePath, page)` got silently `FILE:READ`-gated under firmware Chauvet `3.29.43_beta` (confirmed on-device, sn-plugin-lib 0.1.65)**: no `PluginConfig.json` change is documented as required, and the call used to just work — but on this firmware `checkAPIAvailable` now logs `PluginSec: DENY reason=sdcard_no_read path=...` for any plugin that hasn't declared `FILE:READ`, and the API resolves as if the page size were unavailable (no thrown error, just an unusable result — easy to misdiagnose as a lasso/geometry bug instead of a permission one). One plugin was broken by exactly this: `getPageSize` failing meant a lasso-setup helper returned null and the lasso API was never even called, so the symptom looked like "the lasso selects nothing" with no hint that a permission check was involved. Prefer `PluginCommAPI.getPageDisplaySize()` (current-page context, like `lassoElements`/`setLassoBoxState`) over `getPageSize` when you only need the currently-open file's page size — it isn't gated and needs no `filePath`. Only fall back to declaring `plugin.permission.FILE:READ` (Pattern 17) if you genuinely need an arbitrary file's page size. When any previously-working `PluginFileAPI` call starts silently no-opping after a firmware/SDK update, grep `adb logcat` for `PluginSec.*DENY` before assuming the plugin's own logic broke. The same class of bug bit `INTERNET` too (see the SDK version note above and Pattern 17) — any permission-gated API can regress this way after a firmware update, not just file access.
39. **Reinstalling from Settings → Apps → Plugins does NOT read the file you just `adb push`ed to `MyStyle/`**: the host keeps its own managed copy at `MyStyle/Plugins/<name>.snplg` and the in-UI "reinstall/update" action installs from *that* copy, not from whatever you dropped in `MyStyle/` root. Confirmed on-device: pushing a rebuilt `.snplg` to `MyStyle/` and tapping reinstall silently reran the **old** build (same `versionName`/`versionCode` as before) — looked exactly like "the fix didn't do anything." Push directly to `MyStyle/Plugins/<name>.snplg` (overwrite in place) when iterating on a fix, or use "Add Plugin" to browse to the new file explicitly rather than reinstalling the existing entry.
40. **Every `console.log` gated behind `__DEV__` is silent in a real install — `buildPlugin.sh` always bundles with `--dev false`**, including ad-hoc local test builds, not just CI releases. There is typically no separate "debug build" path in a plugin's build script. Consequence: extensive `__DEV__`-gated logging is completely invisible via `adb logcat` on any sideloaded build, which can make a real bug look like "nothing happened" when actually the JS ran fine but you can't see it. Keep one deliberately **ungated** `console.log`/native-log line at startup (e.g. `${TAG} v${versionName} (code ${versionCode}) starting`, reading from `PluginConfig.json`) so `adb logcat` at least confirms which build is actually running before debugging further — this also catches gotcha #39 (stale reinstall) immediately instead of after a confusing detour. Prefer a custom logcat tag over the generic `ReactNativeJS` tag if the plugin has native code too (route both JS and native logs through one tag) — it makes `adb logcat -v time -s <TAG>` show the full picture in one stream instead of juggling multiple filters.
41. **Testing a plugin's own TCP/network sockets doesn't need the device on the same network as your dev machine**: `adb forward tcp:<local> tcp:<device-port>` tunnels a local TCP port straight to a port the plugin opened on the device over the existing USB/ADB connection, regardless of WiFi. Use it to `curl`/`nc`/raw-socket-probe a plugin's listener directly (`adb forward tcp:18888 tcp:8888` then `curl http://127.0.0.1:18888/`) instead of asking the user to find and share the device's WiFi IP. Combine with `adb logcat -v time -s <TAG>` (see gotcha #40) to correlate what you see over the forwarded connection with what the plugin's own logs say happened — this is how a "the tunnel opens but relays fail" bug (native socket blocked by an undeclared permission, not a code bug) gets diagnosed instead of guessed at.

## When Helping the User

- **For new plugin creation**: Walk through the full workflow (scaffold → init → buttons → UI → build). Generate complete `index.js` and `App.tsx` files.
- **For API questions**: Look up the exact signature in `references/api-quick-ref.md`. Provide working code with proper error handling.
- **For debugging**: Check the gotchas list first. Common issues: missing init, wrong coordinates, missing lasso context, wrong layer.
- **For complex features**: Combine patterns from `references/patterns.md`. Show the full flow including error handling and resource cleanup.
- **For i18n / localization requests** ("extract strings", "multi-language", "i18n"): see `references/i18n.md` Pattern 7 (JSON button name) + Pattern 10 (`registerLangListener`). For adding new locales from scratch, the generic extract-translate-convert workflow is Pattern 12 in `references/patterns.md`. Check the repo's own locale files/config for which languages it already ships before assuming.
- **For network/socket features** (a plugin that opens its own TCP/HTTP listener or makes outbound requests): remember `INTERNET` is a runtime-gated permission like the file ones — declare it in `uses-permissions` and call `requestPermission` before the first socket, or every connection will fail with an on-device-only `SocketException` that's invisible unless you're watching `adb logcat` (see the SDK version note above, Pattern 17, and gotcha #41 for how to verify it actually works end-to-end).
- **Always**: Include TypeScript types, proper `APIResponse` checking, and `recycle()` calls where applicable. Verify any non-trivial change on a real device via `adb logcat` before calling it done — `npm test`/`tsc` passing does not mean the plugin works on-device (see the react-native-renderer version-mismatch note above for a concrete example of a change that passed all local checks and still crashed at runtime).
