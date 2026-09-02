# Supernote Plugin API Quick Reference

All imports from `sn-plugin-lib`. All async methods return `APIResponse<T>` unless noted.

Signatures verified against `sn-plugin-lib@0.1.65`. Anything tagged "Added in 0.1.43" or "0.1.65"
documents an SDK version floor; always re-check the `supernote-docs` MCP for the current signature
before writing code, and check your own `package.json` for the pinned `sn-plugin-lib` version.

---

## §1 PluginManager

```ts
import { PluginManager } from 'sn-plugin-lib';
```

### Lifecycle & Info

| Method | Returns | Description |
|--------|---------|-------------|
| `init()` | `void` | **Must call first** after `AppRegistry.registerComponent(...)`. All other SDK calls fail without this. |
| `getPluginDirPath()` | `Promise<string>` | Plugin's runtime directory path |
| `getPluginName()` | `Promise<string>` | Plugin name from PluginConfig.json |
| `getDeviceType()` | `Promise<number>` | Device type: 0=A5, 1=A6, 2=A6X, 3=A5X, 4=Nomad, 5=Manta |
| `closePluginView()` | `Promise<boolean>` | Close the plugin UI container |
| `showPluginView()` | `Promise<boolean>` | Show the plugin view while running in background. Added in 0.1.43. |
| `hasPermission(permission: string)` | `Promise<number>` | `0`=not granted, `1`=granted. Added in 0.1.65. See "Permissions" below. |
| `requestPermission(permission: string, desc?: string)` | `Promise<number>` | Prompts the host permission dialog. Returns `0`=deny, `1`=allow this time, `2`=always allow, `-1`=dialog dismissed (treated as deny). Added in 0.1.65. |

### Button Registration

```ts
registerButton(type: number, appTypes: string[], config: PluginButton): Promise<boolean>;
```
- `type`: `1` = toolbar, `2` = lasso toolbar, `3` = text-selection toolbar (DOC only)
- `appTypes`: `['NOTE']`, `['DOC']`, or `['NOTE', 'DOC']`
- `config`:
  - `id: number` — unique button ID (keep stable after release)
  - `name: string` — **multi-language JSON string**, e.g. `'{"en":"Sticker","zh_CN":"贴纸","zh_TW":"貼紙","ja":"ステッカー"}'`. A plain string also works but won't localize.
  - `icon: string` — icon URI (use `Image.resolveAssetSource(require(...)).uri`)
  - `showType?: number` — `0` = no UI, `1` = show plugin UI (default `1`)
  - `editDataTypes?: number[]` — (type=2 only) lasso data types that trigger this button: `0`=stroke, `1`=title, `2`=picture, `3`=text, `4`=link, `5`=geometry. **⚠️ These are NOT `ElementType` values (0/100/200/…) — this is a separate 0–5 index.**

```ts
unregisterButton(type: number, buttonId: number): void;
```

```ts
getButtonState(type: number, buttonId: number): Promise<number>;
setButtonState(type: number, buttonId: number, state: number): void;
```

### Config Button

```ts
registerConfigButton(): Promise<boolean>;
registerConfigButtonListener(listener: { onClick(): void }): { remove(): void };
```

### Event Listeners

```ts
registerButtonListener(listener: {
  onButtonPress: (event: {
    id: number;
    name: string;
    icon: string;
    pressEvent?: number;   // 3 = lasso-toolbar button press
  }) => void;
}): { remove(): void };
```

```ts
registerEventListener(
  event: string,       // 'event_pen_up' | 'event_lasso_pen_up'
  registerType: number, // 0=first, 1=normal, 2=last
  listener: { onMsg(msg: Element[]): void }
): { remove(): void };
```

```ts
registerMotionListener(
  registerType: number, // 0=first, 1=normal, 2=last
  listener: { onMsg(msg: MotionEvent): void }
): { remove(): void };
// Added in 0.1.43. Listens for pen and finger touch events.
// MotionEvent.toolType: 0=unknown, 1=finger, 2=EMR pen
// MotionEvent.action: 0=ACTION_DOWN, 1=ACTION_UP, 2=ACTION_MOVE, 3=ACTION_CANCEL
// msg.pointers is a Pointer[] with per-pointer x, y, pressure, toolType, pointerId
```

```ts
registerLangListener(listener: {
  onMsg: (msg: { lang: string }) => void;   // msg.lang e.g. "zh_CN", "en", "zh_TW", "ja"
}): { remove(): void };
// ⚠️ lang uses underscore (e.g. "zh_CN"), convert to dash for i18next: msg.lang.replace("_", "-")
```

```ts
registerPluginLifeListener(listener: PluginEventListener): PluginEventSubscription;
// ⚠️ BREAKING in 0.1.65: replaces the old `addPluginLifeListener({onStart, onStop})`.
// New shape: listener.onMsg(msg) where msg.state is the lifecycle state value (no onStart/onStop split).
// Requires PluginManager.init() to have run first (depends on the internal event channel).
// If registered late, the last lifecycle event is redelivered if it fired within the past 1s.
```

### Permissions (0.1.65+)

Supported `permission` strings: `plugin.permission.FILE:READ`, `plugin.permission.FILE:WRITE`,
`plugin.permission.FILE:DELETE`, `plugin.permission.INTERNET`. Must be declared in
`PluginConfig.json`'s `uses-permissions` first, or the call throws (error code `1500`). The
plugin's own private data dir is always readable/writable/deletable without any of these. See
`references/patterns.md` for the request flow.

---

## §1b NativePluginManager (Native Module)

```ts
import { NativePluginManager } from 'sn-plugin-lib';
```

> `NativePluginManager` is a lower-level native module distinct from `PluginManager`. It provides device/environment info that `PluginManager` doesn't expose.

| Method | Returns | Description |
|--------|---------|-------------|
| `getPluginDirPath()` | `Promise<string>` | Plugin's **private data directory** — use this for storing databases, sticker files, cached assets. Different from `PluginManager.getPluginDirPath()`. Cache the result (it's slow to call repeatedly). |
| `getOrientation()` | `Promise<number>` | Current device orientation. Use on mount to set initial layout. Listen to `plugin_event_rotation` for changes. |

### Orientation Change Event

React Native's `DeviceEventEmitter` fires `'plugin_event_rotation'` when the device rotates:

```ts
import { DeviceEventEmitter } from 'react-native';

DeviceEventEmitter.addListener('plugin_event_rotation', (msg: { rotation: number }) => {
  setRotation(msg.rotation);
});
```

Always also listen to `Dimensions.addEventListener('change', ...)` to get updated `width`/`height` after rotation.

⚠️ `getPluginDirPath()` is slow — cache the result in a module-level variable.

---

## §1c FileUtils

```ts
import { FileUtils } from 'sn-plugin-lib';
```

| Method | Signature | Notes |
|--------|-----------|-------|
| `copyFile` | `(srcPath, destPath) → Promise<boolean>` | Copy a file. Returns true on success. |
| `deleteFile` | `(path) → Promise<boolean>` | Delete a single file. |
| `deleteDir` | `(dirPath) → Promise<boolean>` | Delete a directory and all contents. |
| `listFiles` | `(dirPath) → Promise<{path: string}[]>` | List files in a directory. Returns array of file descriptor objects. |
| `getFileMD5` | `(path) → Promise<string>` | Compute MD5 hash of a file. |
| `renameToFile` | `(oldPath, newPath) → Promise<boolean>` | Rename/move a file. |

---

## §2 PluginCommAPI (Common — works in NOTE & DOC)

```ts
import { PluginCommAPI } from 'sn-plugin-lib';
```

### Element Creation & Lifecycle

| Method | Signature | Notes |
|--------|-----------|-------|
| `createElement` | `(type: number) → APIResponse<Element>` | Create native-side element with accessors. Always call before inserting. |
| `recycleElement` | `(uuid: string) → void` | Free native-side cache for an element. |
| `clearElementCache` | `() → void` | Free all cached element data. |
| `getCacheElement` | `(uuid: string) → APIResponse<Element>` | Retrieve cached element data by UUID. Added in 0.1.43. |

### Sticker Operations

| Method | Signature | Notes |
|--------|-----------|-------|
| `saveStickerByLasso` | `(stickerPath: string) → APIResponse<boolean>` | Save lasso selection as sticker file at the given path. Requires lasso context. |
| `getStickerSize` | `(stickerPath: string) → APIResponse<Size>` | Get sticker dimensions. |
| `generateStickerThumbnail` | `(stickerPath: string, outputPath: string, size: {width, height}) → APIResponse<boolean>` | Generate thumbnail image. Pass a Size object (not separate w/h args). |
| `convertElement2Sticker` | `({machineType, elements, stickerPath}) → APIResponse<boolean>` | Convert elements to sticker file. machineType from `getDeviceType()`. |
| `insertSticker` | `(stickerPath: string) → APIResponse<boolean>` | Insert sticker into current page. |

### Lasso Operations (⚠️ require active lasso context)

| Method | Signature | Notes |
|--------|-----------|-------|
| `getLassoRect` | `() → APIResponse<Rect>` | Lasso bounding box (pixel coords). |
| `resizeLassoRect` | `(rect: Rect, rotationDegree?: number) → APIResponse<boolean>` | Resize lasso box. **Only proportional scaling supported.** `rotationDegree` added in 0.1.65. |
| `lassoElements` | `(rect: Rect) → APIResponse<boolean>` | Programmatically create a lasso selection from a rectangle (pixel coords). After success, other lasso APIs become usable. |
| `flipLassoElements` | `(flipType: number) → APIResponse<boolean>` | Flip lasso-selected elements in place (no duplicate created). `flipType`: 1=horizontal, 2=vertical. Added in 0.1.65. |
| `getLassoElements` | `() → APIResponse<Element[]>` | All elements in lasso selection. |
| `getLassoElementTypeCounts` | `() → APIResponse<object>` | Detailed count object: `{trailNum, trailLinkNum, textLinkNum, todoLinkNum, titleNum, normalTextBoxNum, digestTextBoxNum, digestTextBoxEditableNum, geometryNum, straightLineNum, circleNum, ellipseNum, polygonNum}`. |
| `deleteLassoElements` | `() → APIResponse<boolean>` | Delete all lasso-selected elements. |
| `setLassoBoxState` | `(state: number) → APIResponse<boolean>` | `0`=show, `1`=hide, `2`=remove (permanent), `3`=hide all lasso UI but preserve lasso state (added in 0.1.43). |
| `getLassoGeometries` | `() → APIResponse<Geometry[]>` | Geometries in lasso. |
| `modifyLassoGeometry` | `(geometry: Geometry) → APIResponse<boolean>` | Modify a single lasso geometry. |

### Page & File Context

| Method | Signature | Notes |
|--------|-----------|-------|
| `getCurrentPageNum` | `() → APIResponse<number>` | Current page number. |
| `getCurrentFilePath` | `() → APIResponse<string>` | Currently open file path. |
| `reloadFile` | `() → APIResponse<boolean>` | Reload currently opened file. |
| `getPenInfo` | `() → APIResponse<PenInfo>` | Get currently selected pen type in the app. |
| `canHandwrite` | `() → APIResponse<boolean>` | Whether the current view supports EMR handwriting. Added in 0.1.65. |
| `jumpToPage` | `(page: number) → APIResponse<boolean>` | Jump to a page in the current file, 0-indexed. Added in 0.1.65. |
| `getPageDisplaySize` | `() → APIResponse<Size>` | Display size of the **currently opened page**. Use this (not `PluginFileAPI.getPageSize`) before `modifyPageElements`/`insertPageElements`/`deletePageElements`/`batchUpdatePageElements`, otherwise position data may not match. Added in 0.1.65. |

### Recognition

| Method | Signature | Notes |
|--------|-----------|-------|
| `recognizeElements` | `(elements: Object[], size: {width, height}) → APIResponse<string>` | Recognize stroke/text box elements as text. `size` is the note page size in pixels. |
| `cancelRecognize` | `() → APIResponse<boolean>` | Cancel the current recognition task. |

### Lasso Preview

| Method | Signature | Notes |
|--------|-----------|-------|
| `generateLassoPreview` | `(imagePath: string) → APIResponse<LassoPreview>` | Generate preview image for lasso elements. `LassoPreview` = `{imagePath: string, rect: Rect, rotateDegree: number}`. Added in 0.1.43. |

### Geometry & Misc

| Method | Signature | Notes |
|--------|-----------|-------|
| `insertGeometry` | `(geometry: Geometry) → APIResponse<boolean>` | Insert geometry into current page. Pixel coords. Set `geometry.showLassoAfterInsert` to auto-select with lasso after insertion. |
| `getNoteSystemTemplates` | `() → APIResponse<Template[]>` | System note templates. |
| `insertFiveStar` | `(starPoints: Point[]) → APIResponse<boolean>` | Insert five-star into current page/layer. **Pixel coords.** Must be 6 points with first===last. |
| `fillRegionByPoint` | `(point: {x, y}, color: number) → APIResponse<boolean>` | Fill the closed region containing `point` with `color`. Added in 0.1.65. |

### Current-File Page Element CRUD (0.1.65+)

Operates on the file **currently open in the host**, unlike `PluginFileAPI`'s element CRUD which
takes an explicit `filePath`. Always call `getPageDisplaySize()` first for correct positioning.

| Method | Signature | Notes |
|--------|-----------|-------|
| `modifyPageElements` | `(elements: Element[], page: number, layer?: number \| null) → APIResponse<number[]>` | Elements must already exist on the page (matched by `uuid`). `layer`: omit for note files to use current layer; ignored for recognized notes and doc files; else `0-3`. Returns modified in-page indices (1-based). |
| `insertPageElements` | `(elements: Element[], page: number, layer?: number \| null) → APIResponse<boolean>` | Same `layer` rules as above. |
| `deletePageElements` | `(numsInPage: number[], page: number, layer?: number \| null) → APIResponse<boolean>` | Delete by in-page index. |
| `batchUpdatePageElements` | `(deleteNumList: number[], elements: Element[], page: number, layer?: number \| null) → APIResponse<boolean>` | Terminal deletes first, then inserts — use for atomic replace-in-place. |

---

## §3 PluginFileAPI (File operations — direct file manipulation)

```ts
import { PluginFileAPI } from 'sn-plugin-lib';
```

### Element CRUD

| Method | Signature | Notes |
|--------|-----------|-------|
| `getElements` | `(page, filePath) → APIResponse<Element[]>` | All elements on a page. |
| `insertElements` | `(filePath, page, elements: Element[]) → APIResponse<boolean>` | Insert elements. Call `createElement()` first. |
| `modifyElements` | `(filePath, page, elements: Element[]) → APIResponse<number[]>` | Modify existing elements. Returns indices of successfully modified elements. |
| `replaceElements` | `(filePath, page, elements: Element[]) → APIResponse<boolean>` | Replace ALL elements on a page. |
| `deleteElements` | `(filePath, page, numsInPage: number[]) → APIResponse<boolean>` | Delete elements by their indices in the page. |
| `getElementCounts` | `(pageNum, filePath) → APIResponse<number>` | Count elements on a page. |
| `getElementNumList` | `(pageNum, filePath, elementType) → APIResponse<number[]>` | List element nums by type. |
| `getElement` | `(filePath, page, numInPage) → APIResponse<Element>` | Get single element by page position. `numInPage` is **1-indexed** (matches `Element.numInPage`). |
| `getLastElement` | `() → APIResponse<Element>` | Get the last element on the **current displayed page**. Takes no parameters — always operates on the page the user is currently viewing. |
| `openFile` | `(filePath: string, page: number) → APIResponse<boolean>` | Open the given file. `page >= 0` jumps to that page; `page = -1` keeps the last-viewed page. Added in 0.1.65. |
| `getPathEncryptionStatus` | `(filePath: string) → APIResponse<number>` | `0`=not encrypted, `1`=encrypted+locked, `2`=encrypted+unlocked in this plugin session. Added in 0.1.65. |
| `unlockPathWithPassword` | `(filePath: string, password: string) → APIResponse<boolean>` | Unlock an encrypted file/dir for the current plugin session. Added in 0.1.65. |
| `lockPathAccess` | `(filePath: string) → APIResponse<boolean>` | Clear the session's unlock record for a path; subsequent access needs `unlockPathWithPassword` again. No-op on unencrypted paths. Added in 0.1.65. |

### Page Management

| Method | Signature | Notes |
|--------|-----------|-------|
| `getNoteTotalPageNum` | `(filePath) → APIResponse<number>` | Total pages. |
| `getPageSize` | `(filePath, pageNum) → APIResponse<Size>` | Page size in pixels. Needed for coordinate conversion. |
| `insertNotePage` | `({notePath, page, template}) → APIResponse<boolean>` | Insert a new page after `page`. |
| `removeNotePage` | `(filePath, pageNum) → APIResponse<boolean>` | Remove a page. |
| `createNote` | `({notePath, template, mode, isPortrait}) → APIResponse<boolean>` | Create new note file. `mode`: 0=normal, 1=recognition. `template`: system template name OR custom template image path. |

### Layer Management

| Method | Signature | Notes |
|--------|-----------|-------|
| `getLayers` | `(filePath, pageNum) → APIResponse<Layer[]>` | Get page layers. |
| `insertLayer` | `(filePath, pageNum, layer: Layer) → APIResponse<boolean>` | Add a custom layer. |
| `modifyLayers` | `(filePath, pageNum, layers: Layer[]) → APIResponse<boolean>` | Modify layer properties. |
| `deleteLayers` | `(filePath, pageNum, layerNums: number[]) → APIResponse<boolean>` | Delete layers by number. |
| `sortLayers` | `(filePath, pageNum, layerNums: number[]) → APIResponse<boolean>` | Reorder layers. |
| `clearLayerElements` | `(filePath, pageNum, layerNum) → APIResponse<boolean>` | Clear all elements on a layer. |

### Titles, Keywords, Templates, Marks

| Method | Signature | Notes |
|--------|-----------|-------|
| `getTitles` | `(filePath, pageNum?) → APIResponse<Title[]>` | Get titles. Optional page filter. |
| `getKeyWords` | `(filePath) → APIResponse<KeyWord[]>` | Get all keywords. |
| `insertKeyWord` | `(filePath, keyWord: KeyWord) → APIResponse<boolean>` | Add a keyword. |
| `deleteKeyWord` | `(filePath, keyWord: KeyWord) → APIResponse<boolean>` | Remove a keyword. |
| `getNotePageTemplate` | `(filePath, pageNum) → APIResponse<Template>` | Get page template. |
| `getNoteType` | `(filePath) → APIResponse<number>` | Note type. |
| `getFileMachineType` | `(filePath) → APIResponse<string>` | Machine/device type. |
| `getMarkPages` | `(filePath) → APIResponse<number[]>` | Pages with marks. |
| `generateMarkThumbnails` | `(filePath, pageNum, outputPath) → APIResponse<boolean>` | Generate mark thumbnail. |
| `clearMarkElements` | `(filePath, pageNum) → APIResponse<boolean>` | Clear mark elements. |
| `searchFiveStars` | `(filePath) → APIResponse<number[]>` | Search five-star elements. Returns page indices. |

### Image Generation

| Method | Signature | Notes |
|--------|-----------|-------|
| `generateNotePng` | `(filePath, pageNum, outputPath, width?, height?) → APIResponse<boolean>` | Render page to PNG. |
| `generateNoteTemplatePng` | `(filePath, pageNum, outputPath) → APIResponse<boolean>` | Render template to PNG. |

---

## §4 PluginNoteAPI (NOTE-only)

```ts
import { PluginNoteAPI } from 'sn-plugin-lib';
```

### Text Box

| Method | Signature | Notes |
|--------|-----------|-------|
| `insertText` | `(textBox) → APIResponse<boolean>` | Insert text box into the **currently displayed page** (no page parameter). Pixel coords for `textRect`. NOTE main layer only. Supports undo/redo. **⚠️ If the user flips to a different page, insertText writes there — always verify `getCurrentPageNum()` before calling.** |
| `getLassoText` | `() → APIResponse<TextBox[]>` | Get lasso-selected text boxes. |
| `modifyLassoText` | `(textBox) → APIResponse<boolean>` | Modify a single lasso-selected text box. |

`insertText` params: `{ textContentFull, textRect: Rect, fontSize?, fontPath?, textAlign? (0=left,1=center,2=right), textBold? (0/1), textItalics? (0/1), textFrameWidthType? (0=fixed,1=auto), textFrameStyle? (0=none,3=stroke), textEditable? (0=editable,1=locked) }`

### Image

| Method | Signature | Notes |
|--------|-----------|-------|
| `insertImage` | `(pngPath: string) → APIResponse<boolean>` | Insert PNG image into current page/layer. |

### Title (⚠️ main layer only, NOTE only)

| Method | Signature | Notes |
|--------|-----------|-------|
| `setLassoTitle` | `({style}) → APIResponse<boolean>` | Convert lasso strokes/geometry to title. `style`: 0=remove, 1=black, 2=gray-white, 3=gray-black, 4=shadow. |
| `getLassoTitles` | `() → APIResponse<Title[]>` | Get lasso-selected titles. |
| `modifyLassoTitle` | `({style}) → APIResponse<boolean>` | Change title style. |

### Link (⚠️ main layer only, NOTE only)

| Method | Signature | Notes |
|--------|-----------|-------|
| `getLassoLinks` | `() → APIResponse<Link[]>` | Get lasso-selected links. |
| `insertTextLink` | `(textLink: TextLink) → APIResponse<boolean>` | Insert text link. `linkType`: 0=note page, 1=note file, 2=doc, 3=image, 4=URL. |
| `setLassoStrokeLink` | `({destPath, destPage, style, linkType}) → APIResponse<boolean>` | Convert lasso strokes to link. |
| `modifyLassoLink` | `(lassoLink) → APIResponse<boolean>` | Modify single lasso link. |

### Layer Preview

| Method | Signature | Notes |
|--------|-----------|-------|
| `generateLayerPreviewImage` | `(notePath: string, page: number, layer: number, imagePath: string) → APIResponse<boolean>` | Generate a preview image for a specific layer on a specific page. NOTE files only. Added in 0.1.43. |

### Save

| Method | Signature | Notes |
|--------|-----------|-------|
| `saveCurrentNote` | `() → APIResponse<boolean>` | Save current note. **Call before file-level APIs** (insertElements/modifyElements/replaceElements) to avoid cache-vs-file inconsistency. |

---

## §5 PluginDocAPI (DOC-only)

```ts
import { PluginDocAPI } from 'sn-plugin-lib';
```

| Method | Signature | Notes |
|--------|-----------|-------|
| `getCurrentDocText` | `(page: number) → APIResponse<string>` | Get text of specified page. |
| `getLastSelectedText` | `() → APIResponse<string>` | Get the most recently selected text, even when no text is currently selected. |
| `getCurrentTotalPages` | `() → APIResponse<number>` | Total pages in document. |
| `generateCurrentDocImage` | `(page: number, pngPath: string, size: {width, height}, type: number) → APIResponse<boolean>` | Render a page of the **currently open** document to PNG. `size` 1~5120px per side. `type`: 0=default, 1=with text-selection styles (highlight/underline). **⚠️ Renamed in 0.1.65** from `generateDocImage(docPath, page, pngPath, size)` — the old form took an explicit `docPath` and no `type`; the new form always targets the current doc and adds `type`. |

---

## §6 PointUtils (Coordinate Conversion)

```ts
import { PointUtils } from 'sn-plugin-lib';
```

| Method | Signature | Notes |
|--------|-----------|-------|
| `androidPoint2Emr` | `(point: Point, pageSize: Size) → Point` | Pixel → EMR |
| `emrPoint2Android` | `(point: Point, pageSize: Size) → Point` | EMR → Pixel |

**Supported page sizes** (others throw "unknown pageSize"):
- `1404×1872` (A5X portrait) → EMR max `15819×11864`
- `1872×1404` (A5X landscape) → EMR max `11864×15819`
- `1920×2560` (Manta portrait) → EMR max `21632×16224`
- `2560×1920` (Manta landscape) → EMR max `16224×21632`

**Constants**: `PointUtils.NORMAL_PAGE_SIZE`, `PointUtils.A5X2_PAGE_SIZE`, `PointUtils.MACHINE_TYPE_*` (A5=0..Manta=5), `PointUtils.ROTATION_*` (orientation constants). 0.1.65 adds `PointUtils.A6X2_PAGE_MAX_SIZE` and `PointUtils.NORMAL_PAGE_MAX_SIZE`. See `references/types.md §PointUtils Constants` for full list.

**⚠️ 0.1.65**: `getRealMaxX`/`getRealMaxY` now also return `28854` and `21098` for an additional
device/pageSize combination not yet in the public docs table above (the docs site still lists only
the 4 pairs shown, but the SDK type union is `21632 | 15819 | 28854 | 21098 | 16224 | 11864`) —
query the MCP or test on-device before relying on it. Also **removed in 0.1.65**:
`PointUtils.getNotePageSize(orientation, machineType)` — no replacement in `PointUtils`; get page
size from `PluginFileAPI.getPageSize(filePath, page)` or `PluginCommAPI.getPageDisplaySize()` (current file) instead.

---

## §6b NativeUIUtils (Native Dialogs)

```ts
import { NativeUIUtils } from 'sn-plugin-lib';
```

Calls through to the PluginHost's `HostUIAPI`, which renders **Supernote's native RattaDialog** — style is identical to the system file manager dialogs.

| Method | Signature | Notes |
|--------|-----------|-------|
| `showErrorTipDialog` | `(tag: string) → void` | Show a simple tip/error dialog. Fire-and-forget, no return value. |
| `showRattaDialog` | `(tip: string, leftBtnTxt: string, rightBtnTxt: string, isSuccess: boolean) → Promise<boolean>` | Two-button confirm dialog. Returns `true` if right button (confirm) pressed, `false` if left (cancel). `isSuccess` controls icon style (true=success, false=warning). |

**Usage examples:**

```ts
// Simple error/info tip
NativeUIUtils.showErrorTipDialog('链接暂不支持剪贴板保存');

// Confirm dialog with user choice
const confirmed = await NativeUIUtils.showRattaDialog(
  '确定要删除这3项吗？删除后将不可恢复',
  '取消',    // left button
  '确定',    // right button
  false      // warning style
);
if (confirmed) { /* proceed */ }
```

**Prefer native dialogs over custom overlays** — they match the system visual style and the PluginHost handles lifecycle/cleanup automatically.

---

## §7 EventType & Touch Types (added in 0.1.43)

```ts
import { EventType, type MotionEvent, type Pointer } from 'sn-plugin-lib';
```

### EventType enum

| Value | String | Used with |
|-------|--------|-----------|
| `PEN_UP` | `"event_pen_up"` | `registerEventListener` |
| `IMPORT_STICKER` | `"event_import_sticker"` | `registerEventListener` |
| `MOTION_EVENT` | `"motion_event"` | `registerMotionListener` (0.1.43+) |
| `PLUGIN_LIFE` | `"plugin_life"` | `registerPluginLifeListener` (0.1.65+) |

### MotionEvent

Delivered to `registerMotionListener` callback via `listener.onMsg(msg)`.

```ts
interface MotionEvent {
  pointers: Pointer[];   // all active pointers
  x: number;             // primary pointer X
  y: number;             // primary pointer Y
  pressure: number;      // primary pointer pressure
  toolType: number;      // 0=unknown, 1=finger, 2=EMR pen
  action: number;        // 0=DOWN, 1=UP, 2=MOVE, 3=CANCEL
  actionIndex: number;   // pointer index for this action
  pointerCount: number;  // current active pointer count
  downTime: number;      // timestamp of initial DOWN
  eventTime: number;     // timestamp of this event
}
```

### Pointer

```ts
interface Pointer {
  x: number;
  y: number;
  pressure: number;
  toolType: number;      // 0=unknown, 1=finger, 2=EMR pen
  pointerId: number;     // unique pointer identifier
}
```

### LassoPreview

Returned by `PluginCommAPI.generateLassoPreview`.

```ts
class LassoPreview {
  imagePath: string;
  rect: { left: number; top: number; right: number; bottom: number };
  rotateDegree: number;
}
```