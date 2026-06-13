import {langFromMsg, normalizeLang, pickInitialLanguage} from '../src/i18n';

describe('normalizeLang', () => {
  it('returns it for Italian locale variants', () => {
    expect(normalizeLang('it')).toBe('it');
    expect(normalizeLang('it_IT')).toBe('it');
    expect(normalizeLang('it-IT')).toBe('it');
    expect(normalizeLang('IT_it')).toBe('it');
  });

  it('falls back to en for any non-Italian locale (incl. Supernote zh/ja)', () => {
    expect(normalizeLang('en_US')).toBe('en');
    expect(normalizeLang('zh_CN')).toBe('en');
    expect(normalizeLang('zh_TW')).toBe('en');
    expect(normalizeLang('ja')).toBe('en');
  });

  it('falls back to en for missing/empty input', () => {
    expect(normalizeLang(undefined)).toBe('en');
    expect(normalizeLang(null)).toBe('en');
    expect(normalizeLang('')).toBe('en');
  });

  it('keeps the pickInitialLanguage alias working', () => {
    expect(pickInitialLanguage('it_IT')).toBe('it');
  });
});

describe('langFromMsg', () => {
  it('reads a bare string code (per SDK docs)', () => {
    expect(langFromMsg('zh_CN')).toBe('zh_CN');
    expect(langFromMsg('it')).toBe('it');
  });

  it('reads an object shape ({lang}/{language}) some firmware sends', () => {
    expect(langFromMsg({lang: 'it_IT'})).toBe('it_IT');
    expect(langFromMsg({language: 'ja'})).toBe('ja');
  });

  it('returns undefined for unexpected shapes', () => {
    expect(langFromMsg(undefined)).toBeUndefined();
    expect(langFromMsg(null)).toBeUndefined();
    expect(langFromMsg(42)).toBeUndefined();
    expect(langFromMsg({})).toBeUndefined();
  });
});
