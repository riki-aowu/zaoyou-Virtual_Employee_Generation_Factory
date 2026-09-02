import JSZip from 'jszip';

const eq = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector);
const nativeCreateUrl = URL.createObjectURL.bind(URL);
const nativeRevokeUrl = URL.revokeObjectURL.bind(URL);
const previousClick = HTMLAnchorElement.prototype.click;
const capturedBlobs = new Map<string, Blob>();
let batchCapture = false;
let bypass = false;

URL.createObjectURL = ((value: Blob | MediaSource) => {
  const url = nativeCreateUrl(value);
  if (value instanceof Blob) capturedBlobs.set(url, value);
  return url;
}) as typeof URL.createObjectURL;
URL.revokeObjectURL = ((url: string) => {
  capturedBlobs.delete(url);
  nativeRevokeUrl(url);
}) as typeof URL.revokeObjectURL;

function captureBatch() {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    batchCapture = true;
    const timer = window.setTimeout(() => {
      batchCapture = false;
      reject(new Error('读取批次状态超时。'));
    }, 30000);
    const handler = (event: Event) => {
      const custom = event as CustomEvent<Record<string, unknown>>;
      clearTimeout(timer);
      window.removeEventListener('zaoyou-export-batch-captured', handler);
      resolve(custom.detail);
    };
    window.addEventListener('zaoyou-export-batch-captured', handler);
    eq<HTMLButtonElement>('#saveBatch')?.click();
  });
}

HTMLAnchorElement.prototype.click = function () {
  if (!bypass && batchCapture && this.download.endsWith('.sprite-batch.json')) {
    const blob = capturedBlobs.get(this.href);
    batchCapture = false;
    if (blob) {
      void blob.text().then(text => {
        const data = JSON.parse(text) as Record<string, unknown>;
        window.dispatchEvent(new CustomEvent('zaoyou-export-batch-captured', { detail: data }));
      });
      return;
    }
  }
  return previousClick.call(this);
};

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '_');
}

async function dataUrlBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return response.blob();
}

type StoredFrame = { canvas?: string } | string;
type StoredSlot = {
  visualId?: string;
  clips?: Record<string, StoredFrame[]>;
};

type Batch = {
  batchId?: string;
  slots?: StoredSlot[];
};

const actionInfo: Record<string, { fps: number; loop: boolean }> = {
  idle: { fps: 6, loop: true },
  walk_down: { fps: 8, loop: true },
  walk_up: { fps: 8, loop: true },
  walk_left: { fps: 8, loop: true },
  walk_right: { fps: 8, loop: true },
  typing: { fps: 8, loop: true },
  celebrate: { fps: 10, loop: false },
  tired: { fps: 5, loop: true },
};

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  const url = nativeCreateUrl(blob);
  a.href = url;
  a.download = name;
  bypass = true;
  previousClick.call(a);
  bypass = false;
  setTimeout(() => nativeRevokeUrl(url), 1500);
}

async function addFrames(zip: JSZip, batch: Batch) {
  const framePaths = new Map<string, Map<string, string[]>>();
  for (const [slotIndex, slot] of (batch.slots || []).entries()) {
    const visualId = safeName(slot.visualId || `staff_visual_${String(slotIndex + 1).padStart(4, '0')}`);
    const actions = new Map<string, string[]>();
    for (const [action, frames] of Object.entries(slot.clips || {})) {
      const paths: string[] = [];
      for (const [index, stored] of frames.entries()) {
        const dataUrl = typeof stored === 'string' ? stored : stored.canvas;
        if (!dataUrl) continue;
        const path = `${visualId}/${action}/frame_${String(index + 1).padStart(3, '0')}.png`;
        zip.file(path, await dataUrlBlob(dataUrl));
        paths.push(path);
      }
      if (paths.length) actions.set(action, paths);
    }
    if (actions.size) framePaths.set(visualId, actions);
  }
  return framePaths;
}

async function exportPngSequence() {
  const batch = await captureBatch() as Batch;
  const zip = new JSZip();
  await addFrames(zip, batch);
  zip.file('README.txt', '造游社 PNG Sequence 导出\n目录：角色 / 动作 / frame_XXX.png\n所有帧均来自当前 Canonical Canvas 处理结果。\n');
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  download(blob, `${safeName(batch.batchId || 'batch_001')}.png-sequence.zip`);
}

function godotTres(actions: Map<string, string[]>, baseDir: string) {
  const resources: { id: string; path: string }[] = [];
  let nextId = 1;
  const animations: string[] = [];
  for (const [action, paths] of actions) {
    const frameDefs: string[] = [];
    for (const path of paths) {
      const id = String(nextId++);
      const relative = path.slice(baseDir.length + 1);
      resources.push({ id, path: relative });
      frameDefs.push(`{\n"duration": 1.0,\n"texture": ExtResource("${id}")\n}`);
    }
    const info = actionInfo[action] || { fps: 6, loop: true };
    animations.push(`{\n"frames": [${frameDefs.join(', ')}],\n"loop": ${info.loop ? 'true' : 'false'},\n"name": &"${action}",\n"speed": ${info.fps}.0\n}`);
  }
  const ext = resources.map(resource => `[ext_resource type="Texture2D" path="${resource.path}" id="${resource.id}"]`).join('\n');
  return `[gd_resource type="SpriteFrames" load_steps=${resources.length + 1} format=3]\n\n${ext}\n\n[resource]\nanimations = [${animations.join(',\n')} ]\n`;
}

async function exportGodot() {
  const batch = await captureBatch() as Batch;
  const zip = new JSZip();
  const framePaths = await addFrames(zip, batch);
  for (const [visualId, actions] of framePaths) {
    zip.file(`${visualId}/sprite_frames.tres`, godotTres(actions, visualId));
  }
  zip.file('README.txt', 'Godot 4 导出\n解压到 Godot 项目的资源目录中。每个角色包含动作 PNG 与 sprite_frames.tres，可直接作为 SpriteFrames 资源使用。\n');
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  download(blob, `${safeName(batch.batchId || 'batch_001')}.godot4.zip`);
}

function run(button: HTMLButtonElement, task: () => Promise<void>) {
  const original = button.querySelector('em')?.textContent || '';
  button.disabled = true;
  const tag = button.querySelector('em');
  if (tag) tag.textContent = '正在生成…';
  void task().catch(error => alert(error instanceof Error ? error.message : String(error))).finally(() => {
    button.disabled = false;
    if (tag) tag.textContent = original;
  });
}

function install() {
  const grid = eq<HTMLElement>('.factory-export-grid');
  if (!grid || eq('#exportPngSequence')) return requestAnimationFrame(install);
  const png = document.createElement('button');
  png.id = 'exportPngSequence';
  png.innerHTML = '<b>PNG 序列</b><small>按角色 / 动作拆成独立透明 PNG，适合任意引擎或后续美术编辑。</small><em>通用格式</em>';
  const godot = document.createElement('button');
  godot.id = 'exportGodot4';
  godot.innerHTML = '<b>Godot 4 SpriteFrames</b><small>生成动作 PNG 与每角色 sprite_frames.tres，直接放进 Godot 资源目录。</small><em>Godot 4</em>';
  grid.append(png, godot);
  png.onclick = () => run(png, exportPngSequence);
  godot.onclick = () => run(godot, exportGodot);
}

install();
