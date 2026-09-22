import { POINTS, type PointId } from './data';

export const STORAGE_KEY = 'dongtou-passport-v1';
export type Progress = {
  version: 1; lanterns: number[]; shells: number[]; quiz: boolean; inn: boolean;
  viewedDishes: number[]; meal: number | null; nickname: string;
  redeemed: boolean; completedAt: string | null;
};
export type Action = { type: 'lantern' | 'shell' | 'viewDish'; index: number }
  | { type: 'quiz' | 'inn' | 'redeem' | 'reset' }
  | { type: 'meal'; index: number } | { type: 'nickname'; value: string };
export const freshProgress = (): Progress => ({ version: 1, lanterns: [], shells: [], quiz: false, inn: false, viewedDishes: [], meal: null, nickname: '', redeemed: false, completedAt: null });
export function isComplete(p: Progress, id: PointId) {
  return ({ plaza: p.lanterns.length === 3, alley: p.quiz, beach: p.shells.length === 3, inn: p.inn, bistro: p.meal !== null })[id];
}
export function countStamps(p: Progress) { return POINTS.filter(point => isComplete(p, point.id)).length; }
function add(items: number[], n: number) { return n >= 0 && n <= 2 && Number.isInteger(n) ? [...new Set([...items, n])] : items; }
export function progressReducer(p: Progress, a: Action): Progress {
  let next = p;
  switch (a.type) {
    case 'reset': return freshProgress();
    case 'lantern': next = { ...p, lanterns: add(p.lanterns, a.index) }; break;
    case 'shell': next = { ...p, shells: add(p.shells, a.index) }; break;
    case 'viewDish': next = { ...p, viewedDishes: add(p.viewedDishes, a.index) }; break;
    case 'quiz': next = { ...p, quiz: true }; break;
    case 'inn': next = { ...p, inn: true }; break;
    case 'meal': if (p.viewedDishes.length === 3 && [0, 1, 2].includes(a.index)) next = { ...p, meal: a.index }; break;
    case 'nickname': next = { ...p, nickname: Array.from(a.value).slice(0, 12).join('') }; break;
    case 'redeem': if (countStamps(p) === 5 && !p.redeemed) next = { ...p, redeemed: true }; break;
  }
  if (countStamps(next) === 5 && !next.completedAt) next = { ...next, completedAt: new Date().toISOString() };
  return next;
}
const indices = (v: unknown): number[] => Array.isArray(v) ? [...new Set(v.filter((n): n is number => Number.isInteger(n) && n >= 0 && n <= 2))] : [];
export function parseProgress(raw: string | null): Progress {
  if (!raw) return freshProgress();
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1) return freshProgress();
  const p = data as Record<string, unknown>;
  const result: Progress = {
    version: 1, lanterns: indices(p.lanterns), shells: indices(p.shells), viewedDishes: indices(p.viewedDishes),
    quiz: p.quiz === true, inn: p.inn === true,
    meal: typeof p.meal === 'number' && [0, 1, 2].includes(p.meal) && indices(p.viewedDishes).length === 3 ? p.meal : null,
    nickname: typeof p.nickname === 'string' ? Array.from(p.nickname).slice(0, 12).join('') : '',
    redeemed: false, completedAt: typeof p.completedAt === 'string' && !Number.isNaN(Date.parse(p.completedAt)) ? p.completedAt : null,
  };
  result.redeemed = p.redeemed === true && countStamps(result) === 5;
  return result;
}
export function loadProgress(): { progress: Progress; warning: string } {
  try { return { progress: parseProgress(localStorage.getItem(STORAGE_KEY)), warning: '' }; }
  catch { return { progress: freshProgress(), warning: '无法读取本机进度，本次仍可体验；离开后可能无法保存。' }; }
}
