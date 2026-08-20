# Common Time UI and Style Audit

Last updated: 2026-08-20

## Purpose

This is the working record of how Common Time's interface is built and where it must be consolidated before large visual changes. It covers the browser UI in `src/app` and `src/components`, the Tailwind and CSS foundations, responsive behavior, interaction styling, and the public, owner, and family surfaces.

The goal is not to freeze the current look. The goal is to make the look easy to change without producing a mixture of old and new interface conventions.

## Audit scope and method

- Read every UI route and shared component in `src/app` and `src/components`.
- Inspected `tailwind.config.ts`, `globals.css`, all component CSS, font loading, design rules, code rules, and prior design decisions.
- Searched all 65 TSX files and 6 CSS files for utility usage, custom selectors, arbitrary values, raw colors, inline styles, responsive behavior, focus treatment, motion, shadows, gradients, and repeated patterns.
- Inspected production renders of the public site, owner login, and family portal at phone, tablet, and desktop widths.
- Verified those sampled public screens had no accidental horizontal overflow at 375, 768, or 1440 pixels.
- Authenticated owner pages were audited from their complete rendered component trees and styling source. A signed-in cross-browser visual regression pass remains necessary after the consolidation work begins.

Snapshot at the time of this audit:

- 792 `className` usages across the TSX interface.
- 14 inline React style assignments in production components, plus 1 in the interaction study.
- 4 production component-specific stylesheets, 1 global stylesheet, and 1 temporary interaction-study stylesheet.
- 9 semantic color tokens, 3 radius tokens, 3 spacing tokens, 1 shadow token, and 2 font-family tokens.
- 0 raw browser-component colors outside the semantic palette; email markup retains literal values for client compatibility.
- 7 repeated local field-class definitions or equivalent field patterns.
- 16 repeated uppercase tracked status/taxonomy treatments.
- 48 buttons without an explicit `type`; some are intentional form submits, but the convention is not enforced.

## Current visual direction

The established direction is coherent and worth preserving until deliberately replaced:

- Character: cultivated, calm, specific, and human; an independent music school rather than generic SaaS.
- Atmosphere: dark, precise, and luminous.
- Palette: near-black, midnight blue, deep navy, pale blue-white, and focused electric cyan derived from the temporary Common Time identity.
- Typography: Newsreader for expressive display text and DM Sans for operational UI.
- Geometry: square or nearly square controls, thin architectural rules, open sections, scarce rounding, and minimal shadow.
- Hierarchy: typography, whitespace, alignment, and rules before cards or containers.
- Interaction grammar: lines draw, track, fill, connect, expand, compress, and confirm state changes.
- Density: calendars, schedules, tables, and operational lists remain scan-friendly rather than becoming oversized cards.

The production public pages express this direction well. The large editorial display type, warm monochrome palette, restrained rules, and low-contrast grain feel distinct. Login and family portal screens are clear and calm at sampled widths. The owner interface uses the same vocabulary, though its patterns are less centralized.

## Authoritative styling order

All future UI work should follow this order:

1. **Foundation variables in `globals.css`.** Raw palette values, font variables, global geometry, and foundational motion values belong here.
2. **Semantic tokens in `tailwind.config.ts`.** Components consume names such as `canvas`, `surface`, `ink`, `muted`, `line`, `brand`, and `danger`, not raw palette values.
3. **Tailwind utilities in components.** Tailwind is the default for layout, responsive behavior, spacing, typography, color, and ordinary interaction states.
4. **Shared component variants.** Repeated class combinations belong in maintained primitives or domain components, not copied constants in pages.
5. **Custom CSS for capabilities utilities cannot express cleanly.** Use it for pseudo-elements, coordinated state selectors, complex calendar geometry, keyframes, scrollbar treatment, and interaction systems such as hold-to-confirm.
6. **Inline styles only for runtime-computed values.** They are appropriate for grid column counts, time-based positioning, measured scroll width, and CSS custom-property values. They are not appropriate for fixed color, spacing, typography, or ordinary layout.

Transactional email is a separate rendering environment. Inline email CSS is required for client compatibility, but its palette and typography constants should still correspond to the product tokens.

## Token foundation

### What is centralized now

`globals.css` defines the current raw values and `tailwind.config.ts` maps them to semantic utilities:

| Category | Current tokens |
| --- | --- |
| Surfaces | `canvas`, `surface`, `surface-raised` |
| Content | `ink`, `muted`, `line` |
| Actions/state | `brand`, `brand-hover`, `danger` |
| Radius | `control`, `card`, `panel` |
| Spacing | `control`, `card`, `section` |
| Shadow | `panel` |
| Type | `sans`, `display` |

This is the correct architecture: CSS variables hold values; Tailwind exposes semantic names; components use utilities.

### What is working

- The principal production palette is consistently referenced by semantic name.
- Font families are loaded once with `next/font` and exposed through variables.
- Global canvas, ink, selection, form-font inheritance, tap behavior, coarse-pointer minimum button height, and subtle grain are centralized.
- School logos and avatars use meaningful radius tokens or circles rather than arbitrary rounding.
- Existing inline styles are overwhelmingly legitimate runtime geometry rather than visual hard-coding.

### Gaps

- Tokens exist but are underused. `space-section` is used, while page gutters, content widths, header spacing, row density, control heights, and type scales are repeatedly assembled by hand.
- `shadow-panel` is defined as `none`, but dropdowns and sheets use `shadow-xl`, `shadow-2xl`, and raw CSS shadows. A global shadow change would not affect those components.
- Billing approval surfaces now use the configured `surface` token; the stale `panel` reference was removed.
- Student outcomes now use semantic rescheduled, cancelled, and no-show tokens.
- Planner overlays and shadow values now resolve through centralized global effect variables.
- There is no complete semantic state family for success, warning, informational, pending, disabled, selected, unread, and overlay states. `brand` is currently doing several jobs.
- School-level accent theming is described in the design rules but is not yet represented as a scoped token override in the UI shell.

## Typography

### Current convention

- Newsreader (`font-display`) carries page titles, section titles, prominent names, and public editorial messages.
- IBM Plex Sans is the body and operational font.
- Most UI copy is `text-sm`; metadata is usually `text-xs`; large page titles are generally `text-5xl` with occasional `sm:text-6xl`.
- Uppercase tracked text is intended for genuine status or taxonomy.

### Drift

- Page titles vary among `text-4xl`, `text-5xl`, `sm:text-6xl`, and custom tracking without a named page-title primitive.
- Some titles use terminal punctuation (`Students.`, `Families.`, `Staff.`), while others do not (`Notifications`, `New lesson`).
- Decorative eyebrow-like labels remain common even though the design rules explicitly discourage them. Some are genuine statuses; others are only page decoration.
- Tracking values such as `0.14em`, `0.15em`, and `0.16em` repeat as arbitrary values.
- Operational density is generally good, but small metadata relies heavily on muted `text-xs`; contrast and readability need explicit testing, especially on the textured background.

Recommendation: define shared `PageTitle`, `SectionTitle`, `Metadata`, and `StatusLabel` treatments. Do not tokenise every font size; define only the repeated hierarchy roles.

## Layout and page shells

### Current convention

- Pages center content with `mx-auto`, use a route-specific maximum width, and generally use `px-5 sm:px-8` or `px-6`.
- Vertical page padding is either `py-10 sm:py-section` or `py-section`.
- Setup and detail pages commonly use a two-column `md:grid-cols-[1fr_2fr]` structure separated by a vertical rule.
- The authenticated school header lives in the school layout and persists across owner routes.
- Open sections and horizontal rules carry hierarchy instead of nested cards.

### Drift

- Page shells repeat directly in routes with `max-w-5xl`, `max-w-6xl`, or `max-w-7xl` and slightly different gutters. Some width differences are meaningful, but the reason is not encoded.
- Header and section patterns are partly componentized (`DetailHeader`, `DetailSection`, `SetupHeader`) and partly rewritten in pages.
- Some route files contain substantial presentation and data transformation together. The dashboard/student workspace and family billing page are the clearest examples.
- The persistent owner header is visually useful but needs an authenticated phone/tablet audit for wrapping, navigation order, and notification placement.
- The owner planner intentionally scrolls horizontally on narrow screens and has visible affordances; ordinary public screens sampled at 375, 768, and 1440 pixels did not overflow.

Recommendation: add three page-shell widths (`focused`, `standard`, `wide`) and shared page-header/section primitives. Preserve intentional route width differences through explicit variants.

## Controls and forms

### Current convention

- Most form fields are transparent with a bottom rule; focus changes the rule to brand.
- Primary actions are bordered or use ink/brand fills.
- Secondary actions are frequently text with a bottom border.
- Consequential actions use the shared `HoldToConfirm` component.
- Pills and rounded cards are correctly rare.

### Drift

- The same field string is locally repeated across profile, school setup, lesson creation, places, products, SMS consent, portal auth, family contact editing, billing adjustments, and rescheduling.
- Button styles are assembled independently in nearly every feature. Primary, secondary, quiet, danger, selected, and disabled states are not centrally defined.
- Focus treatment is inconsistent. Fields usually retain a visible bottom-rule change, but buttons and links often define hover without `focus-visible` equivalents.
- Native checkboxes use repeated accent arbitrary values instead of a shared control treatment.
- Disabled states commonly use opacity alone; cursor, explanation, and contrast vary.
- Many buttons omit `type="button"`; form-submit behavior is sometimes intended, but implicit behavior makes reusable controls easier to misuse.
- Touch sizing is globally improved for coarse-pointer buttons, selects, and summaries, but small links are not covered and inputs do not share a complete minimum control-height rule.

Priority primitives:

1. `Button` with `primary`, `secondary`, `quiet`, and `danger` variants.
2. `TextField`, `SelectField`, and `TextAreaField` sharing label, help, error, focus, and disabled behavior.
3. `ActionLink` for the recurring drawn-line interaction.
4. `StatusLabel` and `StatusMessage` for taxonomy and feedback.
5. `CheckboxField` with consistent alignment and touch target.

These should remain narrow, composable components. Domain rules do not belong inside them.

## Surfaces, rows, and information hierarchy

### What is coherent

- Rules and background shifts are used more often than cards.
- Student, family, staff, notification, lesson, billing, and setup rows are structurally similar enough to feel related.
- Unread notifications use a restrained brand tint rather than a badge-heavy treatment.
- Tables and calendars preserve useful density.

### Drift

- Repeated row patterns have inconsistent padding (`py-4`, `py-5`, `py-6`, `py-7`) and hover treatment.
- Empty states range from useful explanatory copy to terse `No …` messages and are not centralized.
- Status display varies among uppercase text, brand text, danger text, left rules, borders, dots, background fills, and prose.
- Some components introduce bordered boxes where the main grammar prefers open sections and rules, especially in later billing and notification work.
- Notification dropdown and full notification list share data but not a shared notification-row presentation.

Recommendation: define `DataRow`, `EmptyState`, `StatusMessage`, and a small set of surface variants. Avoid a universal card component; it would fight the established visual direction.

## Calendar and planner system

The planner is the most intentionally designed part of the owner UI and also the most bespoke.

Strengths:

- Runtime inline styles correctly handle time positions, dynamic columns, track widths, occupancy, and measured scroll width.
- Custom CSS is justified for overlapping availability, expanded/compressed tracks, drag ghosts, sheets, pseudo-element tooltips, and coordinated motion.
- Phone, tablet/coarse pointer, desktop, and reduced-motion paths are explicitly handled.
- The planner preserves dense comparative context on desktop and gives phones a focused alternative.

Concerns:

- Planner CSS contains gradients, glows, a pulsing badge, and large shadows that contradict the general design rules. These may be justified temporary state signals, but the exception is not documented.
- Several shadow, overlay, duration, easing, timeline-height, and rail-width values are hard-coded.
- Tooltip discovery is hover-only, although the reschedule icon itself remains available on touch and the tooltip is suppressed there.
- The generic class name `.line-action` is duplicated in the temporary interaction-study stylesheet and planner stylesheet. Because imported CSS is global, this is a collision risk.
- Planner sheets and the family-calendar sheet use separate implementations and different shadow/sizing conventions.

Recommendation: preserve the planner's domain CSS, namespace all selectors, centralize shared motion/overlay variables, and converge sheets/dialogs on one accessible shell without erasing planner-specific geometry.

## Responsive behavior

### Strong areas

- The design rules explicitly require phone, tablet, and desktop acceptance.
- Planner and calendar components contain meaningful alternate behavior rather than simple shrinking.
- Horizontal tables use a reusable scroll frame with top and bottom scroll affordances.
- Public login, public home, and family portal entry rendered without horizontal overflow at sampled sizes.
- Coarse pointer and reduced-motion considerations exist in global and interaction CSS.

### Gaps

- Most non-calendar application pages rely on a single `sm` or `md` stacking change and have not recorded tablet-specific decisions.
- Authenticated persistent navigation needs a dedicated 375/768/1024 review with long school names, notification counts, and owner avatar present.
- Dense family billing history, notification bulk actions, and setup navigation need phone testing with populated/error states.
- Focus order, 200% text zoom, long names, empty data, and onscreen keyboard behavior are not covered by repeatable visual tests.
- There is no screenshot regression suite or route-state fixture layer yet.

## Accessibility and interaction consistency

Existing strengths include semantic links, labels around most fields, dialog roles on lesson sheets, `aria-current` in navigation, reduced-motion rules in custom interactions, keyboard-aware hold confirmation, and coarse-pointer adaptations.

Systemic gaps:

- There is no global visible `:focus-visible` convention for links and buttons.
- Hover color changes are more common than paired keyboard-focus states.
- Muted text and very small text need measured contrast and zoom testing rather than visual judgment alone.
- Color often reinforces state, but some compact calendar marks may still depend too heavily on color.
- Native control appearance is only partly normalized.
- Modal/sheet focus trapping and focus return should be verified as a shared behavior rather than separately assumed.
- Loading, pending, success, and error announcements use `role="status"` inconsistently.

## Public, family, and owner surface consistency

- Public home has the strongest editorial composition and clearest visual identity.
- Production UI, policy, support, consent, and provider-facing product labels consistently use `Common Time`.
- Family portal uses the shared palette and typography successfully but is visually narrower and simpler than the operational owner UI, which is appropriate.
- Owner pages have the same materials and type but are increasingly composed from one-off patterns as functionality grows.
- The temporary `/design` and `/design/interactions` studies remain shipped routes. They should either become an explicit internal design-system reference or be removed from production when no longer needed.

## Conformance assessment

| Principle | Assessment |
| --- | --- |
| Tailwind first | Strong. Most ordinary styling uses utilities. |
| Semantic tokens before raw values | Good for the core palette; incomplete for state, overlay, shadow, and outcome colors. |
| Custom CSS only when needed | Mostly good. Planner and interaction primitives justify it; selector names need isolation. |
| Inline style only when needed | Strong. Production inline styles are data-driven geometry or CSS variables. |
| Reusable components | Mixed. Complex interactions are reusable; common visual grammar is not. |
| Pages compose rather than present | Mixed to weak on large owner and billing pages. |
| Responsive behavior is intentional | Strong in planner/calendar; incomplete elsewhere. |
| Accessible interaction parity | Partial. Good intent, inconsistent focus and verification. |
| Easy global visual change | Partial. Palette and fonts are easy; controls, spacing, hierarchy, and surfaces are not yet. |

## Priority findings

### P0 — fix before a large redesign

1. Establish shared page shell, header, section, field, button, action-link, status, row, empty-state, and sheet primitives.
2. Keep browser-component colors on the semantic token map; literal email colors remain an explicit compatibility exception.
3. Add a global and component-level keyboard focus convention.
4. Namespace component CSS and remove the `.line-action` collision.
5. Define a visual-regression matrix with authenticated fixture states before broad styling changes.

### P1 — address during the redesign foundation

1. Expand tokens for semantic states, overlays, elevation, repeated motion, and repeated type roles.
2. Consolidate page gutters, content widths, vertical rhythm, and row density into explicit variants.
3. Standardize primary, secondary, quiet, danger, selected, pending, and disabled control states.
4. Unify planner and calendar sheet/dialog shells where their accessibility behavior overlaps.
5. Audit and normalize page-title punctuation, taxonomy labels, and status language.
6. Keep product naming centralized and consistently rendered as `Common Time`.

### P2 — verify before V1 visual sign-off

1. Authenticated screenshots at 375, 768, 1024, and 1440 pixels for every main owner route.
2. Populated, empty, loading, success, warning, and error states.
3. Keyboard-only navigation, visible focus, focus return, and modal containment.
4. 200% zoom, long names, long translated-style copy, and no accidental overflow.
5. Reduced motion and coarse-pointer interactions.
6. Automated contrast checks plus human review of the textured dark canvas.

## Recommended refactor sequence

1. **Freeze and capture.** Create deterministic owner/family fixture states and baseline screenshots before changing visuals.
2. **Repair the token map.** Add missing semantic states and effects; remove invalid and raw repeated values.
3. **Build primitives from existing patterns.** Extract without redesigning so visual changes remain reviewable.
4. **Adopt primitives route family by route family.** Start with simple setup/profile pages, then lists, family billing, notifications, and finally planner/calendar shells.
5. **Apply the new visual direction centrally.** Change tokens and primitive variants before route-specific overrides.
6. **Handle deliberate exceptions.** Keep planner geometry and unique editorial public layouts bespoke, but make each exception explicit.
7. **Run the full responsive and accessibility matrix.** Compare against baseline, approve intended changes, and log remaining debt.

## Definition of done for a swappable visual system

- A palette change requires editing token values, not route files.
- A typography hierarchy change requires editing shared roles, not dozens of headings.
- Button, field, row, status, sheet, and page-shell changes propagate through supported variants.
- Raw colors and fixed visual inline styles do not appear in browser components.
- Custom CSS is namespaced, interaction-driven, responsive, and reduced-motion safe.
- Every main route has repeatable populated and edge-case screenshots at the four target widths.
- Visual exceptions are intentional, documented, and small enough to review individually.

## Audit maintenance

Update this document whenever the styling architecture changes materially. Record future audit runs below with date, scope, screenshots or test vector used, findings added or closed, and the commit that changed the system.

### Audit log

#### UI-AUDIT-2026-08-20-001 — Baseline system audit

- Scope: full Tailwind/CSS/component scan plus public production samples at phone, tablet, and desktop sizes.
- Result: the aesthetic foundation is coherent; global palette and font changes are centralized; broad component-level redesign is blocked by repeated visual class strings and incomplete semantic state/effect tokens.
- Action: use the P0/P1 sequence above before or as the first phase of a major visual redesign.

#### UI-AUDIT-2026-08-20-002 — Naming and raw-color cleanup

- Replaced legacy `MusicSchool` labels across production UI, public policies, SMS consent, billing safety copy, Stripe-facing account naming, and internal design studies with `Common Time`.
- Moved lesson outcome colors and planner overlay/shadow values into the centralized semantic foundation.
- Replaced the invalid `bg-panel/40` billing surface with the configured `surface` token.
- Preserved literal colors only in transactional email HTML, where CSS variables and the browser Tailwind layer are unavailable.

#### UI-AUDIT-2026-08-20-003 — Identity palette and main type

- Added the temporary Common Time identity as a statically optimized product asset and used it on public/sign-in surfaces while preserving school logos inside authenticated school contexts.
- Replaced the warm charcoal/brass token values with an accessible near-black, navy, blue-white, and cyan system derived from the identity artwork.
- Adopted DM Sans as the main operational family and retained Newsreader for expressive display hierarchy.
- Verified the public and login surfaces at 375 and 1440 pixels with no horizontal overflow.
