export type PointId = 'plaza' | 'alley' | 'beach' | 'inn' | 'bistro';
export type Point = {
  id: PointId; name: string; short: string; category: string; stamp: string;
  color: string; position: [number, number]; title: string; story: string;
};

export const POINTS: Point[] = [
  { id: 'plaza', name: '东岙广场', short: '渔灯广场', category: '渔村民俗', stamp: '渔灯章', color: '#D95D45', position: [-20, 8], title: '把渔村的灯火点亮', story: '海风起，渔灯亮。为归航的人点一盏灯，也为这段海岛旅程留一份祝福。' },
  { id: 'alley', name: '七夕古巷', short: '七夕古巷', category: '古巷寻趣', stamp: '七夕章', color: '#AD6279', position: [-14, -9], title: '在古巷，遇见成长的仪式', story: '在洞头，七夕不只有浪漫，还有“做十六”成人礼。少年在亲友的祝福中，感恩养育，迎接成长。' },
  { id: 'beach', name: '东岙沙滩', short: '听海沙滩', category: '海岸探索', stamp: '听海章', color: '#248699', position: [10, 13], title: '捡起海浪留下的小礼物', story: '潮水退去，沙滩上藏着三枚贝壳。把它们留在数字护照里，让真实的海滩保持原样。' },
  { id: 'inn', name: '海风民宿', short: '海风民宿', category: '示范商户 · 虚构', stamp: '枕浪章', color: '#547D55', position: [22, -6], title: '寄存一晚海风', story: '推开窗，是海；闭上眼，是浪。给旅程留一点慢下来的时间。此民宿为虚构示范商户。' },
  { id: 'bistro', name: '渔家小馆', short: '渔家小馆', category: '示范商户 · 虚构', stamp: '渔味章', color: '#AE7928', position: [2, -8], title: '把海岛的滋味带进旅程', story: '一桌海味，一段闲谈。为你的海岛旅行选一份餐单。菜品与商户均为演示，不提供点餐服务。' },
];

// Shared promenade nodes keep all walking routes on the conceptual island.
export const WALKWAY: [number, number][] = [[-20, 8], [-21, -1], [-14, -9], [2, -8], [22, -6], [22, 4], [10, 13]];
export const POINT_NODE: Record<PointId, number> = { plaza: 0, alley: 2, bistro: 3, inn: 4, beach: 6 };
export const DISHES = [
  { name: '清蒸海鱼', note: '一口鲜，留住海的本味', icon: 'fish' },
  { name: '紫菜虾皮汤', note: '清爽热汤，暖暖胃', icon: 'soup' },
  { name: '海苔饭团', note: '带着海风，继续出发', icon: 'rice' },
];
export const SOURCE_URL = 'https://www.66wz.com/wendu/system/2026/08/15/105822611.shtml';
