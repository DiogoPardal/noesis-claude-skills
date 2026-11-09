# Migração a partir dos hooks actuais e rollback

Os hooks de `dresend/scripts-ai-outsystems` continuam intactos até haver aprovação para os retirar.

## Migrar um projecto

1. Confirme que `npm test` passa na versão do catálogo que vai usar.
2. No projecto, retire (ou comente numa cópia) as entradas `PreToolUse`, `PostToolUse`, `Stop` e `SubagentStop` que apontam para `.claude/hooks/*.cjs` em `.claude/settings.json`. Não apague os scripts ainda.
3. Active as capacidades em `enabledPlugins` (ver [Instalação](instalacao.md)).
4. Numa sessão nova, faça um `mentor_get_run` e confirme:
   - a segunda consulta do mesmo run espera cerca de 45 s;
   - a resposta chega compactada;
   - `token-stats.json` continua a crescer no fim de cada resposta.
5. Só depois de uma semana sem problemas, e com aprovação, apague os scripts antigos.

O estado em `.claude/hooks/` usa os mesmos nomes e formatos, por isso a contagem de tokens continua de onde estava.

## Rollback

| Situação | Como voltar atrás |
|---|---|
| Problema numa capacidade | `/plugin disable <id>@noesis` (ou `false` em `enabledPlugins`) e repor as entradas antigas em `.claude/settings.json` |
| Versão nova com defeito | Fixar o marketplace na tag anterior (`#vX.Y.Z`) e `/plugin marketplace update noesis` |
| Remover tudo | `/plugin uninstall <id>@noesis` para cada capacidade e `/plugin marketplace remove noesis` |

Nenhum destes passos apaga dados: os ficheiros de estado e o `token-stats.json` ficam onde estavam.
