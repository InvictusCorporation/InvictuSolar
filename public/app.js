import { projectFields, paymentFields, financialFields, financialSummary, companySections, readProject, readCompany, bindCommercial } from './commercial-ui.js';
const $ = (s, root = document) => root.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = c => (Number(c) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = n => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const date = d => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' });
let state, view = 'overview', preview, editingId, busy = false, csrf = '';
const icons = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  overview: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  proposals: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 12h8m-8 4h5"/>',
  catalog: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  settings: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
  integrations: '<path d="M9 15 15 9M7 17l-2 2a4 4 0 0 1-5-5l4-4a4 4 0 0 1 5 0m6-3 2-2a4 4 0 0 1 5 5l-4 4a4 4 0 0 1-5 0" transform="translate(1 0)"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.sun}</svg>`;
function toast(message, error = false) { const t = $('#toast'); t.textContent = message; t.className = `show ${error ? 'error' : ''}`; clearTimeout(toast.timer); toast.timer = setTimeout(() => t.className = '', 5500); }
async function api(path, method = 'GET', data) {
  const res = await fetch(path, { method, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Não foi possível concluir.');
  return result;
}
async function load() { state = await api('/api/state'); csrf = state.csrf; document.documentElement.style.setProperty('--brand', state.company.color); }
const button = (text, action, secondary = false) => `<button class="btn ${secondary ? 'secondary' : ''}" data-action="${action}">${text}</button>`;
const field = (label, name, value = '', type = 'text', extra = '') => `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const select = (label, name, options, value) => `<label class="field"><span>${label}</span><select name="${name}">${options.map(o => `<option value="${esc(o[0])}" ${o[0] === value ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
const pill = (text, status = '') => `<span class="pill ${status}">${text}</span>`;

async function loginScreen() {
  csrf = '';
  const opts = await api('/api/demo/options');
  $('#app').innerHTML = `<main class="login"><div class="login-art"><div class="brand">${icon('sun')}<span>INVICTUS<span class="brand-sub">SYSTEMS</span></span></div><div><span class="eyebrow">PROPOSTAS SOLARES</span><h1>Do primeiro cálculo<br>à próxima conquista.</h1><p>Seu processo comercial com mais clareza,<br>consistência e uma apresentação à altura.</p></div><small>Uma base preparada para conectar à sua gestão.</small><div class="solar-art" aria-hidden="true"><div></div><div></div><div></div><div></div></div></div><section class="login-form"><span class="eyebrow">ESPAÇO DE HOMOLOGAÇÃO</span><h2>Conheça seu novo módulo.</h2><p>Explore o fluxo com empresas, equipamentos e preços fictícios.</p><form id="login-form">${select('Empresa de demonstração', 'tenantId', opts.tenants.map(t => [t.id, t.name]), opts.tenants[0].id)}${select('Perfil de acesso', 'role', [['admin','Administrador · configurações e preços'],['representative','Representante · propostas e preço de venda']], 'admin')}<button class="btn full">Entrar na demonstração ${icon('arrow')}</button></form><div class="note">Acesso demonstrativo local. Os perfis são selecionáveis para testes; a autenticação real será integrada à plataforma.</div></section></main>`;
}

function shell() {
  const labels = { overview: 'Visão geral', proposals: 'Propostas', new: 'Nova proposta', catalog: 'Equipamentos e preços', settings: 'Minha empresa', integrations: 'Integrações' };
  const nav = ['overview','proposals', ...(state.role === 'admin' ? ['catalog','settings'] : []), 'integrations'];
  $('#app').innerHTML = `<div class="layout"><aside class="sidebar"><a class="brand" href="#" data-view="overview">${icon('sun')}<span>INVICTUS<span class="brand-sub">SYSTEMS</span></span></a><div class="workspace-label">SOLAR WORKSPACE</div><nav aria-label="Navegação principal">${nav.map(k => `<button data-view="${k}" class="nav-item ${view === k || (k === 'proposals' && view === 'new') ? 'active' : ''}">${icon(k)}<span>${labels[k]}</span>${k === 'proposals' ? `<small>${state.proposals.length}</small>` : ''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="demo-badge"><span class="dot"></span> Ambiente de demonstração</div><p>Construa boas propostas.<br>Gere novas possibilidades.</p><div class="profile"><span class="avatar">${state.role === 'admin' ? 'AD' : 'RP'}</span><div><strong>${state.role === 'admin' ? 'Administrador' : 'Representante'}</strong><small>${esc(state.company.name)}</small></div><button data-action="logout" class="icon-button" title="Trocar perfil" aria-label="Trocar perfil">↗</button></div></div></aside><div class="main-wrap"><header class="topbar"><div><span class="breadcrumb">Workspace <span>/</span> ${labels[view]}</span></div><div class="topbar-right">${pill('Homologação', 'amber')}<span class="company-chip">${esc(state.company.name)}</span></div></header><main class="main" id="main">${view === 'overview' ? overview() : view === 'proposals' ? proposalsView() : view === 'new' ? editor() : view === 'catalog' ? catalogView() : view === 'settings' ? settingsView() : integrationsView()}</main><footer class="app-footer">Invictus Systems <span>Propostas solares · versão 0.2</span></footer></div></div>`;
  if(view==='settings') $('#company-form').insertAdjacentHTML('beforeend',companySections(state.company));
  bindEditor();
}
function heading(kicker, title, description, action = '') { return `<div class="page-heading"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${description}</p></div>${action}</div>`; }
function overview() {
  const issued = state.proposals.filter(p => p.status === 'issued');
  const total = issued.reduce((s, p) => s + p.result.cashCents, 0);
  return `${heading('SEU NEGÓCIO, MAIS LONGE', 'Boas propostas começam aqui.', 'Transforme consumo em uma solução solar bem apresentada.', button(`${icon('plus')} Nova proposta`, 'new'))}
    <section class="hero"><div><span class="eyebrow">MAIS CLAREZA EM CADA ETAPA</span><h2>Uma proposta que mostra<br>todo o seu potencial.</h2><p>Dimensione, organize os equipamentos e prepare<br>uma apresentação com a identidade da sua empresa.</p>${button(`Criar minha proposta ${icon('arrow')}`, 'new', true)}<span class="hero-caption">Proposta comercial · cenários explícitos · versões preservadas</span></div><div class="hero-visual" aria-hidden="true"><div class="sun-disc"></div><div class="orbit"></div><div class="panel-array"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="float-card"><span class="dot"></span> Energia para novas possibilidades ${icon('sun')}</div></div></section>
    <div class="stats"><article class="stat"><span>Propostas criadas ${icon('proposals')}</span><strong>${state.proposals.length.toString().padStart(2,'0')}</strong><small>Registros desta empresa</small></article><article class="stat"><span>Versões emitidas ${icon('sun')}</span><strong>${issued.length.toString().padStart(2,'0')}</strong><small>Última versão de cada proposta</small></article><article class="stat"><span>Valor das propostas emitidas ${icon('arrow')}</span><strong class="money-stat">${brl(total)}</strong><small>Valor à vista · não representa receita</small></article></div>
    <div class="overview-grid"><section class="card"><div class="section-title"><h2>Propostas recentes</h2><button class="text-button" data-view="proposals">Ver todas →</button></div>${proposalTable(state.proposals.slice(0,4))}</section><section class="card checklist"><span class="eyebrow">PRONTO PARA COMEÇAR</span><h2>Seu próximo passo</h2><div class="check-item"><span>01</span><div><strong>Configure sua empresa</strong><p>Identidade, condições e parâmetros.</p></div></div><div class="check-item"><span>02</span><div><strong>Revise seu catálogo</strong><p>Equipamentos e preços de venda.</p></div></div><div class="check-item"><span>03</span><div><strong>Crie uma proposta</strong><p>Comece pelo consumo do cliente.</p></div></div><div class="note">Os dados deste ambiente são fictícios. Integrações e revisão técnica permanecem pendentes.</div></section></div>`;
}
function proposalTable(list) {
  if (!list.length) return `<div class="empty">${icon('proposals')}<h3>Sua primeira proposta começa aqui.</h3><p>Informe o consumo e descubra o dimensionamento preliminar.</p>${button('Criar proposta', 'new')}</div>`;
  return `<div class="table-scroll"><table><thead><tr><th>Cliente / proposta</th><th>Potência</th><th>À vista</th><th>Status</th><th></th></tr></thead><tbody>${list.map(p => `<tr><td><strong>${esc(p.result.clientName)}</strong><small>${esc(p.number)} · ${date(p.updatedAt)}</small></td><td>${num(p.result.installedKwp)} kWp</td><td>${brl(p.result.cashCents)}</td><td>${pill(p.status === 'issued' ? `Emitida · v${p.revision}` : 'Rascunho', p.status === 'issued' ? 'green' : '')}</td><td><button class="text-button" data-edit-proposal="${p.id}">Abrir →</button></td></tr>`).join('')}</tbody></table></div>`;
}
function proposalsView() { return `${heading('OPORTUNIDADES EM MOVIMENTO', 'Suas propostas.', 'Rascunhos para revisar. Versões emitidas para preservar.', button(`${icon('plus')} Nova proposta`, 'new'))}<section class="card">${proposalTable(state.proposals)}</section>`; }

function editor() {
  const p = state.proposals.find(p => p.id === editingId);
  const d = p?.input || { clientName: '', location: '', roof: 'Fibrocimento', monthlyKwh: 1000, hsp: 4.5, irradiationSource: 'Exemplo fictício para homologação · substituir por fonte e período validados', discountPct: 0 };
  const modules = state.catalog.filter(i => i.kind === 'module' && i.active);
  const inverters = state.catalog.filter(i => i.kind === 'inverter' && i.active);
  const extras = state.catalog.filter(i => !['module','inverter'].includes(i.kind) && i.active);
  return `${heading('DO CONSUMO À SOLUÇÃO', p ? 'Revise sua proposta.' : 'Vamos criar uma proposta.', 'Estimativa comercial preliminar. Projeto elétrico sujeito à revisão técnica.')}
    <div class="steps"><span class="current"><b>1</b> Cliente e consumo</span><i></i><span><b>2</b> Equipamentos</span><i></i><span><b>3</b> Revisão e emissão</span></div>
    <div class="editor-grid"><form id="proposal-form"><section class="card form-section"><div class="section-title"><h2><span class="step-number">01</span> Cliente e instalação</h2>${pill('Cadastro manual')}</div><div class="form-grid">${field('Nome do cliente', 'clientName', d.clientName, 'text', 'required maxlength="150" placeholder="Ex.: Cliente demonstração"')}${field('Cidade / UF', 'location', d.location, 'text', 'required placeholder="Ex.: Castanhal / PA" maxlength="120"')}${select('Tipo de telhado', 'roof', ['Fibrocimento','Cerâmico','Metálico','Laje','Solo','Outro'].map(x => [x,x]), d.roof)}${field('Consumo médio mensal · kWh', 'monthlyKwh', d.monthlyKwh, 'number', 'required min="1" max="10000000" step="0.01"')}</div><p class="helper">Informe a média manualmente, mesmo sem uma fatura. Cadastro de cliente pelo CRM será integrado.</p></section>
    <section class="card form-section"><div class="section-title"><h2><span class="step-number">02</span> Irradiação e equipamentos</h2></div><div class="note amber-note">O valor de irradiação pré-preenchido é fictício. Informe uma fonte e um período confiáveis para um projeto real.</div><div class="form-grid">${field('Irradiação média · kWh/m²/dia', 'hsp', d.hsp, 'number', 'required min="1" max="8" step="0.01"')}${field('Fonte e período da irradiação', 'irradiationSource', d.irradiationSource, 'text', 'required maxlength="250"')}${select('Módulo fotovoltaico', 'moduleId', modules.map(i => [i.id, `${i.name} · ${brl(i.unitPriceCents)}`]), d.moduleId || modules[0]?.id)}${select('Inversor', 'inverterId', inverters.map(i => [i.id, `${i.name} · ${brl(i.unitPriceCents)}`]), d.inverterId || inverters[0]?.id)}</div><div class="field-label">Itens adicionais da composição</div><div class="extra-list">${extras.map(i => `<label><input type="checkbox" name="extras" value="${i.id}" ${(d.extras || extras.map(x => x.id)).includes(i.id) ? 'checked' : ''}><span>${esc(i.name)}<small>${brl(i.unitPriceCents)} / ${esc(i.unit)}</small></span></label>`).join('')}</div></section>
    <section class="card form-section"><div class="section-title"><h2><span class="step-number">03</span> Condição comercial</h2></div>${field(`Desconto à vista · máximo ${num(state.company.discountPct)}%`, 'discountPct', d.discountPct ?? 0, 'number', `required min="0" max="${state.company.discountPct}" step="0.01"`)}<p class="helper">Financiamento ilustrativo usa somente condições cadastradas. Solar Programado depende da integração existente.</p><div class="form-actions"><button class="btn" type="submit">${icon('sun')} Calcular proposta</button><button class="btn secondary" type="button" data-action="save-draft" id="save-draft">Salvar rascunho</button></div></section></form>
    <aside class="summary-wrap"><section class="card summary"><span class="eyebrow">RESUMO DA PROPOSTA</span><h2>Seu projeto, em números.</h2><div id="calculation-result">${preview ? resultView(preview) : `<div class="summary-empty">${icon('sun')}<p>Preencha os dados e calcule<br>para visualizar a composição.</p></div>`}</div></section>${p?.revision ? `<section class="card version-card"><h3>Versões preservadas</h3><p>Editar um rascunho não altera documentos emitidos.</p><button class="text-button" data-history="${p.id}">Consultar versões →</button></section>` : ''}<div id="history-list"></div></aside></div>`;
}
function resultView(r) {
  return `<div class="result-power"><strong>${num(r.installedKwp)}</strong><span>kWp de potência instalada</span></div><div class="result-grid"><div><b>${r.moduleCount}</b><small>módulos</small></div><div><b>${num(r.generationMonthlyKwh)}</b><small>kWh/mês estimados</small></div><div><b>${num(r.areaM2)} m²</b><small>área dos módulos</small></div><div><b>${r.inverterCount}</b><small>inversor(es)</small></div></div><div class="mini-chart" aria-label="Comparação entre consumo e geração mensal média"><div><span>Consumo</span><i style="width:${Math.min(100, r.monthlyKwh / Math.max(r.monthlyKwh, r.generationMonthlyKwh) * 100)}%"></i><b>${num(r.monthlyKwh)} kWh</b></div><div><span>Geração estimada</span><i class="generation" style="width:${Math.min(100, r.generationMonthlyKwh / Math.max(r.monthlyKwh, r.generationMonthlyKwh) * 100)}%"></i><b>${num(r.generationMonthlyKwh)} kWh</b></div></div><small class="helper">Médias mensais; sem previsão sazonal.</small><div class="line-items">${r.lines.map(l => `<div><span>${esc(l.name)}<small>${num(l.quantity)} ${esc(l.unit)}</small></span><b>${brl(l.totalCents)}</b></div>`).join('')}</div><div class="summary-total"><span>Investimento total</span><b>${brl(r.totalCents)}</b></div><div class="cash-total"><div><span>À vista</span><small>${num(r.discountPct)}% de desconto</small></div><strong>${brl(r.cashCents)}</strong></div><p class="helper">${brl(r.centsPerWp)} / Wp · ${r.deliveryDays} dias propostos</p><div class="note amber-note">Revisão elétrica e estrutural pendente. Economia e retorno dependem das premissas confirmadas; aceite comercial depende de integração.</div>`;
}
function inputData() {
  const f = new FormData($('#proposal-form'));
  return { ...Object.fromEntries(f), ...readProject($('#proposal-form')), extras: f.getAll('extras'), ...(editingId ? { id: editingId } : {}) };
}
function bindEditor() {
  if (view !== 'new') return;
  const d=state.proposals.find(p=>p.id===editingId)?.input || {monthlyKwh:1000};
  const form=$('#proposal-form');
  const oldMonthly=form.querySelector('[name="monthlyKwh"]');
  if(oldMonthly){oldMonthly.closest('label').remove();}
  form.querySelector('.form-section').insertAdjacentHTML('afterend',projectFields(d));
  const commercial=form.querySelector('.form-section:last-child');
  commercial.querySelector('.section-title').insertAdjacentHTML('afterend',paymentFields(d,state.company));
  commercial.querySelector('.helper').textContent='Juros e condições definidos pelo administrador. Solar Programado depende da integração existente.';
  const financial=d.financial ? {...d.financial,...(state.role==='representative'?state.company.projectionPolicy:{})} : {...(state.company.financialDefaults??{}),...(state.company.projectionPolicy??{}),confirmed:false};
  commercial.insertAdjacentHTML('beforebegin',`<section class="card form-section"><h2>Economia, retorno e premissas</h2><p class="helper">Campos em branco mantêm o cenário pendente. Zero representa uma premissa confirmada, não ausência de informação.</p>${financialFields(financial,state.role)}</section>`);
  if(state.role==='representative')for(const node of form.querySelectorAll('[name^="c_"],[name^="e_"]'))node.disabled=true;
  if(preview) $('#calculation-result').innerHTML=resultView(preview)+financialSummary(preview);
  $('#proposal-form')?.addEventListener('input', () => { preview = undefined; $('#calculation-result').innerHTML = '<div class="summary-empty"><p>Dados alterados.<br>Calcule novamente para atualizar o resumo.</p></div>'; });
}
function catalogView() {
  return `${heading('BASE DO SEU ORÇAMENTO', 'Equipamentos e preços.', 'Uma tabela por empresa, para projetos residenciais e comerciais.', button(`${icon('plus')} Adicionar item`, 'add-item'))}<div class="note catalog-note">Custos e markup são exclusivos do administrador. O representante recebe somente os preços de venda.</div><section class="card"><div class="table-scroll"><table><thead><tr><th>Equipamento / serviço</th><th>Custo</th><th>Precificação</th><th>Preço de venda</th><th>Situação</th><th></th></tr></thead><tbody>${state.catalog.map(i => `<tr><td><strong>${esc(i.name)}</strong><small>${esc(i.brand || 'Serviço / composição')} ${i.watts ? `· ${num(i.watts)} W` : ''}</small></td><td>${brl(i.costCents)}</td><td>${i.mode === 'markup' ? `Custo + ${num(i.markupBps / 100)}%` : 'Preço final'}</td><td><strong>${brl(i.unitPriceCents)}</strong><small>por ${esc(i.unit)}</small></td><td>${pill(i.active ? 'Ativo' : 'Inativo', i.active ? 'green' : '')}</td><td><button class="text-button" data-edit-item="${i.id}">Editar</button></td></tr>`).join('')}</tbody></table></div></section><div id="item-editor"></div>`;
}
function itemForm(id) {
  const i = state.catalog.find(x => x.id === id) || { name: '', brand: '', kind: 'other', unit: 'un', watts: 0, mode: 'fixed', costCents: 0, saleCents: 0, markupBps: 0, quantityRule: 'fixed', baseQuantity: 1, active: true, validUntil: '' };
  $('#item-editor').innerHTML = `<section class="card form-section"><div class="section-title"><h2>${id ? 'Editar item' : 'Novo item'}</h2></div><form id="item-form" data-id="${id || ''}"><div class="form-grid">${field('Descrição', 'name', i.name, 'text', 'required maxlength="180"')}${field('Marca / fabricante', 'brand', i.brand, 'text', 'maxlength="60"')}${select('Categoria', 'kind', [['module','Módulo'],['inverter','Inversor'],['structure','Estrutura'],['cable','Cabos'],['protection','Proteções'],['labor','Mão de obra'],['design','Projeto'],['freight','Frete'],['service','Serviço'],['other','Outro']], i.kind)}${select('Unidade', 'unit', [['un','Unidade'],['kit','Kit'],['m','Metro'],['serviço','Serviço']], i.unit)}${field('Potência nominal · W ou Wp', 'watts', i.watts, 'number', 'min="0" max="1000000" required')}${select('Precificação', 'mode', [['fixed','Preço final já com margem'],['markup','Custo + markup sobre o custo']], i.mode)}${field('Custo · R$', 'cost', i.costCents / 100, 'number', 'min="0" max="10000000" step="0.01" required')}${field('Preço final · R$', 'sale', i.saleCents / 100, 'number', 'min="0" max="10000000" step="0.01" required')}${field('Markup sobre custo · %', 'markup', i.markupBps / 100, 'number', 'min="0" max="1000" step="0.01" required')}${select('Quantidade automática', 'quantityRule', [['fixed','Quantidade fixa por proposta'],['module','Quantidade por módulo'],['inverter','Quantidade por inversor']], i.quantityRule)}${field('Quantidade base / multiplicador', 'baseQuantity', i.baseQuantity, 'number', 'min="0.01" max="10000" step="0.01" required')}${field('Preço válido até · opcional', 'validUntil', i.validUntil, 'date')}</div><label class="checkbox"><input type="checkbox" name="active" ${i.active ? 'checked' : ''}> Item ativo</label><p class="helper">Markup de 25% sobre custo de R$ 100 resulta em R$ 125. Isso equivale a 20% de margem sobre a venda. Módulos e inversores usam quantidade pela potência; a regra acima aplica-se aos demais itens.</p><button class="btn">Salvar item</button></form></section>`;
  $('#item-form .form-grid').insertAdjacentHTML('afterbegin',field('Modelo', 'model', i.model || '', 'text', 'maxlength="100"'));
  $('#item-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function settingsView() {
  const c = state.company;
  return `${heading('A IDENTIDADE DA SUA EMPRESA', 'Sua marca. Suas condições.', 'Configurações aplicadas às novas simulações, sem alterar versões emitidas.')}<form id="company-form"><section class="card form-section"><h2>Apresentação e identidade</h2><div class="form-grid">${field('Nome da empresa', 'name', c.name, 'text', 'required maxlength="100"')}${field('Cor principal', 'color', c.color, 'color', 'required')}</div><label class="field"><span>Apresentação da empresa</span><textarea name="presentation" rows="3" maxlength="2000">${esc(c.presentation)}</textarea></label><label class="field"><span>Condições comerciais e garantias confirmadas</span><textarea name="terms" rows="4" maxlength="3000">${esc(c.terms)}</textarea></label></section><section class="card form-section"><h2>Parâmetros administrativos</h2><div class="form-grid">${field('Perdas técnicas de geração · %', 'lossesPct', c.lossesPct, 'number', 'required min="0" max="50" step="0.01"')}${field('Desconto máximo à vista · %', 'discountPct', c.discountPct, 'number', 'required min="0" max="50" step="0.01"')}${field('Área de um módulo · m²', 'moduleArea', c.moduleArea, 'number', 'required min="0.1" max="10" step="0.01"')}${field('Prazo de entrega proposto · dias', 'deliveryDays', c.deliveryDays, 'number', 'required min="1" max="730"')}${field('Validade da proposta · dias', 'validityDays', c.validityDays, 'number', 'required min="1" max="365"')}</div><div class="note">As perdas são aplicadas uma única vez no cálculo. A área é uma estimativa dos módulos; distâncias, corredores e estrutura dependem do projeto técnico. Os exemplos não são recomendações de engenharia.</div><button class="btn">Salvar configurações</button></section></form>`;
}
function integrationsView() {
  return `${heading('PREPARADO PARA CONECTAR', 'Parte da sua plataforma.', 'O módulo mantém suas próprias propostas e reutilizará os serviços já existentes.')}<div class="note catalog-note">Nenhuma conexão externa está ativa. O acesso atual é demonstrativo, restrito ao computador local.</div><div class="integration-grid">${state.integrations.map(i => `<article class="card integration-card">${icon('integrations')} ${pill(i.status === 'disabled' ? 'Desabilitado' : 'Integração pendente', i.status === 'disabled' ? '' : 'amber')}<h2>${esc(i.name)}</h2><p>${esc(i.description)}</p></article>`).join('')}</div>`;
}

async function navigate(next) { view = next; if (next !== 'new') { preview = undefined; editingId = undefined; } shell(); window.scrollTo(0,0); }
async function saveDraft() {
  if (!$('#proposal-form').reportValidity()) return;
  const p = await api('/api/proposals', 'POST', inputData()); editingId = p.id; preview = p.result;
  await load(); shell(); showIssue(p); toast('Rascunho salvo. Revise a composição antes de emitir.');
}
function showIssue(p) {
  if (!p) return;
  const area = $('#calculation-result');
  area.insertAdjacentHTML('beforeend', `<div class="issue-area"><label class="checkbox"><input type="checkbox" id="review-check"> Estou ciente de que esta emissão demonstrativa mantém a revisão técnica pendente.</label><button class="btn full" data-action="issue" ${p.status === 'issued' ? 'disabled' : ''}>${p.status === 'issued' ? 'Versão já emitida' : 'Emitir versão de demonstração'}</button></div>`);
  if (p.versionId) area.insertAdjacentHTML('beforeend', `<a class="btn secondary full" href="/print/${p.versionId}" target="_blank" rel="noopener">Abrir documento / imprimir PDF ↗</a>`);
  if (p.versionId) area.insertAdjacentHTML('beforeend',`<a class="btn secondary full" href="/pdf/${p.versionId}" target="_blank" rel="noopener">Baixar PDF da versão</a><button class="btn secondary full" data-share-version="${p.versionId}">Link local e registros de leitura</button><div id="share-controls"></div>`);
}
async function sharePanel(versionId){
  const data=await api(`/api/versions/${versionId}/links`),root=$('#share-controls');
  root.innerHTML=`<section class="share-panel"><h3>Acesso à versão emitida</h3><p class="helper">Link restrito a este computador. Acesso por posse do link, validade máxima de 7 dias ou vencimento da proposta. Publicação e acesso externo dependem de infraestrutura autorizada.</p>${field('Validade do link · horas','linkHours',24,'number','id="link-hours" min="1" max="168" step="1"')}<button class="btn secondary" data-create-link="${versionId}">Gerar link local</button><div id="created-link"></div><h3>Links desta versão</h3>${data.links.map(l=>`<div class="link-row"><span>${l.revoked?'Revogado':new Date(l.expires_at)<new Date()?'Expirado':'Ativo'} · até ${esc(new Date(l.expires_at).toLocaleString('pt-BR'))}</span>${!l.revoked?`<button class="text-button" data-revoke-link="${l.id}" data-version="${versionId}">Revogar</button>`:''}</div>`).join('')||'<p class="helper">Nenhum link gerado.</p>'}<h3>Ciência de leitura autodeclarada</h3>${data.readings.map(r=>`<p class="helper">${esc(r.name)} · ${esc(r.identification)} · ${esc(new Date(r.created_at).toLocaleString('pt-BR'))}<br>${esc(r.method)}<br>Versão SHA-256: ${esc(r.version_hash)}</p>`).join('')||'<p class="helper">Nenhum registro. Não representa aceite comercial ou assinatura.</p>'}</section>`;
}
document.addEventListener('click', async e => {
  const t = e.target.closest('button,a'); if (!t || busy) return;
  if (t.dataset.view) { e.preventDefault(); await navigate(t.dataset.view); return; }
  try {
    busy = true;
    if(t.dataset.shareVersion)await sharePanel(t.dataset.shareVersion);
    if(t.dataset.createLink){const link=await api(`/api/versions/${t.dataset.createLink}/links`,'POST',{hours:Number($('#link-hours').value)});await sharePanel(t.dataset.createLink);$('#created-link').innerHTML=`<p class="helper">Copie e guarde o link; o token não será exibido novamente.</p><a class="version-link" href="${esc(link.url)}" target="_blank" rel="noopener">${esc(link.url)}</a>`;}
    if(t.dataset.revokeLink){await api(`/api/links/${t.dataset.revokeLink}/revoke`,'POST',{});await sharePanel(t.dataset.version);toast('Link revogado.');}
    if (t.dataset.action === 'new') { editingId = undefined; preview = undefined; await navigate('new'); }
    if (t.dataset.action === 'logout') { await api('/api/logout', 'POST', {}); state = null; await loginScreen(); }
    if (t.dataset.action === 'save-draft') await saveDraft();
    if (t.dataset.editProposal) {
      const p = state.proposals.find(p => p.id === t.dataset.editProposal); editingId = p.id; preview = p.result; view = 'new'; shell(); showIssue(p);
    }
    if (t.dataset.action === 'add-item' || t.dataset.editItem) itemForm(t.dataset.editItem);
    if (t.dataset.history) {
      const versions = await api(`/api/proposals/${t.dataset.history}/versions`);
      $('#history-list').innerHTML = `<section class="card version-card"><h3>Documentos emitidos</h3>${versions.map(v => `<a class="version-link" href="/print/${v.id}" target="_blank" rel="noopener">Versão ${v.revision} · ${date(v.created_at)} ↗<small>SHA-256: ${esc(v.hash.slice(0,16))}…</small></a>`).join('') || '<p>Nenhuma versão emitida.</p>'}</section>`;
    }
    if (t.dataset.action === 'issue') {
      if (!$('#review-check')?.checked) throw new Error('Confirme ciência da revisão técnica pendente.');
      const v = await api(`/api/proposals/${editingId}/issue`, 'POST', { reviewAcknowledged: true });
      await load(); preview = v.result; shell(); showIssue(state.proposals.find(p => p.id === editingId)); toast('Versão preservada. Abra o documento para imprimir ou salvar em PDF.');
    }
  } catch (error) { toast(error.message, true); } finally { busy = false; }
});
document.addEventListener('submit', async e => {
  e.preventDefault(); if (busy) return;
  busy = true; const submit = $('button[type="submit"], button:not([type])', e.target); if (submit) submit.disabled = true;
  try {
    const f = e.target; const data = Object.fromEntries(new FormData(f));
    if (f.id === 'login-form') { await api('/api/demo/session','POST',data); await load(); view = 'overview'; shell(); }
    if (f.id === 'proposal-form') { preview = await api('/api/calculate','POST',inputData()); $('#calculation-result').innerHTML = resultView(preview)+financialSummary(preview); toast('Estimativa calculada. Salve o rascunho para emitir uma versão.'); }
    if (f.id === 'company-form') { await api('/api/company','PUT',readCompany(f,data)); await load(); shell(); toast('Configurações salvas para novas simulações.'); }
    if (f.id === 'item-form') {
      const raw = { ...data, id: f.dataset.id || undefined, active: new FormData(f).has('active'), costCents: Math.round(Number(data.cost) * 100), saleCents: Math.round(Number(data.sale) * 100), markupBps: Math.round(Number(data.markup) * 100) };
      await api('/api/catalog','POST',raw); await load(); shell(); toast('Item salvo no catálogo desta empresa.');
    }
  } catch (error) { toast(error.message, true); } finally { busy = false; if (submit) submit.disabled = false; }
});
bindCommercial(toast);
try { await load(); shell(); } catch { await loginScreen(); }
