# Templates for plan folder files

All plan files are written in English and live at the project root, so paths inside them are relative to the root. Keep them short: they reference the requirements file and Figma instead of copying them.

## project.md

```markdown
# <Project name>

- **Platform:** ODC | O11 | unknown (informational only)
- **Figma:** <file URL>
- **Requirements:** <path/to/requirements-1>, <path/to/requirements-2> (relative to the project root; absolute path or URL if outside the project)
- **Target app(s):** <OutSystems app name(s), if known>
```

## checklist.md

```markdown
# Checklist: <Project name>

Status values: `pending`, `in progress`, `done`, `needs review`.

| Batch | Title | Status | Note |
|---|---|---|---|
| 01 | <title> | pending | |
| 02 | <title> | pending | |

## Requirement coverage

| Requirement | Batch(es) |
|---|---|
| REQ-001 | 01, 03 |
| Section "Login" (no ID) | 02 |
| REQ-014 | out of scope: <reason> |
```

Use the IDs from the requirements file. When there are none, use the section or heading name. A requirement can span several batches.

## Batch file: `batches/NN-<slug>.md`

Keep sections that don't apply but write "none" or "n/a", so the agent knows it was considered.

The agent that runs a batch reads only this file, so the two protocol blocks ("Before you build" and "Validate and close") are copied unchanged into every batch.

```markdown
# Batch NN: <Title>

## Before you build
The plan may contain mistakes and the checklist may be stale, so verify first. Don't trust this file blindly.
1. Re-read the requirements below from the source file and check they match this batch.
2. Open each Figma link and check the frames exist and match the screens and states described.
3. Check OutSystems through the MCP: the prerequisites really produced what this batch relies on, nothing already built conflicts with or duplicates it, and note what can be reused. The MCP may only show published work.
4. Read `figma-mapping.md`, and AGENTS.md or CLAUDE.md if present.
5. If this batch is `in progress` or partly built, inspect what exists before doing anything.

If anything is wrong, missing or unclear, stop and ask the user before building, with options where you can. Fix planning mistakes in this file (wrong requirement reference, wrong Figma link, missing prerequisite) only after the user confirms. Never write choices or preferences into it.

Set this batch to `in progress` in `checklist.md` when you start.

## Goal
<One or two sentences: the outcome of this batch.>

## Prerequisites
- Batches that must be done first: <NN, NN | none>
- Already in OutSystems, to reuse: <entities, blocks, layouts, roles | none>

## Requirements
- <REQ-xxx or section name>: <requirements file>, section "<heading>"

## What to build

### Data
(Only if this batch creates or changes entities.)

Entity: <Name> (new | reuse | extend)
- Purpose: <one line>
- Attributes: <name (type, required?, default?)>, ...
- Relationships: <to which entities, and how>
- Static or seed data: <if any>

### Logic
(Only what's needed: server-side actions, integrations, rules.)

Action: <Name>: <what it does>
- Inputs → outputs: <...>
- Rules: <...>
- Triggered by: <screen, event, schedule>

### Screens

Screen: <Name>: <purpose>
- Layout: <navigation and layout type, e.g. side menu, top menu, no menu>
- Roles: <who can open it>
- Blocks, top to bottom:
  - <section or block> → <widgets> → data: <entity/attribute or source> → actions: <what happens on interaction>
- States: empty: <...>; loading: <...>; error: <...>
- Navigation: from <screen>; to <screen(s)>

## Figma
- <Screen name>: <link to the specific frame>

## Acceptance criteria
- <Referenced from the requirements file, or copied from the user's tests.>
- <Drafted criteria are marked "(drafted, confirm in session)".>

## Tests
1. <Steps> → <expected result>

## Validate and close
- Stay inside this batch's scope. If it is clearly too big for one session, say so and propose a split instead of silently dropping scope.
- Check every acceptance criterion and run every test, as far as the tools allow. Report each as **passed**, **failed** or **not verified** (with the reason for the last two). Never claim a pass without evidence.
- Update this batch in `checklist.md`: `done` only if everything passed, otherwise `needs review` with a one-line note. Add a short note if what was built differs from this batch.
```

### Writing "What to build"

- Describe **what** must exist and behave, not **how** to build it. The agent running the batch consults the OutSystems MCP for how.
- Be platform-agnostic: avoid steps that only make sense in ODC or only in O11.
- Prefer a hierarchy to prose for screens (layout → blocks → widgets → data → actions → states). OutSystems builds more accurately from structure.
- Use block and pattern names from `figma-mapping.md` when it exists. Otherwise use plain names and let the agent resolve them.
- Mark every entity or element as `new`, `reuse` or `extend` so the agent doesn't duplicate what's already there.
- Tests are manual checks the agent runs and reports on. Take them from the requirements file (by reference) or from tests the user gave (copied).
