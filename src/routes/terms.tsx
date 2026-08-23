import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";
import { LegalLayout, List, Ph, Section, SubSection } from "@/components/quorum/LegalLayout";

const TITLE = `Terms of Service — ${BRAND.name}`;
const DESCRIPTION =
  "The terms that govern your use of Syncly, including the guardian/parent-linking relationship and important limits on our location and safety features.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: "https://syncly.website/terms" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: "https://syncly.website/terms" }],
  }),
  component: TermsPage,
});

const TOC = [
  { id: "acceptance", label: "Acceptance of terms" },
  { id: "service", label: "The service" },
  { id: "accounts", label: "Accounts & eligibility" },
  { id: "acceptable-use", label: "Acceptable use" },
  { id: "guardian-linking", label: "Guardian / parent linking" },
  { id: "location-safety", label: "Location accuracy & safety disclaimer" },
  { id: "content", label: "Your content" },
  { id: "third-party", label: "Third-party services" },
  { id: "disclaimers", label: "Disclaimers" },
  { id: "liability", label: "Limitation of liability" },
  { id: "indemnification", label: "Indemnification" },
  { id: "termination", label: "Termination" },
  { id: "law", label: "Governing law & disputes" },
  { id: "changes", label: "Changes to these terms" },
  { id: "contact", label: "Contact us" },
];

function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      effectiveDate="August 22, 2026"
      toc={TOC}
      intro={
        <p>
          These Terms of Service ("Terms") govern your access to and use of {BRAND.name}
          ("Syncly", "we", "us", or "our"), including our website, apps, and related services (the
          "Service"). By creating an account or using the Service, you agree to these Terms. If you
          don't agree, don't use the Service.
        </p>
      }
    >
      <Section id="acceptance" title="1. Acceptance of terms">
        <p>
          By accessing or using Syncly, you agree to be bound by these Terms and our{" "}
          <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
            Privacy Policy
          </Link>
          , which is incorporated by reference. If you're using Syncly on behalf of a minor as their
          guardian, or you're a minor using Syncly with a guardian's involvement, the
          guardian-specific terms in{" "}
          <a
            href="#guardian-linking"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Section 5
          </a>{" "}
          also apply.
        </p>
      </Section>

      <Section id="service" title="2. The service">
        <p>
          Syncly helps groups plan hangouts by privately collecting each member's constraints
          (budget, schedule, rides, etc.) and surfacing options that work for everyone. It also
          offers optional features for teens and guardians, including live location ("radar"), safe
          zones, check-ins, and plan approvals. Not every feature is available to every account
          type, and we may add, change, or remove features over time.
        </p>
      </Section>

      <Section id="accounts" title="3. Accounts & eligibility">
        <List
          items={[
            <>
              You must provide accurate information when creating an account and keep it up to date.
            </>,
            <>
              You're responsible for safeguarding your password and any activity that happens under
              your account. Tell us immediately if you suspect unauthorized use.
            </>,
            <>
              You must be at least <Ph>[minimum age, e.g. 13]</Ph> to create an account. If you're
              under 18, you should use Syncly together with a parent or guardian, including through
              the guardian-linking feature where applicable.
            </>,
            <>
              One person may not maintain more than one account for the same purpose, and accounts
              may not be transferred or sold.
            </>,
          ]}
        />
      </Section>

      <Section id="acceptable-use" title="4. Acceptable use">
        <p>You agree not to:</p>
        <List
          items={[
            "Use Syncly for anything illegal, harmful, or fraudulent.",
            "Harass, threaten, stalk, or harm another person, or use location or radar features to track someone without their knowledge or consent.",
            "Impersonate another person, or misrepresent your affiliation with any person or entity — including falsely representing a guardian relationship.",
            "Attempt to access another user's account, or to bypass or interfere with the Service's security features.",
            "Scrape, reverse-engineer, or use automated means to access the Service beyond normal use.",
            "Upload content that is unlawful, abusive, or infringes someone else's rights.",
          ]}
        />
        <p>
          We may suspend or terminate accounts that violate this section — see{" "}
          <a href="#termination" className="underline underline-offset-4 hover:text-foreground">
            Termination
          </a>
          .
        </p>
      </Section>

      <Section id="guardian-linking" title="5. Guardian / parent linking">
        <p>
          Guardian linking connects a teen's account with a parent or guardian's account so the
          guardian can see plan, ride, and location information and provide approvals. Linking only
          happens when both sides take an affirmative action (e.g. generating and accepting an
          invite code).
        </p>

        <SubSection title="What the teen consents to">
          <p>
            By accepting or creating a guardian link, the teen consents to sharing the data
            described in the Guardian-linking section of our{" "}
            <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
              Privacy Policy
            </Link>{" "}
            with the linked guardian — including live location while radar is active, plan and ride
            details, check-ins, and approval requests — for as long as the link remains active.
          </p>
        </SubSection>

        <SubSection title="What the guardian consents to">
          <p>
            By linking as a guardian, the guardian consents to receiving and reviewing this data
            responsibly, using approval and safe-zone features as intended (not as a general
            surveillance tool), and to Syncly notifying the teen when the guardian takes actions
            that affect them (such as approving or declining a plan, or setting a safe zone). The
            guardian is responsible for decisions made through their account, including plan
            approvals.
          </p>
        </SubSection>

        <SubSection title="Ending a link">
          <p>
            Either party can unlink the accounts from Settings. Unlinking stops new data from being
            shared going forward.{" "}
            <Ph>
              [Confirm and state here whether either party can unlink unilaterally, or whether
              disputes over unlinking (e.g. a teen unlinking without a guardian's knowledge) are
              handled some other way.]
            </Ph>
          </p>
        </SubSection>

        <SubSection title="Not a substitute for direct supervision">
          <p>
            Guardian linking is a communication and coordination tool. It does not replace a
            guardian's own judgment, direct communication with their teen, or other safety measures.
            See the next section for important limits on the accuracy and reliability of location
            features specifically.
          </p>
        </SubSection>
      </Section>

      <Section id="location-safety" title="6. Location accuracy & safety disclaimer">
        <p className="font-semibold text-foreground">
          Syncly's location and radar features are a convenience and coordination tool. They are not
          a guaranteed safety, monitoring, or emergency system.
        </p>
        <List
          items={[
            "Location data depends on a device's GPS, network connectivity, battery state, OS permissions, and whether the app is open or running in the background. It can be delayed, inaccurate, temporarily unavailable, or stop updating entirely without notice.",
            "A missed check-in, a safe-zone alert not firing, or a location not updating does not necessarily mean something is wrong — and the absence of an alert should never be relied upon as confirmation that someone is safe.",
            "Syncly is not a replacement for calling emergency services. In an emergency, contact local emergency services (e.g. 911 in the U.S.) directly — do not rely on Syncly to detect or respond to an emergency.",
            "Plan approvals reflect the information a guardian was shown at the time of approval; they are not a warranty that a plan is safe, that ride/transportation details will be followed as described, or that circumstances won't change after approval.",
          ]}
        />
        <p>
          By using radar, safe-zone, or check-in features, you acknowledge these limitations and
          agree that Syncly is not liable for decisions made, or harm arising from reliance on
          location data being available, timely, or accurate. See{" "}
          <a href="#liability" className="underline underline-offset-4 hover:text-foreground">
            Limitation of Liability
          </a>
          .
        </p>
      </Section>

      <Section id="content" title="7. Your content">
        <p>
          You retain ownership of the messages, plan details, photos, and other content you submit
          to Syncly ("Your Content"). You grant us a limited license to host, store, reproduce, and
          display Your Content solely to operate and improve the Service (for example, showing your
          plan to your group, or your location to your guardian). You're responsible for Your
          Content and confirm you have the rights to share it.
        </p>
      </Section>

      <Section id="third-party" title="8. Third-party services">
        <p>
          Syncly relies on third-party services to operate, including Supabase (authentication and
          data storage), Mapbox (maps), and Google/Apple (optional sign-in). Your use of those
          sign-in options is also subject to that provider's own terms. We're not responsible for
          the availability or accuracy of third-party services.
        </p>
      </Section>

      <Section id="disclaimers" title="9. Disclaimers">
        <p>
          THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND,
          WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS
          FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR THAT THE SERVICE WILL BE UNINTERRUPTED,
          SECURE, OR ERROR-FREE. WITHOUT LIMITING THE FOREGOING, WE DO NOT WARRANT THE ACCURACY,
          COMPLETENESS, OR TIMELINESS OF ANY LOCATION, RADAR, SAFE-ZONE, OR CHECK-IN DATA.
        </p>
      </Section>

      <Section id="liability" title="10. Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, SYNCLY AND ITS OPERATORS WILL NOT BE LIABLE FOR
          ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF
          DATA, SAFETY, OR PERSONAL INJURY, ARISING FROM OR RELATED TO YOUR USE OF (OR INABILITY TO
          USE) THE SERVICE — INCLUDING RELIANCE ON LOCATION, RADAR, SAFE-ZONE, CHECK-IN, OR APPROVAL
          FEATURES — EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL
          LIABILITY FOR ANY CLAIM ARISING FROM THESE TERMS OR THE SERVICE WILL NOT EXCEED{" "}
          <Ph>
            [e.g. "the amount you paid us in the 12 months before the claim" or "$100" — pick a cap
            appropriate for a free product]
          </Ph>
          .
        </p>
        <p>
          Some jurisdictions don't allow the exclusion or limitation of certain damages, so some of
          the above limitations may not apply to you.
        </p>
      </Section>

      <Section id="indemnification" title="11. Indemnification">
        <p>
          You agree to indemnify and hold Syncly harmless from any claims, damages, or expenses
          (including reasonable legal fees) arising from your use of the Service, Your Content, or
          your violation of these Terms.
        </p>
      </Section>

      <Section id="termination" title="12. Termination">
        <p>
          You may stop using Syncly and delete your account at any time — see the "Deleting your
          account &amp; data" section of our{" "}
          <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
            Privacy Policy
          </Link>
          . We may suspend or terminate your access to the Service, with or without notice, if we
          believe you've violated these Terms, created risk or legal exposure for us or other users,
          or if we discontinue the Service. Sections that by their nature should survive termination
          (including Disclaimers, Limitation of Liability, and Indemnification) will survive.
        </p>
      </Section>

      <Section id="law" title="13. Governing law & disputes">
        <p>
          These Terms are governed by the laws of{" "}
          <Ph>[state/country — e.g. "the State of Delaware, USA"]</Ph>, without regard to
          conflict-of-laws principles.{" "}
          <Ph>
            [Add your preferred dispute-resolution process here — e.g. informal resolution first,
            then binding arbitration or courts in a specific venue. This is a legal/business
            decision, not something to invent by default.]
          </Ph>
        </p>
      </Section>

      <Section id="changes" title="14. Changes to these terms">
        <p>
          We may update these Terms from time to time. If we make material changes, we'll update the
          effective date above and, where appropriate, notify you in the app or by email. Continuing
          to use the Service after changes take effect means you accept the updated Terms.
        </p>
      </Section>

      <Section id="contact" title="15. Contact us">
        <p>
          Questions about these Terms can be sent to <Ph>[legal@yourdomain.example]</Ph>.
        </p>
      </Section>
    </LegalLayout>
  );
}
