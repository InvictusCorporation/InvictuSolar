import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { openStore } from './src/store.mjs';
import { DomainError, calculate, publicCompany, publicItem, validateCompany, validateItem } from './src/solar.mjs';
import { integrations } from './src/adapters.mjs';
import { documentHtml } from './src/document.mjs';
import { generatePdf } from './src/pdf.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = c => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const decimal = n => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const hashOf = obj => createHash('sha256').update(JSON.stringify(obj)).digest('hex');

export function createApplication({ databasePath = join(root, 'data', 'demo.sqlite'), sessionTtlMs = 8 * 3600000 } = {}) {
  if (process.env.NODE_ENV === 'production') throw new Error('Adaptador demonstrativo: execução em produção bloqueada. Integre autenticação, banco e permissões antes de habilitar produção.');
  const store = openStore(databasePath);
  const sessions = new Map();
  const shareCsrfSecret = randomBytes(32).toString('hex');
  const frozenHtml = (tenant, v) => store.document(tenant, v.id)?.html || printDocument(v);
  const pdfResponse = async (res, html, number) => {
    try { const pdf = await generatePdf(html); res.writeHead(200, {'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${number}.pdf"`}); res.end(pdf); }
    catch(e) { throw new DomainError(e.status === 429 ? e.message : 'Geração de PDF indisponível. Use a impressão do navegador ou configure SOLAR_PDF_BROWSER.', e.status || 503); }
  };
  const assets = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/commercial-ui.js': ['commercial-ui.js', 'text/javascript; charset=utf-8'], '/share.js': ['share.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'] };
  const server = http.createServer(async (req, res) => {
    const host = req.headers.host || '';
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) { res.writeHead(403); res.end('Somente homologação local.'); return; }
    const base = `http://${host}`;
    const url = new URL(req.url, base);
    const headers = {
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      'X-Frame-Options': 'DENY',
    };
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    const send = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    const body = async () => {
      let size = 0, text = '';
      for await (const chunk of req) { size += chunk.length; if (size > 1048576) throw new DomainError('Requisição muito grande.', 413); text += chunk; }
      try { const data = JSON.parse(text || '{}'); if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error(); return data; } catch { throw new DomainError('JSON inválido.', 400); }
    };
    try {
      const mutating = !['GET', 'HEAD'].includes(req.method);
      if (mutating && req.headers.origin !== base) throw new DomainError('Origem da requisição inválida.', 403);
      const cookie = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('solar_session='))?.split('=')[1];
      let session = sessions.get(cookie);
      if (session && session.expires < Date.now()) { sessions.delete(cookie); session = null; }
      if (req.method === 'GET' && assets[url.pathname]) {
        const [file, type] = assets[url.pathname]; res.writeHead(200, { 'Content-Type': type }); res.end(readFileSync(join(root, 'public', file))); return;
      }
      const shared = url.pathname.match(/^\/s\/([a-f0-9]{64})(\/pdf|\/reading)?$/);
      if (shared && ['GET','POST'].includes(req.method)) {
        const token=shared[1], link=store.resolveLink(hashOf(token));
        if (!link) throw new DomainError('Link inválido, expirado ou revogado.',404);
        const v=store.version(link.tenant_id,link.version_id);
        const shareCsrf=hashOf(shareCsrfSecret+token);
        if (req.method==='POST' && shared[2]==='/reading') {
          const data=await body();
          if (data.csrf!==shareCsrf || data.acknowledged!==true) throw new DomainError('Recarregue o documento e confirme a ciência de leitura.',403);
          if (typeof data.name!=='string' || !data.name.trim() || data.name.length>150 || typeof data.identification!=='string' || !data.identification.trim() || data.identification.length>150) throw new DomainError('Informe nome e identificação de demonstração, até 150 caracteres.');
          store.transaction(()=>{ store.reading(link.tenant_id,v.id,link.id,data.name.trim(),data.identification.trim(),v.hash); store.audit(link.tenant_id,'link','document.reading.declared',v.id); });
          return send({ok:true,message:'Ciência de leitura demonstrativa registrada. Não é aceite comercial ou assinatura digital.',versionHash:v.hash});
        }
        if(req.method!=='GET') throw new DomainError('Recurso não encontrado.',404);
        if(shared[2]==='/pdf') { store.audit(link.tenant_id,'link','document.pdf.requested',v.id); return await pdfResponse(res,frozenHtml(link.tenant_id,v),v.number); }
        if(shared[2]) throw new DomainError('Recurso não encontrado.',404);
        const form=`<section class="reading-form"><h2>Ciência de leitura · demonstração</h2><p>Identificação autodeclarada. Não é assinatura, aceite comercial ou prova de identidade. Não informe dados pessoais reais.</p><form id="reading-form"><label>Nome fictício <input name="name" maxlength="150" required autocomplete="off"></label><label>Identificação de teste <input name="identification" maxlength="150" required autocomplete="off"></label><label class="check"><input type="checkbox" name="acknowledged" required> Declaro ter lido esta versão demonstrativa e suas pendências.</label><input type="hidden" name="csrf" value="${shareCsrf}"><button>Registrar ciência de leitura</button><p id="reading-status" role="status" aria-live="polite"></p></form><p>Versão ${v.revision} · SHA-256 ${escape(v.hash)} · link local válido até ${escape(link.expires_at)}</p></section><script src="/share.js" type="module"></script>`;
        const html=frozenHtml(link.tenant_id,v).replace(`href="/pdf/${v.id}"`,`href="/s/${token}/pdf"`).replace('</body>',form+'</body>');
        store.audit(link.tenant_id,'link','document.response.served',v.id);
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);return;
      }
      if (req.method === 'GET' && url.pathname === '/api/demo/options') return send({ demo: true, tenants: store.tenants().map(({ id, name }) => ({ id, name })) });
      if (req.method === 'POST' && url.pathname === '/api/demo/session') {
        const data = await body();
        if (!store.company(data.tenantId) || !['admin', 'representative'].includes(data.role)) throw new DomainError('Perfil demonstrativo inválido.');
        if (session && req.headers['x-csrf-token'] !== session.csrf) throw new DomainError('Sessão ativa: recarregue antes de trocar o perfil.', 403);
        if (cookie) sessions.delete(cookie);
        for (const [key, s] of sessions) if (s.expires < Date.now()) sessions.delete(key);
        if (sessions.size >= 100) throw new DomainError('Limite de sessões demonstrativas. Tente mais tarde.', 429);
        const token = randomBytes(32).toString('hex');
        session = { tenantId: data.tenantId, role: data.role, csrf: randomBytes(24).toString('hex'), expires: Date.now() + sessionTtlMs };
        sessions.set(token, session);
        res.setHeader('Set-Cookie', `solar_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(sessionTtlMs / 1000)}`);
        return send({ ok: true });
      }
      if (!session) throw new DomainError('Entre com um perfil de demonstração.', 401);
      if (mutating) {
        const received = String(req.headers['x-csrf-token'] || '');
        const expected = session.csrf;
        if (Buffer.byteLength(received) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) throw new DomainError('Sessão desatualizada. Recarregue a página.', 403);
      }
      const tenant = session.tenantId;
      const admin = () => { if (session.role !== 'admin') throw new DomainError('Acesso exclusivo do administrador.', 403); };
      const audit = (action, entity) => store.audit(tenant, session.role, action, entity);
      const company = store.company(tenant);
      const catalog = store.catalog(tenant);
      const authorizeInput = raw => {
        if(session.role!=='representative')return raw;
        const financial={...(raw.financial??{})};
        for(const key of ['tariffIncreasePct','degradationPct','maintenanceAnnual','replacementYear','replacementCost','discountRatePct','years','comparison','environment'])financial[key]=company.financialDefaults?.[key]??null;
        return {...raw,financial};
      };
      if (req.method === 'GET' && url.pathname === '/api/state') return send({
        demo: true, role: session.role, tenantId: tenant, csrf: session.csrf,
        company: session.role === 'admin' ? company : publicCompany(company),
        catalog: session.role === 'admin' ? catalog.map(i => ({ ...i, ...publicItem(i) })) : catalog.map(publicItem),
        proposals: store.proposals(tenant), integrations,
      });
      if (req.method === 'POST' && url.pathname === '/api/logout') {
        sessions.delete(cookie); res.setHeader('Set-Cookie', 'solar_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return send({ ok: true });
      }
      if (req.method === 'PUT' && url.pathname === '/api/company') {
        admin(); const updated = validateCompany(await body());
        store.transaction(() => { store.setCompany(tenant, updated); audit('company.updated', tenant); }); return send(updated);
      }
      if (req.method === 'POST' && url.pathname === '/api/catalog') {
        admin(); const raw = await body(); const item = validateItem(raw);
        if (raw.id && !store.item(tenant, String(raw.id))) throw new DomainError('Item não encontrado.', 404);
        const id = raw.id || randomUUID();
        store.transaction(() => { store.saveItem(tenant, id, item); audit('catalog.saved', id); }); return send({ id }, 201);
      }
      if (req.method === 'POST' && url.pathname === '/api/calculate') return send(calculate(authorizeInput(await body()), company, catalog));
      if (req.method === 'POST' && url.pathname === '/api/proposals') {
        const raw = authorizeInput(await body());
        // Accepted fields only; client-supplied tenant, totals, snapshot and status are ignored.
        const input = Object.fromEntries(['clientName','location','roof','monthlyKwh','hsp','irradiationSource','moduleId','inverterId','extras','discountPct','units','installationAddress','clientDocument','clientEmail','clientPhone','crmClientRef','negotiationNotes','paymentId','financial'].map(k => [k, raw[k]]));
        const result = calculate(input, company, catalog);
        const previous = raw.id ? store.proposal(tenant, String(raw.id)) : null;
        if (raw.id && !previous) throw new DomainError('Proposta não encontrada.', 404);
        const id = previous?.id || randomUUID();
        const proposal = { id, number: previous?.number || `SOL-${Date.now().toString(36).toUpperCase()}-${id.slice(0, 4).toUpperCase()}`, input, result,
          status: 'draft', updatedAt: new Date().toISOString(), revision: previous?.revision || 0 };
        store.transaction(() => { store.saveProposal(tenant, id, proposal); audit('proposal.draft.saved', id); }); return send(proposal, 201);
      }
      const issue = url.pathname.match(/^\/api\/proposals\/([a-z0-9-]+)\/issue$/);
      if (req.method === 'POST' && issue) {
        const proposal = store.proposal(tenant, issue[1]);
        if (!proposal) throw new DomainError('Proposta não encontrada.', 404);
        if (proposal.status === 'issued') return send(store.version(tenant, proposal.versionId));
        // Recalculate using current settings and require explicit review if changed.
        const latest = calculate(proposal.input, company, catalog);
        if (hashOf(latest) !== hashOf(proposal.result)) throw new DomainError('Preços, parâmetros ou validade mudaram. Abra e salve o rascunho novamente para revisar.', 409);
        const data = await body();
        if (data.reviewAcknowledged !== true) throw new DomainError('Confirme ciência da revisão técnica pendente.');
        const versionId = randomUUID();
        const snapshot = { id: versionId, proposalId: proposal.id, number: proposal.number, revision: proposal.revision + 1,
          createdAt: new Date().toISOString(), result: proposal.result, technicalStatus: 'pending', demo: true, rendererVersion:'commercial-v2-compact' };
        const html=documentHtml(snapshot,readFileSync(join(root,'public','document.css'),'utf8'));
        snapshot.documentDigest=hashOf(html);
        const hash = hashOf(snapshot);
        store.transaction(() => {
          store.saveVersion(tenant, proposal.id, versionId, snapshot, hash);
          const finalHtml=html.replace('<span class="document-fingerprint"></span>',`<span class="document-fingerprint">Versão SHA-256: ${hash} · Conteúdo HTML canônico SHA-256(JSON): ${snapshot.documentDigest}</span>`);
          store.saveDocument(tenant,versionId,finalHtml,hashOf(finalHtml));
          store.saveParameters(tenant, versionId, { company, selectedCatalog: catalog.filter(i => proposal.result.lines.some(l => l.itemId === i.id)), formulaVersion: 'commercial-monthly-v2' });
          store.saveProposal(tenant, proposal.id, { ...proposal, status: 'issued', versionId, revision: snapshot.revision });
          audit('proposal.version.issued', versionId);
        });
        return send({ ...snapshot, hash }, 201);
      }
      const versions = url.pathname.match(/^\/api\/proposals\/([a-z0-9-]+)\/versions$/);
      if (req.method === 'GET' && versions) { if (!store.proposal(tenant, versions[1])) throw new DomainError('Proposta não encontrada.', 404); return send(store.versions(tenant, versions[1])); }
      const version = url.pathname.match(/^\/api\/versions\/([a-z0-9-]+)$/);
      if (req.method === 'GET' && version) { const v = store.version(tenant, version[1]); if (!v) throw new DomainError('Versão não encontrada.', 404); return send(v); }
      const linkRoute=url.pathname.match(/^\/api\/versions\/([a-z0-9-]+)\/links$/);
      if(linkRoute) {
        const v=store.version(tenant,linkRoute[1]);if(!v)throw new DomainError('Versão não encontrada.',404);
        if(req.method==='GET')return send({links:store.links(tenant,v.id),readings:store.readings(tenant,v.id)});
        if(req.method==='POST') {
          const data=await body(),hours=Number(data.hours ?? 24);
          if(!Number.isInteger(hours)||hours<1||hours>168)throw new DomainError('Validade do link: 1 a 168 horas.');
          const expires=new Date(Math.min(Date.now()+hours*3600000,Date.parse(v.result.validUntil+'T23:59:59-03:00'))).toISOString();
          if(expires<=new Date().toISOString())throw new DomainError('Proposta vencida; revise e emita nova versão.');
          const token=randomBytes(32).toString('hex'),id=randomUUID();
          store.transaction(()=>{store.createLink(id,tenant,v.id,hashOf(token),expires);audit('document.link.created',v.id);});
          return send({id,url:`${base}/s/${token}`,expiresAt:expires,localOnly:true},201);
        }
      }
      const revoke=url.pathname.match(/^\/api\/links\/([a-z0-9-]+)\/revoke$/);
      if(req.method==='POST'&&revoke){store.transaction(()=>{const change=store.revokeLink(tenant,revoke[1]);if(!change.changes)throw new DomainError('Link não encontrado.',404);audit('document.link.revoked',revoke[1]);});return send({ok:true});}
      const pdf=url.pathname.match(/^\/pdf\/([a-z0-9-]+)$/);
      if(req.method==='GET'&&pdf){const v=store.version(tenant,pdf[1]);if(!v)throw new DomainError('Versão não encontrada.',404);return await pdfResponse(res,frozenHtml(tenant,v),v.number);}
      if (req.method === 'GET' && url.pathname === '/api/audit') { admin(); return send(store.auditList(tenant)); }
      const print = url.pathname.match(/^\/print\/([a-z0-9-]+)$/);
      if (req.method === 'GET' && print) {
        const v = store.version(tenant, print[1]); if (!v) throw new DomainError('Versão não encontrada.', 404);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(frozenHtml(tenant,v)); return;
      }
      throw new DomainError('Recurso não encontrado.', 404);
    } catch (e) { send({ error: e instanceof DomainError ? e.message : 'Falha interna. Nenhuma operação foi confirmada.' }, e instanceof DomainError ? e.status : 500); if (!(e instanceof DomainError)) console.error(e.name, e.message); }
  });
  return { server, store, close: async () => { await new Promise(resolve => server.close(resolve)); store.close(); } };
}

function printDocument(v) {
  const r = v.result, c = r.company;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(v.number)} · proposta solar</title><link rel="stylesheet" href="/style.css"></head><body class="document" style="--brand:${escape(c.color)}"><div class="print-actions"><a href="/">← Voltar ao módulo</a><p>Para exportar: use Ctrl+P e escolha “Salvar como PDF”. Documento de homologação.</p></div><main class="paper">
    <div class="doc-top"><strong>${escape(c.name)}</strong><span>PROPOSTA SOLAR · DEMONSTRAÇÃO</span></div>
    <h1>Energia para<br>um novo horizonte.</h1><p class="doc-client">Preparada para <strong>${escape(r.clientName)}</strong></p><p>${escape(v.number)} · versão ${v.revision} · validade ${escape(r.validUntil.split('-').reverse().join('/'))}</p>
    <div class="doc-notice">ESTIMATIVA PRELIMINAR · Revisão técnica pendente. Sem validade comercial neste ambiente.</div>
    <h2>Uma solução para o seu projeto</h2><p class="preline">${escape(c.presentation)}</p>
    <div class="doc-grid"><div><small>LOCAL DE INSTALAÇÃO</small><b>${escape(r.location)}</b></div><div><small>TELHADO</small><b>${escape(r.roof)}</b></div><div><small>CONSUMO MÉDIO</small><b>${decimal(r.monthlyKwh)} kWh/mês</b></div><div><small>POTÊNCIA INSTALADA</small><b>${decimal(r.installedKwp)} kWp</b></div><div><small>GERAÇÃO ESTIMADA</small><b>${decimal(r.generationMonthlyKwh)} kWh/mês</b></div><div><small>ÁREA DOS MÓDULOS</small><b>${decimal(r.areaM2)} m²</b></div></div>
    <h2>Equipamentos e serviços</h2><table><thead><tr><th>Descrição</th><th>Quantidade</th><th>Unitário</th><th>Total</th></tr></thead><tbody>${r.lines.map(l => `<tr><td>${escape(l.name)}</td><td>${decimal(l.quantity)} ${escape(l.unit)}</td><td>${money(l.unitPriceCents)}</td><td>${money(l.totalCents)}</td></tr>`).join('')}</tbody></table>
    <div class="doc-investment"><div><small>INVESTIMENTO</small><b>${money(r.totalCents)}</b></div><div><small>À VISTA · DESCONTO ${decimal(r.discountPct)}%</small><b>${money(r.cashCents)}</b></div></div>
    <p>Preço por Wp: ${money(r.centsPerWp)} · Prazo proposto: ${r.deliveryDays} dias.</p>
    <h2>Premissas e condições</h2><p>Irradiação manual: ${decimal(r.hsp)} kWh/m²/dia. Fonte/período: ${escape(r.irradiationSource)}.</p><p>${escape(r.estimateMethod)}</p><p class="preline">${escape(c.terms)}</p><ul>${r.pending.map(p => `<li>${escape(p)}</li>`).join('')}</ul>
    <h2>Validação e aceite</h2><p>O aceite digital e a assinatura serão disponibilizados pela integração com a plataforma. Nenhum aceite foi registrado nesta versão.</p>
    <footer>Emitida em ${escape(new Date(v.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' }))} (Fortaleza).<br>SHA-256: <span class="hash">${escape(v.hash)}</span><br>Versão emitida preservada. Dados e valores exclusivamente demonstrativos.</footer></main></body></html>`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = createApplication();
  const port = Number(process.env.SOLAR_PORT || 4180);
  app.server.listen(port, '127.0.0.1', () => console.log(`Invictus Solar · homologação local: http://127.0.0.1:${port}`));
  const shutdown = async () => { await app.close(); process.exit(0); };
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
}
