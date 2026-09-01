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

// Single toolbar/sidebar button (NOTE only). Tapping it opens the plugin UI
// (App.tsx) full-screen. `name` is a serialized JSON map so the label follows
// the device language.
PluginManager.registerButton(1, ['NOTE'], {
  id: 100,
  name: JSON.stringify({en: 'Make Space', it: 'Fai Spazio'}),
  icon: Image.resolveAssetSource(require('./assets/icon.png')).uri,
  showType: 1,
});
log('button 100 registered');
