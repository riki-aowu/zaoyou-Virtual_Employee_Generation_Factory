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
  else if (manualToolActive()) status.textContent = '手工工具使用中；按住 Space 拖动，或用鼠标中键拖动画布。';
  else status.textContent = panMode ? '左键拖动查看尾巴 / 脚 / 边缘；Space 或中键也可拖动。' : '按住 Space 或鼠标中键仍可临时拖动。';
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
  if (event.button === 1 || spaceHeld) return true;
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
  preview.style.cursor = panContextActive() && panMode && !manualToolActive() ? 'grab' : '';
  updateStatus();
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
      preview.style.cursor = panContextActive() && panMode && !manualToolActive() ? 'grab' : '';
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
    preview.style.cursor = panContextActive() && panMode && !manualToolActive() ? 'grab' : '';
    updateStatus();
  });

  document.addEventListener('keydown', event => {
    if (event.code !== 'Space' || event.repeat) return;
    const target = event.target as HTMLElement | null;
    if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
    spaceHeld = true;
    if (panContextActive()) {
      event.preventDefault();
      preview.style.cursor = 'grab';
      updateStatus();
    }
  });

  document.addEventListener('keyup', event => {
    if (event.code !== 'Space') return;
    spaceHeld = false;
    if (!dragging) preview.style.cursor = panContextActive() && panMode && !manualToolActive() ? 'grab' : '';
    updateStatus();
  });

  document.addEventListener('click', event => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-manual-tool]')) setTimeout(() => {
      preview.style.cursor = panContextActive() && panMode && !manualToolActive() ? 'grab' : manualToolActive() ? 'crosshair' : '';
      updateStatus();
    }, 0);
  });

  updateStatus();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installUi, { once: true });
else installUi();
