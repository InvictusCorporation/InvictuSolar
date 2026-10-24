import { commercialSettings, projectInput, paymentScenario, financialScenario } from './commercial.mjs';
export class DomainError extends Error {
  constructor(message, status = 422) { super(message); this.status = status; }
}

export function number(value, label, min, max, integer = false) {
  if (value === '' || value === null || value === undefined || !['string', 'number'].includes(typeof value)) throw new DomainError(`${label}: informe um valor.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) {
    throw new DomainError(`${label}: valor inválido (${min} a ${max}).`);
  }
  return parsed;
}
export function string(value, label, max = 200, required = true) {
  if (typeof value !== 'string') throw new DomainError(`${label}: texto inválido.`);
  const s = value.trim();
  if ((required && !s) || s.length > max) throw new DomainError(`${label}: informe até ${max} caracteres.`);
  return s;
}
export const round = (n, places = 2) => Math.round((n + Number.EPSILON) * 10 ** places) / 10 ** places;
export function validateCompany(raw) {
  const color = string(raw.color, 'Cor', 7);
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new DomainError('Cor: utilize um código hexadecimal.');
  return {
    ...commercialSettings(raw), name: string(raw.name, 'Empresa', 100), color,
    presentation: string(raw.presentation, 'Apresentação', 2000, false),
    terms: string(raw.terms, 'Condições comerciais', 3000, false),
    lossesPct: number(raw.lossesPct, 'Perdas', 0, 50),
    discountPct: number(raw.discountPct, 'Desconto', 0, 50),
    moduleArea: number(raw.moduleArea, 'Área por módulo', 0.1, 10),
    deliveryDays: number(raw.deliveryDays, 'Prazo de entrega', 1, 730, true),
    validityDays: number(raw.validityDays, 'Validade', 1, 365, true),
  };
}
export function validateItem(raw) {
  const kind = string(raw.kind, 'Categoria', 20);
  const unit = string(raw.unit, 'Unidade', 10);
  const mode = string(raw.mode, 'Modo de preço', 10);
  const quantityRule = string(raw.quantityRule, 'Regra de quantidade', 20);
  if (!['module', 'inverter', 'structure', 'cable', 'protection', 'labor', 'design', 'freight', 'service', 'other'].includes(kind) || !['un', 'kit', 'm', 'serviço'].includes(unit)
    || !['fixed', 'markup'].includes(mode) || !['module', 'inverter', 'fixed'].includes(quantityRule)) throw new DomainError('Opção de catálogo inválida.');
  const watts = number(raw.watts, 'Potência', 0, 1000000);
  if (['module', 'inverter'].includes(kind) && !watts) throw new DomainError('Equipamento precisa de potência nominal.');
  const active = raw.active === true;
  const validUntil = string(raw.validUntil, 'Validade do preço', 10, false);
  if (validUntil && (!/^\d{4}-\d{2}-\d{2}$/.test(validUntil) || Number.isNaN(Date.parse(validUntil)) || new Date(`${validUntil}T12:00:00Z`).toISOString().slice(0, 10) !== validUntil)) throw new DomainError('Validade do preço inválida.');
  return {
    name: string(raw.name, 'Descrição', 180), brand: string(raw.brand, 'Marca', 60, false), model: string(raw.model ?? '', 'Modelo', 100, false),
    kind, unit, mode, quantityRule, watts, active, validUntil,
    baseQuantity: number(raw.baseQuantity, 'Quantidade base', 0.01, 10000),
    costCents: number(raw.costCents, 'Custo', 0, 1000000000, true),
    saleCents: number(raw.saleCents, 'Preço', 0, 1000000000, true),
    markupBps: number(raw.markupBps, 'Markup', 0, 100000, true),
  };
}
export function unitPrice(item) {
  // basis points: 2500 = markup de 25% sobre custo, NÃO margem sobre venda.
  return item.mode === 'markup' ? Math.round(item.costCents * (10000 + item.markupBps) / 10000) : item.saleCents;
}
export function publicItem(item) {
  const { costCents, markupBps, mode, ...safe } = item;
  return { ...safe, unitPriceCents: unitPrice(item) };
}
export function publicCompany(c) {
  const { lossesPct, moduleArea, financialDefaults, ...safe } = c;
  const policyKeys=['tariffIncreasePct','degradationPct','maintenanceAnnual','replacementYear','replacementCost','discountRatePct','years','comparison','environment'];
  return { ...safe, projectionPolicy: Object.fromEntries(policyKeys.map(k=>[k,c.financialDefaults?.[k]??null])), paymentPlans: (c.paymentPlans ?? []).filter(p => p.enabled) };
}

export function calculate(input, company, catalog, now = new Date()) {
  const project = projectInput(input);
  const monthlyKwh = number(project.monthlyKwh, 'Consumo médio (kWh/mês)', 1, 10000000);
  if (company.manualIrradiationAllowed === false) throw new DomainError('Irradiação manual não autorizada; fonte automática depende de integração.');
  const hsp = number(input.hsp, 'Irradiação (kWh/m²/dia)', 1, 8);
  const location = string(input.location, 'Cidade/UF', 120);
  const roof = string(input.roof, 'Telhado', 80);
  const clientName = string(input.clientName, 'Nome do cliente', 150);
  const irradiationSource = string(input.irradiationSource, 'Fonte da irradiação', 250);
  // Annual-average preliminary model: mean calendar month = 365.25 / 12 days.
  // Losses are applied exactly once. Electrical design remains a technical task.
  const days = 365.25 / 12;
  const yieldPerKwp = hsp * days * (1 - company.lossesPct / 100);
  const requiredKwp = monthlyKwh / yieldPerKwp;
  const eligible = catalog.filter(i => i.active);
  const panel = eligible.find(i => i.id === input.moduleId && i.kind === 'module');
  const inverter = eligible.find(i => i.id === input.inverterId && i.kind === 'inverter');
  if (!panel || !inverter) throw new DomainError('Selecione módulo e inversor ativos desta empresa.');
  const moduleCount = Math.ceil(requiredKwp * 1000 / panel.watts);
  const installedWp = moduleCount * panel.watts;
  const installedKwp = installedWp / 1000;
  const inverterCount = Math.ceil(installedWp / inverter.watts);
  const include = new Set(Array.isArray(input.extras) ? input.extras.map(String) : []);
  if ([...include].some(id => !eligible.some(i => i.id === id && !['module', 'inverter'].includes(i.kind)))) throw new DomainError('Item adicional inválido para a empresa.');
  const selected = [panel, inverter, ...eligible.filter(i => include.has(i.id) && !['module', 'inverter'].includes(i.kind))];
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const lines = selected.map(i => {
    if (i.validUntil && i.validUntil < today) throw new DomainError(`Preço vencido: ${i.name}. Solicite atualização ao administrador.`);
    let quantity = i.id === panel.id ? moduleCount : i.id === inverter.id ? inverterCount : i.quantityRule === 'module' ? moduleCount * i.baseQuantity : i.quantityRule === 'inverter' ? inverterCount * i.baseQuantity : i.baseQuantity;
    quantity = round(quantity, 3);
    const price = unitPrice(i);
    return { itemId: i.id, name: i.name, brand: i.brand, model: i.model || '', unit: i.unit, quantity, unitPriceCents: price, totalCents: Math.round(price * quantity), watts: i.watts };
  });
  const totalCents = lines.reduce((s, i) => s + i.totalCents, 0);
  if (!Number.isSafeInteger(totalCents) || totalCents > 100000000000) throw new DomainError('Total fora do limite de cálculo.');
  const requestedDiscount = number(input.discountPct ?? 0, 'Desconto', 0, company.discountPct);
  const discountCents = Math.round(totalCents * Math.round(requestedDiscount * 100) / 10000);
  const generation = installedKwp * yieldPerKwp;
  const issuedDate = new Date(`${today}T12:00:00Z`);
  issuedDate.setUTCDate(issuedDate.getUTCDate() + company.validityDays);
  const result = {
    ...project, clientName, location, roof, monthlyKwh, hsp, irradiationSource,
    requiredKwp: round(requiredKwp, 3), moduleCount, inverterCount,
    installedKwp: round(installedKwp, 3), inverterKwp: round(inverterCount * inverter.watts / 1000, 3),
    generationMonthlyKwh: round(generation), generationAnnualKwh: round(generation * 12),
    areaM2: round(moduleCount * company.moduleArea),
    lines, totalCents, discountPct: requestedDiscount, discountCents,
    cashCents: totalCents - discountCents, centsPerWp: round(totalCents / installedWp, 4),
    validUntil: issuedDate.toISOString().slice(0, 10), deliveryDays: company.deliveryDays,
    estimateMethod: 'Estimativa preliminar por média anual; mês médio de 365,25/12 dias. Sem previsão sazonal ou garantia de geração.',
    reviewRequired: true,
    pending: ['Revisão técnica: strings, MPPT, tensão, corrente, proteções, telhado e área.', 'Irradiação informada manualmente; fonte e período devem ser conferidos.'],
    company: publicCompany(company),
  };
  result.payment = paymentScenario(input, company, totalCents, result.cashCents);
  result.financial = financialScenario(input.financial, result);
  if (result.financial.status === 'pending') result.pending.push('Economia e retorno pendentes: ' + result.financial.missing.join(', ') + '.');
  return result;
}
