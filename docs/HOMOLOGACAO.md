# Critérios de homologação · entrega 0.2

## Verificado por testes automatizados

- [x] Consumo médio manual calcula sem anexar fatura.
- [x] Módulos são inteiros e a potência usa Wp/kWp corretamente.
- [x] Perdas aplicadas uma vez; alteração modifica nova estimativa.
- [x] Preço final e custo + markup são distintos; cálculos monetários usam centavos.
- [x] Desconto acima do máximo é rejeitado no servidor.
- [x] Preço vencido e equipamento de outra empresa são rejeitados.
- [x] Representante não recebe custos, markup ou perdas internas e não altera configurações/catálogo.
- [x] Uma empresa não consulta proposta, versão ou documento de outra.
- [x] Versão emitida preserva conteúdo após mudança de preço.
- [x] Versão repetidamente emitida não duplica o mesmo documento; nova revisão mantém histórico.
- [x] Hash corresponde ao snapshot serializado e parâmetros internos são armazenados separadamente.
- [x] Conteúdo de cliente é escapado no documento HTML.
- [x] Operações exigem origem válida e CSRF de sessão.
- [x] Proposta e versão persistem após reiniciar servidor/banco.
- [x] Price/SAC liquidam o principal em centavos; condição escolhida altera desembolso e fluxo.
- [x] Conta residual, piso, custos fixos, compensação, manutenção e degradação possuem casos matemáticos verificáveis.
- [x] Comparativos tributam somente ganhos; indicadores ambientais exigem fonte.
- [x] Links exigem versão da mesma empresa, expiram e podem ser revogados.
- [x] Ciência de leitura preserva hash, método e data; CSRF/origem exigidos.
- [x] HTML emitido permanece idêntico após mudanças na empresa.
- [x] Vencimento de preços e validade da proposta respeitam Fortaleza perto da meia-noite UTC.

Resultado da bateria atual: **19 testes aprovados**.

## Verificado no navegador · banco isolado

Chrome headless local com banco de QA separado, dados fictícios e capturas desktop (1440 px) e celular (390 px). Foram gerados PDFs pelo endpoint do servidor, sem instalar dependências ou alterar os dados das empresas existentes.

- [x] Telas de edição e documento sem corte horizontal a 390 px.
- [x] Configurar conteúdo empresarial, parâmetros e financiamento pela interface.
- [x] Preencher 12 consumos mensais, calcular, salvar rascunho e emitir pelo formulário.
- [x] Reemitir com condição financiada e obter versão distinta.
- [x] Baixar PDF A4 pelo servidor e inspecionar páginas renderizadas.
- [x] Gerar link, abrir sem sessão, declarar leitura e revogar.
- [x] Representante sem acesso à configuração e com políticas administrativas desabilitadas.
- [x] Fluxo completo sem erros JavaScript de página.
- [x] Modelo compacto: exemplo reduzido de 16 para 8 páginas A4, com as 13 seções e todos os resultados/premissas idênticos. Conferência visual de todas as páginas, sem folhas com notas ou linhas isoladas. Evidências em `../work/solar-compact/`.

Evidências em `../work/solar-qa/run-*/`: `result.json`, capturas e `proposal.pdf`. Banco exclusivamente de teste, não incluir esses arquivos em produção.

## Pendente de validação adicional

- [ ] Revisão humana das regras comerciais e premissas por empresa/distribuidora.
- [ ] Teste manual de teclado, leitor de tela e dispositivos móveis físicos.
- [ ] Casos extremos de textos extensos, catálogo máximo e impressão em outros navegadores.
- [ ] Tarifas individuais e alocação para múltiplas unidades; demanda/Grupo A.
- [ ] Integrações e aceite comercial autenticado na plataforma principal.

## Condições para produção · ainda não cumpridas

Autenticação central, permissões reais, entitlements/limites/tolerância, vínculo com CRM, fontes técnicas versionadas, revisão de engenharia, finanças completas, PDF pelo servidor, links seguros, assinatura/aceite, backups externos, monitoramento, migrações e rollback da plataforma real. Não apresentar esta versão como solução comercial completa.
