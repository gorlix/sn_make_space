import {computeLassoRect} from '../src/makeSpace';

// A5X page in portrait. viewH equal to pageH keeps the proportion 1:1 for the
// simple cases; the scaling test below uses a different viewH on purpose.
const PAGE_W = 1404;
const PAGE_H = 1872;

describe('computeLassoRect — below', () => {
  it('maps a tap at half the view to half the page height', () => {
    const rect = computeLassoRect(PAGE_H / 2, PAGE_H, PAGE_W, PAGE_H, 'below');
    expect(rect.top).toBe(Math.round(PAGE_H / 2));
  });

  it('selects the whole page when tapping at the very top', () => {
    const rect = computeLassoRect(0, PAGE_H, PAGE_W, PAGE_H, 'below');
    expect(rect).toEqual({left: 0, top: 0, right: PAGE_W, bottom: PAGE_H});
  });

  it('clamps a tap past the bottom to pageH', () => {
    const rect = computeLassoRect(
      PAGE_H + 500,
      PAGE_H,
      PAGE_W,
      PAGE_H,
      'below',
    );
    expect(rect.top).toBe(PAGE_H);
  });

  it('clamps a negative tap to 0', () => {
    const rect = computeLassoRect(-50, PAGE_H, PAGE_W, PAGE_H, 'below');
    expect(rect.top).toBe(0);
  });

  it('scales correctly when the view height differs from the page height', () => {
    // View is 800 DP tall, tap at 400 DP = halfway → half the page in pixels.
    const rect = computeLassoRect(400, 800, PAGE_W, PAGE_H, 'below');
    expect(rect.top).toBe(Math.round((400 / 800) * PAGE_H));
  });

  it('treats a not-yet-laid-out view (height 0) as a top tap', () => {
    const rect = computeLassoRect(123, 0, PAGE_W, PAGE_H, 'below');
    expect(rect.top).toBe(0);
  });

  it('always spans full width and reaches the page bottom', () => {
    const rect = computeLassoRect(
      PAGE_H * 0.3,
      PAGE_H,
      PAGE_W,
      PAGE_H,
      'below',
    );
    expect(rect.left).toBe(0);
    expect(rect.right).toBe(PAGE_W);
    expect(rect.bottom).toBe(PAGE_H);
  });
});

describe('computeLassoRect — above', () => {
  it('maps a tap at half the view to half the page height', () => {
    const rect = computeLassoRect(PAGE_H / 2, PAGE_H, PAGE_W, PAGE_H, 'above');
    expect(rect.bottom).toBe(Math.round(PAGE_H / 2));
  });

  it('selects nothing when tapping at the very top', () => {
    const rect = computeLassoRect(0, PAGE_H, PAGE_W, PAGE_H, 'above');
    expect(rect).toEqual({left: 0, top: 0, right: PAGE_W, bottom: 0});
  });

  it('selects the whole page when tapping past the bottom (clamped)', () => {
    const rect = computeLassoRect(
      PAGE_H + 500,
      PAGE_H,
      PAGE_W,
      PAGE_H,
      'above',
    );
    expect(rect).toEqual({left: 0, top: 0, right: PAGE_W, bottom: PAGE_H});
  });

  it('clamps a negative tap to selecting nothing (bottom 0)', () => {
    const rect = computeLassoRect(-50, PAGE_H, PAGE_W, PAGE_H, 'above');
    expect(rect.bottom).toBe(0);
  });

  it('scales correctly when the view height differs from the page height', () => {
    const rect = computeLassoRect(400, 800, PAGE_W, PAGE_H, 'above');
    expect(rect.bottom).toBe(Math.round((400 / 800) * PAGE_H));
  });

  it('treats a not-yet-laid-out view (height 0) as a top tap (selects nothing)', () => {
    const rect = computeLassoRect(123, 0, PAGE_W, PAGE_H, 'above');
    expect(rect.bottom).toBe(0);
  });

  it('always spans full width and starts at the page top', () => {
    const rect = computeLassoRect(
      PAGE_H * 0.3,
      PAGE_H,
      PAGE_W,
      PAGE_H,
      'above',
    );
    expect(rect.left).toBe(0);
    expect(rect.right).toBe(PAGE_W);
    expect(rect.top).toBe(0);
  });
});
