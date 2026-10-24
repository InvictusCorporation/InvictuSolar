import test from 'node:test';
import assert from 'node:assert/strict';
import { createApplication } from '../server.mjs';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function launch(databasePath = ':memory:') {
  const app = createApplication({ databasePath });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  async function login(tenantId, role) {
    const response = await fetch(`${base}/api/demo/session`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, role }) });
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie').split(';')[0];
    const s = await (await fetch(`${base}/api/state`, { headers: { Cookie: cookie } })).json();
    return {
      state: s, cookie,
      async request(path, method = 'GET', body, overrides = {}) {
        const r = await fetch(base + path, { method, headers: { Cookie: cookie, Origin: base, 'Content-Type': 'application/json', 'X-CSRF-Token': s.csrf, ...overrides }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        const type = r.headers.get('content-type') || '';
        return { status: r.status, data: type.includes('json') ? await r.json() : await r.text() };
      },
    };
  }
  return { ...app, base, login };
}
const proposal = tenant => ({ clientName: 'Cliente <script>alert(1)</script>', location: 'Belém / PA', roof: 'Metálico', monthlyKwh: 1000, hsp: 4.5, irradiationSource: 'Fictícia · testes', moduleId: `${tenant}-panel`, inverterId: `${tenant}-inverter`, extras: [`${tenant}-structure`], discountPct: 5 });

test('links: isolamento, expiração, revogação, ciência de leitura e HTML congelado',async t=>{
  const app=await launch();t.after(()=>app.close());const a=await app.login('demo-a','admin'),b=await app.login('demo-b','admin');
  const draft=(await a.request('/api/proposals','POST',proposal('demo-a'))).data;
  const v=(await a.request(`/api/proposals/${draft.id}/issue`,'POST',{reviewAcknowledged:true})).data;
  const original=(await a.request(`/print/${v.id}`)).data;
  assert.ok(original.includes('Comparação com investimentos.'));assert.ok(original.includes('Aguardando'));
  await a.request('/api/company','PUT',{...a.state.company,presentation:'Conteúdo modificado após emissão'});
  assert.equal((await a.request(`/print/${v.id}`)).data,original);
  assert.equal((await b.request(`/api/versions/${v.id}/links`,'POST',{})).status,404);
  const link=(await a.request(`/api/versions/${v.id}/links`,'POST',{hours:1})).data;
  const response=await fetch(link.url);assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes('Ciência de leitura'));
  const csrf=html.match(/name="csrf" value="([a-f0-9]+)"/)[1];
  const read=await fetch(link.url+'/reading',{method:'POST',headers:{Origin:app.base,'Content-Type':'application/json'},body:JSON.stringify({name:'Leitor fictício',identification:'Teste QA',acknowledged:true,csrf})});assert.equal(read.status,200);
  assert.equal((await a.request(`/api/versions/${v.id}/links`)).data.readings[0].version_hash,v.hash);
  assert.equal((await fetch(link.url+'/reading',{method:'POST',headers:{Origin:app.base,'Content-Type':'application/json'},body:JSON.stringify({name:'A',identification:'B',acknowledged:true,csrf:'bad'})})).status,403);
  assert.equal((await b.request(`/api/links/${link.id}/revoke`,'POST',{})).status,404);
  await a.request(`/api/links/${link.id}/revoke`,'POST',{});assert.equal((await fetch(link.url)).status,404);
  const exp=(await a.request(`/api/versions/${v.id}/links`,'POST',{hours:1})).data;
  app.store.db.prepare('UPDATE share_links SET expires_at=? WHERE id=?').run('2000-01-01T00:00:00Z',exp.id);assert.equal((await fetch(exp.url)).status,404);
  assert.throws(()=>app.store.db.prepare('UPDATE documents SET html=? WHERE version_id=?').run('changed',v.id),/imutável/);
});

test('representante não altera políticas de projeção configuradas pelo administrador',async t=>{
  const app=await launch();t.after(()=>app.close());const a=await app.login('demo-a','admin'),seller=await app.login('demo-a','representative');
  const settings={...a.state.company,financialDefaults:{tariffIncreasePct:4,years:25}};
  assert.equal((await a.request('/api/company','PUT',settings)).status,200);
  const r=await seller.request('/api/calculate','POST',{...proposal('demo-a'),financial:{tariffIncreasePct:99,years:1}});
  assert.equal(r.status,200);assert.equal(r.data.financial.assumptions.tariffIncreasePct,4);assert.equal(r.data.financial.assumptions.years,25);
});

test('API: isolamento real entre empresas, RBAC e proteção de parâmetros', async t => {
  const app = await launch(); t.after(() => app.close());
  const a = await app.login('demo-a','admin'), seller = await app.login('demo-a','representative'), b = await app.login('demo-b','admin');
  assert.equal((await fetch(app.base + '/api/state')).status, 401);
  assert.equal((await seller.request('/api/company','PUT', a.state.company)).status, 403);
  assert.equal((await seller.request('/api/catalog','POST', a.state.catalog[0])).status, 403);
  assert.equal((await seller.request('/api/audit')).status, 403);
  for (const key of ['costCents','markupBps','lossesPct','moduleArea']) assert.equal(JSON.stringify(seller.state).includes(`"${key}"`), false);
  const draft = await a.request('/api/proposals','POST', { ...proposal('demo-a'), tenantId: 'demo-b', result: { totalCents: 1 }, status:'issued' });
  assert.equal(draft.status, 201); assert.equal(draft.data.status, 'draft'); assert.ok(draft.data.result.totalCents > 1);
  assert.equal((await b.request('/api/state')).data.proposals.length, 0);
  assert.equal((await b.request(`/api/proposals/${draft.data.id}/issue`,'POST',{reviewAcknowledged:true})).status, 404);
  assert.equal((await b.request('/api/calculate','POST', proposal('demo-a'))).status, 422);
  assert.equal((await a.request('/api/company','PUT', a.state.company, {'X-CSRF-Token':'bad'})).status, 403);
  assert.equal((await a.request('/api/company','PUT', a.state.company, {'X-CSRF-Token':'á'.repeat(48)})).status, 403);
  assert.equal((await a.request('/api/proposals','POST', proposal('demo-a'), {Origin:'https://evil.example'})).status, 403);
  assert.equal((await a.request('/api/proposals','POST', proposal('demo-a'), {Origin:''})).status, 403);
});
test('API: emissão idempotente, hash verificável, histórico e versão imutável', async t => {
  const app = await launch(); t.after(() => app.close()); const a = await app.login('demo-a','admin'); const b = await app.login('demo-b','admin');
  const draft = (await a.request('/api/proposals','POST',proposal('demo-a'))).data;
  const issued = await a.request(`/api/proposals/${draft.id}/issue`,'POST',{reviewAcknowledged:true});
  assert.equal(issued.status,201); const v = issued.data;
  const { hash, ...snapshot } = v;
  const params = JSON.parse(app.store.db.prepare('SELECT body FROM version_parameters WHERE version_id=? AND tenant_id=?').get(v.id, 'demo-a').body);
  assert.equal(params.company.lossesPct,20);
  assert.ok(params.selectedCatalog[0].costCents > 0);
  assert.equal(JSON.stringify(v).includes('costCents'),false);
  assert.equal(createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),hash);
  const again = await a.request(`/api/proposals/${draft.id}/issue`,'POST',{reviewAcknowledged:true});
  assert.equal(again.data.id,v.id);
  assert.equal((await b.request(`/api/versions/${v.id}`)).status,404);
  assert.equal((await b.request(`/print/${v.id}`)).status,404);
  const print = await a.request(`/print/${v.id}`);
  assert.equal(print.status,200); assert.ok(print.data.includes('&lt;script&gt;')); assert.ok(!print.data.includes('<script>alert(1)</script>'));
  assert.ok(print.data.includes(hash));
  const item = a.state.catalog[0]; await a.request('/api/catalog','POST',{...item,costCents:item.costCents+10000});
  assert.deepEqual((await a.request(`/api/versions/${v.id}`)).data,v);
  const updated = await a.request('/api/proposals','POST',{...proposal('demo-a'),id:draft.id});
  assert.notEqual(updated.data.result.totalCents,v.result.totalCents);
  const second = await a.request(`/api/proposals/${draft.id}/issue`,'POST',{reviewAcknowledged:true});
  assert.equal(second.data.revision,2);
  assert.equal((await a.request(`/api/proposals/${draft.id}/versions`)).data.length,2);
  assert.throws(() => app.store.db.prepare('UPDATE versions SET hash=? WHERE id=?').run('bad',v.id),/imutável/);
});
test('API: mudança de parâmetro após salvar exige nova revisão', async t => {
  const app = await launch(); t.after(() => app.close()); const a = await app.login('demo-a','admin');
  const draft = (await a.request('/api/proposals','POST',proposal('demo-a'))).data;
  await a.request('/api/company','PUT',{...a.state.company,lossesPct:10});
  assert.equal((await a.request(`/api/proposals/${draft.id}/issue`,'POST',{reviewAcknowledged:true})).status,409);
});
test('persistência: proposta e versão sobrevivem ao encerramento e reinício do servidor', async () => {
  const dir = mkdtempSync(join(tmpdir(),'invictus-solar-test-')); const databasePath = join(dir,'test.sqlite');
  let app;
  try {
    app = await launch(databasePath); let a = await app.login('demo-a','admin');
    const draft = (await a.request('/api/proposals','POST',proposal('demo-a'))).data;
    const version = (await a.request(`/api/proposals/${draft.id}/issue`,'POST',{reviewAcknowledged:true})).data;
    await app.close(); app = undefined;
    app = await launch(databasePath); a = await app.login('demo-a','representative');
    const read = await a.request(`/api/versions/${version.id}`);
    assert.equal(read.status,200); assert.deepEqual(read.data,version);
    assert.equal(a.state.proposals[0].id,draft.id);
  } finally { if (app) await app.close(); rmSync(dir,{recursive:true,force:true}); }
});
