import { describe, expect, it } from 'vitest';
import { countStamps, freshProgress, parseProgress, progressReducer as reduce, type Progress } from './progress';

function finish(): Progress {
  let p = freshProgress();
  for (const type of ['lantern', 'shell', 'viewDish'] as const) for (let index = 0; index < 3; index++) p = reduce(p, { type, index });
  p = reduce(p, { type: 'quiz' }); p = reduce(p, { type: 'inn' });
  return reduce(p, { type: 'meal', index: 1 });
}
describe('visitor progress', () => {
  it('starts empty', () => expect(countStamps(freshProgress())).toBe(0));
  it('does not issue duplicate stamps or count invalid steps', () => {
    let p = freshProgress();
    for (const index of [0, 0, 1, 2, 2, 9, -1, 1.5]) p = reduce(p, { type: 'lantern', index });
    expect(p.lanterns).toHaveLength(3); expect(countStamps(p)).toBe(1);
  });
  it('requires all dishes to be viewed', () => {
    const p = reduce(freshProgress(), { type: 'meal', index: 0 }); expect(p.meal).toBeNull();
  });
  it('unlocks five stamps and preserves completion date', () => {
    const p = finish(); expect(countStamps(p)).toBe(5); expect(p.completedAt).toBeTruthy();
    expect(reduce(p, { type: 'quiz' }).completedAt).toBe(p.completedAt);
  });
  it('gates redemption and is idempotent', () => {
    expect(reduce(freshProgress(), { type: 'redeem' }).redeemed).toBe(false);
    const p = reduce(finish(), { type: 'redeem' }); expect(p.redeemed).toBe(true);
    expect(reduce(p, { type: 'redeem' })).toBe(p);
  });
  it('restores partial and completed progress', () => {
    const p = reduce(freshProgress(), { type: 'lantern', index: 1 });
    expect(parseProgress(JSON.stringify(p))).toEqual(p);
    const complete = reduce(finish(), { type: 'redeem' }); expect(parseProgress(JSON.stringify(complete))).toEqual(complete);
  });
  it('sanitizes untrusted stored data', () => {
    const p = parseProgress(JSON.stringify({ version: 1, lanterns: [0, 0, 1, 8, '2'], meal: 3, redeemed: true, completedAt: 'invalid' }));
    expect(p.lanterns).toEqual([0, 1]); expect(p.meal).toBeNull(); expect(p.redeemed).toBe(false); expect(p.completedAt).toBeNull();
    expect(parseProgress('{"version":2}')).toEqual(freshProgress());
  });
  it('limits names and resets every visitor field', () => {
    const p = reduce(finish(), { type: 'nickname', value: '一二三四五六七八九十一二三四五六' });
    expect(Array.from(p.nickname)).toHaveLength(12); expect(reduce(p, { type: 'reset' })).toEqual(freshProgress());
  });
});
