# Arquitetura e integração futura · 0.2

## Decisão

Este projeto é um módulo independente de homologação, autorizado para desenvolvimento antes do acesso à plataforma principal. Não copia o CRM do Gestão de Agentes IA. A documentação desse produto descreve uma central Yii/PHP; isso é indício da arquitetura, não auditoria do código da central.

O núcleo `src/solar.mjs` independe de framework, sessão, banco e provedor externo. As rotas demonstrativas e o SQLite são adaptadores substituíveis. Não se pressupõe que o banco local seja usado na central.

## Limites de confiança

1. A plataforma central valida sessão, usuário, conta/empresa, papel, módulo contratado e situação da assinatura.
2. O adaptador server-side resolve esse contexto a partir de evidência autenticada, nunca de `tenantId` ou cabeçalho livre enviado pelo navegador.
3. O módulo valida entradas, aplica permissões, filtra custos e parâmetros internos e consulta apenas o tenant resolvido.
4. O domínio calcula o resultado. Na emissão, o servidor recalcula e exige revisão se os dados mudaram.
5. Transação atômica preserva documento, parâmetros internos e evento. Uma emissão repetida do mesmo rascunho emitido retorna a versão existente.
6. O serviço de documentos e as integrações futuras recebem somente o conteúdo autorizado.

Atualmente, a etapa 1 é uma escolha demonstrativa em loopback. Ela deve ser removida antes de operação real.

## Contratos a implementar

| Serviço existente | Contrato esperado | Não desenvolver em paralelo |
| --- | --- | --- |
| Autenticação | Resolver sessão, tenant, usuário e permissões verificadas | Novo login comercial |
| Empresas/planos | Consultar habilitações, limites e política de bloqueio | Outro sistema de assinatura mensal |
| CRM | Buscar/vincular cliente e oportunidade; registrar eventos idempotentes | Cadastro/funil paralelo |
| Financeiro | Encaminhar venda aprovada com chave única por versão | Contas a receber duplicadas |
| Contratos | Solicitar assinatura da versão e registrar resultado verificável | Outro provedor de assinatura |
| Solar Programado | Consultar opções somente com entitlement ativo | Novo consórcio |

O arquivo `src/adapters.mjs` descreve os contratos; ainda não existem implementações conectadas. Não confundir o indicador “integração pendente” com integração funcional.

## Rotas atuais

| Método / rota | Acesso e função |
| --- | --- |
| GET `/api/demo/options` | Público local; empresas fictícias |
| POST `/api/demo/session` | Público local com origem validada; seleciona perfil fictício |
| GET `/api/state` | Sessão; catálogo filtrado e propostas da empresa |
| POST `/api/logout` | Sessão + CSRF |
| PUT `/api/company` | Administrador + CSRF |
| POST `/api/catalog` | Administrador + CSRF |
| POST `/api/calculate` | Sessão + CSRF; cálculo no servidor |
| POST `/api/proposals` | Sessão + CSRF; grava ou revisa rascunho |
| POST `/api/proposals/:id/issue` | Sessão + CSRF; emite versão preliminar |
| GET `/api/proposals/:id/versions` | Sessão; histórico da mesma empresa |
| GET `/api/versions/:id` | Sessão; snapshot público sem custos internos |
| GET `/print/:id` | Sessão; documento da mesma versão |
| GET `/api/audit` | Administrador; eventos da própria empresa |
| GET `/pdf/:id` | Sessão; PDF do HTML congelado da versão; Chromium local |
| GET/POST `/api/versions/:id/links` | Sessão; consultar registros ou criar link local com validade |
| POST `/api/links/:id/revoke` | Sessão + CSRF; revogar link da própria empresa |
| GET `/s/:token` e `/s/:token/pdf` | Posse do token não expirado/revogado; versão fixa, apenas loopback |
| POST `/s/:token/reading` | Origem + token antifalsificação; ciência de leitura autodeclarada demonstrativa |

## Persistência demonstrativa

`tenants` contém somente as duas configurações fictícias; não é um novo cadastro comercial. `catalog`, `proposals`, `versions`, `version_parameters` e `audit` mantêm o escopo do módulo.

Na 0.2, `documents` congela HTML/CSS por versão, `share_links` guarda somente hash do token e expiração/revogação, e `reading_events` conserva identificação autodeclarada, método, hash e data. Não são contratos/assinaturas. Schema local 2 acrescenta tabelas sem apagar a base 1. Documentos antigos mantêm renderização legada. Eventos de resposta HTTP não provam visualização humana, e nenhum evento foi transmitido ao CRM.

No alvo real, auditar os modelos existentes antes de criar qualquer tabela. O plano provável é acrescentar catálogo/parâmetros e propostas/versionamento ausentes, com chaves compostas ou políticas equivalentes para tenant, índices, restrições e transações. Nenhuma migração da central foi preparada ou executada.

Os snapshots públicos não incluem custos/markup/perdas internos. `version_parameters` preserva as configurações e itens internos usados, sem rota pública. Os dois registros são inseridos na mesma transação e protegidos contra alterações/deleções ordinárias no banco demonstrativo. O administrador do arquivo SQLite permanece capaz de alterar o schema; não se trata de evidência inviolável contra o operador do banco.

## Backlog com gates

1. Validação visual local da 0.2 realizada; concluir revisão humana das regras comerciais e tarifárias.
2. Auditar o repositório principal; decidir incorporação ao Yii/PHP ou serviço isolado com contexto assinado. Não assumir serviço Node em produção.
3. Integrar identidade, RBAC, tenant, assinatura, limites e CRM. Testar duas contas reais de QA e todos os perfis.
4. Consumo manual/12 meses e dimensionamento de múltiplas unidades disponíveis. Implementar tarifas/alocação individuais, compatibilidade elétrica, revisão de engenharia e fontes de irradiação integradas.
5. Cenário financeiro simplificado e Price/SAC ilustrativos disponíveis com fontes e confirmação. Implementar motor tarifário regulatório, Grupo A, parceiros reais e CET. TIR é omitida em fluxos não convencionais; não pressupor aprovação bancária.
6. PDF local e links em loopback com expiração/revogação disponíveis. Implementar exposição externa HTTPS com identidade, revogação apropriada, aceite comercial existente, documento final e hash dos bytes assinados.
7. Integrar eventos por mecanismo idempotente, preferencialmente outbox transacional, com retentativas e observabilidade. A outbox ainda não foi implementada.
8. Homologar regressão, carga, backups, restore e deploy/rollback em QA antes de liberação comercial.

Cada fase segue a revisão prevista na especificação. Não há autorização de publicação em produção nesta entrega.
