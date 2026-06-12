/**
 * make_space — plugin entry point.
 *
 * @format
 */

import {AppRegistry, Image} from 'react-native';
import {PluginManager} from 'sn-plugin-lib';

import App from './App';
import {name as appName} from './app.json';
// Side-effect import: initializes i18next before any UI renders.
import './src/i18n';

AppRegistry.registerComponent(appName, () => App);

// Must run before any other SDK call, otherwise they silently fail.
PluginManager.init();

// Single toolbar/sidebar button (NOTE only). Tapping it opens the plugin UI
// (App.tsx) full-screen. `name` is a serialized JSON map so the label follows
// the device language.
PluginManager.registerButton(1, ['NOTE'], {
  id: 100,
  name: JSON.stringify({en: 'Make Space', it: 'Fai Spazio'}),
  icon: Image.resolveAssetSource(require('./assets/icon.png')).uri,
  showType: 1,
});
