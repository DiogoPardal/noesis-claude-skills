# Instalação, activação por projecto e desinstalação

Requisitos: Claude Code, Node.js 18+ no `PATH` (os hooks correm `node`), e acesso de leitura ao repositório do catálogo.

## 1. Testar localmente (antes de publicar)

Numa sessão do Claude Code, aponte o marketplace para a pasta local:

```text
/plugin marketplace add C:\caminho\para\noesis-ai-skills
/plugin install mentor-polling@noesis
```

## 2. Instalar a partir do GitHub (depois de publicado)

```text
/plugin marketplace add <org>/noesis-ai-skills#stable
/plugin install os-batch-planner@noesis
```

`#stable` fixa a ref (ver [Actualizações e segurança](actualizacao-e-seguranca.md)). Sem ela, usa a branch por omissão.

## 3. Activar só algumas capacidades num projecto

Para que toda a equipa de um projecto use as mesmas capacidades, ponha no `.claude/settings.json` **do projecto**:

```json
{
  "extraKnownMarketplaces": {
    "noesis": { "source": { "source": "github", "repo": "<org>/noesis-ai-skills" } }
  },
  "enabledPlugins": {
    "mentor-polling@noesis": true,
    "os-batch-planner@noesis": true
  }
}
```

Capacidades que não estejam em `enabledPlugins` não aparecem nesse projecto. Quem abre o projecto é convidado a confiar no marketplace e a instalar os plugins.

> Por confirmar no primeiro teste real: o nome exacto do campo para fixar a ref (`#stable`) dentro de `extraKnownMarketplaces`. Esta máquina não tem a CLI `claude`, por isso a instalação ainda não foi testada de ponta a ponta.

## 4. Onde ficam os ficheiros

- O plugin é copiado para a cache do Claude Code no perfil do utilizador; nada é copiado para dentro do projecto.
- Os hooks escrevem estado no projecto, em `.claude/hooks/` (igual à origem), para manter compatibilidade com o `token-stats.json` actual. Acrescente ao `.gitignore` do projecto:

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

- **Hooks antigos no mesmo projecto:** se o projecto ainda tiver os hooks em `.claude/settings.json` (como `scripts-ai-outsystems`), desactive-os antes de activar `mentor-polling`. Com os dois, o segundo throttle volta a esperar 45 s depois do primeiro.
- **Tracker global:** se usar `~/.claude/hooks/token-usage-tracker.js`, não active também `token-usage`; os dois gravam no mesmo `token-stats.json`.

## 7. Desinstalar

```text
/plugin uninstall mentor-polling@noesis
```

Retire também a entrada de `enabledPlugins` do projecto. Os ficheiros de estado em `.claude/hooks/` não são apagados automaticamente; apague-os à mão se quiser.
