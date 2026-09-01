/**
 * make_space — plugin entry point.
 *
 * @format
 */

import {AppRegistry, Image} from 'react-native';
import {PluginManager} from 'sn-plugin-lib';

import App from './App';
import {name as appName} from './app.json';
import {versionCode, versionName} from './PluginConfig.json';
// Side-effect import: initializes i18next before any UI renders.
import './src/i18n';

const TAG = '[make_space]';
// Gated behind __DEV__ so release bundles (built with `--dev false`) stay silent.
const log = (...args) => {
  if (__DEV__) {
    console.log(TAG, ...args);
  }
};

// Deliberately NOT gated behind __DEV__: `console.log` calls above are silent
// in release bundles, which made it impossible to tell from `adb logcat`
// whether a sideloaded .snplg was actually the build just pushed or a stale
// one the host had cached (see the getPageSize/getPageDisplaySize incident).
// This one line always fires so the installed version is verifiable on-device.
console.log(TAG, `v${versionName} (code ${versionCode}) starting`);

log('index.js loaded; registering component', appName);
AppRegistry.registerComponent(appName, () => App);

// Must run before any other SDK call, otherwise they silently fail.
PluginManager.init();
log('PluginManager.init() done');

// Two toolbar/sidebar buttons (NOTE only), one per cut direction. Tapping
// either opens the same plugin UI (App.tsx) full-screen; App.tsx tells them
// apart via the Pending Button ID pattern below. `name` is a serialized JSON
// map so the label follows the device language.
PluginManager.registerButton(1, ['NOTE'], {
  id: 100,
  name: JSON.stringify({en: 'Make Space Below', it: 'Fai Spazio Sotto'}),
  icon: Image.resolveAssetSource(require('./assets/icon-below.png')).uri,
  showType: 1,
});
PluginManager.registerButton(1, ['NOTE'], {
  id: 101,
  name: JSON.stringify({en: 'Make Space Above', it: 'Fai Spazio Sopra'}),
  icon: Image.resolveAssetSource(require('./assets/icon-above.png')).uri,
  showType: 1,
});
log('buttons 100/101 registered');

// Pending Button ID pattern (references/patterns.md Pattern 5, SKILL.md
// gotcha #11): on the very first open, this listener can fire before App.tsx
// has mounted and registered its own, so stash the direction at module level
// and let App.tsx consume it once on mount. For every later open, PluginHost
// reuses the same App instance (see make-space.md §4) — App.tsx's own
// listener (set up once, stays alive) handles those directly.
let pendingDirection = null;
PluginManager.registerButtonListener({
  onButtonPress(event) {
    pendingDirection = event.id === 101 ? 'above' : 'below';
    log(
      'button pressed, id=',
      event.id,
      '-> pendingDirection=',
      pendingDirection,
    );
  },
});

export const checkPendingDirection = () => {
  const d = pendingDirection;
  pendingDirection = null;
  return d;
};
