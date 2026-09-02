const qs = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);

const nativeCanvasRect = HTMLCanvasElement.prototype.getBoundingClientRect;
const nativeClearRect = CanvasRenderingContext2D.prototype.clearRect;
const nativeSetTransform = CanvasRenderingContext2D.prototype.setTransform;

let panX = 0;
let panY = 0;
let panMode = true;
let dragging = false;
let spaceHeld = false;
let dragPointer = -1;
let dragStart = { x: 0, y: 0 };
let panStart = { x: 0, y: 0 };
const movementKeys = new Set<string>();
let movementRaf = 0;
let movementLast = performance.now();

function previewCanvas() {
  return qs<HTMLCanvasElement>('#preview');
}

function inCharacterView() {
  return Boolean(document.querySelector<HTMLElement>('[data-view="character"].active-view'));
}

function zoomInspectionEnabled() {
  return Boolean(qs<HTMLInputElement>('#edgeInspection')?.checked);
}

function manualToolActive() {
  return Boolean(document.querySelector<HTMLElement>('[data-manual-tool].active-view'));
}

function panContextActive() {
  return inCharacterView() && zoomInspectionEnabled();
}

function requestPreviewRender() {
  const driver = qs<HTMLInputElement>('#onionOpacity');
  if (driver) driver.dispatchEvent(new Event('input', { bubbles: true }));
}

function updateStatus() {
  const status = qs<HTMLElement>('#viewportPanStatus');
  const button = qs<HTMLButtonElement>('#viewportPanToggle');
  if (button) {
    button.classList.toggle('active-view', panMode);
    button.textContent = panMode ? '✋ 拖动画布：开' : '✋ 拖动画布：关';
  }
  if (!status) return;
  if (!zoomInspectionEnabled()) status.textContent = '开启“边缘放大检查”后可拖动画布。';
  else if (manualToolActive()) status.textContent = '精修时：右键拖 / Space+左键拖 / WASD 平移；左键继续使用当前工具。';
  else status.textContent = panMode ? '左键拖、右键拖或 WASD 查看尾巴 / 脚 / 边缘；双击回到中心。' : '右键拖、Space+左键拖或 WASD 仍可临时平移。';
}

function resetPan(render = true) {
  panX = 0;
  panY = 0;
  if (render) requestPreviewRender();
}

function originalRect(canvas: HTMLCanvasElement) {
  return nativeCanvasRect.call(canvas);
}

function clampPan(canvas: HTMLCanvasElement) {
  const limitX = canvas.width * 3;
  const limitY = canvas.height * 3;
  panX = Math.max(-limitX, Math.min(limitX, panX));
  panY = Math.max(-limitY, Math.min(limitY, panY));
}

HTMLCanvasElement.prototype.getBoundingClientRect = function getBoundingClientRectPatched() {
  const rect = nativeCanvasRect.call(this);
  if (this.id !== 'preview' || !panContextActive() || (!panX && !panY)) return rect;
  const scaleX = this.width ? rect.width / this.width : 1;
  const scaleY = this.height ? rect.height / this.height : 1;
  return new DOMRect(rect.x + panX * scaleX, rect.y + panY * scaleY, rect.width, rect.height);
};

CanvasRenderingContext2D.prototype.clearRect = function clearRectPatched(x: number, y: number, w: number, h: number) {
  if (this.canvas.id !== 'preview') return nativeClearRect.call(this, x, y, w, h);
  nativeSetTransform.call(this, 1, 0, 0, 1, 0, 0);
  nativeClearRect.call(this, 0, 0, this.canvas.width, this.canvas.height);
  if (panContextActive() && (panX || panY)) nativeSetTransform.call(this, 1, 0, 0, 1, panX, panY);
};

function shouldBeginPan(event: PointerEvent) {
  if (!panContextActive()) return false;
  if (event.button === 2 || event.button === 1 || spaceHeld) return true;
  return event.button === 0 && panMode && !manualToolActive();
}

function beginPan(event: PointerEvent) {
  const preview = previewCanvas();
  if (!preview || !shouldBeginPan(event)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  dragging = true;
  dragPointer = event.pointerId;
  dragStart = { x: event.clientX, y: event.clientY };
  panStart = { x: panX, y: panY };
  preview.setPointerCapture(event.pointerId);
  preview.style.cursor = 'grabbing';
}

function movePan(event: PointerEvent) {
  const preview = previewCanvas();
  if (!preview || !dragging || event.pointerId !== dragPointer) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const rect = originalRect(preview);
  const scaleX = rect.width ? preview.width / rect.width : 1;
  const scaleY = rect.height ? preview.height / rect.height : 1;
  panX = panStart.x + (event.clientX - dragStart.x) * scaleX;
  panY = panStart.y + (event.clientY - dragStart.y) * scaleY;
  clampPan(preview);
  requestPreviewRender();
}

function endPan(event: PointerEvent) {
  const preview = previewCanvas();
  if (!preview || !dragging || event.pointerId !== dragPointer) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  dragging = false;
  dragPointer = -1;
  if (preview.hasPointerCapture(event.pointerId)) preview.releasePointerCapture(event.pointerId);
  preview.style.cursor = panContextActive() && panMode && !manualToolActive() ? 'grab' : manualToolActive() ? 'crosshair' : '';
  updateStatus();
}

function targetAllowsShortcut(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return true;
  if (el.matches('input, textarea, select, [contenteditable="true"]')) return false;
  return true;
}

function movementStep(now: number) {
  movementRaf = requestAnimationFrame(movementStep);
  const dt = Math.min((now - movementLast) / 1000, .05);
  movementLast = now;
  if (!panContextActive() || !movementKeys.size) return;
  let dx = 0;
  let dy = 0;
  const speed = 420;
  if (movementKeys.has('w')) dy += speed * dt;
  if (movementKeys.has('s')) dy -= speed * dt;
  if (movementKeys.has('a')) dx += speed * dt;
  if (movementKeys.has('d')) dx -= speed * dt;
  if (!dx && !dy) return;
  const preview = previewCanvas();
  if (!preview) return;
  panX += dx;
  panY += dy;
  clampPan(preview);
  requestPreviewRender();
}

function installUi() {
  const preview = previewCanvas();
  const inspection = qs<HTMLInputElement>('#edgeInspection');
  if (!preview || !inspection || qs('#viewportPanToggle')) return;

  const host = inspection.closest('label')?.parentElement || inspection.parentElement;
  if (host) {
    const row = document.createElement('div');
    row.className = 'row';
    row.style.marginTop = '8px';

    const toggle = document.createElement('button');
    toggle.id = 'viewportPanToggle';
    toggle.className = 'btn small active-view';
    toggle.type = 'button';
    toggle.onclick = () => {
      panMode = !panMode;
      preview.style.cursor = panContextActive() && panMode && !manualToolActive() ? 'grab' : manualToolActive() ? 'crosshair' : '';
      updateStatus();
    };

    const reset = document.createElement('button');
    reset.id = 'viewportPanReset';
    reset.className = 'btn small';
    reset.type = 'button';
    reset.textContent = '回到中心';
    reset.onclick = () => resetPan();

    row.append(toggle, reset);
    host.appendChild(row);

    const status = document.createElement('div');
    status.id = 'viewportPanStatus';
    status.className = 'hint';
    status.style.marginTop = '6px';
    host.appendChild(status);
  }

  preview.addEventListener('contextmenu', event => {
    if (panContextActive()) event.preventDefault();
  });
  preview.addEventListener('pointerdown', beginPan, true);
  preview.addEventListener('pointermove', movePan, true);
  preview.addEventListener('pointerup', endPan, true);
  preview.addEventListener('pointercancel', endPan, true);
  preview.addEventListener('dblclick', event => {
    if (!panContextActive()) return;
    event.preventDefault();
    resetPan();
  }, true);

  inspection.addEventListener('change', () => {
    if (!inspection.checked) resetPan(false);
    preview.style.cursor = panContextActive() && panMode && !manualToolActive() ? 'grab' : manualToolActive() ? 'crosshair' : '';
    updateStatus();
  });

  document.addEventListener('keydown', event => {
    if (!targetAllowsShortcut(event.target)) return;
    if (event.code === 'Space' && !event.repeat) {
      spaceHeld = true;
      if (panContextActive()) {
        event.preventDefault();
        preview.style.cursor = 'grab';
        updateStatus();
      }
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.code === 'KeyW' ? 'w' : event.code === 'KeyA' ? 'a' : event.code === 'KeyS' ? 's' : event.code === 'KeyD' ? 'd' : '';
    if (key && panContextActive()) {
      movementKeys.add(key);
      event.preventDefault();
    }
  });

  document.addEventListener('keyup', event => {
    if (event.code === 'Space') {
      spaceHeld = false;
      if (!dragging) preview.style.cursor = panContextActive() && panMode && !manualToolActive() ? 'grab' : manualToolActive() ? 'crosshair' : '';
      updateStatus();
      return;
    }
    if (event.code === 'KeyW') movementKeys.delete('w');
    else if (event.code === 'KeyA') movementKeys.delete('a');
    else if (event.code === 'KeyS') movementKeys.delete('s');
    else if (event.code === 'KeyD') movementKeys.delete('d');
  });

  window.addEventListener('blur', () => {
    movementKeys.clear();
    spaceHeld = false;
  });

  document.addEventListener('click', event => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-manual-tool],[data-view]')) setTimeout(() => {
      preview.style.cursor = panContextActive() && panMode && !manualToolActive() ? 'grab' : manualToolActive() ? 'crosshair' : '';
      updateStatus();
    }, 0);
  });

  movementRaf = requestAnimationFrame(movementStep);
  updateStatus();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installUi, { once: true });
else installUi();
