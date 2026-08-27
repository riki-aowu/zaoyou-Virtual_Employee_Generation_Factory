import './style.css';

type ClipId = 'idle' | 'walk_down' | 'walk_up' | 'walk_left' | 'typing' | 'celebrate' | 'tired';
type QaLevel = 'green' | 'yellow' | 'red';

interface FrameAsset {
  canvas: HTMLCanvasElement;
  sourceName: string;
  alphaPartial: number;
  bbox: Bounds | null;
}

interface Clip {
  id: ClipId;
  label: string;
  fps: number;
  loop: boolean;
  expected: number;
  anchor: 'feet' | 'seat';
  frames: FrameAsset[];
}

interface Bounds { x: number; y: number; width: number; height: number; }

const FRAME_W = 80;
const FRAME_H = 96;
const SHEET_COLS = 8;

const clips: Clip[] = [
  { id: 'idle', label: '待机 Idle', fps: 6, loop: true, expected: 4, anchor: 'feet', frames: [] },
  { id: 'walk_down', label: '向下走 Walk Down', fps: 8, loop: true, expected: 6, anchor: 'feet', frames: [] },
  { id: 'walk_up', label: '向上走 Walk Up', fps: 8, loop: true, expected: 6, anchor: 'feet', frames: [] },
  { id: 'walk_left', label: '向左走 Walk Left', fps: 8, loop: true, expected: 6, anchor: 'feet', frames: [] },
  { id: 'typing', label: '坐姿打字 Typing', fps: 8, loop: true, expected: 6, anchor: 'seat', frames: [] },
  { id: 'celebrate', label: '庆祝 Celebrate', fps: 10, loop: false, expected: 8, anchor: 'feet', frames: [] },
  { id: 'tired', label: '疲劳 Tired', fps: 5, loop: true, expected: 4, anchor: 'feet', frames: [] },
];

const state = {
  activeClip: clips[0],
  activeFrame: 0,
  playing: false,
  lastTick: 0,
  background: 'checker',
  showBounds: true,
  showAnchor: true,
};

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div class="brand"><div class="brand-mark">游</div><strong>员工 Sprite 工厂</strong><small>Asset Pipeline v0.1</small></div>
      <div class="hint">固定帧 <span class="mono">80×96</span> · 最近邻 · 透明 PNG</div>
      <div class="top-actions">
        <button class="btn ghost" id="newProject">新建</button>
        <label class="btn ghost">打开项目<input hidden id="openProject" type="file" accept="application/json,.json" /></label>
        <button class="btn" id="saveProject">保存项目</button>
        <button class="btn primary" id="exportAll">导出资产</button>
      </div>
    </header>

    <section class="workspace">
      <aside class="sidebar">
        <div class="section">
          <div class="section-title">01 / 角色项目</div>
          <label class="field"><span>角色类型</span><select id="characterType"><option value="random">Random 普通 / 优秀</option><option value="elite">Elite 精英</option><option value="legend">Legend 传奇</option></select></label>
          <label class="field"><span>Character ID</span><input id="characterId" value="staff_pool_f_001" spellcheck="false" /></label>
          <label class="field elite-only"><span>Display Name</span><input id="displayName" placeholder="角色显示名" /></label>
          <label class="field elite-only"><span>Prompt Anchor</span><textarea id="promptAnchor" placeholder="adult, hairstyle, outfit, signature accessory..."></textarea></label>
        </div>

        <div class="section">
          <div class="section-title">02 / 导入与分格</div>
          <label class="field"><span>导入到动作</span><select id="importClip">${clips.map(c => `<option value="${c.id}">${c.label}</option>`).join('')}</select></label>
          <div class="row">
            <label class="field"><span>帧列数</span><input id="gridCols" type="number" min="1" max="64" value="6" /></label>
            <label class="field"><span>帧行数</span><input id="gridRows" type="number" min="1" max="64" value="1" /></label>
          </div>
          <label class="upload btn primary">导入 PNG / GIF<input id="imageInput" type="file" accept="image/png,image/gif,image/webp" multiple /></label>
          <p class="hint">单张序列图按网格拆帧；多张图按文件顺序逐帧导入。</p>
        </div>

        <div class="section">
          <div class="section-title">03 / 抠图</div>
          <label class="check"><input id="removeBg" type="checkbox" checked /> 四角自动取背景色</label>
          <label class="field"><span>颜色容差</span><div class="range-line"><input id="tolerance" type="range" min="0" max="120" value="28" /><output id="toleranceOut">28</output></div></label>
          <label class="check"><input id="edgeOnly" type="checkbox" checked /> 仅删除边缘连通区域</label>
          <label class="check"><input id="pixelEdge" type="checkbox" checked /> Pixel Edge（Alpha 0/255）</label>
        </div>

        <div class="section">
          <div class="section-title">04 / 对齐</div>
          <label class="check"><input id="normalize" type="checkbox" checked /> 统一角色高度</label>
          <label class="check"><input id="centerX" type="checkbox" checked /> 水平居中</label>
          <label class="field"><span>目标角色高度</span><div class="range-line"><input id="targetHeight" type="range" min="48" max="90" value="78" /><output id="heightOut">78</output></div></label>
          <button class="btn" id="reprocess" style="width:100%;margin-top:10px">按当前参数重新处理</button>
        </div>
      </aside>

      <div class="stage" id="stage">
        <div class="stage-tools">
          <button class="btn small" data-bg="checker">透明</button><button class="btn small" data-bg="office">办公室</button><button class="btn small" data-bg="white">白</button><button class="btn small" data-bg="black">黑</button>
        </div>
        <div class="frame-readout" id="frameReadout">无素材</div>
        <div class="canvas-wrap">
          <canvas id="preview" width="400" height="480"></canvas>
          <div class="empty-state" id="empty"><b>把动作素材扔进来</b>PNG Sprite Sheet 或多张 PNG Sequence</div>
        </div>
      </div>

      <aside class="sidebar right">
        <div class="section">
          <div class="section-title">Animation Clips <span id="assetCount">0 帧</span></div>
          <div class="clip-list" id="clipList"></div>
        </div>
        <div class="section">
          <div class="section-title">Asset QA <button class="btn small" id="runQa">刷新</button></div>
          <div class="qa-list" id="qaList"></div>
        </div>
        <div class="section">
          <div class="section-title">预览标记</div>
          <label class="check"><input id="showBounds" type="checkbox" checked /> Bounding Box</label>
          <label class="check"><input id="showAnchor" type="checkbox" checked /> Anchor</label>
          <p class="hint">绿线：脚底锚点<br />青线：坐姿锚点<br />右走由 Walk Left 镜像生成</p>
        </div>
      </aside>
    </section>

    <footer class="timeline">
      <div class="transport">
        <div class="section-title">Timeline / <span id="timelineName">Idle</span></div>
        <div class="transport-row">
          <button class="btn" id="prev">◀</button><button class="btn primary" id="play">▶ 播放</button><button class="btn" id="next">▶</button>
          <label class="field" style="margin:0 0 0 auto"><span>FPS</span><input id="fps" type="number" min="1" max="30" value="6" style="width:58px" /></label>
        </div>
        <div class="transport-row" style="margin-top:10px"><button class="btn small" id="deleteFrame">删除帧</button><button class="btn small" id="duplicateFrame">复制帧</button><button class="btn small" id="flipFrame">镜像帧</button></div>
      </div>
      <div class="timeline-strip" id="timelineStrip"><span class="hint">选择动作并导入素材后，在这里编辑帧。</span></div>
    </footer>
  </main>`;

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const preview = $('#preview') as HTMLCanvasElement;
const previewCtx = preview.getContext('2d')!;
previewCtx.imageSmoothingEnabled = false;

function renderClipList() {
  $('#clipList').innerHTML = clips.map(clip => {
    const qa = clipQa(clip);
    return `<div class="clip ${clip === state.activeClip ? 'active' : ''}" data-clip="${clip.id}"><i class="status-dot ${clip.frames.length ? qa.level : ''}"></i><div><b>${clip.label}</b><small>${clip.frames.length || '—'} / ${clip.expected} 帧 · ${clip.fps} FPS</small></div><span class="tag">${clip.anchor}</span></div>`;
  }).join('');
  document.querySelectorAll<HTMLElement>('[data-clip]').forEach(el => el.onclick = () => selectClip(el.dataset.clip as ClipId));
  const count = clips.reduce((n, c) => n + c.frames.length, 0);
  $('#assetCount').textContent = `${count} 帧`;
}

function selectClip(id: ClipId) {
  state.activeClip = clips.find(c => c.id === id)!;
  state.activeFrame = 0;
  ($('#importClip') as HTMLSelectElement).value = id;
  ($('#fps') as HTMLInputElement).value = String(state.activeClip.fps);
  $('#timelineName').textContent = state.activeClip.label;
  renderAll();
}

function renderAll() {
  renderClipList();
  renderTimeline();
  renderPreview();
  renderQa();
}

function renderPreview() {
  previewCtx.clearRect(0, 0, preview.width, preview.height);
  const frame = state.activeClip.frames[state.activeFrame];
  $('#empty').style.display = frame ? 'none' : 'block';
  if (!frame) {
    $('#frameReadout').textContent = `${state.activeClip.label} · 未导入`;
    return;
  }
  previewCtx.save();
  previewCtx.imageSmoothingEnabled = false;
  previewCtx.drawImage(frame.canvas, 0, 0, preview.width, preview.height);
  const sx = preview.width / FRAME_W;
  const sy = preview.height / FRAME_H;
  if (state.showBounds && frame.bbox) {
    previewCtx.strokeStyle = '#f0bf67';
    previewCtx.lineWidth = 1;
    previewCtx.setLineDash([4, 3]);
    previewCtx.strokeRect(frame.bbox.x * sx + .5, frame.bbox.y * sy + .5, frame.bbox.width * sx, frame.bbox.height * sy);
  }
  if (state.showAnchor) {
    const y = (state.activeClip.anchor === 'seat' ? 75 : 90) * sy;
    previewCtx.strokeStyle = state.activeClip.anchor === 'seat' ? '#72d5d0' : '#78d294';
    previewCtx.setLineDash([]);
    previewCtx.beginPath(); previewCtx.moveTo(preview.width / 2 - 18, y); previewCtx.lineTo(preview.width / 2 + 18, y); previewCtx.stroke();
    previewCtx.beginPath(); previewCtx.moveTo(preview.width / 2, y - 18); previewCtx.lineTo(preview.width / 2, y + 18); previewCtx.stroke();
  }
  previewCtx.restore();
  $('#frameReadout').textContent = `${state.activeClip.id} · ${state.activeFrame + 1}/${state.activeClip.frames.length} · ${FRAME_W}×${FRAME_H}`;
}

function renderTimeline() {
  const strip = $('#timelineStrip');
  if (!state.activeClip.frames.length) {
    strip.innerHTML = '<span class="hint">当前动作还没有帧。请从左侧导入素材。</span>';
    return;
  }
  strip.innerHTML = state.activeClip.frames.map((frame, index) => `<div class="thumb ${index === state.activeFrame ? 'active' : ''}" data-frame="${index}"><span class="thumb-index">${String(index + 1).padStart(2, '0')}</span><canvas width="80" height="96"></canvas></div>`).join('');
  strip.querySelectorAll<HTMLElement>('.thumb').forEach((thumb, i) => {
    const ctx = thumb.querySelector('canvas')!.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(state.activeClip.frames[i].canvas, 0, 0);
    thumb.onclick = () => { state.activeFrame = i; renderTimeline(); renderPreview(); };
  });
}

function renderQa() {
  const checks: { name: string; detail: string; level: QaLevel }[] = [];
  const populated = clips.filter(c => c.frames.length);
  checks.push({ name: 'Frame Size', detail: populated.length ? '全部 80×96' : '等待素材', level: populated.length ? 'green' : 'yellow' });
  const partial = populated.flatMap(c => c.frames).reduce((n, f) => n + f.alphaPartial, 0);
  checks.push({ name: 'Alpha Edge', detail: partial ? `${partial} 个半透明像素` : 'Alpha 0 / 255', level: partial ? 'yellow' : populated.length ? 'green' : 'yellow' });
  const empty = populated.flatMap(c => c.frames).filter(f => !f.bbox).length;
  checks.push({ name: 'Empty Frame', detail: empty ? `${empty} 帧为空` : '未发现空帧', level: empty ? 'red' : populated.length ? 'green' : 'yellow' });
  const clipResult = clipQa(state.activeClip);
  checks.push({ name: 'Scale Consistency', detail: clipResult.message, level: state.activeClip.frames.length ? clipResult.level : 'yellow' });
  const crops = populated.flatMap(c => c.frames).filter(f => f.bbox && (f.bbox.x === 0 || f.bbox.y === 0 || f.bbox.x + f.bbox.width >= FRAME_W || f.bbox.y + f.bbox.height >= FRAME_H)).length;
  checks.push({ name: 'Cropping', detail: crops ? `${crops} 帧触碰画布边缘` : '安全边距正常', level: crops ? 'yellow' : populated.length ? 'green' : 'yellow' });
  $('#qaList').innerHTML = checks.map(q => `<div class="qa-item ${q.level}"><span>${q.name}</span><span>${q.detail}</span></div>`).join('');
}

function clipQa(clip: Clip): { level: QaLevel; message: string } {
  const heights = clip.frames.map(f => f.bbox?.height ?? 0).filter(Boolean);
  if (!heights.length) return { level: 'yellow', message: '等待素材' };
  const avg = heights.reduce((a, b) => a + b, 0) / heights.length;
  const maxVariance = Math.max(...heights.map(h => Math.abs(h - avg) / avg));
  if (maxVariance > .1) return { level: 'red', message: `高度偏差 ${(maxVariance * 100).toFixed(1)}%` };
  if (maxVariance > .03) return { level: 'yellow', message: `高度偏差 ${(maxVariance * 100).toFixed(1)}%` };
  return { level: 'green', message: `高度偏差 ${(maxVariance * 100).toFixed(1)}%` };
}

async function importFiles(files: FileList) {
  const clip = clips.find(c => c.id === ($('#importClip') as HTMLSelectElement).value)!;
  const columns = Math.max(1, Number(($('#gridCols') as HTMLInputElement).value));
  const rows = Math.max(1, Number(($('#gridRows') as HTMLInputElement).value));
  const sources: { image: CanvasImageSource; name: string; cols: number; rows: number }[] = [];
  for (const file of Array.from(files)) {
    const bitmap = await createImageBitmap(file);
    sources.push({ image: bitmap, name: file.name, cols: files.length > 1 ? 1 : columns, rows: files.length > 1 ? 1 : rows });
  }
  const imported: FrameAsset[] = [];
  for (const source of sources) {
    const sw = Math.floor((source.image as ImageBitmap).width / source.cols);
    const sh = Math.floor((source.image as ImageBitmap).height / source.rows);
    for (let row = 0; row < source.rows; row++) {
      for (let col = 0; col < source.cols; col++) {
        const raw = document.createElement('canvas'); raw.width = sw; raw.height = sh;
        raw.getContext('2d')!.drawImage(source.image, col * sw, row * sh, sw, sh, 0, 0, sw, sh);
        imported.push(processFrame(raw, source.name));
      }
    }
  }
  clip.frames.push(...imported);
  state.activeClip = clip;
  state.activeFrame = Math.max(0, clip.frames.length - imported.length);
  renderAll();
}

function processFrame(raw: HTMLCanvasElement, sourceName: string): FrameAsset {
  const ctx = raw.getContext('2d', { willReadFrequently: true })!;
  if (($('#removeBg') as HTMLInputElement).checked) removeBackground(raw);
  let bbox = findBounds(ctx.getImageData(0, 0, raw.width, raw.height));
  const out = document.createElement('canvas'); out.width = FRAME_W; out.height = FRAME_H;
  const outCtx = out.getContext('2d', { willReadFrequently: true })!;
  outCtx.imageSmoothingEnabled = false;
  if (bbox) {
    const normalize = ($('#normalize') as HTMLInputElement).checked;
    const targetHeight = Number(($('#targetHeight') as HTMLInputElement).value);
    const scale = normalize ? Math.min(targetHeight / bbox.height, (FRAME_W - 6) / bbox.width) : Math.min(1, (FRAME_W - 6) / bbox.width, (FRAME_H - 6) / bbox.height);
    const dw = Math.max(1, Math.round(bbox.width * scale));
    const dh = Math.max(1, Math.round(bbox.height * scale));
    const anchorY = state.activeClip.anchor === 'seat' ? 75 : 90;
    const dx = ($('#centerX') as HTMLInputElement).checked ? Math.round((FRAME_W - dw) / 2) : Math.max(0, bbox.x);
    const dy = Math.round(anchorY - dh);
    outCtx.drawImage(raw, bbox.x, bbox.y, bbox.width, bbox.height, dx, dy, dw, dh);
  }
  if (($('#pixelEdge') as HTMLInputElement).checked) quantizeAlpha(outCtx, out.width, out.height);
  const data = outCtx.getImageData(0, 0, out.width, out.height);
  bbox = findBounds(data);
  let partial = 0;
  for (let i = 3; i < data.data.length; i += 4) if (data.data[i] > 0 && data.data[i] < 255) partial++;
  return { canvas: out, sourceName, alphaPartial: partial, bbox };
}

function cornerColor(data: ImageData): [number, number, number] {
  const points = [[0, 0], [data.width - 1, 0], [0, data.height - 1], [data.width - 1, data.height - 1]];
  const colors = points.map(([x, y]) => { const i = (y * data.width + x) * 4; return [data.data[i], data.data[i + 1], data.data[i + 2]]; });
  return [0, 1, 2].map(channel => Math.round(colors.reduce((sum, c) => sum + c[channel], 0) / 4)) as [number, number, number];
}

function removeBackground(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const target = cornerColor(image);
  const tolerance = Number(($('#tolerance') as HTMLInputElement).value);
  const match = (index: number) => {
    const d = image.data;
    return Math.max(Math.abs(d[index] - target[0]), Math.abs(d[index + 1] - target[1]), Math.abs(d[index + 2] - target[2])) <= tolerance;
  };
  if (!($('#edgeOnly') as HTMLInputElement).checked) {
    for (let i = 0; i < image.data.length; i += 4) if (match(i)) image.data[i + 3] = 0;
  } else {
    const visited = new Uint8Array(canvas.width * canvas.height);
    const queue: number[] = [];
    for (let x = 0; x < canvas.width; x++) queue.push(x, (canvas.height - 1) * canvas.width + x);
    for (let y = 1; y < canvas.height - 1; y++) queue.push(y * canvas.width, y * canvas.width + canvas.width - 1);
    let head = 0;
    while (head < queue.length) {
      const p = queue[head++];
      if (visited[p]) continue;
      visited[p] = 1;
      const i = p * 4;
      if (!match(i)) continue;
      image.data[i + 3] = 0;
      const x = p % canvas.width, y = Math.floor(p / canvas.width);
      if (x > 0) queue.push(p - 1); if (x < canvas.width - 1) queue.push(p + 1);
      if (y > 0) queue.push(p - canvas.width); if (y < canvas.height - 1) queue.push(p + canvas.width);
    }
  }
  ctx.putImageData(image, 0, 0);
}

function quantizeAlpha(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const image = ctx.getImageData(0, 0, width, height);
  for (let i = 3; i < image.data.length; i += 4) image.data[i] = image.data[i] >= 128 ? 255 : 0;
  ctx.putImageData(image, 0, 0);
}

function findBounds(image: ImageData): Bounds | null {
  let minX = image.width, minY = image.height, maxX = -1, maxY = -1;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    if (image.data[(y * image.width + x) * 4 + 3] > 0) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function flipCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas'); out.width = source.width; out.height = source.height;
  const ctx = out.getContext('2d')!; ctx.translate(out.width, 0); ctx.scale(-1, 1); ctx.drawImage(source, 0, 0); return out;
}

function projectMetadata() {
  const characterId = ($('#characterId') as HTMLInputElement).value.trim() || 'unnamed_character';
  const animationEntries: [string, object][] = clips.map((clip, row) => [clip.id, { row, frames: clip.frames.length, fps: clip.fps, loop: clip.loop, ...(clip.anchor === 'seat' ? { anchor: 'seat' } : {}) }]);
  animationEntries.push(['walk_right', { source: 'walk_left', flipX: true }]);
  return {
    schemaVersion: 1,
    characterId,
    characterType: ($('#characterType') as HTMLSelectElement).value,
    displayName: ($('#displayName') as HTMLInputElement).value.trim() || undefined,
    promptAnchor: ($('#promptAnchor') as HTMLTextAreaElement).value.trim() || undefined,
    frameWidth: FRAME_W, frameHeight: FRAME_H, sheetColumns: SHEET_COLS, sheetRows: clips.length,
    defaultFps: 8, scale: 1,
    standingAnchor: { x: .5, y: .9375 }, seatAnchor: { x: .5, y: .78125 },
    animations: Object.fromEntries(animationEntries),
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function exportAssets() {
  const metadata = projectMetadata();
  const sheet = document.createElement('canvas'); sheet.width = FRAME_W * SHEET_COLS; sheet.height = FRAME_H * clips.length;
  const ctx = sheet.getContext('2d')!; ctx.imageSmoothingEnabled = false;
  clips.forEach((clip, row) => clip.frames.slice(0, SHEET_COLS).forEach((frame, col) => ctx.drawImage(frame.canvas, col * FRAME_W, row * FRAME_H)));
  const id = metadata.characterId;
  const blob = await new Promise<Blob>((resolve, reject) => sheet.toBlob(b => b ? resolve(b) : reject(new Error('PNG export failed')), 'image/png'));
  downloadBlob(blob, `${id}_sprite.png`);
  downloadBlob(new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' }), `${id}_sprite.json`);
}

function saveProject() {
  const payload = { ...projectMetadata(), sourceFrames: Object.fromEntries(clips.map(c => [c.id, c.frames.map(f => f.canvas.toDataURL('image/png'))])) };
  downloadBlob(new Blob([JSON.stringify(payload)], { type: 'application/json' }), `${payload.characterId}.sprite-project.json`);
}

async function openProject(file: File) {
  const data = JSON.parse(await file.text());
  ($('#characterId') as HTMLInputElement).value = data.characterId || 'unnamed_character';
  ($('#characterType') as HTMLSelectElement).value = data.characterType || 'random';
  ($('#displayName') as HTMLInputElement).value = data.displayName || '';
  ($('#promptAnchor') as HTMLTextAreaElement).value = data.promptAnchor || '';
  for (const clip of clips) {
    clip.frames = [];
    const urls: string[] = data.sourceFrames?.[clip.id] || [];
    for (const url of urls) {
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = FRAME_W; canvas.height = FRAME_H; canvas.getContext('2d')!.drawImage(image, 0, 0);
      const imageData = canvas.getContext('2d')!.getImageData(0, 0, FRAME_W, FRAME_H);
      clip.frames.push({ canvas, sourceName: file.name, alphaPartial: 0, bbox: findBounds(imageData) });
    }
  }
  selectClip('idle');
}

function resetProject() {
  if (clips.some(c => c.frames.length) && !confirm('清空当前项目中的全部帧？')) return;
  clips.forEach(c => c.frames = []);
  ($('#characterId') as HTMLInputElement).value = 'staff_pool_f_001';
  ($('#displayName') as HTMLInputElement).value = '';
  ($('#promptAnchor') as HTMLTextAreaElement).value = '';
  selectClip('idle');
}

function animate(time: number) {
  if (state.playing && state.activeClip.frames.length && time - state.lastTick > 1000 / state.activeClip.fps) {
    const next = state.activeFrame + 1;
    if (next >= state.activeClip.frames.length && !state.activeClip.loop) state.playing = false;
    else state.activeFrame = next % state.activeClip.frames.length;
    state.lastTick = time; renderTimeline(); renderPreview();
  }
  requestAnimationFrame(animate);
}

$('#imageInput').addEventListener('change', e => { const files = (e.target as HTMLInputElement).files; if (files?.length) importFiles(files).catch(err => alert(err.message)); });
$('#importClip').addEventListener('change', e => selectClip((e.target as HTMLSelectElement).value as ClipId));
$('#tolerance').addEventListener('input', e => $('#toleranceOut').textContent = (e.target as HTMLInputElement).value);
$('#targetHeight').addEventListener('input', e => $('#heightOut').textContent = (e.target as HTMLInputElement).value);
$('#showBounds').addEventListener('change', e => { state.showBounds = (e.target as HTMLInputElement).checked; renderPreview(); });
$('#showAnchor').addEventListener('change', e => { state.showAnchor = (e.target as HTMLInputElement).checked; renderPreview(); });
$('#fps').addEventListener('change', e => { state.activeClip.fps = Math.max(1, Math.min(30, Number((e.target as HTMLInputElement).value))); renderClipList(); });
$('#play').onclick = () => { state.playing = !state.playing; $('#play').textContent = state.playing ? '❚❚ 暂停' : '▶ 播放'; };
$('#prev').onclick = () => { if (state.activeClip.frames.length) { state.activeFrame = (state.activeFrame - 1 + state.activeClip.frames.length) % state.activeClip.frames.length; renderTimeline(); renderPreview(); } };
$('#next').onclick = () => { if (state.activeClip.frames.length) { state.activeFrame = (state.activeFrame + 1) % state.activeClip.frames.length; renderTimeline(); renderPreview(); } };
$('#deleteFrame').onclick = () => { if (state.activeClip.frames.length) { state.activeClip.frames.splice(state.activeFrame, 1); state.activeFrame = Math.max(0, Math.min(state.activeFrame, state.activeClip.frames.length - 1)); renderAll(); } };
$('#duplicateFrame').onclick = () => { const f = state.activeClip.frames[state.activeFrame]; if (f) { const canvas = document.createElement('canvas'); canvas.width = FRAME_W; canvas.height = FRAME_H; canvas.getContext('2d')!.drawImage(f.canvas, 0, 0); state.activeClip.frames.splice(state.activeFrame + 1, 0, { ...f, canvas }); state.activeFrame++; renderAll(); } };
$('#flipFrame').onclick = () => { const f = state.activeClip.frames[state.activeFrame]; if (f) { f.canvas = flipCanvas(f.canvas); f.bbox = findBounds(f.canvas.getContext('2d')!.getImageData(0, 0, FRAME_W, FRAME_H)); renderAll(); } };
$('#runQa').onclick = renderQa;
$('#exportAll').onclick = () => exportAssets().catch(err => alert(err.message));
$('#saveProject').onclick = saveProject;
$('#newProject').onclick = resetProject;
$('#openProject').addEventListener('change', e => { const file = (e.target as HTMLInputElement).files?.[0]; if (file) openProject(file).catch(err => alert(`项目读取失败：${err.message}`)); });
$('#reprocess').onclick = () => alert('当前版本会在导入时应用参数。要更换抠图参数，请重新导入原图；项目文件会保留已处理帧。');
document.querySelectorAll<HTMLElement>('[data-bg]').forEach(btn => btn.onclick = () => { state.background = btn.dataset.bg!; $('#stage').className = `stage ${state.background === 'checker' ? '' : state.background}`; });

renderAll();
requestAnimationFrame(animate);
