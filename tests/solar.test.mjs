import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, unitPrice, publicItem, publicCompany, validateCompany, validateItem } from '../src/solar.mjs';
import { openStore } from '../src/store.mjs';

function fixture() {
  const s = openStore(':memory:');
  const company = s.company('demo-a'), catalog = s.catalog('demo-a');
  s.close();
  return { company, catalog, input: { clientName: 'Cliente de teste', location: 'Castanhal / PA', roof: 'Fibrocimento', monthlyKwh: 5000, hsp: 5.06, irradiationSource: 'Fonte fictícia de teste · 2026', moduleId: 'demo-a-panel', inverterId: 'demo-a-inverter', extras: ['demo-a-structure','demo-a-service'], discountPct: 5 } };
}
test('dimensionamento usa kWp, perdas uma vez, mês médio e módulos inteiros', () => {
  const { input, company, catalog } = fixture();
  const r = calculate(input, company, catalog, new Date('2026-10-23T12:00:00Z'));
  const expectedCount = Math.ceil(5000 / (5.06 * 365.25 / 12 * 0.8) * 1000 / 620);
  assert.equal(r.moduleCount, expectedCount);
  assert.equal(r.installedKwp, expectedCount * .62);
  assert.ok(r.generationMonthlyKwh >= 5000);
  assert.equal(r.lines[2].quantity, expectedCount);
  assert.equal(r.validUntil, '2026-11-07');
  assert.ok(Math.abs(r.generationAnnualKwh - r.generationMonthlyKwh * 12) < .07);
});
test('validade e vencimento de preços respeitam a data de Fortaleza perto da meia-noite UTC',()=>{
  const {input,company,catalog}=fixture();
  const r=calculate(input,company,catalog.map(i=>({...i,validUntil:'2026-10-23'})),new Date('2026-10-24T01:00:00Z'));
  assert.equal(r.validUntil,'2026-11-07');
  assert.throws(()=>calculate(input,company,catalog.map(i=>({...i,validUntil:'2026-10-23'})),new Date('2026-10-24T04:00:00Z')));
});

test('markup sobre custo difere de margem sobre venda; arredondamento em centavos', () => {
  assert.equal(unitPrice({ mode: 'markup', costCents: 10000, markupBps: 2500 }), 12500);
  assert.equal(unitPrice({ mode: 'markup', costCents: 101, markupBps: 2500 }), 126);
  assert.equal(unitPrice({ mode: 'fixed', costCents: 999, saleCents: 177 }), 177);
});
test('desconto é limitado e não aceita valor não finito ou consumo ausente', () => {
  const { input, company, catalog } = fixture();
  for (const patch of [{ discountPct: 6 }, { monthlyKwh: '' }, { monthlyKwh: 'Infinity' }, { hsp: 0 }, { monthlyKwh: true }, { hsp: null }]) {
    assert.throws(() => calculate({ ...input, ...patch }, company, catalog));
  }
  const r = calculate(input, company, catalog);
  assert.equal(r.cashCents, r.totalCents - Math.round(r.totalCents * .05));
});
test('dados públicos excluem custo, markup e perdas internas', () => {
  const { company, catalog } = fixture();
  const p = publicItem(catalog[0]);
  for (const field of ['costCents', 'markupBps', 'mode']) assert.equal(field in p, false);
  assert.equal('lossesPct' in publicCompany(company), false);
});
test('equipamentos de outra empresa e preços vencidos são rejeitados', () => {
  const { input, company, catalog } = fixture();
  assert.throws(() => calculate({ ...input, moduleId: 'demo-b-panel' }, company, catalog));
  assert.throws(() => calculate({ ...input, extras: ['foreign'] }, company, catalog));
  const expired = catalog.map(i => ({ ...i, validUntil: '2026-01-01' }));
  assert.throws(() => calculate(input, company, expired, new Date('2026-10-23')));
});
test('reduzir perdas muda novas estimativas e não modifica o objeto anterior', () => {
  const { input, company, catalog } = fixture();
  const before = calculate(input, company, catalog);
  const frozen = JSON.stringify(before);
  const after = calculate(input, { ...company, lossesPct: 10 }, catalog);
  assert.ok(after.moduleCount < before.moduleCount);
  assert.equal(JSON.stringify(before), frozen);
});
test('configurações não aceitam cor arbitrária, data inexistente ou fração de centavo', () => {
  const { company, catalog } = fixture();
  assert.throws(() => validateCompany({ ...company, color: 'red;'}));
  assert.throws(() => validateItem({ ...catalog[0], validUntil: '2026-02-31' }));
  assert.throws(() => validateItem({ ...catalog[0], costCents: 1.2 }));
});
