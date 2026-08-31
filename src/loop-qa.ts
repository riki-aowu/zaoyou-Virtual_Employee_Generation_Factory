import './loop-qa.css';

type FrameSample = { index: number; data: Uint8ClampedArray };

const waitForFactory = () => new Promise<void>(resolve => {
  const tick = () => document.querySelector<HTMLCanvasElement>('#preview') ? resolve() : requestAnimationFrame(tick);
  tick();
});
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

function pixelDifference(a: Uint8ClampedArray, b: Uint8ClampedArray) {
  const pixels = Math.min(a.length, b.length) / 4;
  if (!pixels) return 0;
  let changed = 0;
  for (let i = 0; i < pixels * 4; i += 4) {
    const delta = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) + Math.abs(a[i + 3] - b[i + 3]);
    if (delta > 72) changed++;
  }
  return changed / pixels;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function captureFrames(): Promise<FrameSample[]> {
  const thumbs = Array.from(document.querySelectorAll<HTMLElement>('#timelineStrip [data-frame]'));
  const preview = document.querySelector<HTMLCanvasElement>('#preview');
  if (!preview || !thumbs.length) return [];

  const showBounds = document.querySelector<HTMLInputElement>('#showBounds');
  const showAnchor = document.querySelector<HTMLInputElement>('#showAnchor');
  const boundsWas = showBounds?.checked ?? false;
  const anchorWas = showAnchor?.checked ?? false;
  if (showBounds?.checked) { showBounds.checked = false; showBounds.dispatchEvent(new Event('change', { bubbles: true })); }
  if (showAnchor?.checked) { showAnchor.checked = false; showAnchor.dispatchEvent(new Event('change', { bubbles: true })); }

  const samples: FrameSample[] = [];
  for (const [index, thumb] of thumbs.entries()) {
    thumb.click();
    await nextFrame();
    const ctx = preview.getContext('2d', { willReadFrequently: true });
    if (ctx) samples.push({ index, data: ctx.getImageData(0, 0, preview.width, preview.height).data });
  }

  if (showBounds) { showBounds.checked = boundsWas; showBounds.dispatchEvent(new Event('change', { bubbles: true })); }
  if (showAnchor) { showAnchor.checked = anchorWas; showAnchor.dispatchEvent(new Event('change', { bubbles: true })); }
  thumbs[0]?.click();
  return samples;
}

function clearTimelineQa() {
  document.querySelectorAll('.thumb.loop-qa-spike').forEach(node => node.classList.remove('loop-qa-spike'));
}

function markSpikes(adjacent: number[], threshold: number) {
  clearTimelineQa();
  adjacent.forEach((value, index) => {
    if (value <= threshold) return;
    document.querySelector<HTMLElement>(`#timelineStrip [data-frame="${index + 1}"]`)?.classList.add('loop-qa-spike');
  });
}

async function runQa(dialog: HTMLDialogElement) {
  const result = dialog.querySelector<HTMLElement>('.loop-qa-result')!;
  result.innerHTML = '<p class="loop-qa-working">正在逐帧检查……</p>';
  const samples = await captureFrames();
  if (samples.length < 2) {
    result.innerHTML = '<p>当前动作至少需要 2 帧才能进行循环检查。</p>';
    return;
  }

  const adjacent = samples.slice(1).map((sample, i) => pixelDifference(samples[i].data, sample.data));
  const seam = pixelDifference(samples[0].data, samples[samples.length - 1].data);
  const typical = median(adjacent);
  const maxAdjacent = Math.max(...adjacent);
  const spikeThreshold = Math.max(.025, typical * 1.8);
  const seamThreshold = Math.max(.04, typical * 1.65);
  const spikeFrames = adjacent.map((value, index) => ({ value, frame: index + 2 })).filter(item => item.value > spikeThreshold);
  const seamStatus = seam <= seamThreshold ? '良好' : seam <= seamThreshold * 1.5 ? '注意' : '明显跳变';
  markSpikes(adjacent, spikeThreshold);

  result.innerHTML = `
    <div class="loop-qa-summary">
      <div><span>帧数</span><strong>${samples.length}</strong></div>
      <div><span>首尾差异</span><strong>${(seam * 100).toFixed(1)}%</strong></div>
      <div><span>典型相邻差异</span><strong>${(typical * 100).toFixed(1)}%</strong></div>
      <div><span>最大相邻差异</span><strong>${(maxAdjacent * 100).toFixed(1)}%</strong></div>
    </div>
    <div class="loop-qa-verdict ${seamStatus === '良好' ? 'good' : seamStatus === '注意' ? 'warn' : 'bad'}">循环接缝：${seamStatus}</div>
    <div class="loop-qa-spikes"><b>异常跳变帧：</b>${spikeFrames.length ? spikeFrames.map(item => `F${String(item.frame).padStart(2, '0')} (${(item.value * 100).toFixed(1)}%)`).join(' · ') : '未发现明显异常'}</div>
    <p class="loop-qa-note">黄色时间轴边框表示相邻画面变化显著。该检查用于筛查 AI 动画突变，不替代人工观看。</p>`;
}

function install() {
  const transport = document.querySelector<HTMLElement>('.transport-row');
  if (!transport || document.querySelector('#loopQaButton')) return;
  const button = document.createElement('button');
  button.id = 'loopQaButton';
  button.className = 'btn';
  button.textContent = '循环 QA';
  transport.appendChild(button);

  const dialog = document.createElement('dialog');
  dialog.id = 'loopQaDialog';
  dialog.innerHTML = `<div class="loop-qa-shell"><header><div><h2>动画循环 QA</h2><p>检测首尾接缝与相邻帧突变。</p></div><button class="btn small loop-qa-close">关闭</button></header><div class="loop-qa-result"></div><div class="loop-qa-actions"><button class="btn primary loop-qa-run">重新检查当前动作</button><button class="btn small loop-qa-clear">清除时间轴标记</button></div></div>`;
  document.body.appendChild(dialog);
  button.onclick = () => { dialog.showModal(); void runQa(dialog); };
  dialog.querySelector<HTMLButtonElement>('.loop-qa-close')!.onclick = () => dialog.close();
  dialog.querySelector<HTMLButtonElement>('.loop-qa-run')!.onclick = () => void runQa(dialog);
  dialog.querySelector<HTMLButtonElement>('.loop-qa-clear')!.onclick = clearTimelineQa;
}

waitForFactory().then(install);
