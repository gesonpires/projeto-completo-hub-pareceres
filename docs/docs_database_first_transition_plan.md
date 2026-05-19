# database-first-transition-plan.md

## Objetivo
Definir um plano técnico, incremental e seguro para transformar o projeto **Sistema Integrado de Apoio às Rotinas do CEE-SC** em uma arquitetura efetivamente **database-first**, sem abandonar a base já implementada no Cursor.

Este plano parte de quatro premissas:
1. o projeto atual **não deve ser abandonado**;
2. o banco de dados deve passar a ser a **base principal de verdade** do sistema;
3. a transição deve ocorrer por etapas pequenas, revisáveis e seguras;
4. o frontend deve ser ajustado **depois** da consolidação da persistência, das leituras centrais e das escritas transacionais.

---

## 1. Situação atual resumida
A análise do projeto indica que:
- a documentação técnica está madura e coerente com o domínio;
- a modelagem relacional já é forte e aderente ao problema;
- existe estrutura Prisma e base relacional já relevante;
- há recursos de importação, reconciliação, auditoria e relatórios em andamento;
- o projeto não sofre de ausência de domínio, mas sim de **desalinhamento entre implementação, schema versionado e camadas de aplicação**.

Os principais problemas identificados foram:
1. **drift entre `schema.prisma` e migrações**;
2. **leituras complexas espalhadas em páginas e rotas**;
3. **server actions com responsabilidades excessivas**;
4. **regras de proveniência e integridade ainda dependentes demais da aplicação**;
5. **duplicação potencial entre UI, actions e APIs**.

---

## 2. Meta arquitetural da transição
Ao final da transição, o sistema deverá operar com a seguinte lógica:

### Banco de dados central como fonte principal de verdade
O banco deverá concentrar e estruturar:
- instituições;
- mantenedoras;
- processos;
- documentos;
- atos autorizativos;
- eventos regulatórios;
- tramitações;
- lotes de importação e proveniência;
- auditoria.

### Camada de leitura centralizada
Consultas críticas não devem mais estar espalhadas em páginas ou ações. Elas devem ser expostas por **read models** reutilizáveis.

### Camada de escrita transacional
Mutações críticas devem ser executadas por **serviços transacionais**, com regras de integridade, auditoria e rastreabilidade explícitas.

### Frontend como consumidor
A interface deve consumir:
- read models para consulta;
- serviços/mutações bem encapsulados para escrita.

Ou seja, o frontend deixa de ser o lugar onde a regra de negócio “acontece” e passa a ser uma camada de operação sobre o núcleo persistente.

---

## 3. Estratégia geral de transição
A transição será dividida em quatro grandes etapas:

- **Etapa 1**: baseline do banco e eliminação do drift
- **Etapa 2**: reorganização da leitura
- **Etapa 3**: reorganização da escrita
- **Etapa 4**: consolidação, endurecimento e evolução

Para reduzir risco, a Etapa 1 será quebrada em **1A** e **1B**.

---

## 4. Etapa 1A — Diagnóstico e decisão de baseline do banco

## Objetivo
Estabelecer qual é o estado real de referência da persistência do projeto e preparar a correção segura do drift entre schema, migrações e banco existente.

## Pergunta central desta etapa
**Qual é a verdade atual do banco?**

Sem responder isso, qualquer migração corretiva pode reforçar um estado errado.

## Atividades
1. inspecionar `web/prisma/schema.prisma`;
2. inspecionar `web/prisma/migrations/*`;
3. comparar com o banco real usado nos testes atuais;
4. identificar exatamente:
   - tabelas presentes no schema e ausentes nas migrações;
   - colunas presentes no schema e ausentes nas migrações;
   - enums presentes no schema e ausentes nas migrações;
   - índices e constraints presentes no schema e ausentes nas migrações;
   - estruturas existentes no banco real, mas ainda não refletidas no repositório;
5. decidir qual ambiente servirá como **baseline oficial**:
   - o banco local mais atualizado;
   - o conjunto `schema + migrations` do repositório;
   - ou uma composição validada dos dois.

## Saídas esperadas
- relatório técnico de baseline;
- lista exata do drift atual;
- definição do baseline oficial;
- proposta da migração corretiva aditiva.

## Critério de aceite
A equipe consegue responder, sem ambiguidade:
- qual é o estado canônico atual do banco;
- quais diferenças precisam ser corrigidas;
- em que ordem isso será feito.

---

## 5. Etapa 1B — Migração aditiva de sincronização

## Objetivo
Criar e aplicar uma migração **aditiva e segura** que alinhe o banco versionado ao schema realmente esperado pela aplicação, sem destruir dados existentes.

## Nome sugerido da migração
`sync_schema_prisma`

## Diretrizes obrigatórias
1. a migração deve ser **somente aditiva**;
2. não remover colunas, tabelas ou enums nesta fase;
3. preferir colunas nullable ou com defaults compatíveis;
4. preservar compatibilidade com dados já existentes;
5. validar tudo em ambiente local e de staging antes de qualquer uso ampliado.

## Itens prováveis da migração
Conforme as análises feitas, esta migração deve contemplar, se confirmado no baseline:
- criação de enums ausentes;
- criação da tabela `AuditoriaExportJob`;
- adição de colunas faltantes em `ImportacaoLote`;
- adição de colunas faltantes em `Documento`;
- criação de índices faltantes;
- eventual adição de FKs ou constraints leves, quando forem seguras nesta fase.

## Cuidados importantes
- se existirem dados inconsistentes, não endurecer constraints cedo demais;
- separar correção estrutural de saneamento de conteúdo;
- evitar fazer limpeza sem trilha e sem inventário.

## Comandos Prisma a usar com cautela
Os comandos exatos devem ser validados pelo estado do projeto, mas a política recomendada é:
- usar `prisma migrate dev` para gerar migração em desenvolvimento controlado;
- usar `prisma migrate deploy` para aplicar migrações versionadas em ambiente reprodutível;
- usar `prisma migrate diff` para diagnosticar diferenças quando necessário;
- evitar usar `db push` como mecanismo normal de evolução do schema versionado.

## Smoke tests após a migração
Validar ao menos:
- importação de dados;
- export job de auditoria;
- leitura de documentos com vínculo a ato/evento;
- relatório institucional;
- busca/listagem básica.

## Critério de aceite
Ao final da etapa:
- `schema.prisma` e migrações deixam de divergir materialmente;
- um clone limpo do projeto consegue reproduzir o banco esperado;
- fluxos críticos não quebram após a sincronização.

---

## 6. Política de governança Prisma a partir desta etapa
Para impedir novo drift, adotar imediatamente as seguintes regras:

1. o `schema.prisma` não pode evoluir sem migração correspondente;
2. mudanças locais em banco não podem virar dependência invisível do projeto;
3. não usar `db push` como atalho permanente de evolução;
4. toda mudança estrutural relevante deve passar por migration versionada;
5. sempre testar o projeto em ambiente limpo após alteração estrutural;
6. registrar no repositório a política de uso de `migrate dev`, `migrate deploy` e `migrate diff`.

---

## 7. Etapa 2 — Reorganização da leitura

## Objetivo
Retirar consultas críticas da superfície do app e centralizá-las em **read models** reutilizáveis, consistentes e testáveis.

## Problema atual
Atualmente, parte das leituras relevantes ainda está espalhada em páginas, RSCs, rotas e módulos específicos. Isso gera:
- duplicação de lógica;
- divergência entre telas e relatórios;
- dificuldade de otimização;
- fragilidade da abordagem database-first.

## Princípio da etapa
Toda leitura importante do domínio deve nascer de uma função central explícita, e não da composição casual dentro de páginas.

## Prioridade dos read models
### P1 — Relatório institucional consolidado
Este deve ser o primeiro read model formal.

#### Motivo
Ele está no centro do valor do sistema e normalmente exige agregação consistente de:
- instituição;
- mantenedora;
- processos;
- atos autorizativos;
- documentos;
- eventos regulatórios.

#### Saída esperada
Uma função ou serviço central que produza a visão institucional consolidada, consumível por:
- tela;
- PDF;
- exportações futuras.

### P2 — Lista de instituições
Read model responsável por:
- paginação;
- filtros;
- ordenação;
- campos resumidos de listagem.

### P3 — Busca global
Read model da busca principal, combinando filtros sobre:
- instituição;
- mantenedora;
- CNPJ;
- INEP;
- processo;
- ato autorizativo.

### P4 — Detalhe institucional e módulos correlatos
Após estabilizar relatório, lista e busca, extrair leituras secundárias de detalhe e módulos administrativos.

## Local sugerido para os read models
Estruturas como:
- `web/src/server/queries/*`
- ou `web/src/server/read-models/*`

O importante é que fiquem fora da camada de página e sejam reaproveitáveis.

## Critério de aceite
Ao final desta etapa:
- relatórios e telas críticas deixam de montar leitura por conta própria;
- existe uma fonte única para leitura institucional consolidada;
- fica mais fácil otimizar SQL, paginação e cache de forma controlada.

---

## 8. Etapa 3 — Reorganização da escrita

## Objetivo
Extrair mutações críticas de server actions e outros pontos dispersos para **serviços transacionais** bem definidos.

## Problema atual
Hoje, parte das mutações mistura no mesmo lugar:
- validação;
- acesso Prisma;
- auditoria;
- IO;
- redirecionamento;
- regra de negócio.

Isso dificulta:
- testes;
- reaproveitamento;
- auditoria consistente;
- evolução segura do domínio.

## Princípio da etapa
Toda escrita importante deve passar por serviço explícito, idealmente transacional, com responsabilidade clara.

## Serviços prioritários
### S1 — `instituicaoMutationsService`
Responsável por:
- atualizar dados institucionais;
- atualizar mantenedora vinculada quando aplicável;
- aplicar auditoria;
- garantir consistência mínima da operação.

### S2 — `reconciliacaoAjustesService`
Responsável por:
- ajustes derivados de reconciliação;
- associação ou correção de vínculos;
- tratamento de decisões que nascem do processo de importação/saneamento.

### S3 — `documentoLoteService`
Responsável por:
- mutações em lote ligadas a documentos;
- vínculo com atos/eventos;
- atualização consistente com proveniência.

### S4 — `auditoriaExportJobService`
Responsável por:
- criação e acompanhamento dos jobs de exportação de auditoria;
- persistência dos estados;
- isolamento do fluxo específico de export.

### S5 — Serviços adicionais posteriores
Depois dos prioritários, extrair:
- mutações de importação;
- mutações administrativas de usuários/perfis;
- mutações de tramitação ou workflows secundários.

## Local sugerido para os serviços
Estruturas como:
- `web/src/server/services/*`
- com separação por domínio/módulo.

## Regras de implementação
1. evitar regras de negócio relevantes diretamente na action;
2. a action deve orquestrar entrada e saída, não encapsular o domínio inteiro;
3. sempre que houver múltiplas escritas relacionadas, considerar `prisma.$transaction`;
4. auditoria deve ocorrer no mesmo fluxo lógico da mutação crítica.

## Critério de aceite
Ao final da etapa:
- mutações centrais deixam de depender de lógica espalhada;
- a escrita passa a ser auditável e mais testável;
- o sistema fica mais coerente com o modelo database-first.

---

## 9. Etapa 4 — Consolidação e endurecimento progressivo

## Objetivo
Depois de alinhar banco, leitura e escrita, avançar para consolidar a arquitetura e endurecer a integridade de forma gradual.

## Frentes desta etapa
### 4.1 Integridade relacional progressiva
Avaliar, com base no estado dos dados:
- FKs adicionais;
- unique constraints;
- índices compostos;
- restrições de proveniência;
- constraints antes deixadas leves por compatibilidade.

### 4.2 Busca e desempenho
Somente depois de estabilizar os read models:
- revisar queries críticas;
- adicionar índices específicos;
- otimizar busca global;
- considerar mecanismos dedicados de busca em fase posterior.

### 4.3 Redução de duplicação entre API e Actions
Consolidar regras comuns para evitar que:
- UI;
- server actions;
- rotas de API
mantenham versões paralelas da mesma lógica.

### 4.4 Política permanente de arquitetura
Formalizar no projeto:
- banco como fonte principal;
- leitura via read models;
- escrita via serviços transacionais;
- frontend como consumidor.

## Critério de aceite
O sistema passa a operar com clareza arquitetural, sem drift estrutural grave, com leitura e escrita centralizadas e com base pronta para evolução futura.

---

## 10. Ordem prática de execução

## Etapa 1A
- diagnosticar baseline;
- decidir ambiente de referência;
- listar drift exato.

## Etapa 1B
- gerar migração `sync_schema_prisma`;
- validar em dev;
- validar em staging;
- executar smoke tests.

## Etapa 2
- extrair read model do relatório institucional;
- depois lista de instituições;
- depois busca global.

## Etapa 3
- extrair `instituicaoMutationsService`;
- depois `reconciliacaoAjustesService`;
- depois serviços de lote/importação/export job.

## Etapa 4
- endurecer integridade gradualmente;
- revisar índices e desempenho;
- unificar regra entre APIs e Actions;
- consolidar política arquitetural.

---

## 11. O que manter do projeto atual
Não abandonar nem refazer sem necessidade:
- documentação já produzida;
- modelagem relacional já aderente ao domínio;
- estrutura Prisma existente;
- módulos de importação, reconciliação, auditoria e relatório que possam ser reorganizados;
- frontend já construído como consumidor futuro da base consolidada.

---

## 12. O que refatorar
Priorizar refatoração em:
- persistência versionada;
- camadas de leitura;
- camadas de escrita;
- ações excessivamente grossas;
- consultas espalhadas em páginas;
- pontos onde proveniência depende apenas da disciplina do app.

---

## 13. O que adiar
Adiar até a estabilização do núcleo:
- novas features visuais grandes;
- mecanismos sofisticados de busca textual;
- automações mais ambiciosas de geração documental;
- endurecimento agressivo de constraints antes de validar os dados reais.

---

## 14. O que não fazer
1. não abandonar o projeto atual;
2. não reescrever tudo do zero;
3. não adicionar novas grandes features antes da Etapa 1;
4. não deixar o `schema.prisma` continuar andando sem migração correspondente;
5. não usar o frontend como centro da lógica de domínio.

---

## 15. Definição de sucesso da transição
A transição será considerada bem-sucedida quando:
- o banco de dados estiver alinhado, versionado e reproduzível;
- as leituras críticas nascerem de read models centrais;
- as escritas críticas nascerem de serviços transacionais;
- o frontend consumir a base consolidada em vez de concentrar a regra;
- a equipe puder evoluir o sistema sem depender de drift local ou lógica espalhada.

---

## 16. Prompt operacional recomendado para o Cursor
### Para Etapa 1A
```text
Implemente apenas a Etapa 1A do plano database-first.

Objetivo:
- diagnosticar o baseline real do banco;
- comparar web/prisma/schema.prisma, web/prisma/migrations e o banco atual;
- listar exatamente o diff que precisa virar migração aditiva;
- não alterar frontend nem read models ainda.

Quero como saída:
1. relatório técnico do baseline;
2. proposta da migration sync_schema_prisma;
3. lista de comandos Prisma a executar;
4. riscos e cuidados.
```

### Para Etapa 1B
```text
Implemente a Etapa 1B.

Objetivo:
- criar a migration aditiva sync_schema_prisma;
- manter compatibilidade com dados existentes;
- não remover nada;
- preparar validação em dev/staging.

Ao final:
1. mostre o conteúdo da migration;
2. explique cada alteração;
3. diga quais smoke tests devem ser executados.
```

### Para Etapa 2
```text
Implemente apenas a primeira parte da Etapa 2.

Objetivo:
- extrair o read model do relatório institucional;
- remover da superfície da UI a lógica central de agregação;
- manter o comportamento atual.

Quero:
1. novo módulo de leitura centralizado;
2. ajuste mínimo dos pontos consumidores;
3. explicação das mudanças;
4. riscos e pontos ainda pendentes.
```

### Para Etapa 3
```text
Implemente apenas a primeira parte da Etapa 3.

Objetivo:
- criar o instituicaoMutationsService;
- mover para ele a lógica central de mutação da ficha institucional;
- manter auditoria e consistência;
- não refatorar todos os fluxos de uma vez.

Quero:
1. serviço criado;
2. actions mínimas adaptadas;
3. explicação da transação e da auditoria;
4. pontos futuros de extração.
```

---

## 17. Reanálise crítica do plano
### Pontos fortes
- preserva o investimento já feito;
- ataca primeiro o problema mais estrutural;
- reorganiza arquitetura sem radicalismo;
- respeita a ordem correta: banco, leitura, escrita, frontend.

### Pontos de atenção
- a Etapa 1 depende de definir com clareza o baseline oficial;
- read models podem revelar inconsistências antigas de dados;
- alguns serviços transacionais exigirão revisão fina das actions atuais;
- endurecimento de constraints deve ser progressivo e guiado por dados reais.

### Refinamento futuro recomendado
Depois da Etapa 2 e 3, produzir dois documentos complementares:
1. `read-models-spec.md`
2. `mutation-services-spec.md`

Esses documentos ajudarão a estabilizar a segunda fase do projeto.

