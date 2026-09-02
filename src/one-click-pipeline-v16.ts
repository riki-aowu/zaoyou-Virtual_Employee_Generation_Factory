const pick = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);

function clickButton(id: string) {
  const button = pick<HTMLButtonElement>(`#${id}`);
  if (!button || button.disabled) return false;
  button.click();
  return true;
}

function waitFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

function waitForAutoSlice(timeout = 10000) {
  const status = pick<HTMLElement>('#autoSliceStatus');
  if (!status) return Promise.resolve(true);
  if (status.textContent?.startsWith('✓')) return Promise.resolve(true);
  return new Promise<boolean>(resolve => {
    const started = performance.now();
    const check = () => {
      const text = status.textContent || '';
      if (text.startsWith('✓')) return resolve(true);
      if (text.startsWith('⚠')) return resolve(false);
      if (performance.now() - started >= timeout) return resolve(false);
      requestAnimationFrame(check);
    };
    check();
  });
}

async function runPipeline() {
  const button = pick<HTMLButtonElement>('#oneClickPipeline');
  const status = pick<HTMLElement>('#pipelineStatus');
  if (button) button.disabled = true;

  try {
    if (status) status.textContent = '1/5 自动识别切片…';
    const detected = clickButton('autoDetectSlices') ? await waitForAutoSlice() : true;
    if (!detected) throw new Error('自动切片未通过，请先修正切片后再继续。');

    if (status) status.textContent = '2/5 自动采样背景…';
    clickButton('autoSample');
    await waitFrame();

    if (status) status.textContent = '3/5 抠图与边缘清理…';
    clickButton('cleanFringe');
    await waitFrame();

    if (status) status.textContent = '4/5 建立统一角色基准…';
    const baseline = pick<HTMLButtonElement>('#establishBaseline');
    if (baseline && !baseline.disabled) baseline.click();
    await waitFrame();

    if (status) status.textContent = '5/5 刷新预览与 QA…';
    const view = document.querySelector<HTMLButtonElement>('[data-view="character"]');
    view?.click();
    await waitFrame();

    if (status) status.textContent = '✓ 当前动作处理完成，请检查 QA 红 / 黄项';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (status) status.textContent = `⚠ ${message}`;
    alert(message);
  } finally {
    if (button) button.disabled = false;
  }
}

function installPipelineUi() {
  if (pick('#oneClickPipeline')) return;
  const mediaInput = pick<HTMLInputElement>('#mediaInput');
  const section = mediaInput?.closest('.section');
  if (!section) return;

  const box = document.createElement('div');
  box.style.marginTop = '10px';
  box.innerHTML = `
    <button class="btn primary" id="oneClickPipeline" style="width:100%">✨ 一键处理当前动作</button>
    <div class="hint" id="pipelineStatus" style="margin-top:6px">自动切片 → 背景采样 → 去边 → 统一基准 → QA</div>
  `;
  section.appendChild(box);
  pick<HTMLButtonElement>('#oneClickPipeline')!.onclick = () => void runPipeline();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installPipelineUi, { once: true });
else installPipelineUi();
