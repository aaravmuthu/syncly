import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";
import { LEGAL } from "@/lib/legal";
import { LegalLayout, List, Section, SubSection } from "@/components/quorum/LegalLayout";

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
  { id: "billing", label: "Trials & cancellation" },
  { id: "disclaimers", label: "Disclaimers" },
  { id: "liability", label: "Limitation of liability" },
  { id: "indemnification", label: "Indemnification" },
  { id: "termination", label: "Termination" },
  { id: "changes", label: "Changes to these terms" },
  { id: "contact", label: "Contact us" },
];

function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      effectiveDate={LEGAL.effectiveDate}
      toc={TOC}
      intro={
        <p>
          These Terms of Service ("Terms") govern your access to and use of {BRAND.name}
          (the "Service"), operated by {LEGAL.operators}, individual operators. "We", "us" and "our"
          refer to these operators. By creating an account or using the Service, you agree to these
          Terms. If you don't agree, don't use the Service.
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
          (budget, schedule, rides, etc.) and comparing possible options. Scores and suggestions
          depend on the information provided and do not guarantee that an option will suit everyone.
          It also offers optional features for teens and guardians, including live location
          ("radar"), safe zones, check-ins, and plan approvals. Not every feature is available to
          every account type, and we may add, change, or remove features over time.
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
              You must be at least {LEGAL.minimumAccountAge} years old to create an account.
              Children under {LEGAL.minimumAccountAge} may not create an account, including through
              guardian linking. If you're under 18, we encourage you to use Syncly with a parent or
              legal guardian.
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
          happens after a teen shares a temporary pairing code, a guardian enters it to request
          linking, and the teen separately approves the request. Entering a code alone does not
          create a link. Syncly does not verify the guardian's identity or legal authority through
          this pairing flow.
        </p>

        <SubSection title="What the teen consents to">
          <p>
            By approving a guardian link request, the teen agrees to share the data described in the
            Guardian-linking section of our{" "}
            <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
              Privacy Policy
            </Link>{" "}
            with the linked guardian — including saved home and safety information, stored location
            updates, plan and ride details, check-ins and approval requests. Linking creates an
            ongoing guardian location share. Ghost Mode hides friend pins in Syncly's friend views;
            it does not revoke stored location-share access or pause the guardian's family view.
            Stopping new location updates does not erase previously recorded locations.
          </p>
        </SubSection>

        <SubSection title="What the guardian consents to">
          <p>
            By linking as a guardian, the guardian consents to receiving and reviewing this data
            responsibly, using approval and safe-zone features as intended (not as a general
            surveillance tool). Approval decisions generate in-app notifications, but not every
            guardian action generates a notification: creating a safe zone does not currently notify
            the teen. Browser alerts depend on permission and a running, connected app; delivery
            while the app is closed is not guaranteed. The guardian is responsible for decisions
            made through their account, including plan approvals.
          </p>
        </SubSection>

        <SubSection title="Ending a link">
          <p>
            Either linked account can request unlinking without the other person's confirmation.
            Teens have an unlink control in Settings → Account. Contact us if you cannot find or use
            an unlink control. Unlinking removes the guardian relationship and its associated
            location share. It does not erase saved records, recall copies already viewed, or revoke
            separately granted group or approval-link access.
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
            "Location data depends on device permissions, positioning, battery, connectivity and whether the app is running. Updates and browser notifications are not guaranteed when the app is closed or suspended; they can be delayed, inaccurate or unavailable.",
            "A missed check-in, a safe-zone alert not firing, or a location not updating does not necessarily mean something is wrong — and the absence of an alert should never be relied upon as confirmation that someone is safe.",
            "Syncly is not a replacement for calling emergency services. In an emergency, contact local emergency services (e.g. 911 in the U.S.) directly — do not rely on Syncly to detect or respond to an emergency.",
            "Plan approvals reflect the information a guardian was shown at the time of approval; they are not a warranty that a plan is safe, that ride/transportation details will be followed as described, or that circumstances won't change after approval.",
          ]}
        />
        <p>
          By using radar, safe-zone or check-in features, you acknowledge these limitations.
          Communicate directly with the people involved and use appropriate emergency services when
          needed. See{" "}
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
          display Your Content solely to operate the Service (for example, showing your plan to your
          group, or your location to your guardian). You're responsible for Your Content and confirm
          you have the rights to share it.
        </p>
      </Section>

      <Section id="third-party" title="8. Third-party services">
        <p>
          Syncly relies on third-party services to operate, including Supabase (authentication and
          data storage), mapping and place-search providers, Google for optional sign-in, and Google
          Gemini, Groq or the Lovable AI gateway for AI assistance. The Privacy Policy describes
          information shared with these providers. Your use of third-party services may also be
          subject to their own terms. We're not responsible for the availability or accuracy of
          third-party services.
        </p>
      </Section>

      <Section id="billing" title="Family Plus trials & cancellation">
        <p>
          The founding-family trial is free for six months, requires no payment details and ends
          automatically. It does not automatically renew or convert to a paid subscription.
          Displayed monthly and yearly prices describe planned paid options; billing is not
          currently connected. A paid purchase will require separate agreement to the price, billing
          interval and renewal terms before any charge.
        </p>
        <p>
          You can cancel online from Family hub → Family Plus. Cancellation leaves Plus features
          available until the displayed end date, after which free-plan limits apply. No support
          email or phone call is required to cancel.
        </p>
      </Section>

      <Section id="disclaimers" title="9. Disclaimers">
        <p>
          TO THE EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE IS PROVIDED "AS IS" AND "AS
          AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY,
          INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
          NON-INFRINGEMENT, OR THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
          WITHOUT LIMITING THE FOREGOING, WE DO NOT WARRANT THE ACCURACY, COMPLETENESS, OR
          TIMELINESS OF ANY LOCATION, RADAR, SAFE-ZONE, OR CHECK-IN DATA.
        </p>
      </Section>

      <Section id="liability" title="10. Limitation of liability">
        <p>
          To the extent permitted by applicable law, our total liability arising from the Service is
          limited to the greater of US $100 or the amount you paid us for the Service in the twelve
          months before the event giving rise to the claim. To the extent permitted by law, we are
          not liable for indirect, incidental, special or consequential damages, including lost
          profits or loss of data. These limits do not apply to fraud, willful misconduct or
          liability that cannot lawfully be limited.
        </p>
        <p>
          The disclaimers and limitations in these Terms apply only to the extent permitted by
          applicable law. Nothing in these Terms excludes liability or limits rights that cannot
          legally be excluded or limited. Some jurisdictions do not permit certain warranty
          exclusions or liability limitations, so those exclusions or limitations may not apply to
          you.
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
          You may stop using Syncly and request account or data deletion — see the "Deleting your
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

      <Section id="changes" title="13. Changes to these terms">
        <p>
          We may update these Terms from time to time. If we make material changes, we'll update the
          effective date above and post the revised Terms on this page. Continuing to use the
          Service after changes take effect means you accept the updated Terms.
        </p>
      </Section>

      <Section id="contact" title="14. Contact us">
        <p>
          Contact {LEGAL.operators} for legal questions, privacy requests or support at{" "}
          <a
            href={`mailto:${LEGAL.contactEmail}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {LEGAL.contactEmail}
          </a>
          .
        </p>
      </Section>
    </LegalLayout>
  );
}
