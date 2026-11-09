# Actualizações e segurança

## O que está garantido hoje

| Momento | Mecanismo | Estado |
|---|---|---|
| Antes da sessão | Auto-update do marketplace no arranque do Claude Code (ligar em `/plugin` → Marketplaces → *Enable auto-update*), ou `/plugin marketplace update noesis` | Disponível (desligado por omissão para marketplaces próprios) |
| Antes de cada prompt | — | Não implementado |
| Antes de cada skill | — | Não implementado (fase 3) |

Alterações a **scripts e hooks** só entram em vigor numa sessão nova; o Claude Code não recarrega o código dos hooks a meio da sessão.

## Fase 3 (proposta, por aprovar)

O Claude Code tem pontos de integração que permitem verificar a versão antes de cada skill:

- `PreToolUse` com matcher `Skill`, quando é o modelo a invocar a skill;
- `UserPromptExpansion`, quando o utilizador escreve `/skill`;
- o Claude Code detecta alterações ao texto de `SKILL.md` durante a sessão.

Antes de prometer "actualizado antes de cada utilização", é preciso um teste de ponta a ponta (marcador v1 → v2) que o prove. Se o teste falhar, a garantia fica em "antes da sessão".

Requisitos da fase 3: fonte e ref autorizadas; registo do SHA usado; download para uma pasta temporária, validação (`npm run validate`) e activação atómica; manter a última versão válida; lock contra actualizações simultâneas; aviso visível quando está sem rede; modo estrito opcional; nunca executar código descarregado durante a actualização.

## Canais

| Canal | Ref | Para quem |
|---|---|---|
| `stable` (recomendado) | Última tag semver, criada por PR revisto | Todos os projectos |
| `latest` | Branch `main` | Só quem mantém o catálogo |
| Fixo | Uma tag ou SHA | Projectos que precisam de reprodutibilidade |

Hooks são código que corre na máquina de cada pessoa. Por isso, mudanças em `runtime/` ou nos hooks devem chegar só por tags revistas, nunca directamente da `main`.

## Regras de segurança

- O build e a validação nunca executam scripts das skills.
- Os logs de rotina guardam só contagens e identificadores (ver o teste "logs only counts").
- O debug integral (`MENTOR_HOOK_DEBUG`) é opt-in, escreve o evento completo e não tem rotação; use-o só para diagnóstico e apague o ficheiro depois.
- Nenhum script altera `settings.json`, ficheiros de origem do projecto ou conteúdo editado pelo utilizador; só escrevem em `.claude/hooks/`.
- O repositório é privado: cada pessoa precisa de acesso de leitura no GitHub; não guarde tokens em ficheiros de configuração.
