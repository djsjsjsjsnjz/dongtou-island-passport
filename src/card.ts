import { POINTS } from './data';
import type { Progress } from './progress';

export async function createCard(progress: Progress, sceneImage: string | null): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1440;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法生成纪念卡，请换一个浏览器重试。');
  const font = '"PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillStyle = '#f9fcf9'; ctx.fillRect(0, 0, 1080, 1440);
  ctx.fillStyle = '#46b8c5'; ctx.fillRect(0, 0, 1080, 760);
  if (sceneImage) {
    const image = new Image(); image.src = sceneImage; await image.decode();
    const scale = Math.min(1080 / image.width, 700 / image.height);
    ctx.drawImage(image, (1080 - image.width * scale) / 2, 60 + (700 - image.height * scale) / 2, image.width * scale, image.height * scale);
  }
  ctx.fillStyle = '#234a4f'; ctx.font = `600 24px ${font}`; ctx.fillText('DONGTOU  /  ISLAND PASSPORT', 64, 72);
  ctx.fillStyle = '#ffffff'; ctx.font = `600 68px ${font}`; ctx.fillText('海岛寻宝', 64, 160);
  if (!sceneImage) {
    ctx.font = `600 120px ${font}`; ctx.fillText('东岙', 400, 430);
    ctx.font = `400 32px ${font}`; ctx.fillText('把海风，留在旅程里', 380, 500);
  }
  ctx.fillStyle = '#ed765e'; ctx.fillRect(64, 722, 190, 60);
  ctx.fillStyle = '#ffffff'; ctx.font = `600 27px ${font}`; ctx.fillText('五章集齐', 98, 763);
  ctx.fillStyle = '#234a4f'; ctx.font = `600 74px ${font}`; ctx.fillText('洞头岛民', 64, 890);
  const name = progress.nickname.trim() || '海风旅人';
  ctx.font = `500 36px ${font}`; ctx.fillText(`${name} 的海岛纪念`, 64, 956);
  ctx.fillStyle = '#607873'; ctx.font = `400 25px ${font}`; ctx.fillText('一程海风，五份相遇。东岙的故事，未完待续。', 64, 1015);
  POINTS.forEach((p, i) => {
    const x = 145 + i * 195, y = 1135;
    ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(x, y, 68, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(x, y, 59, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = p.color; ctx.font = `600 26px ${font}`; ctx.textAlign = 'center'; ctx.fillText(p.stamp, x, y + 8);
    ctx.font = `400 19px ${font}`; ctx.fillText(p.name, x, y + 104);
  });
  ctx.textAlign = 'left'; ctx.strokeStyle = '#d9e4de'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(64, 1300); ctx.lineTo(1016, 1300); ctx.stroke();
  const date = new Date(progress.completedAt || Date.now()).toLocaleDateString('zh-CN');
  ctx.fillStyle = '#637d77'; ctx.font = `400 23px ${font}`;
  ctx.fillText(`东岙渔村 · ${date}`, 64, 1350);
  ctx.font = `400 20px ${font}`; ctx.fillText('概念演示 · 非官方凭证 · 无实际消费权益', 64, 1394);
  return canvas;
}

export async function downloadCard(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('图片生成失败，请重试。');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = '洞头岛民-旅行纪念卡.png';
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
