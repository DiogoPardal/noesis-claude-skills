# Noesis AI Skills (Claude Code)

Catálogo central de skills e plugins da Noesis para o Claude Code. Cada projecto escolhe só as capacidades de que precisa e recebe-as a partir deste repositório.

## Como funciona

```text
skills/  runtime/  capabilities/      ← fonte (é aqui que se edita)
              │  npm run build
              ▼
plugins/<capacidade>/                 ← gerado: um plugin do Claude Code por capacidade
.claude-plugin/marketplace.json       ← gerado: o catálogo "noesis"
              │  /plugin install <capacidade>@noesis
              ▼
projectos que activam só o que querem
```

Cada capacidade junta até três peças:

| Peça | O que é | Onde vive |
|---|---|---|
| **Skill** | Instruções que o Claude lê quando precisa (`SKILL.md`, formato Agent Skills) | `skills/<id>/` |
| **Script** | Código determinístico: esperar, compactar, contar | `runtime/` |
| **Hook** | Quando o Claude Code corre o script (evento + matcher) | `capabilities/<id>.json` |

## Capacidades

| Capacidade | Skill | Hooks |
|---|---|---|
| `mentor-polling` | Como fazer polling e ler runs do OutSystems Mentor | `PreToolUse` (espera 45 s entre consultas ao mesmo run) e `PostToolUse` (compacta a resposta) em `mcp__.*__mentor_get_run$` |
| `token-usage` | Como reportar o consumo de tokens do projecto | `Stop` e `SubagentStop` → `.claude/hooks/token-stats.json` |

## Início rápido

```text
/plugin marketplace add DiogoPardal/noesis-claude-skills
/plugin install mentor-polling@noesis
```

Detalhes, activação por projecto e desinstalação em [Instalação](docs/instalacao.md).

## Desenvolvimento

Requer Node.js 18 ou superior. Não há dependências npm.

```bash
npm run validate   # valida skills e manifestos
npm run build      # gera plugins/ e .claude-plugin/marketplace.json
npm run check      # falha se o que está gerado não corresponder às fontes
npm test           # testes com dados sintéticos
```

Depois de alterar `skills/`, `runtime/` ou `capabilities/`, corra `npm run build` e faça commit das fontes e dos ficheiros gerados.

## Limitações conhecidas

- **`mentor-polling`:** quando compacta uma resposta, o filtro retira `structuredContent`, que ainda teria a resposta completa.
- **`token-usage`:** se as linhas de uma mesma mensagem ficarem divididas entre duas execuções do hook, essa mensagem é contada duas vezes.
- **Actualizações:** a versão nova chega no arranque da sessão, não antes de cada utilização de uma skill. Veja [Actualizações e segurança](docs/actualizacao-e-seguranca.md).

## Documentação

- [Instalação, activação por projecto e desinstalação](docs/instalacao.md)
- [Acrescentar uma skill nova](docs/adicionar-skill.md)
- [Actualizações e segurança](docs/actualizacao-e-seguranca.md)
- [Migração a partir de hooks locais e rollback](docs/migracao-e-rollback.md)
