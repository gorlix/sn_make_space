/**
 * i18n setup for make_space.
 *
 * Pure JS (i18next + react-i18next) — no native localization dependency. The
 * plugin follows the Supernote system language:
 *  - initial language from React Native core (`I18nManager.localeIdentifier`,
 *    which reflects the device/system locale),
 *  - runtime changes via `PluginManager.registerLangListener`.
 *
 * Supernote's own UI languages are en / zh_CN / zh_TW / ja; we additionally
 * ship Italian. Any language we don't translate falls back to English.
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

const TAG = '[make_space][i18n]';
const log = (...args: unknown[]) => {
  if (__DEV__) {
    console.log(TAG, ...args);
  }
};

/**
 * Map any device/system language code to a language we ship. Codes arrive in
 * many shapes ("it", "it_IT", "it-IT", "en_US", "zh_CN", "ja"); we only need
 * the leading subtag. Everything we don't translate (incl. Chinese/Japanese)
 * falls back to English.
 *
 * @param code raw locale/language code, possibly undefined
 * @returns a supported AppLanguage
 */
export function normalizeLang(code?: string | null): AppLanguage {
  const c = (code ?? '').toLowerCase().replace('-', '_');
  if (c.startsWith('it')) {
    return 'it';
  }
  return 'en';
}

// Back-compat alias (used by tests / earlier imports).
export const pickInitialLanguage = normalizeLang;

/**
 * Extract the language code from a registerLangListener message. The SDK docs
 * type it as a bare string (e.g. "zh_CN"), but the .d.ts says `any` and some
 * firmware has delivered an object ({lang}); accept both.
 */
export function langFromMsg(msg: unknown): string | undefined {
  if (typeof msg === 'string') {
    return msg;
  }
  if (msg && typeof msg === 'object') {
    const o = msg as {lang?: string; language?: string};
    return o.lang ?? o.language;
  }
  return undefined;
}

const deviceLocale: string | undefined =
  NativeModules?.I18nManager?.localeIdentifier;
const initial = normalizeLang(deviceLocale);
log('initial locale=', deviceLocale, '-> lng=', initial);

i18n.use(initReactI18next).init({
  resources,
  lng: initial,
  fallbackLng: 'en',
  interpolation: {escapeValue: false},
});

// Follow the Supernote system language when the user switches it at runtime.
PluginManager.registerLangListener({
  onMsg: (msg: unknown) => {
    const raw = langFromMsg(msg);
    const next = normalizeLang(raw);
    log('lang event raw=', msg, '-> next=', next);
    if (next !== i18n.language) {
      i18n.changeLanguage(next);
    }
  },
});

export default i18n;
