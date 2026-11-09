# Figma mapping seed

Starting point for `figma-mapping.md` at the project root. It is based on the design-to-app skill in OutSystems' own MCP repository (github.com/OutSystems/outsystems-mcp, a beta skill focused on ODC), keeping only what is about translating a design into OutSystems UI. It leaves out the Mentor, publishing and seeding workflow, which belongs to the MCP skill.

How to use it: copy the sections that apply, adapt them to the project's real Figma components, variables and theme, and have the user confirm before saving. Check that each pattern exists on the project's platform and OutSystems UI version.

## Layout

- Pick the layout from the navigation pattern: side menu, top menu, or no menu (login and similar screens). Don't default to "no menu".
- Exactly one layout per screen.

## Structure → blocks

Use real blocks for structure, not custom CSS flex or grid.

| In Figma | In OutSystems UI |
|---|---|
| N equal columns (2 to 6) | `Columns2` … `Columns6` |
| Uneven two-column split | `ColumnsMediumLeft`, `ColumnsMediumRight`, `ColumnsSmallLeft`, `ColumnsSmallRight` |
| Repeating grid of cards or items | `Gallery` |
| List with a detail panel | `MasterDetail` |
| Content that differs per device | `DisplayOnDevice` |

Two exceptions are fine: alignment inside a single block placeholder (for example icon + text inside a card), and an exact ratio no block can hit, done with one named class defined in the theme.

## Components

| In Figma | In OutSystems UI |
|---|---|
| Card surface | `Card`, `CardItem`, `CardSectioned` |
| Tabs | `Tabs` |
| Multi-step flow | `Wizard` |
| Accordion | `Accordion` |
| Carousel or slider | `Carousel` |
| Side panel | `Sidebar` |
| Breadcrumbs, pagination, timeline | navigation patterns of the same names |
| Chip or pill | `Tag` |
| Numeric pill | `Badge` |
| Progress bar / progress ring | `ProgressBar` / `ProgressCircle` |
| KPI numbers, ratings | the "numbers" patterns |
| Empty state | the blank-state pattern |
| Charts | chart patterns; every chart needs an explicit data series |

**Name rule:** if a Figma layer is named Carousel, Gallery, Tabs, Wizard, Accordion, Sidebar or Stepper, map it to that block, even when it visually looks like plain columns.

Replace placeholder content that blocks ship with (for example default breadcrumb items or tab labels) with the design's real content.

## Typography

- Screen title (h1) goes in the layout's title area.
- Section headings are h2, card titles are h3.
- The `heading1`…`heading6` style classes only change size. They don't replace real heading tags.

## Tokens

Fill in from the Figma variables and the project's theme.

| Figma variable | Theme variable or class | Value |
|---|---|---|
| | | |

Rules:
- Keep exact values from the design. Don't round or generalize colors (`#EDF0ED` stays `#EDF0ED`).
- Figma output often comes as Tailwind classes. Translate them to OutSystems UI utility classes and theme variables, never reuse Tailwind names.
- Define custom classes once, in the theme, with an app or screen prefix.
- Avoid class names that collide with OutSystems UI layout rules: `main-content`, `sidebar`, `header`, `content`, `footer`, `main`, `layout`.
- Spacing and radius come from tokens, not raw pixel values.

## Icons

Record the icon name per icon in Figma. The icon library depends on the platform (in ODC the Icon widget takes a Phosphor icon name), so confirm what the target uses.

## Non-visual details to find in Figma (or ask about)

- Empty, loading and error states.
- Roles and who sees what.
- Navigation targets for links and buttons.
- Responsive variants (desktop, tablet, phone).
- Number, currency and date formats as the design shows them.

## Common screen types

Dashboard, list or table, detail view, edit form, master-detail, gallery or grid, kanban, timeline, calendar, wizard, map, inbox or notifications, settings. Naming the type of each screen in the batch helps the agent pick the right blocks.

## Cautions

- Don't put inputs, buttons, tables or charts inside a link. The link swallows the clicks. Use a link only when the whole element navigates.
- One widget per action. Don't add a second button for the same action.
- Don't hide sections with show/hide toggles to fake several screens. Make each section its own screen, and use the real popup, toast or side panel widgets for overlays.
- Write special characters literally (`▲`, `€`), never as `\uXXXX` escapes.

## Deeper reference

The OutSystems design-to-app skill has a `references/` folder with the full block catalog (UI reference, layouts, adaptive, content, navigation, numbers and interaction patterns, charts, maps, per-screen-type guides and a list of known gotchas). If that skill is installed or reachable in the session, have batches point to it instead of copying it here.
