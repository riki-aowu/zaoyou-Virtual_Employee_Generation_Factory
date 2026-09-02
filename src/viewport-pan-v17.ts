const q = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);
const originalRect = HTMLCanvasElement.prototype.getBoundingClientRect;
const originalClear = CanvasRenderingContext2D.prototype.clearRect;

let pan = { x: 0, y: 0 };
let startPan = { x: 0, y: 0 };
let startPointer = { x: 0, y: 0 };
let pointerId = -1;
let dragging = false;
let spaceHeld = false;
let directPan = true;
const moveKeys = new Set<string>();
let lastTick = performance.now();

const preview = () => q<HTMLCanvasElement>('#preview');
const characterView = () => Boolean(document.querySelector('[data-view="character"].active-view'));
const zoomed = () => Boolean(q<HTMLInputElement>('#edgeInspection')?.checked);
const manualTool = () => Boolean(document.querySelector('[data-manual-tool].active-view'));
const active = () => characterView() && zoomed();

function redraw() {
  q<HTMLInputElement>('#onionOpacity')?.dispatchEvent(new Event('input', { bubbles: true }));
}

function clamp() {
  const canvas = preview();
  if (!canvas) return;
  pan.x = Math.max(-canvas.width * 3, Math.min(canvas.width * 3, pan.x));
  pan.y = Math.max(-canvas.height * 3, Math.min(canvas.height * 3, pan.y));
}

function reset(render = true) {
  pan = { x: 0, y: 0 };
  if (render) redraw();
}

function status() {
  const hint = q('#viewportPanStatus');
  const toggle = q<HTMLButtonElement>('#viewportPanToggle');
  const canvas = preview();
  if (toggle) {
    toggle.classList.toggle('active-view', directPan);
    toggle.textContent = directPan ? '✋ 拖动画布：开' : '✋ 拖动画布：关';
  }
  if (hint) {
    if (!zoomed()) hint.textContent = '开启“边缘检查（放大 4 倍）”后可移动视野。';
    else if (manualTool()) hint.textContent = '精修中：右键拖 / Space+左键拖 / WASD 平移；左键继续抠图。';
    else hint.textContent = '左键拖、右键拖或 WASD 平移；双击“回到中心”。';
  }
  if (canvas && !dragging) canvas.style.cursor = active() && directPan && !manualTool() ? 'grab' : manualTool() ? 'crosshair' : '';
}

HTMLCanvasElement.prototype.getBoundingClientRect = function () {
  const rect = originalRect.call(this);
  if (this.id !== 'preview' || !active() || (!pan.x && !pan.y)) return rect;
  const sx = this.width ? rect.width / this.width : 1;
  const sy = this.height ? rect.height / this.height : 1;
  return new DOMRect(rect.x + pan.x * sx, rect.y + pan.y * sy, rect.width, rect.height);
};

CanvasRenderingContext2D.prototype.clearRect = function (x: number, y: number, width: number, height: number) {
  if (this.canvas.id !== 'preview') return (originalClear as Function).call(this, x, y, width, height);
  this.setTransform(1, 0, 0, 1, 0, 0);
  (originalClear as Function).call(this, 0, 0, this.canvas.width, this.canvas.height);
  if (active() && (pan.x || pan.y)) this.setTransform(1, 0, 0, 1, pan.x, pan.y);
};

function wantsPan(event: PointerEvent) {
  if (!active()) return false;
  if (event.button === 1 || event.button === 2 || spaceHeld) return true;
  return event.button === 0 && directPan && !manualTool();
}

function down(event: PointerEvent) {
  const canvas = preview();
  if (!canvas || !wantsPan(event)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  dragging = true;
  pointerId = event.pointerId;
  startPointer = { x: event.clientX, y: event.clientY };
  startPan = { ...pan };
  canvas.setPointerCapture(event.pointerId);
  canvas.style.cursor = 'grabbing';
}

function move(event: PointerEvent) {
  const canvas = preview();
  if (!canvas || !dragging || event.pointerId !== pointerId) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const rect = originalRect.call(canvas);
  pan.x = startPan.x + (event.clientX - startPointer.x) * (canvas.width / Math.max(1, rect.width));
  pan.y = startPan.y + (event.clientY - startPointer.y) * (canvas.height / Math.max(1, rect.height));
  clamp();
  redraw();
}

function up(event: PointerEvent) {
  const canvas = preview();
  if (!canvas || !dragging || event.pointerId !== pointerId) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  dragging = false;
  pointerId = -1;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  status();
}

function shortcutTargetOkay(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !el?.matches('input, textarea, select, [contenteditable="true"]');
}

function tick(now: number) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - lastTick) / 1000, .05);
  lastTick = now;
  if (!active() || !moveKeys.size) return;
  const speed = 420;
  if (moveKeys.has('w')) pan.y += speed * dt;
  if (moveKeys.has('s')) pan.y -= speed * dt;
  if (moveKeys.has('a')) pan.x += speed * dt;
  if (moveKeys.has('d')) pan.x -= speed * dt;
  clamp();
  redraw();
}

function install() {
  const canvas = preview();
  const inspection = q<HTMLInputElement>('#edgeInspection');
  if (!canvas || !inspection || q('#viewportPanToggle')) return requestAnimationFrame(install);

  const host = inspection.closest('label')?.parentElement;
  if (host) {
    const row = document.createElement('div');
    row.className = 'row';
    row.style.marginTop = '8px';
    row.innerHTML = '<button class="btn small active-view" id="viewportPanToggle" type="button">✋ 拖动画布：开</button><button class="btn small" id="viewportPanReset" type="button">回到中心</button>';
    host.appendChild(row);
    const hint = document.createElement('div');
    hint.id = 'viewportPanStatus';
    hint.className = 'hint';
    hint.style.marginTop = '6px';
    host.appendChild(hint);
    q<HTMLButtonElement>('#viewportPanToggle')!.onclick = () => { directPan = !directPan; status(); };
    q<HTMLButtonElement>('#viewportPanReset')!.onclick = () => reset();
  }

  canvas.addEventListener('contextmenu', event => { if (active()) event.preventDefault(); });
  canvas.addEventListener('pointerdown', down, true);
  canvas.addEventListener('pointermove', move, true);
  canvas.addEventListener('pointerup', up, true);
  canvas.addEventListener('pointercancel', up, true);
  canvas.addEventListener('dblclick', event => { if (active()) { event.preventDefault(); reset(); } }, true);

  inspection.addEventListener('change', () => { if (!inspection.checked) reset(false); status(); });
  document.addEventListener('click', event => {
    if ((event.target as HTMLElement | null)?.closest('[data-manual-tool],[data-view]')) setTimeout(status, 0);
  });
  document.addEventListener('keydown', event => {
    if (!shortcutTargetOkay(event.target)) return;
    if (event.code === 'Space') {
      if (!event.repeat) spaceHeld = true;
      if (active()) { event.preventDefault(); canvas.style.cursor = 'grab'; }
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || !active()) return;
    const key = event.code === 'KeyW' ? 'w' : event.code === 'KeyA' ? 'a' : event.code === 'KeyS' ? 's' : event.code === 'KeyD' ? 'd' : '';
    if (key) { moveKeys.add(key); event.preventDefault(); }
  });
  document.addEventListener('keyup', event => {
    if (event.code === 'Space') { spaceHeld = false; status(); }
    else if (event.code === 'KeyW') moveKeys.delete('w');
    else if (event.code === 'KeyA') moveKeys.delete('a');
    else if (event.code === 'KeyS') moveKeys.delete('s');
    else if (event.code === 'KeyD') moveKeys.delete('d');
  });
  window.addEventListener('blur', () => { moveKeys.clear(); spaceHeld = false; });
  requestAnimationFrame(tick);
  status();
}

install();
