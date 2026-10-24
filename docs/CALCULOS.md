# Cenários comerciais e financeiros · 0.2

Não há enquadramento automático de distribuidora, regulação, tributos ou crédito. Toda premissa precisa de fonte, data e validação. Campos vazios deixam o cenário pendente; zero é uma premissa explícita.

## Geração e consumo

Mês médio = 365,25/12. Perdas incidem uma vez. Geração mensal = potência instalada × irradiação × mês médio × (1 − perdas). Anual = mensal × 12. Sem sazonalidade, orientação, sombreamento ou garantia de produção. Histórico segue janeiro–dezembro do período declarado; sem histórico completo, a média é repetida e rotulada.

Até dez unidades compõem o dimensionamento. Economia por múltiplas unidades depende de alocação e tarifas individuais ainda não implementadas. Grupo A depende de demanda/modelo tarifário específico. Nenhum caso recebe economia estimada sem esses dados.

## Conta simplificada de uma unidade

Para carga C, geração G, simultaneidade s e fração compensável c:

```text
autoconsumo = min(C, G × s)
importação = C − autoconsumo
excedente = max(0, G − autoconsumo)
compensação = min(importação, excedente × c)
sem solar = max(C × tarifa, piso de disponibilidade) + custos fixos
com solar = max((importação − compensação) × tarifa
                + compensação × componente Fio B × percentual de cobrança,
                piso de disponibilidade) + custos fixos
economia = sem solar − com solar
```

Custos fixos = iluminação pública + tributos fixos adicionais + outros residuais. Tarifa contém os tributos variáveis: não os repita em tributos fixos. Piso usa máximo, sem somar a cobrança mínima novamente. Fio B, percentual e piso são informados, não presumidos de leis ou da ligação.

Não modela banco de créditos, receita de excedentes, regras por data de conexão, demanda, bandeiras, tarifa horária ou tributação individual por distribuidora. Não substitui simulação regulatória de fatura.

## Financiamento

Só planos habilitados pelo administrador, com fonte/data, taxa mensal, prazo, entrada, tarifas e Price/SAC. Entrada = preço integral × percentual. Principal = integral − entrada + tarifas financiadas. Desconto à vista não reduz compra financiada.

Price: `prestação = principal × j / (1 − (1+j)^−n)`; com j=0, principal/n. SAC: amortização constante e juros sobre saldo. Arredondamento em centavos, última parcela liquida o saldo. Parcelas ao fim dos meses; sem carência ou CET certificado. Total inclui entrada, amortização, juros e tarifas informadas.

Referência: [Banco Central · metodologia de prestações fixas](https://www3.bcb.gov.br/CALCIDADAO/publico/exibirMetodologiaFinanciamentoPrestacoesFixas.do?method=exibirMetodologiaFinanciamentoPrestacoesFixas). Não é oferta ou taxa vigente.

## Fluxo e indicadores

Anos completos contados da data-base, sem primeiro ano parcial. Mês zero: à vista com desconto, ou entrada. Depois: economia − manutenção − reposição − parcelas. Horizonte cobre todas as parcelas.

Tarifa e componente monetário Fio B recebem o reajuste anual informado. Geração recebe degradação anual a partir do segundo ano. Manutenção anual dividida em doze meses. Reposição no último mês do ano indicado. Piso, tributos fixos, CIP, residual, manutenção e reposição permanecem nominais constantes. Sem valor de revenda, benefícios fiscais ou receitas extras.

VPL mensal usa taxa equivalente `(1 + taxa anual)^(1/12) − 1`. Payback: primeiro mês da recuperação que permanece não negativa até o fim do horizonte; recuperação anterior é descartada se houver nova queda. Sem entrada, não se exibe payback do capital próprio. TIR por busca mensal e anualização efetiva, somente com desembolso inicial e exatamente uma mudança de sinal; sem raiz ou com fluxo não convencional, mostrar “não determinada”.

## Investimentos e ambiente

CDB/poupança só para compra à vista e mesmo desembolso inicial, sem aportes ou reinvestimento da economia. Taxas anuais hipotéticas constantes com fonte/data. CDB líquido = principal capitalizado − IR informado somente sobre ganhos, no resgate de cada horizonte; sem presumir tabela regressiva legal. Poupança usa taxa efetiva anual informada. Solar exibe caixa recebido acumulado líquido de despesas, sem revenda. Risco, liquidez e natureza dos ativos são distintos.

CO₂ = geração acumulada × fator kg CO₂/kWh informado, com fonte/período/método. Não é inventário de ciclo de vida, árvores ou crédito de carbono.

Referências para validação: [ANEEL · geração distribuída](https://www.gov.br/aneel/pt-br/assuntos/geracao-distribuida) e [ANEEL · iluminação pública](https://www.gov.br/aneel/pt-br/assuntos/iluminacao-publica). Nenhum percentual dessas fontes é automaticamente fixado no produto.
