/**
 * i18n setup for make_space (en + it).
 *
 * Pure JS (i18next + react-i18next) — no native localization dependency. The
 * initial language is read from React Native core (`I18nManager.localeIdentifier`,
 * e.g. "it_IT") so we avoid pulling in `react-native-localize`. The Supernote
 * host also pushes language changes at runtime via `registerLangListener`.
 */
import {NativeModules} from 'react-native';
import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import {PluginManager} from 'sn-plugin-lib';

import en from './locales/en_US.json';
import it from './locales/it_IT.json';

export type AppLanguage = 'en' | 'it';

const resources = {
  en: {translation: en},
  it: {translation: it},
};

/**
 * Reduce any device locale identifier to a language we ship.
 *
 * Accepts forms like "it", "it_IT", "it-IT" (and underscore/dash variants the
 * Supernote listener uses). Anything that isn't Italian falls back to English,
 * which is also our i18next `fallbackLng`.
 *
 * @param localeIdentifier raw locale string, possibly undefined
 * @returns 'it' for Italian locales, otherwise 'en'
 */
export function pickInitialLanguage(
  localeIdentifier?: string | null,
): AppLanguage {
  const code = (localeIdentifier ?? '').toLowerCase().replace('-', '_');
  return code.startsWith('it') ? 'it' : 'en';
}

const deviceLocale: string | undefined =
  NativeModules?.I18nManager?.localeIdentifier;

i18n.use(initReactI18next).init({
  resources,
  lng: pickInitialLanguage(deviceLocale),
  fallbackLng: 'en',
  interpolation: {escapeValue: false},
});

// React to host language changes (msg.lang uses underscores, e.g. "it_IT").
PluginManager.registerLangListener({
  onMsg: (msg: {lang: string}) => {
    const next = pickInitialLanguage(msg?.lang);
    if (next !== i18n.language) {
      i18n.changeLanguage(next);
    }
  },
});

export default i18n;
