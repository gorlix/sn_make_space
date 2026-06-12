import {pickInitialLanguage} from '../src/i18n';

describe('pickInitialLanguage', () => {
  it('returns it for Italian locale variants', () => {
    expect(pickInitialLanguage('it')).toBe('it');
    expect(pickInitialLanguage('it_IT')).toBe('it');
    expect(pickInitialLanguage('it-IT')).toBe('it');
    expect(pickInitialLanguage('IT_it')).toBe('it');
  });

  it('falls back to en for any non-Italian locale', () => {
    expect(pickInitialLanguage('en_US')).toBe('en');
    expect(pickInitialLanguage('zh_CN')).toBe('en');
    expect(pickInitialLanguage('ja')).toBe('en');
  });

  it('falls back to en for missing/empty input', () => {
    expect(pickInitialLanguage(undefined)).toBe('en');
    expect(pickInitialLanguage(null)).toBe('en');
    expect(pickInitialLanguage('')).toBe('en');
  });
});
