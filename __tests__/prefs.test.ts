import {dismissIntro, isIntroDismissed, resetPrefsForTests} from '../src/prefs';

afterEach(resetPrefsForTests);

describe('intro dismissal flag', () => {
  it('defaults to not dismissed', () => {
    expect(isIntroDismissed()).toBe(false);
  });

  it('is dismissed after dismissIntro()', () => {
    dismissIntro();
    expect(isIntroDismissed()).toBe(true);
  });

  it('is idempotent', () => {
    dismissIntro();
    dismissIntro();
    expect(isIntroDismissed()).toBe(true);
  });

  it('resets for tests', () => {
    dismissIntro();
    resetPrefsForTests();
    expect(isIntroDismissed()).toBe(false);
  });
});
