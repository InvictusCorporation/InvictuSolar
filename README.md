# Invictus Systems · módulo solar 0.2

Módulo local de homologação com duas partes conectadas: preparação dos dados comerciais e proposta profissional emitida. A evolução segue o escopo consolidado e a organização funcional do PDF de referência, sem copiar sua identidade, clientes, taxas ou resultados.

## Executar

Node.js **24 ou superior**, com `node:sqlite`. Sem instalação de pacotes.

```sh
node server.mjs
```

Abra **http://127.0.0.1:4180**. `SOLAR_PORT` altera a porta. O servidor aceita somente loopback e bloqueia `NODE_ENV=production`. Não publicar este adaptador em produção.

PDF no servidor requer Chromium local. No Windows, Chrome ou Edge são encontrados nos caminhos padrão. Para outro caminho/sistema, configure `SOLAR_PDF_BROWSER` com o executável. Se indisponível, permanece a impressão pelo navegador. Não há serviço externo ou chamada paga.

## Fluxo de demonstração

1. Entre em Aurora Solar ou Horizonte Energia como administrador.
2. Em **Minha empresa**, configure identidade, logo PNG/JPEG/WebP de até 350 KB, dados cadastrais, apresentação, missão, visão, valores, diferenciais, serviços, parceiros, condições, garantias, responsabilidades, exclusões e conclusão. Conteúdo em branco é identificado como pendente.
3. Configure perdas, validade, área por módulo, prazo e desconto máximo. Os valores iniciais são exemplos de cada empresa; 20% não é regra fixa.
4. Habilite pagamento à vista e/ou condições ilustrativas de financiamento: instituição, prazo, taxa mensal, entrada, tarifas financiadas, Price/SAC e fonte/data. Solar Programado depende da plataforma existente.
5. Cadastre premissas financeiras confirmadas e suas fontes. Campos vazios não significam zero. Parâmetros administrativos de projeção não podem ser alterados pelo representante.
6. Crie a proposta: dados fictícios do cliente, cidade/UF, endereço, telhado e até dez unidades consumidoras. Cada unidade usa média manual ou doze consumos de janeiro a dezembro, com período informado. Fatura opcional, sem extração automatizada.
7. Informe irradiação manual e fonte/período, selecione equipamentos e pagamento. Se a empresa bloquear a entrada manual, uma fonte integrada será necessária para prosseguir.
8. Calcule, confira o resumo e salve o rascunho. Confirme ciência da revisão técnica pendente e emita uma versão demonstrativa.
9. Abra a proposta completa ou **Baixar PDF da versão**. PDF e página usam o mesmo HTML congelado na emissão e os valores, equipamentos e premissas da mesma versão.
10. Gere link local com validade de 1 a 168 horas, limitado ao vencimento da proposta. Funciona sem sessão, por posse do token, somente neste computador; pode ser revogado. O token é exibido uma vez, e só seu hash fica no banco.
11. No link, registre apenas ciência de leitura fictícia. Conserva nome/identificação autodeclarados, data/hora, método e hash da versão. **Não é aceite comercial, verificação de identidade ou assinatura digital.**
12. Edite o rascunho e reemita. Mudanças posteriores em preços, configurações, CSS ou renderizador não alteram o HTML de novas versões já emitidas.

**Não cadastre clientes reais, credenciais ou dados pessoais neste ambiente.** A escolha aberta de perfil é demonstrativa, não autenticação comercial.

## Proposta comercial

Capa e treze seções numeradas cobrem: apresentação; diferenciais e serviços; missão, visão, valores e parceiros; projeto e unidades; dimensionamento; gráfico consumo × geração; equipamentos/materiais/serviços; investimento e pagamento; conta sem solar, residual e economia; fluxo de caixa com gráfico, payback, VPL e TIR quando determinável; CDB/poupança; indicador ambiental com fonte; prazos, garantias, responsabilidades e exclusões; conclusão, identificação e encaminhamento do aceite.

Documento responsivo e impressão A4. Seções menores são agrupadas na impressão, com tabelas compactas e cabeçalhos repetidos quando necessário. O exemplo completo de homologação ocupa 8 páginas (antes, 16); projetos com mais conteúdo ou parcelas podem ocupar mais. Seções se expandem conforme o conteúdo; não há editor livre de páginas. Sem histórico mensal, o gráfico identifica a média repetida. Geração por média anual repetida, não previsão sazonal. O novo layout aplica-se às novas emissões; documentos emitidos anteriormente permanecem congelados.

## Cálculos e limites

Dimensionamento: `consumo / (irradiação × 365,25/12 × (1 − perdas/100))`. Módulos inteiros arredondados para cima. Inversores por potência nominal, sem validação de strings, MPPT, tensões ou correntes. Área dos módulos não inclui corredores ou afastamentos.

Moeda em centavos. Markup é percentual sobre custo, não margem sobre venda. Catálogo inclui módulos, inversores, estruturas, cabos, proteções, mão de obra, projeto, frete e serviços, com marca, modelo, unidade, potência, validade e situação.

Cenário financeiro **simplificado e parametrizado**, sem enquadramento regulatório automático. Fórmulas e limitações em [docs/CALCULOS.md](docs/CALCULOS.md). Resultados exigem premissas completas e confirmação. Múltiplas unidades dimensionam o conjunto, mas a economia exige modelo tarifário individual ainda pendente. Grupo A exige demanda e modelo específico, também pendentes. Nenhum dos dois usa indevidamente o cenário de uma unidade do Grupo B.

Financiamento ilustrativo, sem aprovação ou CET certificado. Retorno considera entrada, parcelas, manutenção e substituição. Comparativos exigem taxas, tributação, fonte e data. Indicador ambiental exige fator e metodologia; sem árvores ou créditos inventados.

## Persistência e proteção

SQLite em `data/demo.sqlite`, com WAL/SHM. Sessões em memória; registros persistem após reinício. Versões, parâmetros internos, documentos e registros de leitura bloqueiam UPDATE/DELETE ordinários. Custos, markup, perdas e área interna não são enviados ao representante. Premissas públicas do cenário são exibidas no documento.

Schema local `user_version=2`, com tabelas adicionais de documentos, links e registros de leitura. Não remove registros 0.1. Documentos antigos mantêm formato legado e não ganham cálculos retrospectivos. Não é migração da plataforma central.

Hash da versão: SHA-256 do snapshot JSON. Digest do HTML canônico: SHA-256 da string HTML serializada em JSON antes de inserir seus próprios identificadores. O HTML final tem digest separado no banco. **Não são assinatura digital nem hash dos bytes do PDF**; metadados do navegador podem mudar entre exportações. O administrador do SQLite pode alterar o schema; não há garantia contra o operador do banco.

Backup: pare o servidor e copie **todo** o diretório `data`. Não copie só `.sqlite` durante escrita. Rollback: restaure juntos código e dados correspondentes, com servidor parado. Uma cópia integral anterior à evolução está em `../work/solar-backup-*`. Encerramento: **Ctrl+C**.

## Verificação

```sh
node --test tests/*.test.mjs
```

Testes de domínio/API: dimensionamento, moeda, permissões, isolamento, CSRF/origem, vencimentos/fuso, snapshots, persistência, financiamento, projeções, links e leitura. Validação de navegador usa banco separado; capturas desktop/celular e PDF em `../work/solar-qa/`. Veja [docs/HOMOLOGACAO.md](docs/HOMOLOGACAO.md).

## Integração e escopo restante

CRM, autenticação, usuários/limites, Master, assinaturas mensais, entitlements, financeiro, contratos/assinatura, Solar Programado, fontes automáticas e publicação externa dependem da auditoria do repositório principal. Nenhuma conexão é apresentada como funcional. Referência de cliente manual, sem CRM paralelo. Eventos locais não comprovam visualização humana nem foram enviados ao CRM.

Links não funcionam em outro aparelho enquanto o servidor estiver em loopback. Responsividade foi testada por viewport móvel; acesso externo exige infraestrutura, HTTPS, identidade e política de exposição autorizados. **Nenhum deploy foi realizado.**

Veja [docs/INTEGRACAO.md](docs/INTEGRACAO.md) e [docs/ESCOPO.md](docs/ESCOPO.md).
