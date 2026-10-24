/** These contracts are deliberately NOT connected to any production system.
 * Implement each behind the central platform's authenticated server boundary.
 * Tenant and role must come from a verified session, never a browser header.
 */
export const integrations = Object.freeze([
  { id: 'identity', name: 'Autenticação e permissões', status: 'pending', description: 'Substituir o acesso demonstrativo pela sessão validada da plataforma.' },
  { id: 'crm', name: 'CRM e clientes', status: 'pending', description: 'Vincular cliente e oportunidade; publicar eventos sem criar outro funil.' },
  { id: 'finance', name: 'Financeiro', status: 'pending', description: 'Encaminhar venda aprovada com chave de idempotência, sem lançamentos duplicados.' },
  { id: 'subscription', name: 'Assinatura mensal', status: 'pending', description: 'Consultar módulos contratados, estado da conta, tolerância e limite de usuários.' },
  { id: 'signature', name: 'Contratos e aceite', status: 'pending', description: 'Encaminhar a versão e o hash ao provedor existente; aceite ainda indisponível.' },
  { id: 'solarProgram', name: 'Solar Programado', status: 'disabled', description: 'Oculto no orçamento até existir integração e habilitação da empresa.' },
]);

export const contracts = {
  identity: 'resolveSession(request) -> { userId, tenantId, roles, permissions, entitlements }',
  crm: 'findClients(context, query); getClient(context, clientId); publishProposalEvent(context, event, idempotencyKey)',
  finance: 'createReceivableFromAcceptedProposal(context, versionId, idempotencyKey)',
  subscription: 'assertModuleEnabled(context, module); getUserLimit(context)',
  signature: 'requestAcceptance(context, { versionId, hash, documentRef }, idempotencyKey)',
  solarProgram: 'getEnabledOptions(context, proposalVersionId)',
};
