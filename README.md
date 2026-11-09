# Noesis AI Skills (Claude Code)

Catálogo central de skills e plugins da Noesis para o Claude Code. Cada projecto escolhe só as capacidades de que precisa e recebe as versões estáveis a partir deste repositório.

> Estado: **fase 1 e 2 (local)**. Ainda não está publicado em nenhum repositório. Veja "Decisões pendentes" no fim.

## Ideia

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

Três peças por capacidade:

| Peça | O que é | Onde vive |
|---|---|---|
| **Skill** | Instruções que o Claude lê quando precisa (`SKILL.md`, formato Agent Skills) | `skills/<id>/` |
| **Script** | Código determinístico: esperar, compactar, contar | `runtime/` |
| **Hook** | Quando o Claude Code corre o script (evento + matcher) | `capabilities/<id>.json` |

## Capacidades incluídas

| Capacidade | Skill | Hooks | Origem |
|---|---|---|---|
| `mentor-polling` | Como fazer polling e ler runs do Mentor | `PreToolUse` (espera 45 s por run) e `PostToolUse` (compacta a resposta) em `mcp__.*__mentor_get_run$` | `dresend/scripts-ai-outsystems@e957963` |
| `token-usage` | Como reportar o consumo de tokens | `Stop` e `SubagentStop` → `.claude/hooks/token-stats.json` | idem |
| `os-batch-planner` | Planear projectos OutSystems em lotes | — | idem |

Os scripts foram portados **sem mudar comportamento**. As únicas diferenças estão anotadas no topo de cada ficheiro (o helper do filtro passou a ser carregado sempre da própria pasta; o tracker ignora um BOM no stdin, como o tracker global).

## Comandos

Requer Node.js 18 ou superior. Não há dependências npm.

```bash
npm run validate   # valida skills e manifestos
npm run build      # gera plugins/ e .claude-plugin/marketplace.json
npm run check      # falha se o que está gerado não corresponder às fontes
npm test           # testes com dados sintéticos
```

## Documentação

- [Instalação, activação por projecto e desinstalação](docs/instalacao.md)
- [Acrescentar uma skill nova](docs/adicionar-skill.md)
- [Actualizações e segurança](docs/actualizacao-e-seguranca.md)
- [Migração a partir dos hooks actuais e rollback](docs/migracao-e-rollback.md)

## Observações encontradas na origem

Factos verificados em `dresend/scripts-ai-outsystems@e957963`, mantidos tal como estão até haver decisão:

1. `.claude/settings.local.json` está no Git com `MENTOR_HOOK_DEBUG=1`, por isso quem clona grava o evento completo de cada `mentor_get_run` em `.mentor-hook-debug.jsonl`, sem limite. **Neste catálogo o debug está desligado por omissão** (o código só o liga se a variável existir) e não há `settings.local.json`.
2. O `.gitignore` da origem não exclui os ficheiros de estado dos hooks. O deste catálogo já os exclui, para servir de exemplo aos projectos.
3. O filtro apaga sempre `structuredContent` quando substitui a resposta. Mantido; há um teste que documenta este comportamento.
4. O tracker pode contar duas vezes uma mensagem cujas linhas fiquem divididas entre duas execuções. Mantido; há um teste "known limitation".
5. O `SKILL.md` do `os-batch-planner` apontava para `references/figma-to-outsystems-mapping.md`, que não existe. **Corrigido aqui** para `references/figma-mapping.md`; o validador passa a detectar este tipo de erro.

## Decisões pendentes

- Repositório de destino (Noesis dedicado ou `dresend/scripts-ai-outsystems`) e organização/nome.
- Manter ou não o descarte de `structuredContent` e corrigir a contagem dupla do tracker.
- Unificar o tracker global (`~/.claude/hooks/token-usage-tracker.js`) com o plugin `token-usage`.
- Fase 3: verificação de actualidade antes de cada skill (ver [Actualizações e segurança](docs/actualizacao-e-seguranca.md)).
