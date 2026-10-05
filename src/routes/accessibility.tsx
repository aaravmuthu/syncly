import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, List, Section } from "@/components/quorum/LegalLayout";
import { BRAND } from "@/lib/brand";
import { LEGAL } from "@/lib/legal";

const TITLE = `Accessibility Statement — ${BRAND.name}`;
const DESCRIPTION =
  "Syncly's accessibility goals, current limitations, evaluation status, and how to report an accessibility barrier.";

export const Route = createFileRoute("/accessibility")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: "https://syncly.website/accessibility" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://syncly.website/accessibility" }],
  }),
  component: AccessibilityPage,
});

const TOC = [
  { id: "goal", label: "Our accessibility goal" },
  { id: "evaluation", label: "Evaluation status" },
  { id: "limitations", label: "Known limitations" },
  { id: "feedback", label: "Report a barrier" },
];

function AccessibilityPage() {
  return (
    <LegalLayout
      title="Accessibility Statement"
      effectiveDate="October 4, 2026"
      dateLabel="Last updated"
      toc={TOC}
      intro={
        <p>
          Syncly is operated by {LEGAL.operators}. We want people with disabilities to be able to
          plan and communicate using Syncly. This statement describes our current accessibility work
          and how to tell us about a barrier.
        </p>
      }
    >
      <Section id="goal" title="1. Our accessibility goal">
        <p>
          We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at Level AA. These
          guidelines address access for people with visual, hearing, motor, and cognitive
          disabilities. This is our improvement target; we have not established full conformance.
        </p>
        <p>
          Read the{" "}
          <a
            href="https://www.w3.org/TR/WCAG22/"
            className="underline underline-offset-4 hover:text-foreground"
          >
            WCAG 2.2 guidelines
          </a>
          .
        </p>
      </Section>

      <Section id="evaluation" title="2. Evaluation status">
        <p>
          A preliminary internal review of the application source identified accessibility gaps.
          This was not a complete WCAG assessment. Comprehensive keyboard, screen-reader, contrast,
          and zoom testing across the application remains to be completed. We have not obtained an
          independent accessibility certification.
        </p>
      </Section>

      <Section id="limitations" title="3. Known limitations">
        <List
          items={[
            "Some planner fields and selection controls need clearer labels and state information for assistive technology.",
            "Some forms and safety actions rely on temporary messages; error and status feedback needs improvement.",
            "The SOS confirmation currently resets after five seconds, which may make it difficult for some users to complete.",
            "Some map camera movements do not respect reduced-motion preferences.",
          ]}
        />
        <p>
          Other barriers may exist. We still need to evaluate navigation, dynamic chat updates, map
          information alternatives, audio messages, color contrast, and layouts at increased text
          size and zoom.
        </p>
      </Section>

      <Section id="feedback" title="4. Report a barrier">
        <p>
          If you cannot access a feature or need help with information on Syncly, email{" "}
          <a
            href={`mailto:${LEGAL.contactEmail}?subject=Syncly%20accessibility%20feedback`}
            className="break-words underline underline-offset-4 hover:text-foreground"
          >
            {LEGAL.contactEmail}
          </a>
          .
        </p>
        <p>
          Tell us which page or feature you were using, what you were trying to do, and what
          prevented you from completing it. If useful, include your browser, device, and assistive
          technology. You do not need to disclose a disability or send private messages, precise
          location information, or account credentials.
        </p>
      </Section>
    </LegalLayout>
  );
}
