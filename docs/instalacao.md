# Instalação, activação por projecto e desinstalação

Requisitos: Claude Code, Node.js 18+ no `PATH` (os hooks correm `node`), e acesso de leitura ao repositório do catálogo.

## 1. Instalar a partir do GitHub

```text
/plugin marketplace add DiogoPardal/noesis-claude-skills
/plugin install os-batch-planner@noesis
```

Para fixar uma tag ou branch, acrescente `#<ref>` (por exemplo `DiogoPardal/noesis-claude-skills#v1.0.0`); ver [Actualizações e segurança](actualizacao-e-seguranca.md). Sem ela, usa a branch por omissão.

O repositório é privado: o Claude Code usa as credenciais do Git da máquina para o ler.

## 2. Testar alterações a partir de uma cópia local

Para experimentar alterações antes de as enviar para o GitHub, aponte o marketplace para a pasta do repositório:

```text
/plugin marketplace add C:\caminho\para\noesis-claude-skills
/plugin install mentor-polling@noesis
```

## 3. Activar só algumas capacidades num projecto

Para que toda a equipa de um projecto use as mesmas capacidades, ponha no `.claude/settings.json` **do projecto**:

```json
{
  "extraKnownMarketplaces": {
    "noesis": { "source": { "source": "github", "repo": "DiogoPardal/noesis-claude-skills" } }
  },
  "enabledPlugins": {
    "mentor-polling@noesis": true,
    "os-batch-planner@noesis": true
  }
}
```

Capacidades que não estejam em `enabledPlugins` não aparecem nesse projecto. Quem abre o projecto é convidado a confiar no marketplace e a instalar os plugins.

## 4. Onde ficam os ficheiros

- O plugin é copiado para a cache do Claude Code no perfil do utilizador; nada é copiado para dentro do projecto.
- Os hooks escrevem estado no projecto, em `.claude/hooks/`. Acrescente ao `.gitignore` do projecto:

```gitignore
.claude/hooks/.mentor-poll-state.json
.claude/hooks/.mentor-finished-runs.json
.claude/hooks/.mentor-get-run-filter.jsonl
.claude/hooks/.mentor-hook-debug.jsonl
.claude/hooks/token-stats.json
.claude/hooks/*.tmp
```

## 5. Configuração

| Variável | Omissão | Efeito |
|---|---|---|
| `MENTOR_POLL_INTERVAL_MS` | `45000` | Intervalo mínimo entre polls do mesmo run. Mantenha abaixo de 60 000 (timeout do hook). |
| `MENTOR_HOOK_DEBUG` | não definida | Se definida, grava o **evento completo** (incluindo a resposta do Mentor) em `.claude/hooks/.mentor-hook-debug.jsonl`, sem rotação. Use só para diagnóstico e apague o ficheiro depois. |

## 6. Conflitos a evitar

- **Hooks locais equivalentes:** se o projecto tiver hooks próprios para `mentor_get_run` em `.claude/settings.json`, desactive-os antes de activar `mentor-polling`. Com os dois, a espera de 45 s acontece duas vezes.
- **Outro contador de tokens:** se já tiver um hook (por exemplo global, em `~/.claude/settings.json`) que grava em `.claude/hooks/token-stats.json`, não active também `token-usage`; os dois gravam no mesmo ficheiro.

## 7. Desinstalar

```text
/plugin uninstall mentor-polling@noesis
```

Retire também a entrada de `enabledPlugins` do projecto. Os ficheiros de estado em `.claude/hooks/` não são apagados automaticamente; apague-os à mão se quiser.
