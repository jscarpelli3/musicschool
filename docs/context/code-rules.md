# Code Rules

## Component And Module Discipline

1. Build recurring interface and behavior patterns as reusable components. Do not reimplement the same control, sheet, tooltip, field, selector, status treatment, or interaction in individual pages.
2. Pages orchestrate data and compose features; they should not accumulate large amounts of bespoke presentation or domain logic.
3. Organize code by responsibility:
   - reusable visual primitives in `src/components/ui`
   - domain-level components in a named feature folder such as `src/components/planner`
   - server mutations close to their route or feature
   - Supabase client construction and shared data utilities in `src/lib`
4. Keep domain rules out of generic UI components. A quick-view component may own timing and presentation; it should not know what a lesson or student is.
5. Prefer composition and narrow, typed props over components controlled by many booleans.
6. When a pattern needs variants, define the supported variants in one component or token source. Do not scatter slightly different class strings through the application.
7. Extract a pattern when it repeats, when consistency is important, or when its interaction/accessibility behavior deserves one maintained implementation. Do not create abstractions solely to reduce line count.
8. Keep data transformations separate from rendering when they become substantial. Server pages should prepare clear view models rather than forcing generic UI components to understand database rows.
9. Shared components must preserve keyboard use, visible focus, semantic markup, and reduced-motion behavior.
10. Before adding a new component, check whether an existing primitive or feature component can be extended cleanly. Before extending one, confirm the new responsibility belongs there.
11. Every component and feature must define behavior for phone, tablet, and desktop. Responsive acceptance is required alongside type, lint, and build checks.
12. Pointer hover cannot carry required functionality. Reusable interactions must expose equivalent touch and keyboard paths.
13. Flag material phone/tablet departures from desktop behavior to the user while designing the feature, not after implementation.

These rules are part of the project architecture and apply to all new work and refactoring.
- A production control may be optimistic only when failure is visible and recoverable. Business mutations must await a database/provider result, report failure without implying success, and use idempotency where retries could duplicate work.
- Never derive payment truth from a browser redirect or client callback. Persist provider event IDs and update payment state from verified, idempotent webhooks.
