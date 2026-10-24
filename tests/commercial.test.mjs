import test from 'node:test';
import assert from 'node:assert/strict';
import { commercialSettings, projectInput, paymentScenario, financialScenario } from '../src/commercial.mjs';
const assumptions={tariff:1,simultaneousPct:60,compensationPct:100,fioB:.2,fioBPct:50,taxesMonthly:10,publicLightingMonthly:20,availabilityMonthly:100,otherResidualMonthly:5,tariffIncreasePct:0,degradationPct:0,maintenanceAnnual:0,replacementYear:0,replacementCost:0,discountRatePct:0,years:1,startDate:'2026-10-23',source:'Cenário matemático de teste; não é tarifa real.',confirmed:true};
function result(payment){return {units:[],monthlyKwh:1000,generationMonthlyKwh:1000,payment:payment??paymentScenario({}, {},1000000,1000000)};}
test('economia aplica simultaneidade, compensação, piso e custos fixos; VPL e payback verificáveis',()=>{
  const f=financialScenario(assumptions,result());
  assert.equal(f.monthlyWithoutCents,103500);assert.equal(f.monthlyWithCents,13500);assert.equal(f.monthlySavingsCents,90000);
  assert.equal(f.npvCents,80000);assert.equal(f.paybackMonths,12);assert.equal(f.flows.length,13);assert.ok(f.irrAnnualPct>0);
  const noCompensation=financialScenario({...assumptions,compensationPct:0},result());assert.equal(noCompensation.monthlyWithCents,43500);
});
test('PRICE e SAC liquidam principal em centavos; zero juros e condição escolhida alteram desembolso',()=>{
  for(const method of ['PRICE','SAC']){
    const p=paymentScenario({paymentId:'bank'},{paymentPlans:[{id:'bank',name:'Teste',enabled:true,downPct:20,feeCents:1000,monthlyRatePct:1,months:12,method,source:'Teste'}]},1000000,950000);
    assert.equal(p.installments.reduce((s,x)=>s+x.amortizationCents,0),801000);assert.equal(p.upfrontCents,200000);
    assert.ok(p.totalPaidCents>1001000);
  }
  const financed=paymentScenario({paymentId:'bank'},{paymentPlans:[{id:'bank',name:'Teste',enabled:true,downPct:20,feeCents:0,monthlyRatePct:0,months:12,method:'PRICE',source:'Teste'}]},1000000,950000);
  assert.equal(financed.totalPaidCents,1000000);const scenario=financialScenario(assumptions,result(financed));assert.equal(scenario.npvCents,80000);assert.equal(scenario.flows[0],-200000);assert.equal(scenario.annual[0].debtCents,800000);
  assert.throws(()=>paymentScenario({paymentId:'disabled'},{paymentPlans:[]},1000,900));
});
test('cenários faltantes não geram retorno; degradação e manutenção são independentes',()=>{
  assert.equal(financialScenario({},result()).status,'pending');
  const f=financialScenario({...assumptions,years:2,degradationPct:10,maintenanceAnnual:120,replacementYear:2,replacementCost:500},result());
  assert.equal(f.annual[0].generationKwh,12000);assert.equal(f.annual[1].generationKwh,10800);assert.equal(f.annual[1].maintenanceCents,62000);
  assert.throws(()=>financialScenario({...assumptions,source:'',tariff:Infinity},result()));
});
test('comparativos tributam apenas ganhos e indicadores ambientais exigem fonte',()=>{
  const f=financialScenario({...assumptions,comparison:{enabled:true,cdbAnnualPct:10,savingsAnnualPct:5,taxPct:20,source:'Hipótese documentada de teste'},environment:{enabled:true,kgCo2PerKwh:.1,source:'Fator fictício para teste'}},result());
  assert.equal(f.comparison[0].cdbNetCents,1080000);assert.equal(f.comparison[0].savingsCents,1050000);assert.equal(f.environment.kgCo2Avoided,1200);
  assert.throws(()=>financialScenario({...assumptions,environment:{enabled:true,kgCo2PerKwh:1,source:''}},result()));
});
test('múltiplas unidades e histórico mensal validam totais e impedem histórico incompleto',()=>{
  const p=projectInput({units:[{name:'A',months:Array(12).fill(400)},{name:'B',monthlyKwh:200}]});assert.equal(p.monthlyKwh,600);assert.equal(p.consumptionMonths,null);
  assert.throws(()=>projectInput({units:[{months:[1,2],monthlyKwh:200}]}));
  assert.throws(()=>commercialSettings({logoData:'data:image/svg+xml;base64,abc'}));
  assert.throws(()=>commercialSettings({paymentPlans:[{name:'Teste',enabled:true,months:12,monthlyRatePct:-1,downPct:0,feeCents:0,method:'PRICE',source:'teste'}]}));
});
