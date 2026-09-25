# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are teens (roughly middle-school through high-school age) planning hangouts with a friend group, with parents/guardians as a core second user — not an edge case. Teens create plans, answer constraint questions privately, vote, chat, and share live location with their group ("Radar"). Parents/guardians use a separate Family Hub to see plans, rides, safe zones, and check-ins, and to approve, decline, or conditionally approve outings via a link that requires no app download.

## Product Purpose

Syncly turns a group's private constraints (budget, ride availability, curfew, dietary needs, etc.) into a short list of plan options that are guaranteed to work for everyone in the group, without anyone having to announce their limits out loud in the group chat. It also gives parents visibility and an approval mechanism, and gives the group live location sharing ("Radar") during the outing. Success means groups reach a plan faster, with less friction and no one quietly sacrificed, and parents get confidence without micromanaging.

## Positioning

The differentiator is the privacy-preserving constraint-matching engine, not the chat or scheduling UI around it: every member answers hard and soft constraints privately; the engine eliminates infeasible options first (hard constraints), then ranks by universal feasibility, then fairness (so the same person isn't always the one who compromises), then aggregate preference, then individual preference strength as a tiebreaker. The group only ever sees whether an option works, never who it didn't work for or why. This is described in `src/lib/quorum/engine.ts` and is deliberately ordered and deterministic. Guardian/safety features (parent approval links, safe zones, curfew-aware ride solving) are a real, prominent second pillar, but the constraint engine is the thing a competitor could not truthfully copy.

## Operating Context

- Plans are created within a group ("squad"), with a category, date window, and member set.
- Each member privately answers a constraint questionnaire (budget, timing, ride needs/capacity, curfew, dietary restrictions).
- The engine computes and ranks feasible options; the group votes on the resulting shortlist.
- Rides are solved as part of the plan (seats, drivers, distance limits, return times), not handled separately.
- Live Radar gives real-time location sharing among group members during an outing (mobile-first, full-screen map experience).
- A parent/guardian can be linked to a teen; the Family Hub surfaces that teen's plans, ride details, safe-zone activity, and check-ins, and lets the parent approve, decline, or approve-with-condition via a shareable link — no separate app install required. Conditions attach privately to that teen and the plan re-checks itself.
- Direct messages and group chat exist alongside plans.
- An AI assistant layer exists (see `src/lib/quorum/ai.*`, `aiplus.*`) that can propose candidate options for the engine to score, and produce summaries (e.g., Guardian AI summaries) — but scoring and privacy enforcement stay in the deterministic engine, not the AI.

## Capabilities and Constraints

- Stack: TanStack Start (React) + Vite, Supabase (auth/data), Tailwind v4, Radix UI primitives, Mapbox GL for maps.
- Web-only today; the PWA manifest enables "Add to Home Screen" standalone install, but there is no native iOS/Android wrapper — this does not change the platform classification (web).
- The compatibility engine (`src/lib/quorum/engine.ts`) is pure and deterministic by design; AI may generate candidate options but must not be the source of scoring or privacy decisions.
- Privacy is a hard constraint on the UI/copy layer, not just the backend: individual constraint answers must never be exposed to the group, and language throughout must stay non-identifying (e.g., "doesn't meet every requirement" rather than naming who or why).
- Parent approval must work for a parent with no account/app — link-based flow is a fixed requirement, not a nice-to-have.

## Brand Commitments

- Name: **Syncly** (`src/lib/brand.ts` is the single source of truth for naming — update there to rebrand).
- Tagline: "Plans that actually work for everyone."
- Short pitch: "Everyone privately enters what they need. Syncly finds the plan that works for the whole group."
- Voice: direct, plainspoken, slightly wry — leans on real friction points ("I can't spend that much," "I have to be home by 10") rather than generic feature-speak.

## Evidence on Hand

No real testimonials, case studies, or usage data exist yet. The landing page currently shows illustrative quotes attributed to named people ("Maya, 17," "Dev, 16," "Parent of a junior") — these are placeholder marketing copy, not real evidence, and future work must not treat them as, or build further fabricated evidence on top of, real testimonials.

## Product Principles

1. Privacy is structural, not cosmetic: individual constraints are never exposed to the group, in data or in copy — every surface must preserve this, including AI-generated summaries.
2. Feasibility before popularity: an option must work for everyone before it's ranked by preference; fairness prevents the same person from being the recurring compromise.
3. Parents are a first-class user, not a permission gate: the Family Hub and approval flow should feel like genuine visibility and control, reachable without installing anything.
4. Rides and logistics are part of the plan, not an afterthought — a "feasible" plan already accounts for how people get there and back.
5. The AI layer proposes; the deterministic engine decides. Never let AI-generated content bypass the scoring/privacy rules that live in `engine.ts`.

## Accessibility & Inclusion

No formal accessibility standard has been confirmed with the user. The codebase shows active accessibility intent (aria-label/aria-pressed/aria-expanded semantics on shared UI primitives in `src/components/quorum/ui.tsx`), which future work should preserve and extend rather than treat as optional.
