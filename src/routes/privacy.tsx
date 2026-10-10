import { CookieSettingsButton } from "@/components/quorum/CookieConsent";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";
import { LEGAL } from "@/lib/legal";
import { LegalLayout, List, Section, SubSection } from "@/components/quorum/LegalLayout";

const TITLE = `Privacy Policy — ${BRAND.name}`;
const DESCRIPTION =
  "How Syncly collects, uses, shares and retains information, and handles account and data-deletion requests, including location and guardian-linking data.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: "https://syncly.website/privacy" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: "https://syncly.website/privacy" }],
  }),
  component: PrivacyPage,
});

const TOC = [
  { id: "who-we-are", label: "Who we are" },
  { id: "info-we-collect", label: "Information we collect" },
  { id: "how-we-use", label: "How we use information" },
  { id: "how-we-share", label: "How we share information" },
  { id: "providers", label: "Service providers" },
  { id: "cookies", label: "Cookies & browser storage" },
  { id: "minors", label: "Minors, teens & guardians" },
  { id: "retention", label: "Data retention" },
  { id: "your-choices", label: "Your choices & rights" },
  { id: "delete", label: "Deleting your account" },
  { id: "security", label: "Security" },
  { id: "transfers", label: "International users" },
  { id: "changes", label: "Changes to this policy" },
  { id: "contact", label: "Contact us" },
];

function ContactEmail() {
  return (
    <a
      href={`mailto:${LEGAL.contactEmail}`}
      className="underline underline-offset-4 hover:text-foreground"
    >
      {LEGAL.contactEmail}
    </a>
  );
}

function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      effectiveDate={LEGAL.effectiveDate}
      toc={TOC}
      intro={
        <p>
          {BRAND.name} helps groups plan hangouts, coordinate rides, and share information with
          friends and linked guardians. This policy explains how information is collected, used,
          shared and retained when you use the Syncly website and related features (the "Service").
        </p>
      }
    >
      <Section id="who-we-are" title="1. Who we are">
        <p>
          Syncly is operated by {LEGAL.operators}, individual operators. In this policy, "we", "us"
          and "our" refer to these operators. For privacy, support or legal questions, contact{" "}
          <ContactEmail />.
        </p>
      </Section>

      <Section id="info-we-collect" title="2. Information we collect">
        <SubSection title="Account and profile information">
          <List
            items={[
              "Your email address and authentication information, including a password handled by Supabase or a Google sign-in identifier.",
              "Profile details you provide, such as your name, avatar, age, school, graduation year, phone number, home address or ZIP code, saved home coordinates, curfew and preferences.",
              "Groups, plans, participation, votes, ride arrangements and approval activity.",
            ]}
          />
        </SubSection>
        <SubSection title="Location information">
          <p>
            When device location permission and Syncly location sharing are enabled, the app can
            send location updates while it is running. Updates may include latitude, longitude,
            accuracy, timestamp, battery level, a status label and a plan reference. We also store
            locations you enter or select, such as a home address, saved place or safe zone. Using
            the device-location button for an address search sends coordinates for that lookup.
          </p>
          <p>
            Location updates are not guaranteed to continue when the app is closed or suspended.
            Turning off location sharing stops automatic updates through that sharing feature; it
            does not erase stored locations or prevent an already authorized viewer from seeing a
            previously recorded location. Explicit actions, such as answering a check-in or sharing
            an arrival, may still send the location you include in that action.
          </p>
        </SubSection>
        <SubSection title="Invites and guardian links">
          <p>
            We store group invite codes, guardian pairing codes, pairing attempts, pending link
            requests and accepted guardian relationships. We also store contact information you
            choose to include in your profile or an approval request. Sharing a link through your
            device's messaging or share tools does not give Syncly access to your entire address
            book.
          </p>
        </SubSection>
        <SubSection title="Messages, answers and uploaded content">
          <p>
            We store direct and group messages, private planning answers such as spending and
            scheduling constraints, plan notes, approval conditions, check-in responses and content
            you upload, such as an avatar. AI features also process the prompts and conversation
            content you choose to submit.
          </p>
        </SubSection>
        <SubSection title="Service and notification records">
          <p>
            We store in-app notifications, read status, safety alerts and service activity records.
            Our authentication, hosting and other service providers may process technical
            information such as IP addresses, browser details and request logs when you use the
            Service. Optional browser notifications use your browser's permission setting; the
            current app does not register a remote push subscription or store push-delivery tokens.
          </p>
        </SubSection>
      </Section>

      <Section id="how-we-use" title="3. How we use information">
        <List
          items={[
            "Authenticate accounts and maintain profiles, groups and messages.",
            "Compare private planning answers, score options, coordinate rides and provide AI planning assistance.",
            "Display locations to authorized viewers and support guardian links, safe zones, check-ins and plan approvals.",
            "Create in-app notifications for plan and family activity; display optional browser alerts when supported and permitted.",
            "Troubleshoot the Service, enforce usage limits and protect against abuse.",
          ]}
        />
        <p>
          The current app does not include advertising integrations or a feature that sells personal
          information. Location information is used for planning, mapping and sharing features, not
          advertising.
        </p>
      </Section>

      <Section id="how-we-share" title="4. How we share information">
        <SubSection title="With groups and location viewers">
          <p>
            Group members can see shared profile information, messages, plan details, participation,
            votes, ride arrangements, scores and compatibility explanations. Individual private
            planning answers are used by the scoring service rather than returned as a list of
            members' answers to the group.
          </p>
          <p>
            Friend location access depends on an active location share, not simply on joining a
            group or plan. An authorized location viewer can access stored location updates; sharing
            is not limited to updates recorded after the share began. Friend maps generally show the
            latest available stored location. Saved home coordinates can also be used for planning
            and distance calculations.
          </p>
        </SubSection>
        <SubSection title="With guardians and approval-link recipients">
          <p>
            An accepted guardian link gives the linked guardian access to the information described
            in Section 5. Someone with a valid approval link can view the plan information included
            in that approval page and submit a decision. Only send approval links to intended
            recipients.
          </p>
        </SubSection>
        <SubSection title="With service providers">
          <List
            items={[
              "Supabase handles authentication, database records, realtime updates and uploaded files.",
              "Mapbox handles maps, place searches and geocoding; queries and relevant coordinates or addresses may be sent to it.",
              "Geoapify provides venue search when configured. OpenStreetMap's Nominatim service is used for some place, ZIP-code and reverse-geocoding lookups.",
              "Open-Meteo receives coordinates and date information for weather forecasts.",
              "Google Gemini, Groq, or the Lovable AI gateway when used as a fallback, processes AI prompts and relevant planning context. Structured scoring explanations use aggregate facts, but prompts, conversations and plan notes can contain personal information you enter. Do not include information you do not want processed by an AI provider.",
              "Google processes authentication information if you choose Google sign-in. Google Fonts receives browser requests to deliver the fonts used on the website.",
              "Resend delivers email verification codes when configured and receives the destination email address and the verification message.",
              "Hosting and infrastructure providers process the requests needed to operate the Service.",
            ]}
          />
        </SubSection>
        <p>
          See the{" "}
          <Link to="/subprocessors" className="underline underline-offset-4">
            service provider register
          </Link>{" "}
          for processing purposes and business data-processing inquiries.
        </p>
        <SubSection title="Legal requests">
          <p>
            We may disclose information when required by applicable law or valid legal process, or
            when necessary to investigate misuse or protect users' safety and rights.
          </p>
        </SubSection>
      </Section>

      <Section id="minors" title="5. Minors, teens & guardians">
        <SubSection title="Minimum account age">
          <p>
            You must be at least {LEGAL.minimumAccountAge} years old to create an account. Children
            under {LEGAL.minimumAccountAge} may not create an account, including through guardian
            linking. If you are under 18, we encourage you to use Syncly with a parent or legal
            guardian. If you believe an account belongs to someone under {LEGAL.minimumAccountAge},
            contact <ContactEmail />.
          </p>
        </SubSection>
        <SubSection title="How linking works">
          <p>
            A teen reveals a temporary pairing code and shares it with a guardian. Entering the code
            creates a pending request; the teen must separately approve that request before the
            guardian link is created. The pairing flow connects accounts; it does not verify a
            person's identity or legal authority as a guardian.
          </p>
        </SubSection>
        <SubSection title="What a linked guardian can access">
          <List
            items={[
              "The teen's profile and safety information, including saved home details, curfew, safe zones and stored location updates. The family hub generally displays the most recent location, but guardian access to stored updates is not limited to that single update.",
              "Plans the teen participates in, including group logistics, destination, costs, participants, ride details and approval requests or conditions.",
              "Check-in requests and responses, arrival and delay updates, SOS records and generated safety alerts.",
            ]}
          />
          <p>
            Linking also creates an ongoing location share with the guardian. Ghost Mode hides
            friend pins in Syncly's friend views; it does not revoke stored location-share access or
            pause the linked guardian's family view. Disabling new location updates does not remove
            the guardian's access to previously stored updates. A guardian link alone does not grant
            access to private direct messages or other members' raw private planning answers.
          </p>
        </SubSection>
        <SubSection title="Ending a link">
          <p>
            Either linked account can request unlinking without the other person's confirmation.
            Teens have an unlink control in Settings → Account; contact <ContactEmail /> if you
            cannot find or use an unlink control. The unlink action removes the guardian
            relationship and its associated location share. It does not erase stored plans,
            locations, alerts or check-ins, recall copies already viewed, or remove access granted
            separately through group membership or an approval link.
          </p>
        </SubSection>
      </Section>

      <Section id="retention" title="6. Data retention">
        <List
          items={[
            "Account, profile, message, plan, guardian and notification records are stored to support the Service. These records do not currently have a general automatic expiry period.",
            "Location updates are stored as history. They are not automatically deleted after a plan ends or after a fixed number of hours or days. Stopping sharing, using Ghost Mode or unlinking does not delete that history.",
            "Pairing codes and link requests expire for use, and time-limited location shares expire for access. Expiry of access is separate from deletion of historical records.",
            "Account deletion is described below. Backups and provider logs require separate consideration and are not covered by a verified all-data deletion deadline.",
          ]}
        />
      </Section>

      <Section id="your-choices" title="7. Your choices & rights">
        <List
          items={[
            "Review and update profile information in Settings.",
            "Control device-location permission through your browser or device and new location sharing through Syncly's settings. Manage individual friend shares or hide friend pins in Syncly's friend views with Ghost Mode. To revoke a person's location-share access, stop sharing with them.",
            "Control optional browser notifications through your browser or device settings. In-app notification records may still be created without that permission. Browser alerts require the app to remain running and connected; they are not guaranteed when it is closed.",
            "Decline a pending guardian link or unlink an accepted relationship as described above.",
          ]}
        />
        <p>
          Download your profile, private planning answers, authored messages and owned records in
          Settings → Account → Download my data. The export excludes uploaded file contents,
          provider logs, backups and other people’s private records. Contact us for additional
          access requests.
        </p>
        <p>
          To request access, correction, deletion or other data assistance, contact <ContactEmail />
          . We may need information to verify that a request concerns your account. Depending on
          applicable law, you may have additional privacy rights.
        </p>
      </Section>

      <Section id="delete" title="8. Deleting your account & data">
        <p>
          Settings → Account includes a Delete my account control. It removes your authentication
          account and profile, with linked personal database records removed through database
          deletion rules. Shared groups and plans transfer to another member, or are removed when no
          members remain. Shared messages can remain with their author cleared. If deletion fails,
          contact <ContactEmail /> from your account’s email address.
        </p>
        <p>
          Account removal also removes your uploaded avatars, chat images and voice notes from
          Syncly’s upload storage. Personal location history and linked personal records are removed
          with a deleted profile. Shared text messages and plans may remain for other members. We do
          not promise that all associated data is deleted or de-identified within a specific period.
          Copies retained by other users or service providers may also remain. Contact us for a
          data-deletion request or questions about what remains.
        </p>
      </Section>

      <Section id="cookies" title="Cookies & browser storage">
        <p>
          Essential browser storage keeps you signed in and remembers your theme and cookie choices.
          Optional analytics and marketing storage is off by default. Syncly currently has no
          optional analytics or advertising cookies. Consent choices are saved in this browser for
          six months; you can update them below.
        </p>
        <CookieSettingsButton />
      </Section>

      <Section id="providers" title="AI processing & service providers">
        <p>
          Syncly uses AI providers to generate responses to requests, rather than running a
          model-training pipeline on user content. AI requests are disabled by default until the
          operator confirms that every configured provider and fallback has appropriate
          data-processing terms excluding training on submitted user content. Provider use and
          retention of submitted data depend on the provider, account tier and configured terms. We
          do not promise that every provider excludes training without verified contractual
          settings. Avoid entering sensitive information in AI prompts.
        </p>
        <p>
          Our{" "}
          <Link to="/subprocessors" className="underline underline-offset-4">
            service provider register
          </Link>{" "}
          describes these integrations.
        </p>
      </Section>

      <Section id="security" title="9. Security">
        <p>
          We use Supabase authentication and access controls to restrict access to account data. No
          storage or transmission method is completely secure, and we cannot guarantee absolute
          security. Keep passwords and private invite or approval links secure.
        </p>
      </Section>

      <Section id="transfers" title="10. International users">
        <p>
          Our providers may process information in countries other than your own. Processing
          locations and provider retention practices depend on the services and deployment used.
          Contact <ContactEmail /> with questions about international processing.
        </p>
      </Section>

      <Section id="changes" title="11. Changes to this policy">
        <p>
          We may update this policy as the Service or its information practices change. Updates will
          be posted on this page with a revised effective date. Review this page for the current
          policy.
        </p>
      </Section>

      <Section id="contact" title="12. Contact us">
        <p>
          Contact {LEGAL.operators} at <ContactEmail /> for privacy requests, account assistance,
          support or legal questions.
        </p>
        <p>
          See also our{" "}
          <Link to="/terms" className="underline underline-offset-4 hover:text-foreground">
            Terms of Service
          </Link>
          .
        </p>
      </Section>
    </LegalLayout>
  );
}
