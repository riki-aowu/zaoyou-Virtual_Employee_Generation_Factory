type Box = { x: number; y: number; w: number; h: number; area: number };
type RGB = [number, number, number];

const SLOT_COUNT = 18;
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);

function colorDistance(a: RGB, b: RGB) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function sampleCornerBackground(image: ImageData): RGB {
  const { width: w, height: h, data } = image;
  const points = [
    [1, 1],
    [Math.max(0, w - 2), 1],
    [1, Math.max(0, h - 2)],
    [Math.max(0, w - 2), Math.max(0, h - 2)],
  ];
  const colors = points.map(([x, y]) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]] as RGB;
  });
  let best: [number, number] = [0, 1];
  let bestDistance = Infinity;
  for (let a = 0; a < colors.length; a++) {
    for (let b = a + 1; b < colors.length; b++) {
      const d = colorDistance(colors[a], colors[b]);
      if (d < bestDistance) {
        bestDistance = d;
        best = [a, b];
      }
    }
  }
  return [0, 1, 2].map(channel => Math.round((colors[best[0]][channel] + colors[best[1]][channel]) / 2)) as RGB;
}

function buildForegroundMask(image: ImageData, background: RGB, tolerance: number) {
  const { width: w, height: h, data } = image;
  const mask = new Uint8Array(w * h);
  for (let p = 0; p < mask.length; p++) {
    const i = p * 4;
    if (data[i + 3] < 32) continue;
    const rgb: RGB = [data[i], data[i + 1], data[i + 2]];
    if (colorDistance(rgb, background) > tolerance) mask[p] = 1;
  }
  return mask;
}

function connectedComponents(mask: Uint8Array, width: number, height: number) {
  const visited = new Uint8Array(mask.length);
  const boxes: Box[] = [];
  const queue = new Int32Array(mask.length);
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let area = 0;
    while (head < tail) {
      const p = queue[head++];
      const x = p % width;
      const y = Math.floor(p / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      area++;
      const neighbors = [p - 1, p + 1, p - width, p + width];
      for (const n of neighbors) {
        if (n < 0 || n >= mask.length || visited[n] || !mask[n]) continue;
        const nx = n % width;
        if (Math.abs(nx - x) > 1) continue;
        visited[n] = 1;
        queue[tail++] = n;
      }
    }
    boxes.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area });
  }
  return boxes;
}

function overlapsOrNear(a: Box, b: Box, gapX: number, gapY: number) {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  return a.x - gapX <= bx2 && ax2 + gapX >= b.x && a.y - gapY <= by2 && ay2 + gapY >= b.y;
}

function mergeBoxes(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.w, b.x + b.w);
  const bottom = Math.max(a.y + a.h, b.y + b.h);
  return { x, y, w: right - x, h: bottom - y, area: a.area + b.area };
}

function consolidateComponents(boxes: Box[], width: number, height: number) {
  const minArea = Math.max(20, Math.round(width * height * 0.00008));
  let items = boxes.filter(box => box.area >= minArea && box.w >= 3 && box.h >= 3);
  const gapX = Math.max(2, Math.round(width * 0.006));
  const gapY = Math.max(2, Math.round(height * 0.006));
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const small = Math.min(items[i].area, items[j].area);
        const large = Math.max(items[i].area, items[j].area);
        if (overlapsOrNear(items[i], items[j], gapX, gapY) && small / large < 0.45) {
          items[i] = mergeBoxes(items[i], items[j]);
          items.splice(j, 1);
          changed = true;
          break outer;
        }
      }
    }
  }
  return items;
}

function rowSort(boxes: Box[]) {
  if (!boxes.length) return boxes;
  const heights = boxes.map(box => box.h).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 1;
  const threshold = medianHeight * 0.55;
  const byY = [...boxes].sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2));
  const rows: { cy: number; items: Box[] }[] = [];
  for (const box of byY) {
    const cy = box.y + box.h / 2;
    let row = rows.find(candidate => Math.abs(candidate.cy - cy) <= threshold);
    if (!row) {
      row = { cy, items: [] };
      rows.push(row);
    }
    row.items.push(box);
    row.cy = row.items.reduce((sum, item) => sum + item.y + item.h / 2, 0) / row.items.length;
  }
  rows.sort((a, b) => a.cy - b.cy);
  return rows.flatMap(row => row.items.sort((a, b) => (a.x + a.w / 2) - (b.x + b.w / 2)));
}

function padBox(box: Box, width: number, height: number): Box {
  const px = Math.max(6, Math.round(box.w * 0.09));
  const top = Math.max(8, Math.round(box.h * 0.08));
  const bottom = Math.max(5, Math.round(box.h * 0.05));
  const x = Math.max(0, box.x - px);
  const y = Math.max(0, box.y - top);
  const right = Math.min(width, box.x + box.w + px);
  const lower = Math.min(height, box.y + box.h + bottom);
  return { x, y, w: right - x, h: lower - y, area: box.area };
}

async function fileToCanvas(file: File) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  if (file.type.startsWith('video/')) {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('无法读取视频。'));
    });
    const startTime = $('#startTime') as HTMLInputElement | null;
    const requested = Number(startTime?.value || 0) || 0;
    video.currentTime = Math.min(Math.max(0, requested), Math.max(0, video.duration - 0.05));
    await new Promise<void>(resolve => {
      if (video.currentTime === 0) return resolve();
      video.onseeked = () => resolve();
    });
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    URL.revokeObjectURL(url);
    return canvas;
  }
  const bitmap = await createImageBitmap(file);
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

function dispatchChange(input: HTMLInputElement) {
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function writeBoxesIntoExistingSliceUi(boxes: Box[]) {
  const autoApply = $('#autoApplySlices') as HTMLInputElement | null;
  const wasAuto = autoApply?.checked ?? false;
  if (autoApply) autoApply.checked = false;

  for (let i = 0; i < SLOT_COUNT; i++) {
    const slotButton = document.querySelector<HTMLButtonElement>(`[data-slot="${i}"]`);
    slotButton?.click();
    const values = [boxes[i].x, boxes[i].y, boxes[i].w, boxes[i].h];
    const ids = ['sliceX', 'sliceY', 'sliceW', 'sliceH'];
    ids.forEach((id, index) => {
      const input = $(`#${id}`) as HTMLInputElement | null;
      if (!input) return;
      input.value = String(Math.round(values[index]));
    });
    const h = $('#sliceH') as HTMLInputElement | null;
    if (h) dispatchChange(h);
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }

  if (autoApply) autoApply.checked = wasAuto;
  document.querySelector<HTMLButtonElement>('[data-view="batch"]')?.click();
  if (wasAuto) ($('#applySlices') as HTMLButtonElement | null)?.click();
}

async function detectSlices() {
  const input = $('#mediaInput') as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) {
    alert('请先导入包含员工排布的图片或视频。');
    return;
  }

  const button = $('#autoDetectSlices') as HTMLButtonElement | null;
  const status = $('#autoSliceStatus');
  if (button) button.disabled = true;
  if (status) status.textContent = '正在识别人物…';

  try {
    const canvas = await fileToCanvas(file);
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const background = sampleCornerBackground(image);
    const uiTolerance = Number(($('#tolerance') as HTMLInputElement | null)?.value || 10);
    const detectionTolerance = Math.max(24, Math.min(95, uiTolerance * 2.6));
    const mask = buildForegroundMask(image, background, detectionTolerance);
    let boxes = consolidateComponents(connectedComponents(mask, canvas.width, canvas.height), canvas.width, canvas.height);

    if (boxes.length > SLOT_COUNT) {
      boxes = boxes.sort((a, b) => b.area - a.area).slice(0, SLOT_COUNT);
    }
    if (boxes.length !== SLOT_COUNT) {
      throw new Error(`识别到 ${boxes.length} 个主体，期望 18 个。请检查纯色背景，或继续使用 6×3 / 手动切片兜底。`);
    }

    boxes = rowSort(boxes).map(box => padBox(box, canvas.width, canvas.height));
    await writeBoxesIntoExistingSliceUi(boxes);
    if (status) status.textContent = '✓ 自动识别 18 / 18，可继续手动微调';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (status) status.textContent = `⚠ ${message}`;
    alert(message);
  } finally {
    if (button) button.disabled = false;
  }
}

function installAutoSliceUi() {
  const reset = $('#resetGrid');
  const tools = reset?.parentElement;
  if (!tools || $('#autoDetectSlices')) return;

  const button = document.createElement('button');
  button.id = 'autoDetectSlices';
  button.className = 'btn small';
  button.textContent = '✨ 自动识别切片';
  button.title = '根据纯色背景自动检测 18 个员工主体并生成切片框';
  button.onclick = () => void detectSlices();
  tools.insertBefore(button, reset);

  const status = document.createElement('div');
  status.id = 'autoSliceStatus';
  status.className = 'hint';
  status.style.marginTop = '8px';
  status.textContent = '纯色背景可自动检测 18 人；失败时仍可使用 6×3 或手动切片。';
  tools.parentElement?.appendChild(status);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installAutoSliceUi, { once: true });
} else {
  installAutoSliceUi();
}
