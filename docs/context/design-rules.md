# Design Rules

## Character

The product should feel like a well-run independent music school: cultivated, human, calm, and specific. It should not resemble a generic venture-backed dashboard or an AI-generated component library.

## Rules

1. Typography creates hierarchy before containers do. Prefer scale, weight, alignment, and whitespace over putting every idea in a card.
2. Rounded corners are scarce. Default controls and surfaces are square or nearly square. Reserve circles for avatars and stronger rounding for objects whose shape has meaning.
3. Do not use eyebrow text as a default heading pattern. Use small uppercase text only for real taxonomy, status, or navigation—not decoration.
4. Avoid gradients, colored glows, glass effects, decorative blobs, and oversized shadows.
5. Use one accent color sparingly for action and state. Neutral surfaces should carry most of the interface.
6. Prefer rules, open space, and shifts in background tone to nested bordered panels.
7. Layout may be asymmetric, but interaction should remain predictable. Editorial composition is welcome; arbitrary misalignment is not.
8. Buttons should read as controls, not badges. Avoid pill buttons except where the pill communicates a selected filter or compact status.
9. Tables, calendars, and schedules should be information-dense enough to scan. Do not inflate every row with generous dashboard padding.
10. Labels use sentence case. All caps is reserved for short codes, dates, or genuine categories.
11. Empty states should explain the next useful action in plain language. Avoid cute filler copy and generic illustrations.
12. Motion must explain a state change or preserve spatial context. No ambient motion.
13. School branding may alter the accent color and logo, but not contrast, spacing, or basic interaction rules.
14. Add a new visual token only when it expresses a repeated design decision. Do not turn every one-off measurement into configuration.
15. Every feature must be intentionally designed for phone, tablet, and desktop. Responsive behavior is part of the feature definition, not cleanup after the desktop view ships.
16. Hover may enhance an interaction but may never be the only way to discover information or perform an action. Touch and keyboard behavior must be explicit.
17. When phone or tablet behavior differs materially from desktop, record the difference and tell the user before treating the design as complete.

## Responsive View Rules

- Phone baseline: verify narrow portrait layouts around 375px. Prefer single-purpose screens, stacked information, and touch targets that do not depend on precision pointing.
- Tablet baseline: verify portrait and landscape layouts around 768–1024px. Do not assume a tablet has persistent hover, even when a trackpad might be present.
- Desktop baseline: use added width for simultaneous context, comparison, and precise pointer interactions—not simply larger spacing.
- Avoid accidental horizontal scrolling. A deliberately scrollable schedule or table must have a visible affordance and preserve essential controls outside the scrolling region.
- Dense desktop calendars may become an agenda, single-teacher track, or summarized grid on smaller screens. Preserve the task and data, not necessarily the desktop geometry.
- Sheets and dialogs become full-width or nearly full-screen on phones when needed. Closing, saving, and destructive actions must remain reachable without awkward scrolling.
- Test long names, large text, keyboard focus, reduced motion, empty states, and populated states at all three size classes.

### Planner-specific responsive decisions

- Desktop: hover or focus expands teacher tracks; all teachers can be compared simultaneously.
- Tablet: tapping an availability rail selects and expands it; tapping a lesson opens details. Hover quick views are optional enhancement only.
- Rescheduling is an explicit calendar mode. The selected lesson may be dragged with mouse, pen, or touch while teacher tracks retain their normal expand/compress behavior. A drop only proposes a destination; a separate hold confirms it.
- Invalid collision or availability destinations use a visible rejected ghost and cannot advance to confirmation. Owners may explicitly override recurring availability with a recorded reason, but never teacher or student conflicts.
- On phones, the focused date/time/teacher/place form is open by default so rescheduling never depends on manipulating the horizontally scrollable planner. It uses the same proposal and confirmation transaction as drag-and-drop.
- Reschedule confirmation always compares old and new time, names teacher and place, and shows the immutable billing month before the hold action.
- Phone: default to one selected teacher in day view. Week view should favor an agenda or horizontally paged days. Month view should show compact counts/capacity and open a day rather than squeeze full lesson details into seven narrow columns.
- Phone entry initializes the planner in one-teacher day view, including after a tablet-to-phone resize. Starting a reschedule from lesson details retains that compact teacher scope instead of reopening the all-teacher canvas.
- On touch, lesson dragging begins only from the reschedule icon so vertical scrolling and ordinary lesson taps remain predictable. The icon is a real touch target; tapping a compressed teacher rail expands it and tapping again releases it.
- Phone month cells show lesson counts and capacity marks, and their date/count controls open the focused day. Full lesson labels remain available in day view rather than being squeezed into seven columns.
- Phone lesson and confirmation sheets occupy the viewport and keep their headings/actions reachable. Week view remains deliberately horizontally scrollable pending a later agenda or paged-day treatment.

## Interaction Grammar

- Draw: a short resting rule extends to acknowledge hover or keyboard focus.
- Focus: an input baseline draws across the field; do not surround focused controls with glow.
- Track: a shared rule travels between mutually exclusive views or states.
- Connect: a temporary line may reveal a selected relationship between two visible datasets.
- Expand: overlapping availability fields may grow to the full day column on hover or focus, bringing the selected teacher forward while booked events remain visually dominant.
- Compress: when one teacher expands, inactive availability fields reduce to persistent edge rails and their labels fade. Rails retain a usable hover target so focus can transfer fluidly without hiding another teacher completely.
- Displace: compressed rails move to the outer edge on their original side of the active teacher. The active field occupies only the remaining space between left and right rail stacks, making the transition feel physical rather than layered in place.
- Fill: progress should occupy an existing line or surface rather than introduce a separate decorative meter.
- Confirm: consequential actions may use hold-to-confirm when accidental activation is a credible risk. Always support pointer and keyboard input, show progress, and cancel cleanly on release.
- Keep common actions immediate. Hold-to-confirm is not a substitute for clear labels or a pattern to apply to ordinary saving.
- Motion should usually finish in 180–350ms. Longer motion is reserved for meaningful elapsed progress such as holding to confirm.
- Honor reduced-motion preferences; preserve state communication even when travel animation is removed.

## Billing workflow acceptance requirements

- Present billing as a clear, unmistakable workflow progression; it does not need to be numbered. At every point, state what has been completed, what is happening now, and what the owner must do next in consumer language.
- State and error messages must belong to the current period version and action. Clear obsolete feedback after a successful transition; never leave a failed refresh warning displayed as though it describes a newly locked period.
- Delivery status must identify the destination and attempt time, for example: `Failed to send to name@example.com on August 14 at 3:42 PM`. Preserve earlier attempts in an activity history instead of collapsing them into an ambiguous status.
- Never label provider intake as simply `accepted`; owners can reasonably read that as payer acceptance of the charges. Translate provider states into user-facing delivery language such as `Sent to email provider`, `Delivered`, `Delivery failed`, and separately `Approved by payer`.
- Preparing, refreshing, locking, submitting/replacing an approval request, and starting a charge are consequential billing actions and require hold-to-confirm. The hold label must name the exact result.
- Telegraph the current object and context: school, family or payer, service month, statement version, amount, and workflow stage must remain visible while working.
- Prefer a focused modal, sheet, or dedicated statement workflow for preparation and approval when the surrounding family dashboard makes the active billing task ambiguous. On phones this should behave as a full-screen workflow.
- Preserve clear dashboard location and direct navigation among family details, students, schedule, billing, payment methods, and statement history; owners should not have to repeatedly back out to find sibling areas.
- Actions that are invalid in the current state must be disabled or absent. When useful, an adjacent explanation must say exactly which prerequisite is missing. Server-side state guards remain authoritative even when the control is disabled.
- Button language in test instructions and documentation must exactly match the rendered control. Similar phrases such as `Replace approval link` and `Revise and replace request` may not be treated as interchangeable.
- Billing workflow correctness takes priority over visual refinement during the current implementation phase. These requirements remain recorded acceptance debt and must be resolved before the workflow is considered production-ready.
- Payer response controls are state-exclusive. `Approve` and `Send back for review` appear only while the exact request is pending. After approval, rejection or adjustment-request controls disappear; later concerns enter a separate school-contact, correction, credit, or refund workflow and never rewrite accepted consent.
- Financial actions must use precise nouns. Distinguish `Statement adjustment`, `Account credit`, `Apply account credit`, `One-off charge`, and `Refund payment`; never collapse these into a generic `Adjustment` control. Show whether a credit is available, reserved for a draft, applied to a locked statement, or reversed.
- Receipt links should read `View Stripe receipt` and disclose when one payment covers multiple students. Never present a family payment as multiple independent receipts merely because it appears in more than one student's history.
- Failed-payment notices must identify the family, statement, amount, attempt time, current payment truth, and available recovery actions in plain language. Provider decline codes may support the translation but should not be the owner's primary explanation.
- Bulk draft preparation should lead to a review queue, not directly to payer communication or collection. Individual review is the dominant action. `Lock all eligible drafts` is a secondary text action that opens a summary of totals and exceptions and then requires deliberate confirmation; it must never visually compete with reviewing the next draft.

The live study is available at `/design/interactions`.

## Current Typography Study

- Newsreader with IBM Plex Sans: expressive editorial headings with practical interface text.
- Bricolage Grotesque: a single-family direction with more personality and softer rhythm.
- IBM Plex Sans: a restrained, operational direction that emphasizes clarity and density.

The study lives at `/design`. All three trials now use dark material palettes so typography can be compared without changing the chosen atmosphere. It is a temporary decision tool, not a production feature commitment.

## Selected Direction

- Atmosphere: dark, tactile, and residential rather than glossy or technical.
- Palette: warm charcoal, soot, aged wood, limestone, parchment, and restrained antique brass.
- Typography: Newsreader for expressive headings and IBM Plex Sans for operational interface text.
- Texture: a nearly imperceptible grain may soften large digital surfaces; it must never reduce legibility or become a decorative effect.
- Geometry: square and near-square edges, thin architectural rules, open sections, and little or no shadow.
