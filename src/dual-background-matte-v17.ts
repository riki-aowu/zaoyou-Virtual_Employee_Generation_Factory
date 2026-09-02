const dq = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector);

type RGB = [number, number, number];

function fileCanvas(file: File) {
  return createImageBitmap(file).then(bitmap => {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas;
  });
}

function sampleCorners(image: ImageData): RGB {
  const { width, height, data } = image;
  const points = [0, width - 1, (height - 1) * width, width * height - 1];
  const values = points.map(p => {
    const i = p * 4;
    return [data[i], data[i + 1], data[i + 2]] as RGB;
  });
  return [0, 1, 2].map(ch => Math.round(values.reduce((sum, value) => sum + value[ch], 0) / values.length)) as RGB;
}

function hex(rgb: RGB) {
  return `#${rgb.map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

function reconstruct(a: HTMLCanvasElement, b: HTMLCanvasElement, alphaCutoff: number) {
  if (a.width !== b.width || a.height !== b.height) throw new Error('两张图尺寸必须完全一致。');
  const ca = a.getContext('2d', { willReadFrequently: true })!;
  const cb = b.getContext('2d', { willReadFrequently: true })!;
  const ia = ca.getImageData(0, 0, a.width, a.height);
  const ib = cb.getImageData(0, 0, b.width, b.height);
  const bgA = sampleCorners(ia);
  const bgB = sampleCorners(ib);
  const deltaBg = [bgA[0] - bgB[0], bgA[1] - bgB[1], bgA[2] - bgB[2]];
  const denom = deltaBg.reduce((sum, value) => sum + value * value, 0);
  if (denom < 900) throw new Error('两张图的背景颜色太接近。请使用差异明显的两种纯色背景，例如白底 + 黑底。');

  const out = document.createElement('canvas');
  out.width = a.width;
  out.height = a.height;
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  const image = ctx.createImageData(out.width, out.height);

  for (let p = 0; p < out.width * out.height; p++) {
    const i = p * 4;
    const dc = [ia.data[i] - ib.data[i], ia.data[i + 1] - ib.data[i + 1], ia.data[i + 2] - ib.data[i + 2]];
    const transmission = Math.max(0, Math.min(1, dc.reduce((sum, value, ch) => sum + value * deltaBg[ch], 0) / denom));
    let alpha = 1 - transmission;
    if (alpha * 255 < alphaCutoff) alpha = 0;
    if (alpha <= .001) {
      image.data[i + 3] = 0;
      continue;
    }
    for (let ch = 0; ch < 3; ch++) {
      const foreground = (ia.data[i + ch] - (1 - alpha) * bgA[ch]) / alpha;
      image.data[i + ch] = Math.max(0, Math.min(255, Math.round(foreground)));
    }
    image.data[i + 3] = Math.round(alpha * 255);
  }
  ctx.putImageData(image, 0, 0);
  return { canvas: out, bgA, bgB };
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('透明 PNG 生成失败。')), 'image/png'));
}

function install() {
  const cleanup = dq('#cleanFringe')?.closest<HTMLElement>('.section');
  if (!cleanup || dq('#dualMatteOpen')) return requestAnimationFrame(install);

  const open = document.createElement('button');
  open.id = 'dualMatteOpen';
  open.className = 'btn small';
  open.style.width = '100%';
  open.style.marginTop = '8px';
  open.textContent = '双背景高精度去背';
  cleanup.appendChild(open);

  const dialog = document.createElement('dialog');
  dialog.id = 'dualMatteDialog';
  dialog.innerHTML = `
    <div class="dual-matte-shell">
      <header><div><span>DUAL BACKGROUND MATTE</span><h2>双背景高精度去背</h2><p>同一个角色分别放在两种纯色背景上，利用两次颜色差反推出透明度。适合白发、毛边与浅色服装。</p></div><button class="btn small" data-dual-close>关闭</button></header>
      <div class="dual-matte-inputs">
        <label><b>背景版本 A</b><small>例如白底</small><input id="dualMatteA" type="file" accept="image/png,image/webp,image/jpeg"></label>
        <label><b>背景版本 B</b><small>例如黑底</small><input id="dualMatteB" type="file" accept="image/png,image/webp,image/jpeg"></label>
      </div>
      <div class="dual-matte-control"><label>弱透明阈值 <input id="dualMatteThreshold" type="range" min="0" max="80" value="10"><output id="dualMatteThresholdOut">10</output></label><span id="dualMatteBgReadout">等待两张同尺寸图片</span></div>
      <div class="dual-matte-preview"><canvas id="dualMattePreview"></canvas><div id="dualMatteEmpty">生成后可在透明棋盘格上检查边缘</div></div>
      <footer><button class="btn primary" id="dualMatteRun">生成透明结果</button><button class="btn" id="dualMatteSend" disabled>送回当前动作继续处理</button><button class="btn" id="dualMatteDownload" disabled>单独保存 PNG</button></footer>
    </div>`;
  document.body.appendChild(dialog);

  let result: HTMLCanvasElement | null = null;
  const threshold = dq<HTMLInputElement>('#dualMatteThreshold')!;
  threshold.oninput = () => { dq('#dualMatteThresholdOut')!.textContent = threshold.value; };
  dialog.querySelector<HTMLButtonElement>('[data-dual-close]')!.onclick = () => dialog.close();
  open.onclick = () => dialog.showModal();

  dq<HTMLButtonElement>('#dualMatteRun')!.onclick = () => void (async () => {
    try {
      const fa = dq<HTMLInputElement>('#dualMatteA')!.files?.[0];
      const fb = dq<HTMLInputElement>('#dualMatteB')!.files?.[0];
      if (!fa || !fb) throw new Error('请同时选择 A / B 两张背景版本。');
      const [a, b] = await Promise.all([fileCanvas(fa), fileCanvas(fb)]);
      const rebuilt = reconstruct(a, b, Number(threshold.value));
      result = rebuilt.canvas;
      dq('#dualMatteBgReadout')!.textContent = `检测背景：A ${hex(rebuilt.bgA)} · B ${hex(rebuilt.bgB)}`;
      const preview = dq<HTMLCanvasElement>('#dualMattePreview')!;
      preview.width = result.width;
      preview.height = result.height;
      preview.getContext('2d')!.drawImage(result, 0, 0);
      dq('#dualMatteEmpty')!.hidden = true;
      dq<HTMLButtonElement>('#dualMatteSend')!.disabled = false;
      dq<HTMLButtonElement>('#dualMatteDownload')!.disabled = false;
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    }
  })();

  dq<HTMLButtonElement>('#dualMatteDownload')!.onclick = () => void (async () => {
    if (!result) return;
    const blob = await canvasBlob(result);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dual-background-matte.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1200);
  })();

  dq<HTMLButtonElement>('#dualMatteSend')!.onclick = () => void (async () => {
    if (!result) return;
    const blob = await canvasBlob(result);
    const file = new File([blob], 'dual-background-matte.png', { type: 'image/png' });
    const media = dq<HTMLInputElement>('#mediaInput');
    if (!media) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    media.files = dt.files;
    media.dispatchEvent(new Event('change', { bubbles: true }));
    dialog.close();
  })();
}

install();
