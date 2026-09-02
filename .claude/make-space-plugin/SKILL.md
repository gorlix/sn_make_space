---
name: make-space-plugin
description: "This-repo facts for the sn_make_space ('Make Space') Supernote plugin — OneNote-style 'insert extra writing space' via tap → native lasso, in both Above and Below directions. Trigger this skill for ANY work inside this repo: bugs, features, dependency bumps, release prep, or questions about how the direction/lasso/permission/build flow actually works here. This is the project-specific companion to the generic `supernote-plugin-dev` skill (installed as a Claude Code plugin) — load that one too for SDK-wide facts (coordinate systems, lasso APIs, permission gotchas, build mechanics) this skill doesn't repeat. Also trigger on: make_space, Make Space, Fai Spazio, 'insert writing space', computeLassoRect, PluginConfig.json in this repo, or this plugin by pluginID (lome8csqs3xu38pv)."
---

# make_space — Project Skill

This repository **is** the `make_space` plugin, not a generic playground. Goal: insert blank
writing space anywhere on a NOTE page (inspired by OneNote's *"Insert extra writing space"*).

**Always pair this with the `supernote-plugin-dev` skill** — that one has the generic SDK
reference (API signatures, patterns, gotchas, build/deploy mechanics); this one has only what's
true about *this* codebase. Read this skill first for project facts, then the generic skill for
anything it doesn't repeat.

## Current state (v0.6.0)

- **Two toolbar buttons** (NOTE only, `showType:1`): id `100` "Make Space Below" (original v1
  direction), id `101` "Make Space Above" (added in v0.6.0). Both open the same `App.tsx` overlay;
  direction is determined via the **Pending Button ID pattern** (generic skill's
  `references/patterns.md` Pattern 5) — `index.js` exports `checkPendingDirection()` for the first
  open, `App.tsx`'s mount effect also registers its own `PluginManager.registerButtonListener` to
  catch every subsequent press live (PluginHost reuses the App instance across opens, see
  `references/make-space.md` §4 — a one-time mount effect can't otherwise see later presses).
- `computeLassoRect(tapY, viewH, pageW, pageH, direction)` in `src/makeSpace.ts` — pure, fully
  unit-tested (25 tests), `direction: 'above' | 'below'` is a required parameter.
- Three hand-drawn icons (`assets/icon.png` = bidirectional glyph for the app itself,
  `assets/icon-below.png`, `assets/icon-above.png`) replaced the unused template puzzle piece.
- `PluginConfig.json` `name` = `"Make Space"` (the human-facing title shown in Settings → Apps →
  Plugins) — **`pluginKey`/`pluginID` (`sn_make_space` / `lome8csqs3xu38pv`) must never change**,
  they identify the plugin to the host for anyone who already installed it.
- i18n: **en + it only**. Hint/intro copy is direction-aware:
  `hint.tapToInsertSpaceBelow`/`...Above`, `intro.bodyBelow`/`...Above`.

## Confirmed flow (the move is done by the native lasso, NOT by the plugin)

1. User taps **Make Space Below** (id 100) or **Make Space Above** (id 101) — sets `direction`.
2. UI = fullscreen **transparent overlay with a thick grey border** (the visual cue "do something").
3. User taps a Y point → `computeLassoRect(tapY, viewH, pageW, pageH, direction)` builds a pixel
   rect covering the requested side of the line → `PluginCommAPI.lassoElements(rect)` selects it
   (this call ALSO shows the native selection box) → `PluginManager.closePluginView()`.
4. User **drags the native lasso selection by hand** to open/close space. Native move + native undo.

**Why no auto-move**: the SDK has **no "move selection" API** (`resizeLassoRect` = proportional
scale only). A true one-gesture auto-move would require rewriting every stroke's EMR sample points
via `ElementDataAccessor.setRange` + coord conversion — out of scope for now, see
`references/make-space.md` §10.

## Locked decisions

Target **NOTE only**; overflow past page bottom **ignored**; layer toggle (all↔current) **pending
SDK verification**; i18n = **en + it** only (extendable); transparent overlay is primary,
`generateNotePng` background image is the documented (unused so far) fallback if transparency isn't
honored on some future firmware.

## Known incidents (full postmortems in `references/make-space.md`)

- **§12 — `getPageSize` permission-gate incident**: the 0.1.65 SDK bump broke the entire cut flow
  on firmware Chauvet `3.29.43_beta` — `PluginFileAPI.getPageSize` got silently `FILE:READ`-gated,
  so the flow bailed out before `lassoElements` was ever called. Fixed by switching to
  `PluginCommAPI.getPageDisplaySize()`. See also the generic skill's gotcha #38.
- **§8 — stale-tag release incident**: `v0.5.3` was first tagged from a local `main` that was one
  PR behind `origin/main` (`git checkout main` doesn't fetch) — shipped a release missing its own
  fix, with every quality gate still green. Always `git pull origin main` immediately before
  tagging; sanity-check `git log --oneline -1` against `origin/main` post-fetch.
- **`MyStyle/Plugins/` reinstall trap**: reinstalling via Settings → Apps → Plugins reads the
  host's own managed copy at `MyStyle/Plugins/sn_make_space.snplg`, not whatever was just
  `adb push`ed to `MyStyle/` root. See the generic skill's gotcha #39.

## Process rules (from the user)

Serious JSDoc comments (explain *why*, not *what*); pure logic in `src/makeSpace.ts`
(`computeLassoRect`) so it's unit-testable without a device; quality gates
(typecheck/eslint/prettier/jest) before every commit; **each unit on its own branch + PR**; CI on
push/PR; release on tag `v*` (see the stale-tag incident above before cutting one). Full original
step-by-step plan: `/home/gorlix/.claude/plans/valuterei-che-quando-si-compiled-eagle.md`; the
"Make Space Above" feature plan: `/home/gorlix/.claude/plans/functional-knitting-lantern.md`.

## InkHub distribution readiness

No submission spec exists yet (Supernote's own docs say only "in the future" as of firmware
`3.29.43_beta`) — see `references/make-space.md` §11 for the full tracking note. `v0.6.0` is the
first release with the no-regret prep done: `LICENSE`, presentable `name`/`desc`, real icons.
Current outreach channels while InkHub doesn't exist: the
[`fharper/awesome-supernote`](https://github.com/fharper/awesome-supernote) community catalogue PR
and the `r/Supernote_dev` announcement post — both need manual edits per release, not automated.

## Where to look next

| Task | Read |
|------|------|
| Full implementation recipe, all the "why"s, file layout, quality gates, incident postmortems | **`references/make-space.md`** (this skill) |
| Any SDK API signature, type, or version-gated fact | `supernote-plugin-dev` skill (generic) |
| Common recipes (lasso ops, pending-button, permissions) | `supernote-plugin-dev` skill's `references/patterns.md` |
| Build/deploy/debug mechanics not specific to this repo | `supernote-plugin-dev` skill's `references/setup-and-build.md` |
