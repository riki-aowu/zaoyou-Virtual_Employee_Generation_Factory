import JSZip from 'jszip';
import './production-tools-v15.css';

type ClipId = 'idle' | 'walk_down' | 'walk_up' | 'walk_left' | 'walk_right' | 'typing' | 'celebrate' | 'tired';
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector);
let cycleIn = 0;
let cycleOut = 0;
const sourceFiles = new Map<ClipId, File[]>();
const sleepFrame = () => new Promise(requestAnimationFrame);

function activeAction(): ClipId { return (($('#importClip') as HTMLSelectElement | null)?.value || 'idle') as ClipId; }
function activeSlotIndex() { return Number($('.slot-chip.active')?.getAttribute('data-slot') || 0); }
function activeFrameIndex() { const thumbs = Array.from(document.querySelectorAll<HTMLElement>('#timelineStrip .thumb')); return Math.max(0, thumbs.findIndex(item => item.classList.contains('active'))); }
function timelineFrameCount() { return document.querySelectorAll('#timelineStrip .thumb').length; }

function installUndoRedo() {
  const cleanup = $('.manual-cleanup-controls');
  if (!cleanup || $('#manualUndo')) return;
  const row = document.createElement('div');
  row.className = 'row manual-history-row';
  row.innerHTML = '<button class="btn small" id="manualUndo">↶ 撤销本帧精修</button><button class="btn small" id="manualRedo">↷ 重做本帧精修</button>';
  cleanup.prepend(row);
  type Snap = { key: string; data: string };
  const undo: Snap[] = [], redo: Snap[] = [];
  const key = () => `${activeSlotIndex()}:${activeAction()}:${activeFrameIndex()}`;
  let lastKey = '', before = '';
  const capture = () => { const c = $('#preview') as HTMLCanvasElement | null; return c ? c.toDataURL('image/png') : ''; };
  document.addEventListener('pointerdown', event => {
    const t = event.target as HTMLElement;
    if (t.id !== 'preview') return;
    if (!document.querySelector('[data-manual-tool].active-view')) return;
    lastKey = key(); before = capture();
  }, true);
  document.addEventListener('pointerup', event => {
    const t = event.target as HTMLElement;
    if (t.id !== 'preview' || !before || key() !== lastKey) return;
    const after = capture();
    if (after !== before) { undo.push({ key: lastKey, data: before }); if (undo.length > 30) undo.shift(); redo.length = 0; }
    before = '';
  }, true);
  const restore = async (snap: Snap, target: Snap[]) => {
    const [slot, action, frame] = snap.key.split(':');
    document.querySelector<HTMLElement>(`[data-slot="${slot}"]`)?.click(); await sleepFrame();
    document.querySelector<HTMLElement>(`[data-action="${action}"]`)?.click(); await sleepFrame();
    const thumbs = Array.from(document.querySelectorAll<HTMLElement>('#timelineStrip .thumb')); thumbs[Number(frame)]?.click(); await sleepFrame();
    const current = capture();
    target.push({ key: snap.key, data: current });
    const img = new Image(); img.src = snap.data; await img.decode();
    const c = $('#preview') as HTMLCanvasElement; const ctx = c.getContext('2d')!; ctx.clearRect(0,0,c.width,c.height); ctx.drawImage(img,0,0,c.width,c.height);
  };
  $('#manualUndo')?.addEventListener('click', () => { const s = undo.pop(); if (s) void restore(s, redo); });
  $('#manualRedo')?.addEventListener('click', () => { const s = redo.pop(); if (s) void restore(s, undo); });
  document.addEventListener('keydown', event => {
    if ((event.target as HTMLElement)?.matches('input,textarea,select')) return;
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase()==='z') { event.preventDefault(); ($('#manualUndo') as HTMLButtonElement)?.click(); }
    if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase()==='y' || (event.shiftKey && event.key.toLowerCase()==='z'))) { event.preventDefault(); ($('#manualRedo') as HTMLButtonElement)?.click(); }
  });
}

function installCycleRange() {
  const transport = $('.transport');
  if (!transport || $('#cycleRangeTools')) return;
  const block = document.createElement('div');
  block.id = 'cycleRangeTools';
  block.innerHTML = '<div class="subhead">动作周期区间</div><div class="cycle-range-row"><button class="btn small" id="cycleSetIn">设当前帧为 In</button><button class="btn small" id="cycleSetOut">设当前帧为 Out</button></div><div id="cycleRangeStatus" class="hint"></div><button class="btn small cycle-apply" id="cycleApplyRange">仅保留该区间（18人同步）</button>';
  transport.appendChild(block);
  const update = () => { const n = timelineFrameCount(); cycleOut = Math.min(cycleOut || Math.max(0,n-1), Math.max(0,n-1)); const s=$('#cycleRangeStatus'); if(s) s.textContent=n?`保留 ${cycleIn+1}–${cycleOut+1} / ${n} 帧`:'当前动作无帧'; };
  $('#cycleSetIn')?.addEventListener('click',()=>{cycleIn=Math.min(activeFrameIndex(),cycleOut||activeFrameIndex());update();});
  $('#cycleSetOut')?.addEventListener('click',()=>{cycleOut=Math.max(activeFrameIndex(),cycleIn);update();});
  $('#cycleApplyRange')?.addEventListener('click',()=>void (async()=>{ const action=activeAction(), original=activeSlotIndex(); const slotButtons=Array.from(document.querySelectorAll<HTMLElement>('[data-slot]')); for(const b of slotButtons){b.click();await sleepFrame();document.querySelector<HTMLElement>(`[data-action="${action}"]`)?.click();await sleepFrame();for(let i=timelineFrameCount()-1;i>=0;i--){if(i>=cycleIn&&i<=cycleOut)continue;const thumbs=Array.from(document.querySelectorAll<HTMLElement>('#timelineStrip .thumb'));thumbs[i]?.click();$('#deleteFrame')?.click();}}document.querySelector<HTMLElement>(`[data-slot="${original}"]`)?.click();await sleepFrame();document.querySelector<HTMLElement>(`[data-action="${action}"]`)?.click();cycleIn=0;cycleOut=Math.max(0,timelineFrameCount()-1);update();})());
  document.addEventListener('click',e=>{if((e.target as HTMLElement).closest('.thumb,[data-action],[data-slot],#sampleFrames'))setTimeout(update,0);});
  cycleOut=Math.max(0,timelineFrameCount()-1);update();
}

function installProjectZip() {
  const input = $('#mediaInput') as HTMLInputElement | null; const actions=$('.top-actions'); if(!input||!actions||$('#saveProjectZip')) return;
  input.addEventListener('change',()=>{const files=Array.from(input.files||[]);if(files.length)sourceFiles.set(activeAction(),files.map(f=>new File([f],f.name,{type:f.type,lastModified:f.lastModified})));},true);
  const save=document.createElement('button');save.id='saveProjectZip';save.className='btn ghost';save.textContent='保存工程 ZIP';actions.insertBefore(save,$('#exportBatch'));
  save.addEventListener('click',()=>void (async()=>{const zip=new JSZip();const manifest:{schemaVersion:number;sources:{action:ClipId;path:string;name:string;type:string;lastModified:number}[]}={schemaVersion:1,sources:[]};for(const [action,files] of sourceFiles){files.forEach((file,i)=>{const path=`sources/${action}/${String(i+1).padStart(2,'0')}_${file.name.replace(/[\\/:*?"<>|]+/g,'_')}`;zip.file(path,file);manifest.sources.push({action,path,name:file.name,type:file.type,lastModified:file.lastModified});});}zip.file('manifest.json',JSON.stringify(manifest,null,2));zip.file('README.txt','造游社员工像素动画工厂工程包\nsources/ 保留当前会话导入的原始素材，可用于以后重新切片。');const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${(($('#batchId') as HTMLInputElement|null)?.value||'batch_001')}.spriteproj.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);})());
}

function installAtlasNote() {
  const btn=$('#exportBatch');if(!btn||$('#atlasExportHint'))return;const p=document.createElement('div');p.id='atlasExportHint';p.className='hint atlas-export-hint';p.textContent='Atlas 建议：2px padding + 1px edge extrusion；preview 图保留固定格检查。';btn.parentElement?.insertAdjacentElement('afterend',p);
}

function install(){if(!$('#preview'))return requestAnimationFrame(install);installUndoRedo();installCycleRange();installProjectZip();installAtlasNote();}
install();
