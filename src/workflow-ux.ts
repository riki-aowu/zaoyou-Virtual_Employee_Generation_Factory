import './workflow-ux.css';

type WalkId = 'walk_down' | 'walk_up' | 'walk_left' | 'walk_right';

type WalkSnapshot = {
  id: WalkId;
  label: string;
  image: string;
  scale: string;
  offsetX: string;
  offsetY: string;
  available: boolean;
};

const WALK_ACTIONS: { id: WalkId; label: string }[] = [
  { id: 'walk_down', label: '向下' },
  { id: 'walk_up', label: '向上' },
  { id: 'walk_left', label: '向左' },
  { id: 'walk_right', label: '向右' },
];

const waitForFactory = () => new Promise<void>(resolve => {
  const tick = () => document.querySelector<HTMLCanvasElement>('#preview') ? resolve() : requestAnimationFrame(tick);
  tick();
});

const clickAction = (id: WalkId) => {
  document.querySelector<HTMLElement>(`[data-action="${id}"]`)?.click();
};

const currentActionId = () => document.querySelector<HTMLElement>('[data-action].active')?.dataset.action || 'idle';
const valueOf = (id: string) => (document.querySelector<HTMLInputElement>(`#${id}`)?.value || '0');

const setNumber = (id: string, value: number, eventName: 'input' | 'change') => {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) return;
  input.value = String(value);
  input.dispatchEvent(new Event(eventName, { bubbles: true }));
};

function captureCurrent(id: WalkId, label: string): WalkSnapshot {
  const canvas = document.querySelector<HTMLCanvasElement>('#preview');
  const row = document.querySelector<HTMLElement>(`[data-action="${id}"]`);
  return {
    id,
    label,
    image: canvas?.toDataURL('image/png') || '',
    scale: valueOf('actionScale'),
    offsetX: valueOf('clipOffsetX'),
    offsetY: valueOf('clipOffsetY'),
    available: Boolean(row && !row.textContent?.includes('0 帧')),
  };
}

async function collectSnapshots(): Promise<WalkSnapshot[]> {
  const original = currentActionId();
  const out: WalkSnapshot[] = [];
  for (const action of WALK_ACTIONS) {
    clickAction(action.id);
    await new Promise(requestAnimationFrame);
    out.push(captureCurrent(action.id, action.label));
  }
  document.querySelector<HTMLElement>(`[data-action="${original}"]`)?.click();
  return out;
}

function card(snapshot: WalkSnapshot) {
  return `<section class="direction-card ${snapshot.available ? '' : 'direction-empty'}" data-direction="${snapshot.id}">
    <header><strong>${snapshot.label}</strong><span>${snapshot.available ? '已导入' : '无素材'}</span></header>
    <div class="direction-preview"><img src="${snapshot.image}" alt="${snapshot.label}"><i></i></div>
    <label>动作缩放 <input data-role="scale" type="number" step="0.01" min="0.01" value="${snapshot.scale}"></label>
    <div class="direction-nudges">
      <button data-delta-scale="-0.01">缩小</button><button data-delta-scale="0.01">放大</button>
    </div>
    <div class="direction-offsets">
      <label>X <input data-role="offset-x" type="number" step="1" value="${snapshot.offsetX}"></label>
      <label>Y <input data-role="offset-y" type="number" step="1" value="${snapshot.offsetY}"></label>
    </div>
    <button class="direction-refresh">刷新当前方向</button>
  </section>`;
}

async function refreshCard(dialog: HTMLDialogElement, id: WalkId) {
  const original = currentActionId();
  clickAction(id);
  await new Promise(requestAnimationFrame);
  const action = WALK_ACTIONS.find(item => item.id === id)!;
  const snapshot = captureCurrent(id, action.label);
  const section = dialog.querySelector<HTMLElement>(`[data-direction="${id}"]`);
  const image = section?.querySelector<HTMLImageElement>('img');
  if (image) image.src = snapshot.image;
  const scale = section?.querySelector<HTMLInputElement>('[data-role="scale"]');
  const x = section?.querySelector<HTMLInputElement>('[data-role="offset-x"]');
  const y = section?.querySelector<HTMLInputElement>('[data-role="offset-y"]');
  if (scale) scale.value = snapshot.scale;
  if (x) x.value = snapshot.offsetX;
  if (y) y.value = snapshot.offsetY;
  document.querySelector<HTMLElement>(`[data-action="${original}"]`)?.click();
}

async function openCalibration(dialog: HTMLDialogElement) {
  const snapshots = await collectSnapshots();
  const grid = dialog.querySelector<HTMLElement>('.direction-grid')!;
  grid.innerHTML = snapshots.map(card).join('');
  dialog.showModal();
}

function bindDialog(dialog: HTMLDialogElement) {
  dialog.addEventListener('input', event => {
    const input = event.target as HTMLInputElement;
    const section = input.closest<HTMLElement>('[data-direction]');
    if (!section) return;
    const id = section.dataset.direction as WalkId;
    clickAction(id);
    if (input.dataset.role === 'scale') setNumber('actionScale', Number(input.value), 'input');
  });

  dialog.addEventListener('change', event => {
    const input = event.target as HTMLInputElement;
    const section = input.closest<HTMLElement>('[data-direction]');
    if (!section) return;
    const id = section.dataset.direction as WalkId;
    clickAction(id);
    if (input.dataset.role === 'offset-x') setNumber('clipOffsetX', Number(input.value), 'change');
    if (input.dataset.role === 'offset-y') setNumber('clipOffsetY', Number(input.value), 'change');
  });

  dialog.addEventListener('click', async event => {
    const target = event.target as HTMLElement;
    if (target.closest('.direction-close')) return dialog.close();
    const section = target.closest<HTMLElement>('[data-direction]');
    if (section) {
      const id = section.dataset.direction as WalkId;
      const delta = target.getAttribute('data-delta-scale');
      if (delta) {
        clickAction(id);
        const next = Math.max(.01, Number(valueOf('actionScale')) + Number(delta));
        setNumber('actionScale', Number(next.toFixed(3)), 'input');
        await refreshCard(dialog, id);
      }
      if (target.classList.contains('direction-refresh')) await refreshCard(dialog, id);
    }
    if (target.closest('.direction-refresh-all')) {
      const snapshots = await collectSnapshots();
      const grid = dialog.querySelector<HTMLElement>('.direction-grid')!;
      grid.innerHTML = snapshots.map(card).join('');
    }
  });
}

function installKeyboardShortcuts() {
  document.addEventListener('keydown', event => {
    if ((event.target as HTMLElement)?.matches('input, textarea, select')) return;
    if (event.key === '1') document.querySelector<HTMLButtonElement>('[data-manual-tool="connected-delete"]')?.click();
    if (event.key === '2') document.querySelector<HTMLButtonElement>('[data-manual-tool="magic-wand"]')?.click();
    if (event.key === '3') document.querySelector<HTMLButtonElement>('[data-manual-tool="eraser"]')?.click();
    if (event.key === 'Delete') document.querySelector<HTMLButtonElement>('#deleteMagicSelection')?.click();
    if (event.key === 'Escape') document.querySelector<HTMLButtonElement>('#clearMagicSelection')?.click();
  });
}

function install() {
  const topActions = document.querySelector<HTMLElement>('.top-actions');
  if (!topActions || document.querySelector('#directionCalibration')) return;

  const openButton = document.createElement('button');
  openButton.className = 'btn ghost';
  openButton.id = 'directionCalibration';
  openButton.textContent = '四向校准';
  topActions.prepend(openButton);

  const dialog = document.createElement('dialog');
  dialog.id = 'directionCalibrationDialog';
  dialog.innerHTML = `<div class="direction-shell">
    <header class="direction-header">
      <div><h2>四方向动作校准</h2><p>四个方向共用同一视觉基准线；直接调整 Action Scale 与动作偏移。</p></div>
      <div><button class="btn small direction-refresh-all">刷新全部</button><button class="btn small direction-close">关闭</button></div>
    </header>
    <div class="direction-grid"></div>
    <footer>快捷键：1 连通删除 · 2 魔棒 · 3 橡皮 · Delete 删除魔棒选区 · Esc 取消选区</footer>
  </div>`;
  document.body.appendChild(dialog);
  bindDialog(dialog);
  openButton.onclick = () => openCalibration(dialog);
  installKeyboardShortcuts();
}

waitForFactory().then(install);
