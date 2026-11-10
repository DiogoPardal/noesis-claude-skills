# Noesis AI Skills (Claude Code)

Catálogo central de skills e plugins da Noesis para o Claude Code. Cada projecto escolhe só as capacidades de que precisa e recebe-as a partir deste repositório.

## Como funciona

```text
plugins/<id>/                         ← um plugin por capacidade: é aqui que se edita
.claude-plugin/marketplace.json       ← o catálogo "noesis", que lista os plugins
              │  npm test (valida e testa)  →  commit  →  push
              ▼
Claude Code: adicionar o catálogo e instalar só os plugins que se querem
```

O que está em `plugins/<id>/` é exactamente o que o Claude Code instala. Não há passo de build nem cópias geradas.

Cada plugin junta até quatro peças:

| Peça | O que é | Onde vive |
|---|---|---|
| **Manifesto** | Nome, versão e descrição do plugin | `plugins/<id>/.claude-plugin/plugin.json` |
| **Skill** | Instruções que o Claude lê quando precisa (`SKILL.md`, formato Agent Skills) | `plugins/<id>/skills/<skill>/` |
| **Script** | Código determinístico: esperar, compactar, contar | `plugins/<id>/scripts/` |
| **Hook** | Quando o Claude Code corre o script (evento + matcher) | `plugins/<id>/hooks/hooks.json` |

## Capacidades

| Capacidade | Skill | Hooks |
|---|---|---|
| `mentor-polling` | Como fazer polling e ler runs do OutSystems Mentor | `PreToolUse` (espera 45 s entre consultas ao mesmo run) e `PostToolUse` (compacta a resposta) em `mcp__.*__mentor_get_run$` |
| `token-usage` | Como reportar o consumo de tokens do projecto | `Stop` e `SubagentStop` → `.claude/hooks/token-stats.json` |

## Início rápido

Requisitos: acesso de leitura a este repositório e Node.js 18+ no `PATH`.

1. No Claude desktop, área Code, escreva `/plugins` no chat. Abre-se **Customize → Plugins**.
2. **Add** → **Add marketplace**, cole `https://github.com/DiogoPardal/noesis-claude-skills` e clique em **Sync**.
3. Instale `mentor-polling` e/ou `token-usage` a partir do catálogo.
4. Abra uma sessão nova.

O passo a passo com imagens, o âmbito de activação, os comandos de terminal e a desinstalação estão em [Instalação](docs/instalacao.md).

## Desenvolvimento

Requer Node.js 18 ou superior. Não há dependências npm.

```bash
npm run validate   # valida os plugins e o catálogo
npm test           # valida e corre os testes com dados sintéticos
```

Para alterar um plugin, faça o seguinte:

1. Edite os ficheiros dentro de `plugins/<id>/`.
2. Suba `version` em `plugins/<id>/.claude-plugin/plugin.json` e, com o mesmo valor, na entrada do plugin em `.claude-plugin/marketplace.json`. Sem subir a versão, a alteração não chega a quem já instalou.
3. Corra `npm test`.
4. Faça commit e push.

O validador falha se as duas versões forem diferentes. Para criar um plugin novo, veja [Acrescentar um plugin](docs/adicionar-skill.md).

## Limitações conhecidas

- **`mentor-polling`:** quando compacta uma resposta, o filtro retira `structuredContent`, que ainda teria a resposta completa.
- **`token-usage`:** se as linhas de uma mesma mensagem ficarem divididas entre duas execuções do hook, essa mensagem é contada duas vezes.
- **Actualizações:** só chega versão nova quando `version` sobe. A actualização automática vem desligada para este catálogo. Uma versão nova só se aplica com `/reload-plugins` ou numa sessão nova, nunca antes de cada utilização de uma skill. Veja [Actualizações e segurança](docs/actualizacao-e-seguranca.md).

## Documentação

- [Instalação, activação e desinstalação](docs/instalacao.md)
- [Acrescentar um plugin ou uma skill](docs/adicionar-skill.md)
- [Actualizações e segurança](docs/actualizacao-e-seguranca.md)
- [Migração a partir de hooks locais e rollback](docs/migracao-e-rollback.md)
