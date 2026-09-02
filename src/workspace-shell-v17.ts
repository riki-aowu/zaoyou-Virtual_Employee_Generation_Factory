import './workspace-shell-v17.css';

type Workbench = 'home' | 'quick' | 'slice' | 'cleanup' | 'motion' | 'export';

type WorkbenchSpec = {
  id: Exclude<Workbench, 'home'>;
  icon: string;
  title: string;
  short: string;
  description: string;
  coach: string;
};

const specs: WorkbenchSpec[] = [
  {
    id: 'quick',
    icon: '✦',
    title: '快速生产',
    short: '快速生产',
    description: '导入一批素材，自动识别 18 人、抠图、统一比例并检查 QA。',
    coach: '先导入当前动作素材，再点「一键处理当前动作」。自动切片失败时再进入切片工作台微调。',
  },
  {
    id: 'slice',
    icon: '⌗',
    title: '切片与导入',
    short: '切片',
    description: '自动识别人位；必要时手工拖框、建立动作专用切片。',
    coach: '这里只处理「人在哪里」。自动识别后检查 18 / 18；有特殊动作时再建立 Override。',
  },
  {
    id: 'cleanup',
    icon: '◫',
    title: '抠图精修',
    short: '精修',
    description: '去底、去白边、魔棒、硬边橡皮擦、放大检查与画布平移。',
    coach: '先用算法清理，再进入标准画布做局部精修。4× 检查时可拖动画布，不必盯着角色大脸。',
  },
  {
    id: 'motion',
    icon: '↗',
    title: '动画与方向',
    short: '动画',
    description: 'Canonical、锚点、四向校准、动作缩放、帧区间和循环 QA。',
    coach: '先锁批次统一基准，再校准四方向。时间轴只负责动作帧，角色站立基准不要逐帧乱改。',
  },
  {
    id: 'export',
    icon: '⇩',
    title: '检查与导出',
    short: '导出',
    description: '集中检查 QA，保存工程、批次状态和游戏 Atlas。',
    coach: '红色 QA 项先修；工程 ZIP 用于继续编辑，游戏资源 ZIP 用于进入造游社。',
  },
];

const qs = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector);
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

function waitForFactory() {
  return new Promise<void>(resolve => {
    const tick = () => qs('.shell') && qs('#preview') ? resolve() : requestAnimationFrame(tick);
    tick();
  });
}

function getSections(side: 'left' | 'right') {
  const selector = side === 'left' ? '.sidebar:not(.right) > .section' : '.sidebar.right > .section';
  return Array.from(document.querySelectorAll<HTMLElement>(selector));
}

const sectionMatrix: Record<Exclude<Workbench, 'home'>, { left: number[]; right: number[]; timeline: boolean }> = {
  quick: { left: [0, 2], right: [0, 4], timeline: false },
  slice: { left: [0, 1, 2], right: [0], timeline: false },
  cleanup: { left: [2, 3, 4], right: [0, 1, 4, 5], timeline: true },
  motion: { left: [2, 4], right: [0, 1, 2, 3, 4, 5], timeline: true },
  export: { left: [0], right: [4], timeline: false },
};

function setSectionVisibility(mode: Exclude<Workbench, 'home'>) {
  const matrix = sectionMatrix[mode];
  getSections('left').forEach((section, index) => {
    section.hidden = !matrix.left.includes(index);
    if (!section.hidden) section.classList.remove('collapsed');
  });
  getSections('right').forEach((section, index) => {
    section.hidden = !matrix.right.includes(index);
    if (!section.hidden) section.classList.remove('collapsed');
  });
  const timeline = qs<HTMLElement>('.timeline');
  if (timeline) timeline.hidden = !matrix.timeline;
}

function actionNode(selector: string) {
  const node = qs<HTMLElement>(selector);
  if (!node) return null;
  return node.tagName === 'INPUT' ? node.closest<HTMLElement>('label') : node;
}

function setTopActions(mode: Workbench) {
  const visibility: Record<string, Workbench[]> = {
    '#styleGuide': ['home', 'quick'],
    '#newBatch': ['home', 'quick', 'slice'],
    '#openBatch': ['home', 'quick'],
    '#saveBatch': ['quick', 'slice', 'cleanup', 'motion', 'export'],
    '#saveProjectZip': ['export'],
    '#openProjectFull': ['home', 'export'],
    '#exportBatch': ['export'],
    '#directionCalibration': ['motion'],
  };
  Object.entries(visibility).forEach(([selector, modes]) => {
    const node = actionNode(selector);
    if (node) node.hidden = !modes.includes(mode);
  });
}

function setPreferredView(mode: Exclude<Workbench, 'home'>) {
  const id = mode === 'slice' || mode === 'quick' ? 'batch' : 'character';
  document.querySelector<HTMLButtonElement>(`[data-view="${id}"]`)?.click();
}

function updateHomeStats() {
  const slots = qs('#slotSummary')?.textContent?.trim() || '0 / 18';
  const action = qs<HTMLElement>('[data-action].active b')?.textContent?.trim() || '待机';
  const batch = qs<HTMLInputElement>('#batchId')?.value?.trim() || 'batch_001';
  const slotStat = qs('#factoryHomeSlotStat');
  const actionStat = qs('#factoryHomeActionStat');
  const batchStat = qs('#factoryHomeBatchStat');
  if (slotStat) slotStat.textContent = slots;
  if (actionStat) actionStat.textContent = action;
  if (batchStat) batchStat.textContent = batch;
}

function createHome(shell: HTMLElement) {
  const home = document.createElement('section');
  home.id = 'factoryHome';
  home.className = 'factory-home';
  home.innerHTML = `
    <div class="factory-home-inner">
      <header class="factory-home-hero">
        <div>
          <span class="factory-kicker">ZAOYOU · EMPLOYEE ASSET PIPELINE</span>
          <h1>员工像素动画工厂</h1>
          <p>从任务进入工具，不再把切片、抠图、锚点、动画和导出全部挤在同一张操作台上。</p>
        </div>
        <div class="factory-home-stats">
          <div><span>批次</span><strong id="factoryHomeBatchStat">batch_001</strong></div>
          <div><span>已处理角色</span><strong id="factoryHomeSlotStat">0 / 18</strong></div>
          <div><span>当前动作</span><strong id="factoryHomeActionStat">待机</strong></div>
        </div>
      </header>
      <div class="factory-flow" aria-label="生产流程">
        <span>导入</span><i>→</i><span>自动切片</span><i>→</i><span>抠图</span><i>→</i><span>统一锚点</span><i>→</i><span>动画 QA</span><i>→</i><span>导出</span>
      </div>
      <div class="factory-home-grid">
        ${specs.map((spec, index) => `
          <button type="button" class="factory-module-card ${index === 0 ? 'primary-module' : ''}" data-open-workbench="${spec.id}">
            <span class="factory-module-icon">${spec.icon}</span>
            <span class="factory-module-copy"><b>${spec.title}</b><small>${spec.description}</small></span>
            <span class="factory-module-arrow">↗</span>
          </button>`).join('')}
      </div>
      <footer class="factory-home-foot">
        <span>建议：普通批次先走「快速生产」，只有出错的环节再进入专用工作台。</span>
        <span><kbd>B</kbd> 从任意工作台返回这里</span>
      </footer>
    </div>`;
  shell.insertBefore(home, qs('.workspace'));
  return home;
}

function createWorkbenchNav(topbar: HTMLElement) {
  const nav = document.createElement('div');
  nav.id = 'factoryWorkbenchNav';
  nav.className = 'factory-workbench-nav';
  nav.innerHTML = `
    <button type="button" class="factory-back" id="factoryBackHome" title="返回工具首页（B）">←</button>
    <div class="factory-current-tool"><span>工作台</span><strong id="factoryWorkbenchTitle">快速生产</strong></div>
    <div class="factory-workbench-switcher">
      ${specs.map(spec => `<button type="button" data-workbench-switch="${spec.id}" title="${spec.title}">${spec.short}</button>`).join('')}
    </div>`;
  const brand = topbar.querySelector('.brand');
  brand?.insertAdjacentElement('afterend', nav);
  return nav;
}

function createCoach(stage: HTMLElement) {
  const coach = document.createElement('aside');
  coach.id = 'factoryCoach';
  coach.className = 'factory-coach';
  stage.appendChild(coach);
  return coach;
}

function createExportCenter(stage: HTMLElement) {
  const center = document.createElement('section');
  center.id = 'factoryExportCenter';
  center.className = 'factory-export-center';
  center.innerHTML = `
    <header><span>FINALIZE</span><h2>检查与导出</h2><p>把“继续编辑”和“进游戏”分开。不要拿最终游戏包当工程备份。</p></header>
    <div class="factory-export-grid">
      <button data-export-trigger="#saveProjectZip"><b>工程 ZIP</b><small>保存完整处理状态，之后继续修切片、抠图和对齐。</small><em>推荐备份</em></button>
      <button data-export-trigger="#saveBatch"><b>批次 JSON</b><small>保存当前批次参数、帧、Mask、缩放和参考设置。</small><em>轻量状态</em></button>
      <button data-export-trigger="#exportBatch" class="export-game"><b>造游社游戏资源</b><small>导出 18 人 Atlas + JSON，并自动做 padding / edge extrusion。</small><em>进入游戏</em></button>
      <button data-export-trigger="#saveLayout"><b>切片模板</b><small>只保存 18 人切片布局，适合后续同规格动作复用。</small><em>复用布局</em></button>
    </div>`;
  stage.appendChild(center);
  center.querySelectorAll<HTMLButtonElement>('[data-export-trigger]').forEach(button => {
    button.onclick = () => {
      const selector = button.dataset.exportTrigger;
      if (!selector) return;
      const target = qs<HTMLElement>(selector);
      if (!target) return alert('对应导出功能尚未加载，请刷新页面后重试。');
      target.click();
    };
  });
  return center;
}

function refreshCoach(mode: Exclude<Workbench, 'home'>) {
  const coach = qs('#factoryCoach');
  const spec = specs.find(item => item.id === mode);
  if (!coach || !spec) return;
  coach.innerHTML = `<b>${spec.icon} ${spec.title}</b><span>${spec.coach}</span>`;
}

function refreshModeUi(mode: Workbench) {
  const shell = qs<HTMLElement>('.shell');
  const home = qs<HTMLElement>('#factoryHome');
  const nav = qs<HTMLElement>('#factoryWorkbenchNav');
  if (!shell || !home || !nav) return;
  shell.dataset.workbench = mode;
  home.hidden = mode !== 'home';
  nav.hidden = mode === 'home';

  if (mode === 'home') {
    const timeline = qs<HTMLElement>('.timeline');
    if (timeline) timeline.hidden = true;
    getSections('left').forEach(section => section.hidden = false);
    getSections('right').forEach(section => section.hidden = false);
    setTopActions('home');
    updateHomeStats();
    return;
  }

  const spec = specs.find(item => item.id === mode)!;
  const title = qs('#factoryWorkbenchTitle');
  if (title) title.textContent = spec.title;
  document.querySelectorAll<HTMLButtonElement>('[data-workbench-switch]').forEach(button => {
    button.classList.toggle('active', button.dataset.workbenchSwitch === mode);
  });
  setSectionVisibility(mode);
  setTopActions(mode);
  setPreferredView(mode);
  refreshCoach(mode);
  sessionStorage.setItem('zaoyou-last-workbench', mode);
}

async function activate(mode: Workbench) {
  refreshModeUi(mode);
  await nextFrame();
  if (mode === 'motion') qs<HTMLButtonElement>('#directionCalibration')?.classList.add('factory-highlight-action');
}

function install() {
  const shell = qs<HTMLElement>('.shell');
  const topbar = qs<HTMLElement>('.topbar');
  const stage = qs<HTMLElement>('.stage');
  if (!shell || !topbar || !stage || qs('#factoryHome')) return;

  const brandSmall = topbar.querySelector<HTMLElement>('.brand small');
  if (brandSmall) brandSmall.textContent = 'Asset Pipeline v1.7';

  const home = createHome(shell);
  const nav = createWorkbenchNav(topbar);
  createCoach(stage);
  createExportCenter(stage);

  home.querySelectorAll<HTMLButtonElement>('[data-open-workbench]').forEach(button => {
    button.onclick = () => void activate(button.dataset.openWorkbench as Workbench);
  });
  nav.querySelector<HTMLButtonElement>('#factoryBackHome')!.onclick = () => void activate('home');
  nav.querySelectorAll<HTMLButtonElement>('[data-workbench-switch]').forEach(button => {
    button.onclick = () => void activate(button.dataset.workbenchSwitch as Workbench);
  });

  document.addEventListener('keydown', event => {
    if (event.code !== 'KeyB' || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
    if (document.querySelector('dialog[open]')) return;
    if (shell.dataset.workbench && shell.dataset.workbench !== 'home') {
      event.preventDefault();
      void activate('home');
    }
  });

  const observer = new MutationObserver(updateHomeStats);
  const summary = qs('#slotSummary');
  if (summary) observer.observe(summary, { childList: true, subtree: true, characterData: true });
  qs<HTMLInputElement>('#batchId')?.addEventListener('input', updateHomeStats);
  document.addEventListener('click', event => {
    if ((event.target as HTMLElement | null)?.closest('[data-action],[data-slot]')) setTimeout(updateHomeStats, 0);
  });

  refreshModeUi('home');
}

waitForFactory().then(() => requestAnimationFrame(install));
