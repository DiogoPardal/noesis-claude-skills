# Acrescentar um plugin ou uma skill

Cada capacidade é um plugin em `plugins/<id>/`, e é aí que se edita. O que está nessa pasta é exactamente o que o Claude Code instala. O `<id>` usa só minúsculas, dígitos e hífens (máx. 64 caracteres).

```text
plugins/<id>/
  .claude-plugin/plugin.json      manifesto: nome, versão, descrição
  skills/<skill>/SKILL.md         instruções para o Claude (uma ou mais skills)
  skills/<skill>/references/      opcional: material longo referenciado pela skill
  hooks/hooks.json                opcional: quando correr os scripts
  scripts/<nome>.cjs              opcional: código que os hooks correm
```

## Só instruções (o caso mais comum)

1. Crie o manifesto `plugins/<id>/.claude-plugin/plugin.json`:

   ```json
   {
     "name": "<id>",
     "version": "1.0.0",
     "description": "Uma frase para o catálogo.",
     "author": { "name": "Noesis" }
   }
   ```

2. Crie a skill em `plugins/<id>/skills/<skill>/SKILL.md`. O `name` tem de ser igual ao nome da pasta da skill:

   ```markdown
   ---
   name: <skill>
   description: O que a skill faz e quando a usar (máx. 1024 caracteres). É isto que o Claude lê para decidir usá-la.
   ---

   # Título

   Passos, critérios e regras. Mantenha abaixo de 500 linhas; detalhes vão para `references/`.
   ```

   O material longo vai para `references/*.md`. Referencie esses ficheiros no texto com o caminho entre crases, por exemplo `references/exemplo.md`. O validador confirma que existem.

3. Acrescente o plugin ao catálogo `.claude-plugin/marketplace.json`, com a mesma `version` e `description` do manifesto:

   ```json
   { "name": "<id>", "source": "./plugins/<id>", "description": "Uma frase para o catálogo.", "version": "1.0.0" }
   ```

4. Corra `npm test` e faça commit.

## Com script e hook

Quando a skill precisa de comportamento garantido (esperar, filtrar, medir), escrevê-lo em prosa não chega: é preciso código.

1. Ponha o script em `plugins/<id>/scripts/<nome>.cjs`. Regras:
   - Só pode carregar módulos `node:` ou outros scripts da mesma pasta (`./<ficheiro>.cjs`). Não use dependências npm nem ficheiros de outros plugins. O validador verifica isto.
   - Lê o evento JSON do stdin e nunca bloqueia por falha própria: termina com código 0 e avisa em stderr.
   - Não grava conteúdo de conversas, transcripts ou respostas em logs; só contagens e identificadores.
2. Ligue-o em `plugins/<id>/hooks/hooks.json`:

   ```json
   {
     "description": "...",
     "hooks": {
       "PreToolUse": [
         {
           "matcher": "mcp__.*__<ferramenta>$",
           "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/<nome>.cjs\"", "timeout": 30 }]
         }
       ]
     }
   }
   ```

3. Acrescente testes em `tests/<id>.test.cjs` com dados **sintéticos** (nunca transcripts ou respostas reais). Os testes correm os scripts directamente a partir de `plugins/<id>/scripts/`.

## O que o validador verifica (`npm run validate`, também corre em `npm test`)

- **Manifesto:** existe, `name` é igual à pasta, `version` está em semver e há `description`.
- **Skills:** frontmatter presente, `name` válido e igual à pasta, `description` entre 1 e 1024 caracteres, e os ficheiros referenciados existem.
- **Hooks:**
  - eventos conhecidos e `type` igual a `command`;
  - `timeout` entre 1 e 600 s e matcher com regex válida;
  - comando no formato `node "${CLAUDE_PLUGIN_ROOT}/scripts/<nome>.cjs"`, com o script existente.
- **Scripts:**
  - cada plugin é auto-suficiente: os `require` só apontam para `node:` ou para a própria pasta;
  - há aviso se um script não for usado por nenhum hook nem por outro script.
- **Catálogo:**
  - cada entrada aponta para `./plugins/<id>`;
  - `version` e `description` coincidem com o manifesto;
  - todos os plugins estão listados.

## Versões

Suba `version` sempre que o plugin mudar, no manifesto e no catálogo. O Claude Code só entrega uma cópia nova quando a versão muda. Ver [Actualizações e segurança](actualizacao-e-seguranca.md).
