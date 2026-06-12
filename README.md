# ✍️ Make Space

> Insert blank writing space anywhere on a Supernote page — just tap a line and push everything below it down.

Ever filled a page by hand and then needed **one more line** in the middle? On paper you're stuck. On a Supernote, **Make Space** gives you room: tap where you need space, and everything underneath slides down so you can keep writing.

Inspired by OneNote's _“Insert extra writing space”_, built as a native Supernote plugin.

---

## 🎥 Demo

<!-- Drop your demo video here (drag-and-drop an .mp4 into this section on GitHub, or link it). -->

_Demo video coming soon._

---

## ✨ What it does

You're writing notes. Two lines are too close together and you need to squeeze something in between. Instead of erasing and rewriting:

1. Open **Make Space** from the toolbar.
2. A light **grey frame** appears around the screen — that's your cue.
3. **Tap** the spot where you want room.
4. Everything below that point gets selected — now just **drag it down** to open up as much space as you like.

That's it. The move is the Supernote's own selection drag, so **undo works normally**.

```
┌─────────────────────────────┐
│  line written above         │
│                             │
│ ─ ─ ─ ─ tap here ─ ─ ─ ─ ─  │  ← tap
│   ↓ drag down to make room ↓ │
│  line written below         │
└─────────────────────────────┘
```

---

## 📲 Install on your Supernote

1. Build the plugin package (see [Build](#-build-from-source)) — or grab `sn_make_space.snplg` from a [Release](../../releases).
2. Copy it to your device:
   ```bash
   adb push sn_make_space.snplg /storage/emulated/0/MyStyle/
   ```
   (or just copy the file into the `MyStyle` folder over USB)
3. On the Supernote: **Settings → Apps → Plugins → Install** and pick `sn_make_space`.
4. Open a note, tap **Make Space** in the toolbar, and go.

> Works in the **NOTE** app.

---

## 🛠 Build from source

Requirements: Node 18+, and `zip` + `jq` (preinstalled on most systems).

```bash
npm ci             # install dependencies
bash ./buildPlugin.sh   # → build/outputs/sn_make_space.snplg
```

The script bundles the JavaScript and packages it into a `.snplg`. No Android Studio needed — this plugin is pure JS.

---

## 🧑‍💻 Development

Built with **React Native 0.79.2** + the **`sn-plugin-lib`** Supernote SDK.

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm run format      # Prettier check
npm test            # Jest
```

- **Pre-commit** runs lint + format + typecheck; **pre-push** runs the tests (via Husky).
- **CI** runs the full gate on every PR; **releases** are published automatically when you push a `v*` tag.
- Bilingual UI out of the box: **English 🇬🇧 + Italian 🇮🇹**.

### Project layout

| Path               | What's inside                                        |
| ------------------ | ---------------------------------------------------- |
| `index.js`         | Plugin entry — registers the toolbar button          |
| `App.tsx`          | The overlay: grey frame, tap handling, lasso + close |
| `src/makeSpace.ts` | Pure tap-to-rectangle math (unit-tested)             |
| `src/sdk.ts`       | Typed wrapper over `sn-plugin-lib`                   |
| `src/i18n/`        | Localization (en + it)                               |
| `__tests__/`       | Jest tests                                           |

---

## 🧭 How it works under the hood

The Supernote SDK has no “move selection” command, so Make Space leans on what the device already does well: it turns your tap into a **native lasso** of everything below the line, then hands control back so you drag it yourself. Simple, reliable, and undoable.

The full **one-gesture auto-move** (drag once, everything shifts automatically) is the next milestone — see the roadmap.

---

## 🗺 Roadmap

Tracked as GitHub issues:

- **[v1 refinements](../../milestone/1)** — layer toggle, landscape support, on-screen cut-line preview, and more.
- **[v2 — one-gesture auto-move](../../milestone/2)** — drag once and the page reflows automatically, with new-page overflow.

Browse the [open issues](../../issues) to see what's planned.

---

## 🙏 Built with

[React Native](https://reactnative.dev) · [`sn-plugin-lib`](https://docs.supernote.com) · [Supernote docs](https://docs.supernote.com)
