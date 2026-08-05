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
