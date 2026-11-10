# Actualizações e segurança

## Como uma versão nova chega a cada pessoa

São três passos distintos. Fazer só o primeiro não muda nada no que está a correr.

| Passo | O que faz | O que **não** faz |
|---|---|---|
| 1. Actualizar o catálogo | Volta a ler o repositório e a lista de plugins e versões disponíveis | Não actualiza os plugins já instalados |
| 2. Actualizar os plugins instalados | Descarrega a versão nova de cada plugin para a cache do Claude Code | Não muda a sessão que já está aberta |
| 3. Aplicar | A sessão passa a usar a versão nova: `/reload-plugins` ou uma sessão nova | — |

Recomendamos abrir uma **sessão nova** depois de actualizar. A documentação oficial diz que `/reload-plugins` também troca os hooks, mas não o testámos.

### Só há versão nova quando `version` sobe

Os plugins do catálogo declaram `version` (em `capabilities/<id>.json`, copiada para `plugin.json` e `marketplace.json`). Com `version` definida, o Claude Code só entrega uma cópia nova quando esse número muda. Commits novos com a mesma versão **não chegam** a quem já instalou. Por isso, qualquer alteração a uma capacidade passa por subir `version`, correr `npm run build` e fazer commit.

### Actualização manual

| Passo | Dentro de uma sessão do Claude Code no terminal | Numa shell, com `claude` no `PATH` |
|---|---|---|
| 1. Catálogo | `/plugin marketplace update noesis` | `claude plugin marketplace update noesis` |
| 2. Plugins | `/plugin` → separador **Installed** → **Update now** | `claude plugin update mentor-polling@noesis` (um comando por plugin) |
| 3. Aplicar | `/reload-plugins` ou sessão nova | Sessão nova |

**Na app desktop:** na janela de plugins (`/plugins`, depois **Customize → Plugins**) vimos os rótulos **New** e **Installed locally** e um menu **…** por plugin. Não confirmámos ainda um controlo de actualização nessa janela.

### Actualização automática

- **Estado por omissão:** desligada para marketplaces de terceiros, como o `noesis`.
- **Como ligar, segundo a documentação oficial** (ainda não testado neste catálogo):
  - numa sessão do Claude Code no terminal, `/plugin` → separador **Marketplaces** → `noesis` → **Enable auto-update**;
  - ou a chave `autoUpdate` na entrada do marketplace em `extraKnownMarketplaces`.
- **Na app desktop:** não confirmámos um controlo de auto-update na janela de plugins. Isso não quer dizer que não exista; está por validar.
- **Quando corre:** depois da primeira mensagem da sessão, após uma espera aleatória de até dez minutos. Actualiza as cópias em disco. A sessão em curso continua com a versão que carregou e mostra um aviso para correr `/reload-plugins`.
- **Credenciais:** a actualização em segundo plano usa as credenciais Git da máquina e nunca as pede. Para o GitHub, a documentação indica `gh auth login` seguido de `gh auth setup-git`. Definir só `GITHUB_TOKEN` não chega.

### O que não existe

Não há verificação de versão antes de cada prompt nem antes de cada utilização de uma skill.

### Limites desta validação

Fontes: documentação oficial do Claude Code consultada a 2026-11-10 (code.claude.com: *Discover and install plugins*, *Host a marketplace*, *Plugin loading*). Validámos o percurso gráfico na app Claude desktop 4.23118.1, com Claude Code 2.1.321, até à instalação dos dois plugins. Não foram testados nesta versão: a actualização manual, o auto-update e o `/reload-plugins`.

## Verificação antes de cada skill (possível evolução)

O Claude Code tem pontos de integração que permitiriam verificar a versão antes de cada skill:

- `PreToolUse` com matcher `Skill`, quando é o modelo a invocar a skill;
- `UserPromptExpansion`, quando o utilizador escreve `/skill`;
- o Claude Code detecta alterações ao texto de `SKILL.md` durante a sessão.

Só deve ser anunciado como garantido depois de um teste de ponta a ponta o provar. Requisitos: fonte e ref autorizadas; registo do SHA usado; download para uma pasta temporária, validação (`npm run validate`) e activação atómica; manter a última versão válida; lock contra actualizações simultâneas; aviso visível quando está sem rede; modo estrito opcional; nunca executar código descarregado durante a actualização.

## Canais

| Canal | Ref | Para quem |
|---|---|---|
| Estável (recomendado) | Última tag semver, criada por PR revisto | Todos os projectos |
| Desenvolvimento | Branch `main` | Só quem mantém o catálogo |
| Fixo | Uma tag ou SHA | Projectos que precisam de reprodutibilidade |

Hooks são código que corre na máquina de cada pessoa. Por isso, mudanças em `runtime/` ou nos hooks devem chegar só por tags revistas, nunca directamente da `main`.

## Regras de segurança

- O build e a validação nunca executam scripts das skills.
- Os logs de rotina guardam só contagens e identificadores, nunca conteúdo de respostas ou conversas.
- O debug integral (`MENTOR_HOOK_DEBUG`) é opt-in, escreve o evento completo e não tem rotação; use-o só para diagnóstico e apague o ficheiro depois.
- Nenhum script altera `settings.json`, ficheiros de código do projecto ou conteúdo editado pelo utilizador; só escrevem em `.claude/hooks/`.
- O repositório é privado: cada pessoa precisa de acesso de leitura no GitHub; não guarde tokens em ficheiros de configuração.
