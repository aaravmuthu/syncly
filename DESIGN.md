---
name: Syncly
description: Plans that actually work for everyone.
colors:
  evergreen-signal: "oklch(0.44 0.09 168)"
  warm-ember: "oklch(0.74 0.13 62)"
  paper: "oklch(0.985 0.006 95)"
  paper-surface: "oklch(0.965 0.008 95)"
  card: "oklch(1 0 0)"
  neutral-surface: "oklch(0.94 0.01 95)"
  ink: "oklch(0.22 0.012 70)"
  ink-muted: "oklch(0.52 0.012 75)"
  ink-border: "oklch(0.25 0.01 70 / 0.12)"
  success: "oklch(0.55 0.13 155)"
  warning: "oklch(0.72 0.14 75)"
  destructive: "oklch(0.55 0.18 27)"
typography:
  display:
    fontFamily: "Bricolage Grotesque, ui-serif, Georgia, serif"
    fontSize: "2.5rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Bricolage Grotesque, ui-serif, Georgia, serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  title:
    fontFamily: "-apple-system, SF Pro Text, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
  body:
    fontFamily: "-apple-system, SF Pro Text, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.011em"
  label:
    fontFamily: "-apple-system, SF Pro Text, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.16em"
  brand:
    fontFamily: "Gloock, ui-serif, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.01em"
rounded:
  sm: "10px"
  md: "13px"
  lg: "16px"
  xl: "20px"
  "2xl": "26px"
  "3xl": "34px"
  surface: "28px"
  full: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.evergreen-signal}"
    textColor: "{colors.paper}"
    rounded: "{rounded.2xl}"
    padding: "10px 16px"
    typography: "{typography.body}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "10px 16px"
    typography: "{typography.body}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "10px 14px"
    typography: "{typography.body}"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  pill-status:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
    typography: "{typography.label}"
---

# Design System: Syncly

## Overview

**Creative North Star: "The Night Radar"**

Syncly reads as a live-signal instrument wearing warm, ink-on-paper calm during the day and going full glass-and-glow after dark. The name isn't decorative: the radar pulse that animates a friend's live location on the map is the same visual grammar — a soft ring expanding from a solid core — that shows up as loading skeleton sheens, presence indicators, and the "S" glyph at the center of the app mark. Everything floats: navigation, search, and status live in frosted glass capsules that sit with margin above the content rather than fusing to the screen edge, because the product's real subject (the map, the plan, the group) should always show through.

The system is calm, trustworthy, and quietly premium rather than loud or gamified — it has to read as safe to a parent glancing at the Family Hub and as genuinely nice to use for a teen coordinating a Friday night. Color discipline does the work here: one confident evergreen carries almost the entire system, one warm ember accent appears only as a rare spark. Depth is deliberate rather than decorative — flat where structure needs to read clearly, frosted where content needs to breathe underneath, and only truly "lifted" where a control needs to visibly float over live map or page content.

**Key Characteristics:**

- Warm-paper light mode, near-black "Apple-style" dark mode — both real, tuned themes, not a light mode with inverted values.
- One confident accent (evergreen), one rare spark (amber) — never treated as co-equal.
- Floating glass chrome for navigation and controls; structural content stays flat or frosted.
- Every border, divider, and skeleton is the ink color at low opacity, never a separate gray token.
- Motion is spring-physical (bounce, lift, haptic tap) everywhere a control responds to touch.

## Colors

Warm and restrained in light mode, cool and glass-forward in dark mode; in both, the palette leans on exactly two chromatic colors and lets neutrals (paper/ink) do the rest of the work.

### Primary

- **Evergreen Signal** (`oklch(0.44 0.09 168)`): the one confident accent — primary buttons, active nav state, focus rings, links, the "S" glyph glow, the radar pulse ring, chart line 1. In dark mode it lifts to `oklch(0.72 0.11 168)` so it still reads against a near-black canvas.

### Secondary (spark, not a second primary)

- **Warm Ember** (`oklch(0.74 0.13 62)`): deliberately rare — radial background glows on marketing surfaces, the "accent" status-pill tone, one map-pin variant (activity pins). Dark mode: `oklch(0.78 0.12 62)`.

### Neutral

- **Paper** (`oklch(0.985 0.006 95)`): page background in light mode. Dark mode's background is a near-black `oklch(0.06 0.002 270)` — not an inversion of Paper, a distinct "ink at night" canvas.
- **Paper Surface** (`oklch(0.965 0.008 95)`): the `surface`/`elevated` step — secondary panels, one tick above background. Dark mode: `oklch(0.145 0.004 270)` (surface) stepping up to `oklch(0.27 0.006 270)` (elevated) — dark mode uses three real lightness steps (background → card → elevated) so depth reads even before blur dilutes it.
- **Card** (`oklch(1 0 0)`, pure white in light mode / `oklch(0.2 0.005 270)` in dark mode): flat structural card backgrounds.
- **Neutral Surface** (`oklch(0.94 0.01 95)`): secondary button / neutral-tone pill background.
- **Ink** (`oklch(0.22 0.012 70)`): primary text. Dark mode: near-white `oklch(0.985 0.002 270)`.
- **Ink Muted** (`oklch(0.52 0.012 75)`): secondary text, timestamps, captions. Dark mode: `oklch(0.72 0.006 270)`.
- **Ink Border** (`oklch(0.25 0.01 70 / 0.12)`): the base hairline border color. Dark mode: `oklch(1 0 0 / 0.08)`.

### Semantic

- **Success** (`oklch(0.55 0.13 155)`) / **Warning** (`oklch(0.72 0.14 75)`) / **Destructive** (`oklch(0.55 0.18 27)`): status pills, meters, alerts. Each has a dark-mode lift (`0.72 0.13 155` / `0.8 0.13 75` / `0.64 0.18 27`) following the same "lighten to read on near-black" rule as the two brand colors.

### Named Rules

**The Warm Ember Rule.** Amber is a rare spark, not a second primary. Reserve it for a glow, a celebration moment, or a single accent pill per screen — if amber is competing with Evergreen Signal for attention anywhere, that's a bug, not a choice.

**The Ink-Mix Rule.** Every border, divider, skeleton background, and scrollbar thumb is `color-mix(in oklab, var(--foreground) N%, transparent)` at some low percentage (typically 7–16%) — never a standalone gray hex. This is what makes light and dark mode automatically produce correctly-weighted neutrals without a second set of gray tokens to maintain.

## Typography

**Display Font:** Bricolage Grotesque (with ui-serif, Georgia, serif fallback)
**Body Font:** the platform system face — SF Pro on Apple devices, Segoe UI on Windows — via `-apple-system, BlinkMacSystemFont, "SF Pro Text", ui-sans-serif, system-ui`. Chosen for native legibility and zero font download; personality lives in the display and brand faces.
**Brand/Wordmark Font:** Gloock (with ui-serif, Georgia, serif fallback) — reserved for the Syncly wordmark itself, never used for UI copy

**Character:** A grotesque display face for headlines paired with a warm, slightly rounded humanist sans for everything functional — confident and a little editorial at hero scale, calm and legible at body scale. The separate Gloock brand face exists only so the wordmark itself carries a touch more personality than any UI text is allowed to.

### Hierarchy

- **Display** (600, 2.5rem, 1.1 line-height, -0.03em tracking): hero headlines and the largest on-screen numbers.
- **Headline** (600, 1.75rem, 1.2 line-height, -0.03em tracking): section headings (`h1`–`h3` all resolve to the display font family with this tight negative tracking).
- **Title** (600, 1.125rem, 1.35 line-height): card titles, list item primary text — still the body font family, just heavier.
- **Body** (400, 1rem, 1.5 line-height, -0.011em tracking): the default for everything readable. Inputs and textareas are pinned to 16px specifically to stop iOS Safari's zoom-on-focus — never let a form control render smaller than this.
- **Label** (600, 0.75rem, 1.4 line-height, 0.16em tracking, uppercase): eyebrow labels and stat captions ("SETUP", section kickers).

### Named Rules

**The Sixteen Rule.** No form input renders below 16px, ever — it's not a visual preference, it's what stops iOS from zooming the whole page on focus.

## Layout

Mobile-first and mobile-shaped even on desktop: the authenticated app renders inside a centered `max-w-3xl` column with its own shadow on wide viewports, deliberately keeping the phone-app proportions rather than spreading into a desktop dashboard layout. There is no custom spacing token scale — rhythm comes from Tailwind's default 4px-based scale used consistently (`gap-3`/`gap-4`/`gap-5`, `px-4`/`px-5`, `py-2.5`/`py-3.5`).

Two chrome variables (`--chrome-top`, `--chrome-bottom`) are the single source of truth for how much space floating chrome reserves, computed from safe-area insets plus the pill's own height — every screen's own floating controls read these instead of hardcoding chrome height, so the floating bar can change size without every screen drifting out of sync.

### Named Rules

**The Inset Chrome Rule.** Navigation and floating controls never sit edge-to-edge. They're capsules with margin (`inset-x-3`, safe-area-aware top/bottom offsets) so the content behind — especially the Radar map — is always visible around them.

## Elevation & Depth

Three real depth tiers, and shadow is used structurally, not ambiently — a shadow shows up only where something is either a self-contained flat object or something actively floating over other content; it never decorates a translucent panel.

1. **Flat / structural** (`card-surface`): opaque background, hairline border, one soft ambient shadow. Landing-page feature cards and testimonials use this tier.
2. **Frosted / recessed** (`surface`, the `Card` primitive): `blur(40px) saturate(180%)` over a partially transparent card color, hairline border, **no shadow at all** — depth comes from the blur and the border, not from elevation.
3. **Floating / glass** (`glass-card`, `glass-pill`): the heaviest treatment — blur + saturation + a real drop shadow plus an inset top/bottom highlight to sell "pane of glass," always reserved for controls that visually hover over other content (nav bars, search pills, map controls, status pills).

### Shadow Vocabulary

- **Ambient card** (`0 1px 2px oklch(0 0 0 / 0.04), 0 12px 28px -22px oklch(0 0 0 / 0.35)`): flat structural cards.
- **Glass card** (`0 24px 60px -32px color-mix(in oklab, var(--foreground) 55%, transparent), inset 0 1px 0 color-mix(in oklab, var(--foreground) 8%, transparent)`): floating panels.
- **Glass pill** (theme-aware `--glass-shadow`, tuned separately per theme — e.g. dark mode adds a `brightness(1.32)` lift so frost still reads over an already-dark canvas): nav bars, floating controls.

### Named Rules

**The No-Shadow-On-Frost Rule.** The `surface`/`Card` tier never gets a `box-shadow`. If a panel needs to visually separate from its background, that's a sign it should either be a flat `card-surface` or a floating `glass-card`, not a frosted `surface` with a shadow bolted on.

## Shapes

Soft and capsule-heavy, with radius scaling by role rather than one blanket value. The base `--radius` (16px) drives a full scale (`sm` 10px → `3xl` 34px); a separate fixed `--radius-surface` (28px) exists specifically for the frosted/glass tier so it always reads as noticeably softer than a structural card regardless of the base radius scale. Anything meant to float (nav bars, search pills, badges, glass buttons) is `rounded-full`; structural containers (cards, empty states, dialogs) use the `2xl`/`3xl` steps; small inline elements (inputs, standard buttons) use `2xl`.

### Named Rules

**The Full-Or-Structural Rule.** Radius is either `rounded-full` (anything that floats or is a pill/badge/circular control) or a structural step (`xl` through `3xl`, for anything that's a container). Nothing in between — there's no "slightly rounded rectangle" floating control in this system.

## Components

Tactile and springy, never stiff — every interactive primitive responds to touch with a small physical bounce (Framer Motion spring, `stiffness: 420, damping: 26`), pairs it with a haptic tap on pointer-down, and lifts a couple pixels with an intensifying shadow on hover for anything acting as a call to action.

### Buttons

- **Shape:** `rounded-2xl` (26px) for standard buttons; `rounded-full` for the `glass` variant, since glass surfaces are always capsules.
- **Primary:** Evergreen Signal background, Paper text, `10px 16px` padding, `hover:opacity-92`.
- **Outline / Ghost:** transparent or `neutral-surface` background, Ink text, hairline border on outline.
- **Danger:** Destructive background, Paper text — same shape and motion as primary.
- **Glass:** `glass-pill` background (theme-aware frosted capsule), Ink text — used when a button needs to read as a floating control (e.g. "try the demo" against the hero) rather than a filled action.
- **All variants:** press scales to 0.95, hover lifts and scales to 1.02, spring transition, haptic tap on pointer-down, disabled/loading drop to 55% opacity.
- **Hero CTA (`GlowButton`):** adds a colored glow shadow on hover that intensifies and a 3px lift — Evergreen glow for the primary CTA, a neutral ink-tinted glow for secondary CTAs.

### Chips / Pills

- **Status pill:** `rounded-full`, `4px 10px` padding, Label typography. Five semantic tones (`neutral`/`good`/`warn`/`bad`/`accent`), each a tint of its color at 12–18% opacity over full-strength text — never a solid fill.
- **Status → tone mapping is centralized** (`statusTone()`): voting/collecting/recommending → accent; finalized/completed → good; cancelled → bad; everything else → neutral. New states should route through this rather than inventing a new color mapping per screen.

### Cards / Containers

- **Corner Style:** `rounded-2xl` (structural `card-surface`) or `radius-surface` 28px (frosted `Card`/`surface`).
- **Background:** Card color (flat) or Card color blended to ~74% over the canvas (frosted).
- **Shadow Strategy:** see Elevation & Depth — flat cards get the ambient shadow, frosted cards get none.
- **Border:** hairline Ink Border on both tiers.
- **Internal Padding:** `20px` (`p-5`) is the default card padding.

### Inputs / Fields

- **Style:** `rounded-2xl`, hairline border, Paper background, 16px text (never smaller — see The Sixteen Rule).
- **Focus:** border shifts to Evergreen Signal at 60% opacity; no glow or ring beyond the standard `:focus-visible` outline.
- **Label pairing (`Field`):** label + optional hint text above, `mt-2` gap to the control.

### Navigation

- **Style:** both the top bar and the bottom tab bar are `glass-pill` capsules, inset from the screen edge with safe-area-aware margin, never edge-to-edge, never opaque. Desktop collapses the bottom tab bar entirely and moves tabs into the header (`DesktopTabs`).
- **Active state:** a short `h-0.5 w-8 rounded-full` Evergreen Signal underline plus Evergreen text color; badge counts render as small solid Evergreen circles with Paper numerals.
- **Touch handling:** primary pointer-down navigates immediately (not on click) with a short duplicate-tap lock, so taps feel instant despite going through real routing rather than optimistic state.

### Radar Map Pins (signature component)

The most distinctive part of the system — a full custom pin language layered over Mapbox's dark style (Radar always forces dark-mode map styling regardless of site theme, since the base map tile is always `dark-v11`):

- **Avatar pins:** circular member photo/initials in an Evergreen-ringed circle, with a small triangular heading indicator and an animated pulse ring (`q-avatar-pulse`) for live presence — the same expanding-ring language as the app's loading skeleton sheen, deliberately, since both mean "this is live."
- **Place pins:** dark glass capsules (`rgb(9 9 11 / 0.7)` + blur) with a small colored dot — sky blue default, pink when active/selected.
- **Cluster pins:** numbered Evergreen circles replacing overlapping pins at low zoom.
- **Cost/fairness pins:** Success-tinted circle for a "fair" recommended option.
- **Low battery badge:** small Warning-colored badge, shown only when actually low — not a persistent readout.

## Do's and Don'ts

### Do:

- **Do** derive every border, divider, skeleton fill, and scrollbar color from `color-mix(in oklab, var(--foreground) N%, transparent)` rather than a standalone gray.
- **Do** keep floating chrome (nav, search, status pills, map controls) inset from the screen edge with visible margin, in `glass-pill`/`glass-card`, never edge-to-edge or opaque.
- **Do** pair every tappable control with a spring press/hover animation and a haptic tap — a static button in this system reads as broken, not restrained.
- **Do** reserve `rounded-full` for anything that floats, is a pill, or is circular; use the structural radius steps (`xl`–`3xl`) for containers.
- **Do** respect `prefers-reduced-motion` (already collapses animation durations) and `prefers-reduced-transparency` (glass falls back to solid `--card`) for every new motion or glass surface.
- **Do** keep Evergreen Signal as the only color doing real "this is interactive/primary" work across the app.

### Don't:

- **Don't** use Warm Ember as a second primary — it's a rare spark (glow, celebration, single accent pill), not a co-equal action color.
- **Don't** add a `box-shadow` to a frosted (`surface`/`Card`) panel — if it needs to separate visually, make it a flat `card-surface` or a true floating `glass-card` instead.
- **Don't** render form inputs below 16px — it triggers iOS Safari's zoom-on-focus.
- **Don't** invent a new gray/neutral hex for borders or dividers; derive it from `--foreground` via `color-mix`.
- **Don't** treat the privacy-preserving copy voice as a components concern — individual-constraint language ("doesn't meet every requirement," never naming who or why) is a content rule from PRODUCT.md, not a visual one, but it constrains what any new component's default copy may say.
