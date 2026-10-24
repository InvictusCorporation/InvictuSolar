# Escopo consolidado e estado da entrega 0.2

| Área solicitada | Disponível para homologação local | Dependência / limite explícito |
| --- | --- | --- |
| Empresa | Dados cadastrais, logo, cor, textos institucionais/comerciais, missão/visão/valores, parceiros, serviços, garantias, responsabilidades e exclusões persistidos | Usuários reais e permissões da central aguardam repositório principal |
| Catálogo | Tipos de equipamentos, materiais e serviços; marca/modelo/unidade/potência, ativo, validade, preço final ou custo + markup | Compatibilidade elétrica e ajuste técnico de quantidades dependem de revisão |
| Projeto | Cidade/UF, endereço, telhado, contatos fictícios, média manual/12 meses, até dez unidades, irradiação com fonte/período | Referência CRM manual; sem busca/cadastro integrado, extração de fatura ou mapa automático |
| Proposta | Capa e conteúdo institucional, projeto, geração/gráfico, equipamentos, investimento/pagamento, cenários, fluxo/gráfico, ambiente, condições e conclusão/encaminhamento de aceite | Dados não cadastrados ou incompletos são identificados como pendentes; sem editor livre |
| Pagamento | À vista habilitável, desconto limitado, planos ilustrativos Price/SAC por instituição/prazo/taxa/entrada/tarifas/fonte | Sem oferta bancária, aprovação ou CET certificado; Solar Programado aguardando módulo existente |
| Economia/retorno | Cenário mensal parametrizado de uma unidade, residual, VPL, fluxo, payback, TIR convencional, reajuste/degradação/manutenção/reposição separados | Modelo simplificado; sem regulação automática, banco de créditos, Grupo A/demanda ou tarifas individuais de múltiplas unidades |
| Comparativos/ambiente | CDB/poupança com taxas, IR, data e fonte; CO₂ com fator/método informado | Não presume rendimentos atuais, tributação legal automática ou equivalências em árvores |
| Documento | HTML/CSS congelado, PDF local, hash do snapshot, histórico de versões | Hash não é assinatura ou hash do PDF; versões 0.1 mantêm formato legado |
| Link/eventos | Token aleatório cujo hash é persistido; validade/revogação; leitura autodeclarada com hash/data/método | Link só neste computador; eventos HTTP não comprovam leitura humana; sem publicação externa ou envio ao CRM |
| Aceite/contratação | Identificação das partes e explicação da integração na conclusão | Sem assinatura ou aceite comercial real. Ciência de leitura demonstrativa não substitui essas funções |
| SaaS/Master | Isolamento local por empresa e contratos de adaptação documentados | Planos, assinatura mensal, proprietário/limites/tolerância/bloqueio devem reutilizar a central após auditoria; não foi criado SaaS paralelo |

## Preservação

Cópia integral do código e de todos os arquivos de dados, com servidor parado, em `../work/solar-backup-*`. Nenhum registro existente foi removido. Testes de navegador usam banco separado. Schema 2 acrescenta tabelas; rollback exige restaurar juntos código e dados do backup.

## Referências

Escopo consolidado fornecido pelo usuário e PDF funcional de dez páginas enviado em 23/10/2026. Os clientes, dados cadastrais e números do PDF não foram importados para o catálogo ou usados como padrões. As premissas do exemplo gerado são fictícias e rotuladas.

Nenhuma publicação, migração da central, conexão com CRM/financeiro/assinatura ou chamada paga foi realizada.
