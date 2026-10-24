import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
let browserPromise;
async function browser() {
  browserPromise ??= (async()=>{
    for (const file of [process.env.SOLAR_PDF_BROWSER,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean)) {
      try { await access(file); return file; } catch {}
    }
    throw new Error('Configure SOLAR_PDF_BROWSER com o executável Chromium local.');
  })();
  return browserPromise;
}
let generating=false;
export async function generatePdf(html) {
  if (generating) { const e=new Error('Há um PDF em geração. Tente novamente em instantes.');e.status=429;throw e; }
  generating=true;
  let dir;
  try {
    const executable=await browser();
    dir=await mkdtemp(join(tmpdir(),'invictus-solar-pdf-'));
    await writeFile(join(dir,'document.html'),html,'utf8');
    await exec(executable,['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions','--no-pdf-header-footer',`--user-data-dir=${join(dir,'profile')}`,`--print-to-pdf=${join(dir,'document.pdf')}`,pathToFileURL(join(dir,'document.html')).href],{windowsHide:true,timeout:60000,maxBuffer:1024*1024});
    const bytes=await readFile(join(dir,'document.pdf'));
    if (!bytes.subarray(0,5).equals(Buffer.from('%PDF-'))) throw new Error('Arquivo PDF inválido.');
    return bytes;
  } finally { if(dir) await rm(dir,{recursive:true,force:true,maxRetries:4,retryDelay:250}).catch(()=>{});generating=false; }
}
