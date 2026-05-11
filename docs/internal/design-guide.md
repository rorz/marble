# The Four Basic Principles of Marble Design

*Marble's UI system stands on four fundamental principles (the acronym **PARC**). Once you can name a principle, you can recognize it; once you recognize it, you have power over it. Every Marble surface — every pane, card, list row, and form — is PARC made concrete.*

## 1. Proximity

**The Principle:** Group related items together. Move them physically close so they read as one cohesive group, not a scatter of unrelated bits.

*   **The Purpose:** Organize information, reduce clutter, give the reader a clear structure. Physical closeness implies relationship.
*   **In Marble:** A card's header, body, and footer must read as one object — that's why `MarbleCard` ships with snap-to-bottom footer and flex-column composition baked into the primitive. A label and its input belong together — that's why `MarbleField` is one primitive, not a hand-rolled `<MarbleFieldLabel/><MarbleInput/>` stack. Pane crumbs sit with their pane title because they describe the same thing.
*   **How to get it:** Squint at the surface and count the visual stops your eye makes. If two stops should be one, the spacing is too generous or a container is missing.
*   **What to avoid:** "Trapped" whitespace — empty space stuck between elements that belong together. Don't park content in corners just to fill the canvas.

## 2. Alignment

**The Principle:** Nothing should be placed on the surface arbitrarily. Every element should have a visual connection with another element.

*   **The Purpose:** Unify and organize the surface. Creates a clean, intentional look.
*   **In Marble:** Padding, gap utilities, type scale, and border radii match adjacent components. A `p-4` card next to a `p-5` card looks like a mistake. A `gap-3` row next to a `gap-2` row is conflict, not contrast. Flush-left is the default — eyebrow labels, list row text, and pane crumbs all share the same left edge.
*   **How to get it:** Find a strong vertical or horizontal edge and stick to it. Flush-left and flush-right alignments produce stronger, cleaner edges than centered text.
*   **What to avoid:** Mixing alignments without intent. Centered alignment in product UI almost always reads as formal or sedate — rarely what a workbench wants.

## 3. Repetition

**The Principle:** Repeat some aspect of the design throughout the entire piece — a font, a stroke, a color, a spatial arrangement.

*   **The Purpose:** Unify the piece, create consistency, add visual interest. Ties a multi-surface product together.
*   **In Marble:** Repetition is *why* `packages/ui` exists. Primitives enforce it. The orange stripe (`shadow-marble-stripe-left`) means "active" everywhere. The eyebrow ramp (`text-eyebrow-xs` / `text-eyebrow` / `text-eyebrow-lg`) means "label" everywhere. The `taupe-*` family means "surface" everywhere. If you catch yourself recomposing the same `border + bg + rounded` cocktail in two places, extend the primitive — don't normalize the override.
*   **How to get it:** Find existing consistencies and push them further. Promote them from incidental to deliberate.
*   **What to avoid:** Repeating an element until it becomes noise. Repetition without contrast is wallpaper.

## 4. Contrast

**The Principle:** If two items are not exactly the same, make them **really different**. Don't be a wimp.

*   **The Purpose:** Create visual interest (draws the eye), establish hierarchy (lets the reader instantly navigate the surface).
*   **In Marble:** Contrast a 14px body with a 24px title, a `font-medium` label with a `font-semibold` heading, a `taupe-50` surface with a `taupe-900` foreground. Use `orange-500` sparingly — it's the loudest voice in the room and earns its weight precisely because it isn't everywhere.
*   **How to get it:** Contrast large with small, bold with light, warm with cool, horizontal with vertical, dense with airy.
*   **What to avoid:** "Conflict." Conflict happens when two elements are *sort of* similar but not the same — two slightly different paddings, two slightly different greys, two sans families. Conflict reads as a mistake. Contrast reads as intent.

# Color & Typography Basics

## Color Theory Fundamentals

*   **Hue / Tint / Shade:** A **hue** is the pure color. Add black for a **shade**. Add white for a **tint**. Marble's `taupe-*`, `zinc-*`, and `orange-*` ramps are hue-to-shade scales — pick the step, don't open-code a new hex.
*   **Color Relationships:**
    *   **Complementary:** Colors across the wheel (e.g., red and green). One leads as the surface, the other lands as the accent. Marble's `taupe` / `orange` pairing behaves complementarily — taupe is the canvas, orange is the rare accent.
    *   **Triads:** Three colors equidistant on the wheel. Rarely useful in product UI; reserved for explicitly playful contexts.
    *   **Analogous:** Colors neighboring on the wheel. Harmonious and calm. Marble's warm-grey neighborhood (`taupe` ↔ `zinc` ↔ `amber`) is analogous.
    *   **Monochromatic:** One hue, many tints and shades. Marble's `taupe-50` → `taupe-900` ramp is monochromatic and carries the majority of product chrome.
*   **Warm vs. Cool:** Warm colors (reds, oranges) come forward and demand attention. Cool colors (blues, greens) recede. **Use warm sparingly for high impact** — exactly why `orange-*` is reserved for actives, accents, and CTAs in Marble, not for decoration.
*   **Screen-only:** Marble is product UI. There is no print pipeline. Think in RGB / sRGB and use `var(--color-*)` custom properties or Tailwind utilities.

## The Six Categories of Type

Understanding how typefaces are built lets you combine them effectively.

1.  **Oldstyle:** Slanted serifs, moderate thick/thin transition, diagonal stress. *Best for long blocks of body copy.* (e.g., Garamond, Times.)
2.  **Modern:** Mechanical and severe. Thin horizontal serifs, radical thick/thin transitions, vertical stress. *Striking for display, terrible for body.* (e.g., Bodoni, Didot.)
3.  **Slab Serif:** Thick, horizontal "slabby" serifs and little to no thick/thin transition. *High readability, makes a darker block.* (e.g., Clarendon, Century Schoolbook.)
4.  **Sans Serif:** "Sans" means "without" serifs. Almost always monoweight. *Clean and contemporary.* (e.g., Inter, Helvetica, Proxima Nova.) **Marble's product surface is sans-serif end-to-end** — the product face is utility, not literature.
5.  **Script:** Hand-lettered with calligraphy or brush. *Never in product chrome; reserve for marketing surfaces, and never in all-caps.*
6.  **Decorative:** Distinctive, fun, quirky. Use sparingly, and only where personality earns the cost.

# Combining Type for the Web

## The 3 C's of Combining Type

1.  **Concord:** One type family, minimal variety. Quiet, harmonious, formal. *Marble's product UI is concord-leaning — one sans family, contrast comes from weight and size, not from family-mixing.*
2.  **Conflict:** Combining typefaces that are similar but not the same (e.g., two different sans families). Looks like a mistake. **Avoid.**
3.  **Contrast:** Clearly distinct typefaces and elements. Exciting and intentional. *Marble's marketing surfaces may earn a second family — product chrome does not.*

## 6 Ways to Contrast

*   **Size:** Big vs. little. Don't contrast 12px with 14px; contrast 12px with 36px. The eyebrow utilities and pane titles are sized for exactly this.
*   **Weight:** Bold vs. light. Heavy weights draw the eye and organize information. Marble uses `font-medium` and `font-semibold` as workhorses; reserve `font-bold` for true display.
*   **Structure:** How the letter is built. **Never put two typefaces from the same category on the same surface.** Combine a serif with a sans-serif, or stay in one category cleanly.
*   **Form:** The shape of the letter. Caps vs. lowercase, roman vs. italic. The `text-eyebrow-*` utilities lean on uppercase form contrast — that's why they're capitalized and tracked.
*   **Direction:** Horizontal vs. vertical. *Avoid diagonal text in product UI — there is no justifiable reason.*
*   **Color:** Not just hue, but the visual *color* of the text block. A light, airy weight creates a "grey" block; a tight, bold weight creates a "black" block. Both are valid — pick deliberately.

## Web-Specific Rules

*   **Line length:** Keep lines short. Paragraphs spanning the full screen width are unreadable. Bias toward a constrained content column, even in dense product views.
*   **Repetition is navigation:** Consistent chrome is how users know they're on the same product. The pane header, sidebar, and crumb pattern in Marble exist precisely to satisfy this.
*   **Resolution-aware sizing:** Use `size={N}` for icons, `px`-based eyebrow tokens, and the 4px Tailwind spacing ramp. Pixel-perfect at 100% browser zoom is the floor, not the ceiling.

### The Ultimate Golden Rule

**DON'T BE A WIMP.**

Don't be afraid of empty space. Don't be afraid of asymmetry. If you're going to make things different, make them *very* different. State the design problem in words, find the similarities causing the conflict, and apply PARC to fix it. The Marble UI System below is PARC made concrete — every primitive in the catalog is a load-bearing answer to one of these four principles.

## Product Surface Conventions

These are Marble-specific rules for route surfaces and pane layout:

1. Project pages are master inventories. If a project owns tables, sources, pipes, or similar children, the project route lists them. It does not become a pseudo-detail view for one selected child.
2. Child resources get real detail routes. A source detail page shows one source. A pipe detail page shows one pipe. Do not re-embed sibling lists inside those routes.
3. First-class project children must appear in the nested sidebar with their own icon. If the sidebar cannot distinguish the resource at a glance, the route surface is incomplete.
4. Pane crumbs must terminate at the concrete resource name shown in the view. The crumb trail, sidebar selection, and page title should all agree on what the user is looking at.
5. Detail views should fit the pane directly. Avoid fake split-workspaces, redundant summary chrome, or explanatory wrappers that make the user re-parse the information architecture.

# The Marble UI System

The Marble UI system lives in `packages/ui` and is demonstrated live at `apps/web/src/app/internal/ui/page.tsx`. **The showcase is the contract.** Before you write any UI code, scan the catalog below, find the primitive that matches your pattern, and verify the behavior against the showcase.

> [!IMPORTANT]
>
> The fact that a primitive exists is the answer to whether you should build one. If a pattern in this catalog matches what you want to render, you use the primitive. You do not "extend" by open-coding a lookalike with similar `border + bg + rounded` chrome.

## Primitive Catalog

Every primitive in `@marble/ui`. Each entry is a one-line "use when" so you can match patterns at a glance. Every primitive ships with a showcase entry — go look at it before consuming.

### Actions & Status

- **`MarbleButton`** — every actionable button. Variants `light` / `dark` / `orange` / `red`. Sizes `md` / `sm` / `xs`. **Always** use `iconLeft={Icon}` / `iconRight={Icon}` slots; **never** wrap children in `<span className="inline-flex"><Icon/>label</span>`.
- **`MarbleBadge`** — small status pills. Tones `neutral` / `info` / `warning` / `error` / `success` / `solid`. `caps` for uppercase tracking.
- **`MarbleAlert`** — block-level status messages. Tones `neutral` / `info` / `warning` / `error` / `success`. Sizes `md` / `sm`.
- **`MarbleToaster` + `marbleToast`** — transient confirmation / error toasts. Mounted once at the layout root.

### Surfaces

- **`MarbleCard` + `MarbleCardHeader` / `MarbleCardContent` / `MarbleCardSection` / `MarbleCardFooter` / `MarbleCardTitle` / `MarbleCardDescription`** — the canonical bordered surface. Card tones `default` / `subtle` / `orange`. Header supports `actions[]`, `disclosureActions[]`, and `divided` for the bordered-header variant. Footer snap-to-bottom and right-align are baked in.
- **`MarbleEmptyState`** — empty list / no-data prompt with `title` / `description` / `icon` / `actions`. Use `iconTone="neutral" | "orange"` to wrap the icon in the standard bordered tile.
- **`MarbleListRow`** — every clickable row in a list-of-records view. Sizes `compact` / `sm` / `md`, tones `neutral` / `orange`, `active`, `aside`, `meta`, `align`. Use `iconTone="neutral" | "orange"` to wrap an icon in the standard bordered tile.
- **`MarbleStat`** — labeled read-only value tile. Use `framed` for the bordered chip variant; default is inline label-above-value. Tones `neutral` / `subtle`.
- **`MarbleJsonPreview`** — tokenized JSON display with the project's monospace + border + scroll defaults. Replaces every hand-rolled `tokenize` helper + `<pre>` cocktail.

### Forms

- **`MarbleField`** — label + control compound. **Always** use this for the "label above input/select/textarea" pattern. Supports optional `description` and `hint` slots. **Never** hand-roll `<div className="space-y-1.5"><MarbleFieldLabel/><MarbleInput/></div>`.
- **`MarbleFieldLabel`** — standalone label for section headers, action-paired labels, or non-input groups. For label + single input, use `MarbleField`.
- **`MarbleInput`** / **`MarbleSelect`** / **`MarbleTextarea`** — form controls. Sizes `md` / `sm` / `xs`. All accept `wrapperClassName` for width / layout.
- **`MarbleSearchSelect`** — datalist-backed combo input.
- **`MarbleEditableText`** — inline rename / hover-to-edit text. `MarblePaneEditableCrumb` is the pre-styled crumb-shaped variant.
- **`MarbleDropzone`** — file drop + browse. Sizes `md` / `sm`, tones `neutral` / `orange`.
- **`MarbleCopyField`** — click-to-copy URL / token / ID row with built-in copied feedback.
- **`MarbleSelectableTile`** — toggle / picker tile with `active` state baked in. Shapes `square` (icon picker grid), `card` (library dock / vertical tile), `wide` (horizontal selectable row).

### Navigation

- **`MarblePane`** — every page-level pane. Crumbs, actions, disclosure menu, narrow width, and frame are all primitive concerns.
- **`MarbleWorkbenchSection` / `MarbleWorkbenchTabs` / `MarbleWorkbenchTab` / `MarbleWorkbenchResizeHandle`** — editor / dock chrome.
- **`MarbleReviewNavigator`** — compact review tray for stepping through grouped changes.

### Menus & Popovers

- **`MarbleContextPopover`** — every disclosure / dot-trigger / button-trigger menu. Anchored to a trigger element. Sections, items, danger tone, disabled items, optional header — all primitive concerns. **Never** hand-roll a `useState(open)` + portal dropdown for a trigger-anchored menu.
- **`MarbleAccountPopover` / `MarbleAccountMark`** — signed-in user identity chrome. `MarbleAccountMark` renders an `<img>` when an `avatarUrl` is provided, otherwise a two-letter initials chip derived from `displayName` (falls back to `?` when the name is empty). `MarbleAccountPopover` wraps the mark with a name + description header card and a `MarbleContextPopover` body for identity actions (account settings, sign out). Used by the GUI shell sidebar brand row.
- **`MarbleBrandMark`** — decorative Marble glyph (orange-cornered taupe disc). Brand chrome only; carries no identity or workspace data. Use for first-party Marble surface tiles (e.g. the Programs library dock) where the brand should be visually marked.
- **`MarbleActivityRadar` / `MarbleActivityRadarPanel` / `MarbleActivityRadarTrigger`** — agent changesets inbox.
- **`MarbleProfileAttribution`** — ownership marks (avatar(s) + name + count).

### Commands

- **`MarbleCommandMenu`** / **`MarbleCommandDialog`** / **`MarbleCommandInput`** / **`MarbleCommandList`** / **`MarbleCommandEmpty`** / **`MarbleCommandGroup`** / **`MarbleCommandItem`** / **`MarbleCommandSeparator`** — `cmdk`-powered command surface. Use `MarbleCommandMenu embedded` when the surface should sit flush inside a host card (drops radius + L/R borders).

### Overlays

- **`MarbleModal` + `MarbleModalHeader` / `MarbleModalContent` / `MarbleModalFooter` / `MarbleModalTitle` / `MarbleModalDescription` / `MarbleModalClose`** — portal-backed modal with size-aware panel. **Always** use `MarbleModalClose` for the header dismiss affordance.
- **`MarbleConfirmModal`** — state-driven destructive / promote confirmation. **Always** use this in place of `window.confirm` / `window.alert` / `window.prompt`.
- **`MarbleSheet` + `MarbleSheetContent` / `MarbleSheetHeader` / `MarbleSheetFooter` / `MarbleSheetTitle` / `MarbleSheetDescription` / `MarbleSheetClose`** — Radix-backed side / top / bottom sheet. `MarbleSheetClose` has `variant="icon" | "button"` — the icon is for the corner affordance, the button is for the footer.

## Design Tokens

Named tokens live in `apps/web/src/app/globals.css`. Use them in route code and primitives alike. **Never** open-code their literal values.

### Typography utilities

For small uppercase labels and metadata captions. Apply your own font-weight and color on top.

- **`text-eyebrow-xs`** — `10px / 0.18em` tracking. Compact eyebrow for list metadata, snapshot titles, workbench section titles.
- **`text-eyebrow`** — `11px / 0.22em` tracking. Standard eyebrow for stat labels, command group headings, dropzone hints.
- **`text-eyebrow-lg`** — `11px / 0.24em` tracking. Section-eyebrow for catalog headers and prominent uppercase preludes.

**Forbidden:** `text-[10px] tracking-[0.18em] uppercase`, `text-[11px] tracking-[0.22em] uppercase`, `text-[11px] tracking-[0.24em] uppercase` and similar literal cocktails. The closest token is the answer.

### Inset highlight shadows

Subtle dimensional lift for tiles, marks, and active surfaces. **Always** pair with a real border + bg.

- **`shadow-marble-highlight`** — `inset 0 1px 0 rgba(255,255,255,0.7)`. Standard active / selected highlight (icon tiles, selectable tiles, profile marks).
- **`shadow-marble-highlight-strong`** — `inset 0 1px 0 rgba(255,255,255,0.92)`. Stronger highlight for compact chrome (workspace marks, command surfaces, activity glyphs).
- **`shadow-marble-highlight-soft`** — `inset 0 1px 0 rgba(255,255,255,0.45)`. Soft highlight for dense panels.

**Forbidden:** `shadow-[inset_0_1px_0_rgba(255,255,255,0.X)]` literals.

### Accent stripes

Active / selected indicator stripes for list rows and tabs.

- **`shadow-marble-stripe-left`** — `inset 2px 0 0 0 var(--color-orange-500)`. Left-edge stripe for list rows and sidebar items.
- **`shadow-marble-stripe-top`** — `inset 0 2px 0 0 var(--color-orange-500)`. Top-edge stripe for tabs.

**Forbidden:** `shadow-[inset_Xpx_X_X_X_#f97316]` literals.

### Surface utilities

- **`bg-workbench-surface`** — warm blueprint-paper gradient for editor / dock canvases. Use for the dense work-area backdrop.

**Forbidden:** `bg-[linear-gradient(...,#hex,...)]` arbitrary gradients in route code. If you need a new gradient, add a named utility to `globals.css`.

### Color tokens

- Use the project's color tokens (`taupe-*`, `zinc-*`, `orange-*`, `red-*`, `emerald-*`, `amber-*`, `sky-*`, `cyan-*`, `violet-*`, etc.) for every color decision.
- The Tailwind v4 `@theme` block at `:root` exposes every color as a CSS custom property (e.g. `var(--color-orange-600)`). Use these in inline `<style>` blocks or third-party theme escape hatches.
- **Forbidden:** raw hex literals in render code, with two narrow exceptions:
  1. Third-party theme escape hatches like `themeQuartz.withParams(...)` where named constants reference the Tailwind token they mirror (see `GRID_THEME_COLORS` in `apps/web/src/app/(gui)/tables/[id]/view.tsx`).
  2. The `globals.css` `@theme` and `@utility` blocks themselves.

## Icon Library Policy

**Phosphor only.** Use `@phosphor-icons/react` (browser), `@phosphor-icons/react/ssr` (top-level server-friendly), or `@phosphor-icons/react/dist/ssr` (nested-import server-friendly).

- Size icons with `size={N}` (px). Heroicon-style `className="h-X w-X"` is forbidden.
- Apply color with `className="text-zinc-500"` etc. Never hex literals on icons.
- When passing an icon to `MarbleButton iconLeft` / `iconRight`, pass the bare Phosphor component reference. The button primitive owns sizing.
- `@heroicons/react` is **NOT** in the workspace catalog. Adding it back is forbidden.

## Pattern → Primitive Map

When you find yourself reaching for the pattern on the left, use the primitive on the right.

| Pattern you want to render | Primitive you must use |
| --- | --- |
| Label above an input / select / textarea | `MarbleField` |
| Destructive confirmation prompt | `MarbleConfirmModal` (never `window.confirm`) |
| JSON / structured data preview | `MarbleJsonPreview` |
| Toggle tile grid (icon picker, library dock, segmented chip) | `MarbleSelectableTile` |
| Read-only labeled value tile | `MarbleStat` |
| Modal header close button | `MarbleModalClose` |
| Sheet header / footer close button | `MarbleSheetClose` |
| Bordered icon container in a list row | `MarbleListRow iconTone=...` |
| Bordered icon container in an empty state | `MarbleEmptyState iconTone=...` |
| Card header that needs a divider | `MarbleCardHeader divided` |
| Command surface flush inside a card | `MarbleCommandMenu embedded` |
| Trigger-anchored dropdown / menu | `MarbleContextPopover` |
| Click-to-copy URL / token / ID | `MarbleCopyField` |
| Inline rename / hover-to-edit text | `MarbleEditableText` (or `MarblePaneEditableCrumb` in crumbs) |
| Page-level pane with crumbs + actions | `MarblePane` |
| Editor section / dock panel | `MarbleWorkbenchSection` |
| Editor tab strip | `MarbleWorkbenchTabs` + `MarbleWorkbenchTab` |
| Browser-native alert / confirm / prompt | (none — use `MarbleConfirmModal` or a `marbleToast` for non-destructive feedback) |

## Anti-Patterns to NEVER Reintroduce

Each of these patterns was hand-rolled across the codebase in the past. Each has a primitive replacement. Reintroducing any of these is a regression.

- ❌ `window.confirm(...)`, `window.alert(...)`, `window.prompt(...)` → use `MarbleConfirmModal`.
- ❌ `<div className="space-y-1.5"><MarbleFieldLabel>X</MarbleFieldLabel><MarbleInput/></div>` → use `<MarbleField label="X"><MarbleInput/></MarbleField>`.
- ❌ Local `tokenizeJson` helpers + `<pre>{tokens}</pre>` → use `<MarbleJsonPreview value={...} />`.
- ❌ Hand-rolled `<button aria-pressed={isSelected} className="aspect-square border ...">` grids → use `<MarbleSelectableTile shape="square" active={isSelected}>`.
- ❌ `<div className="rounded-xs border ... px-3 py-2"><label/><value/></div>` → use `<MarbleStat framed label value />`.
- ❌ `<button>×</button>` close buttons → use `<MarbleModalClose />` or `<MarbleSheetClose variant="button">Dismiss</MarbleSheetClose>`.
- ❌ Per-route `MarbleCardHeader className="border-b ..."` overrides → use `<MarbleCardHeader divided>`.
- ❌ Per-route `<div className="flex size-9 ... rounded-xs border ...">{icon}</div>` wrappers inside `MarbleListRow icon` → use `iconTone="neutral" | "orange"`.
- ❌ `<MarbleButton><span className="inline-flex items-center gap-X"><Icon/>label</span></MarbleButton>` → use `iconLeft={Icon}` / `iconRight={Icon}`.
- ❌ `useState(isOpen)` + manual portal for a trigger-anchored dropdown → use `MarbleContextPopover`.
- ❌ `<pre>{token}</pre>` + a separate Copy button → use `<MarbleCopyField label value />`.
- ❌ `text-[Xpx] tracking-[X.XXem] uppercase` → use `text-eyebrow-*`.
- ❌ `shadow-[inset_0_1px_0_rgba(255,255,255,0.X)]` → use `shadow-marble-highlight*`.
- ❌ `shadow-[inset_Xpx_X_X_X_#f97316]` → use `shadow-marble-stripe-left` / `shadow-marble-stripe-top`.
- ❌ `bg-[linear-gradient(...,#hex,...)]` in route code → add a named `@utility` in `globals.css`.
- ❌ Raw hex literals (`#fafafa`, `#ea580c`, `#f87171`, ...) in render code → use Tailwind class or `var(--color-*)` CSS custom property.
- ❌ `@heroicons/react` imports → use Phosphor.
- ❌ `<Icon className="h-X w-X" />` icon sizing → use `size={N}` (px).

## Keeping the System Honest

Every time you ship a new primitive or a new design token:

1. **Add or extend the showcase** at `apps/web/src/app/internal/ui/page.tsx`. New primitives need their own demo panel. New tokens get a swatch / text-sample in the `Tokens` section.
2. **Update this section** of the design guide. The Primitive Catalog and Design Tokens lists are the contract — they MUST stay current.
3. **Update the Pattern → Primitive Map** if you've added a new pattern coverage area.
4. **Add to Anti-Patterns** if your primitive replaces a recurring hand-rolled shape — name the bad pattern and the replacement.

Every time you migrate a per-route hand-rolled pattern to a primitive:

1. Look at every site that has the same pattern. Migrating one is not enough — if two consumers have it today, four will have it tomorrow.
2. Delete the dead helper from the old site. Do not leave the local copy as a "fallback".
3. Run `bun check` and confirm the showcase still renders the new primitive correctly.

---

# How Marble Wins Friends and Influences Users

*An interface is a conversation. Like any conversation, it can go well or it can go badly. The PARC principles above describe how a Marble surface is **laid out** — proximity, alignment, repetition, contrast. This section describes how a Marble surface **carries itself** as a conversational partner. Use it as a periodic introspective: before you ship a surface, walk it through these eight questions and ask whether Marble is being someone the user would actually want to spend their day with.*

## 1. Don't Criticize, Condemn, or Complain

A user who hits a dead end is not the villain of the story. Empty states are not the place to lecture. Error messages are not where Marble gets to feel clever.

*   **Audit:** Does this empty state explain *what to do next*? Does this error message tell the user what *they* can do, not what *Marble* failed to do?
*   **Marble in practice:** `MarbleEmptyState` ships with `title`, `description`, and `actions[]` slots for a reason — the action is the kindness. An empty state without an action is a complaint dressed up as chrome.
*   **Watch for:** Toasts that read like server logs ("Failed to fetch projects"). The user does not have a Network tab open in their head.

## 2. Begin With Honest Appreciation

When a user does something heavy — names a new program, materializes a table, signs in for the first time — the surface should *land*. Not with confetti, not with a brass band, but with the unmistakable feeling that the system noticed.

*   **Audit:** Does the new resource appear immediately, with its name, in the sidebar? Does the user see themselves in the result?
*   **Marble in practice:** `marbleToast` for the lightweight nod. The pane crumb settling on the new resource name for the durable signal. Optimistic insertion in the sidebar for the immediate one.
*   **Watch for:** Celebrating cheaply. Confetti for "you saved a draft" is patronizing. Reserve real signals for real moments.

## 3. Talk in Terms of the User's Interest

The user did not come here to read about the system. They came here to do their work. Copy, labels, and chrome should be about *their* task, not about Marble's internal model.

*   **Audit:** Does this label name what the user is trying to do, or what the system is doing? Is the verb in the user's vocabulary, or in ours?
*   **Marble in practice:** "New program" is in the user's vocabulary. "Materialize the dependency graph" is in ours. Pick the former.
*   **Watch for:** Implementation language leaking into product copy. "Squashed migration," "service-role client," "RPC call" — none of these are user-facing concepts.

## 4. Be a Good Listener

A surface that doesn't respond to the user is rude. Loading states, optimistic updates, and immediate visual acknowledgements are the UI's version of nodding while someone is talking.

*   **Audit:** When the user clicks, types, drags, or selects, does the surface acknowledge it *immediately*? Is there a state for "I heard you and I'm working on it"?
*   **Marble in practice:** Optimistic state in list rows. Skeleton chrome before a heavy load. `MarbleConfirmModal` pending state during the destructive action. `MarbleEditableText` snapping to its new value before the round-trip resolves.
*   **Watch for:** Silent latency. A click with no response for 300ms reads as a conversation where the other person has stopped listening.

## 5. Make the User Feel Important — and Do It Sincerely

The user is not a "user." They are a person who chose to spend their attention on Marble. The surface should reflect that they are the protagonist of the session, not the audience for it.

*   **Audit:** Is the user's name, avatar, and chosen workspace visible where it should be? Are *their* resources featured, or are *Marble's* features featured?
*   **Marble in practice:** `MarbleAccountPopover` puts the person's name on the brand row. Project pages list the *user's* programs, sources, and pipes — not a marketing reel of capabilities.
*   **Watch for:** Surfaces that talk about Marble. Surfaces should talk about the user's work.

## 6. Don't Argue — Show

The fastest way to lose a user's trust is to argue with them. If the surface insists "no, that's not what you meant," it loses, even when it's right.

*   **Audit:** When a destructive action requires confirmation, does the surface explain *what* will happen and *why* rather than scolding? Does it let the user back out gracefully?
*   **Marble in practice:** `MarbleConfirmModal` with a clear destructive button, a clear cancel button, and a body that explains the consequence in human terms. "Are you sure?" by itself does no work — tell them what they're sure *of*.
*   **Watch for:** Modals that punish rather than inform. Disabled buttons with no explanation of why.

## 7. Let Them Save Face

Mistakes happen. The user will delete the wrong row, type the wrong number, click the wrong button. The surface's job in that moment is to make the recovery feel ordinary, not punitive.

*   **Audit:** Is there an undo? Is the deleted resource recoverable? Does the surface treat the mistake as routine?
*   **Marble in practice:** Soft-delete patterns, undo toasts, the `MarbleActivityRadar` changeset log. The mistake is a recoverable event, not a permanent scar.
*   **Watch for:** Irreversible destruction guarded only by a stern prompt. The recovery path matters more than the prompt.

## 8. Praise Every Improvement

The smallest piece of progress deserves a quiet, honest acknowledgement. The completion of a row, the connection of a source, the first successful run of a program — these moments are the user's payoff, and the surface should treat them as such.

*   **Audit:** When a long-running action succeeds, does the surface mark the win without overdoing it?
*   **Marble in practice:** A toast for the moment, a refreshed list for the durable record, a stripe for the active row. Three different scales of acknowledgement for three different scales of moment.
*   **Watch for:** Either extreme — silent completion (the user didn't see it) or theatrical completion (the user can't get past it).

## The Marble Carnegie Test

Before you ship a surface, ask: *if this surface were a person, would you want to work with them every day?*

*   Are they warm without being saccharine?
*   Do they remember you?
*   Do they listen?
*   Do they correct you without making you feel small?
*   Do they celebrate your wins quietly and own their mistakes plainly?
*   Do they talk about your work, or about themselves?

If the answer to any of those is "no," the surface owes the user another pass. PARC makes the page legible. This makes it likeable.
