# Acrescentar uma skill nova

## Só instruções (o caso mais comum)

1. Crie `skills/<id>/SKILL.md`. O `<id>` usa só minúsculas, dígitos e hífens (máx. 64) e tem de ser igual ao `name`.

   ```markdown
   ---
   name: <id>
   description: O que a skill faz e quando a usar (máx. 1024 caracteres). É isto que o Claude lê para decidir usá-la.
   ---

   # Título

   Passos, critérios e regras. Mantenha abaixo de 500 linhas; detalhes vão para `references/`.
   ```

2. Opcional: `skills/<id>/references/*.md` para material longo. Referencie-os no texto com o caminho entre crases (por exemplo `references/exemplo.md`); o validador confirma que existem.
3. Crie `capabilities/<id>.json`:

   ```json
   {
     "id": "<id>",
     "version": "1.0.0",
     "description": "Uma frase para o catálogo.",
     "skills": ["<id>"]
   }
   ```

4. Corra `npm run build` e `npm test`, e faça commit das fontes **e** do que foi gerado em `plugins/`.

## Com script e hook

Quando a skill precisa de comportamento garantido (esperar, filtrar, medir), escrever isso em prosa não chega: é preciso código.

1. Ponha o script em `runtime/<área>/<nome>.cjs`. Regras:
   - só módulos `node:`; sem dependências npm;
   - lê o evento JSON do stdin e nunca bloqueia por falha própria (termine com código 0 e avise em stderr);
   - não grave conteúdo de conversas, transcripts ou respostas em logs; só contagens e identificadores.
2. Declare-o no manifesto:

   ```json
   {
     "id": "<id>",
     "version": "1.0.0",
     "description": "...",
     "skills": ["<id>"],
     "runtime": ["runtime/<área>/<nome>.cjs"],
     "hooks": {
       "PreToolUse": [{ "matcher": "mcp__.*__<ferramenta>$", "script": "<nome>.cjs", "timeout": 30 }]
     }
   }
   ```

   O build gera `hooks/hooks.json` com `node "${CLAUDE_PLUGIN_ROOT}/scripts/<nome>.cjs"`.
3. Acrescente testes em `tests/<id>.test.cjs` com dados **sintéticos** (nunca transcripts ou respostas reais).

## O que o validador verifica

- frontmatter presente, `name` válido e igual à pasta, `description` entre 1 e 1024 caracteres;
- ficheiros referenciados pela skill existem;
- manifesto: `id` igual ao nome do ficheiro, `version` semver, skills e scripts existentes, eventos de hook conhecidos, `timeout` entre 1 e 600 s, matcher com regex válida;
- `npm run check` falha se `plugins/` não corresponder às fontes.

## Versões

Suba `version` no manifesto sempre que a capacidade mudar. O Claude Code só entrega uma cópia nova quando a versão muda.
