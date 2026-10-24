// Commercial scenarios are explicit inputs, never live tariffs or bank offers.
import { DomainError, number, string, round } from './solar.mjs';

const optionalText = (v, label, max = 2000) => string(v ?? '', label, max, false);
const numeric = (raw, key, min, max, fallback) => number(raw[key] ?? fallback, key, min, max);
const financialNames={tariff:'tarifa final variável',simultaneousPct:'simultaneidade',compensationPct:'fração compensável do excedente',fioB:'componente Fio B',fioBPct:'percentual de cobrança do Fio B',taxesMonthly:'tributos fixos adicionais',publicLightingMonthly:'iluminação pública',availabilityMonthly:'piso de disponibilidade',otherResidualMonthly:'outros encargos residuais',tariffIncreasePct:'reajuste anual da tarifa',degradationPct:'degradação anual',maintenanceAnnual:'manutenção anual',replacementYear:'ano da substituição',replacementCost:'custo da substituição',discountRatePct:'taxa de desconto',years:'horizonte',source:'fonte das premissas',startDate:'data-base'};
export function commercialSettings(raw = {}) {
  const text = {};
  for (const key of ['legalName','cnpj','address','phone','email','website','mission','vision','values','differentials','services','partners','warranties','responsibilities','exclusions','conclusion']) text[key] = optionalText(raw[key], key, key === 'cnpj' ? 30 : 2000);
  const logoData = optionalText(raw.logoData, 'Logo', 500000);
  if (logoData && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logoData)) throw new DomainError('Logo: envie PNG, JPEG ou WebP de até 350 KB.');
  const paymentPlans = raw.paymentPlans ?? [];
  if (!Array.isArray(paymentPlans) || paymentPlans.length > 12) throw new DomainError('Informe até 12 condições de financiamento.');
  const plans = paymentPlans.map((p, i) => ({
    id: string(p.id ?? `plan-${i + 1}`, 'Identificador', 60),
    name: string(p.name, 'Instituição / condição', 120), enabled: p.enabled === true,
    months: number(p.months, 'Prazo do financiamento', 1, 360, true),
    monthlyRatePct: number(p.monthlyRatePct, 'Juros mensais', 0, 10),
    downPct: number(p.downPct, 'Entrada', 0, 100),
    feeCents: number(p.feeCents, 'Tarifas financiadas', 0, 100000000, true),
    method: ['PRICE','SAC'].includes(p.method) ? p.method : (() => { throw new DomainError('Amortização: selecione PRICE ou SAC.'); })(),
    source: string(p.source, 'Fonte e data das taxas', 300),
  }));
  if (new Set(plans.map(p => p.id)).size !== plans.length) throw new DomainError('Identificadores de financiamento duplicados.');
  return { ...text, logoData, cashEnabled: raw.cashEnabled !== false, manualIrradiationAllowed: raw.manualIrradiationAllowed !== false, paymentPlans: plans,
    financialDefaults: validateFinancial(raw.financialDefaults ?? {}, false),
  };
}

// No default rate or statutory rule is inferred. Blank values keep the scenario pending.
export function validateFinancial(raw = {}, required = true) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new DomainError('Premissas financeiras inválidas.');
  const fields = { tariff: [0.01, 100], simultaneousPct: [0, 100], compensationPct: [0, 100], fioB: [0, 100], fioBPct: [0, 100], taxesMonthly: [0, 10000000], publicLightingMonthly: [0, 10000000], availabilityMonthly: [0, 10000000], otherResidualMonthly: [0, 10000000], tariffIncreasePct: [-20, 50], degradationPct: [0, 10], maintenanceAnnual: [0, 10000000], replacementYear: [0, 40], replacementCost: [0, 10000000], discountRatePct: [0, 50], years: [1, 40] };
  const result = {};
  for (const [key, [min, max]] of Object.entries(fields)) {
    if (raw[key] === '' || raw[key] === undefined || raw[key] === null) { result[key] = null; continue; }
    result[key] = number(raw[key], financialNames[key], min, max, ['years','replacementYear'].includes(key));
  }
  result.source = optionalText(raw.source, 'Fonte das premissas', 1000);
  result.startDate = optionalText(raw.startDate, 'Data-base', 10);
  if (result.startDate && (!/^\d{4}-\d{2}-\d{2}$/.test(result.startDate) || Number.isNaN(Date.parse(result.startDate)) || new Date(result.startDate).toISOString().slice(0, 10) !== result.startDate)) throw new DomainError('Data-base inválida.');
  result.confirmed = raw.confirmed === true;
  result.comparison = null;
  if (raw.comparison?.enabled === true) result.comparison = {
    enabled: true, cdbAnnualPct: number(raw.comparison.cdbAnnualPct, 'Rendimento bruto anual CDB', 0, 100), savingsAnnualPct: number(raw.comparison.savingsAnnualPct, 'Rendimento anual poupança', 0, 100),
    taxPct: number(raw.comparison.taxPct, 'IR sobre ganhos no resgate', 0, 100), source: string(raw.comparison.source, 'Fonte/data comparativos', 500),
  };
  result.environment = null;
  if (raw.environment?.enabled === true) result.environment = { enabled: true, kgCo2PerKwh: number(raw.environment.kgCo2PerKwh, 'Fator de emissão kg CO₂/kWh', 0, 10), source: string(raw.environment.source, 'Fonte, período e metodologia ambiental', 1000) };
  return result;
}

export function projectInput(input) {
  const units = input.units ?? [];
  if (!Array.isArray(units) || units.length > 10) throw new DomainError('Informe até 10 unidades consumidoras.');
  const parsed = units.map((u, idx) => {
    if (!u || typeof u !== 'object') throw new DomainError('Unidade inválida.');
    const monthly = Array.isArray(u.months) && u.months.length ? u.months : null;
    if (monthly && monthly.length !== 12) throw new DomainError('Informe os 12 consumos mensais da unidade.');
    const months = monthly?.map(x => number(x, 'Consumo histórico', 0, 10000000));
    return { name: string(u.name || `Unidade ${idx + 1}`, 'Unidade', 100), supply: string(u.supply || 'Não informado', 'Fornecimento', 80), period: optionalText(u.period, 'Período do histórico', 120), monthlyKwh: months ? round(months.reduce((a,b) => a+b,0) / 12) : number(u.monthlyKwh, 'Consumo da unidade', 1, 10000000), months };
  });
  const months = parsed.length && parsed.every(u => u.months) ? Array.from({length:12}, (_, i) => round(parsed.reduce((s,u) => s+u.months[i],0))) : null;
  const monthlyKwh = parsed.length ? round(parsed.reduce((s,u) => s+u.monthlyKwh,0)) : input.monthlyKwh;
  return { units: parsed, monthlyKwh, consumptionMonths: months, installationAddress: optionalText(input.installationAddress, 'Endereço de instalação', 250), clientDocument: optionalText(input.clientDocument, 'CPF/CNPJ cliente', 30), clientEmail: optionalText(input.clientEmail, 'Email cliente', 150), clientPhone: optionalText(input.clientPhone, 'Telefone cliente', 50), crmClientRef: optionalText(input.crmClientRef, 'Referência CRM', 120), negotiationNotes: optionalText(input.negotiationNotes, 'Observações da negociação', 1500) };
}

export function paymentScenario(input, company, totalCents, cashCents) {
  const id = input.paymentId || 'cash';
  if (id === 'cash') {
    if (company.cashEnabled === false) throw new DomainError('Pagamento à vista desabilitado.');
    return { id, name: 'À vista', upfrontCents: cashCents, totalPaidCents: cashCents, installments: [], description: 'Desembolso integral no mês zero.' };
  }
  const p = (company.paymentPlans ?? []).find(p => p.id === id && p.enabled);
  if (!p) throw new DomainError('Condição de pagamento não habilitada.');
  const down = Math.round(totalCents * p.downPct / 100), principal = totalCents - down + p.feeCents;
  const rate = p.monthlyRatePct / 100, installments = [];
  let balance = principal;
  const fixed = rate ? principal * rate / (1 - (1 + rate) ** -p.months) : principal / p.months;
  for (let month = 1; month <= p.months; month++) {
    const interestCents = Math.round(balance * rate);
    const amortization = month === p.months ? balance : Math.min(balance, Math.max(0, Math.round(p.method === 'SAC' ? principal / p.months : fixed - interestCents)));
    installments.push({month, amountCents: amortization + interestCents, interestCents, amortizationCents: amortization});
    balance -= amortization;
  }
  return { id, name: p.name, method: p.method, months: p.months, monthlyRatePct: p.monthlyRatePct, downPct: p.downPct, feeCents: p.feeCents, source: p.source, upfrontCents: down, principalCents: principal, installments, totalPaidCents: down + installments.reduce((s,p)=>s+p.amountCents,0), description: 'Simulação ilustrativa, sujeita à análise da instituição. Sem aprovação ou CET certificado. Tarifas informadas incorporadas ao principal; parcelas vencem ao final de cada mês.' };
}

function npv(flows, monthlyRate) { return flows.reduce((s,x,i) => s + x / (1 + monthlyRate) ** i, 0); }
function irr(flows) {
  // Report only a conventional cash flow: exactly one sign change and an initial outlay.
  const nonzero = flows.filter(x => Math.abs(x) > .5);
  if (flows[0] >= 0 || nonzero.filter((x,i)=>i && Math.sign(x)!==Math.sign(nonzero[i-1])).length !== 1) return null;
  let lo = -.99, hi = 1;
  if (npv(flows, lo) * npv(flows, hi) >= 0) return null;
  for (let i=0;i<160;i++) { const mid=(lo+hi)/2; if (npv(flows,mid)>0) lo=mid; else hi=mid; }
  const annual = ((1 + (lo+hi)/2) ** 12 - 1) * 100;
  return Number.isFinite(annual) ? round(annual) : null;
}
export function financialScenario(raw, result) {
  const f = validateFinancial(raw ?? {}, false);
  const missing = Object.entries(f).filter(([k,v])=>!['comparison','environment','confirmed'].includes(k) && (v === null || v === '')).map(([k])=>financialNames[k]??k);
  if (!f.confirmed) missing.push('confirmação das premissas');
  if (result.units.length > 1) missing.push('modelo tarifário individual por unidade (integração pendente)');
  if (result.units.some(u=>u.supply?.startsWith('Grupo A'))) missing.push('demanda e modelo tarifário do Grupo A (análise específica pendente)');
  if (missing.length) return { status:'pending', missing, assumptions:f };
  if (result.payment.installments.length > f.years*12) throw new DomainError('O horizonte financeiro precisa cobrir todas as parcelas.');
  if (f.replacementCost > 0 && (f.replacementYear < 1 || f.replacementYear > f.years)) throw new DomainError('Ano da substituição deve estar dentro do horizonte.');
  const flows = [-result.payment.upfrontCents], annual = [], consumption = result.consumptionMonths ?? Array(12).fill(result.monthlyKwh);
  const monthlyRate = (1 + f.discountRatePct / 100) ** (1/12) - 1;
  let cumulative = flows[0], stablePayback = null;
  for (let y = 0; y < f.years; y++) {
    let beforeCents=0, afterCents=0, generationKwh=0, savingsCents=0, maintenanceCents=0, debtCents=0;
    const tariff = f.tariff * (1 + f.tariffIncreasePct/100) ** y;
    for (let m=0;m<12;m++) {
      const month = y*12+m+1, generation = result.generationMonthlyKwh * (1-f.degradationPct/100)**y, load=consumption[m];
      const direct=Math.min(load,generation*f.simultaneousPct/100), imports=load-direct, exports=Math.max(0,generation-direct);
      const compensated=Math.min(imports,exports*f.compensationPct/100);
      const fixed = f.publicLightingMonthly+f.taxesMonthly+f.otherResidualMonthly;
      const before=Math.round((Math.max(load*tariff,f.availabilityMonthly)+fixed)*100);
      const after=Math.round((Math.max((imports-compensated)*tariff+compensated*f.fioB*f.fioBPct/100*(1+f.tariffIncreasePct/100)**y,f.availabilityMonthly)+fixed)*100);
      const upkeep=Math.round(f.maintenanceAnnual*100/12)+(m===11 && y+1===f.replacementYear ? Math.round(f.replacementCost*100):0);
      const debt = result.payment.installments[month-1]?.amountCents ?? 0;
      const net=before-after-upkeep-debt;
      flows.push(net); cumulative+=net;
      if (cumulative >= 0 && stablePayback === null && result.payment.upfrontCents > 0) stablePayback=month;
      if (cumulative < 0) stablePayback=null;
      beforeCents+=before; afterCents+=after; generationKwh+=generation; savingsCents+=before-after; maintenanceCents+=upkeep; debtCents+=debt;
    }
    annual.push({year:y+1, tariff:round(tariff,4), generationKwh:round(generationKwh), beforeCents,afterCents,savingsCents,maintenanceCents,debtCents,netCents:savingsCents-maintenanceCents-debtCents,cumulativeCents:cumulative});
  }
  const first=annual[0];
  const comparison = f.comparison && result.payment.id === 'cash' ? annual.map(row=>{
    const capital=result.payment.upfrontCents, gross=capital*(1+f.comparison.cdbAnnualPct/100)**row.year;
    return {year:row.year,solarCashCents:row.cumulativeCents+capital,cdbNetCents:Math.round(gross-Math.max(0,gross-capital)*f.comparison.taxPct/100),savingsCents:Math.round(capital*(1+f.comparison.savingsAnnualPct/100)**row.year)};
  }) : null;
  return {status:'estimated',assumptions:f,monthlyWithoutCents:Math.round(first.beforeCents/12),monthlyWithCents:Math.round(first.afterCents/12),monthlySavingsCents:Math.round(first.savingsCents/12),annualSavingsCents:first.savingsCents,npvCents:Math.round(npv(flows,monthlyRate)),irrAnnualPct:irr(flows),paybackMonths:stablePayback,annual,flows,comparison,
    environment: f.environment ? {kgCo2Avoided:round(annual.reduce((s,r)=>s+r.generationKwh,0)*f.environment.kgCo2PerKwh),...f.environment} : null,
    method:'Cenário simplificado mensal: autoconsumo limitado à carga; excedente compensado limitado à importação do mesmo mês, sem banco de créditos. Piso de disponibilidade por máximo; encargos fixos somados. Fio B informado por kWh compensado. Impostos, CIP e residual em R$/mês explícitos. Tarifa e Fio B reajustados anualmente; encargos fixos, manutenção e reposição em valores nominais constantes. Degradação anual separada. Fluxos no fim de cada mês; VPL mensal pela taxa anual equivalente; TIR apenas para fluxo convencional. Sem valor de revenda. Não substitui simulação regulatória por distribuidora.'};
}
