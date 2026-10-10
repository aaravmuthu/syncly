import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, Section } from "@/components/quorum/LegalLayout";
import { LEGAL } from "@/lib/legal";

export const Route = createFileRoute("/subprocessors")({
  head: () => ({ meta: [{ title: "Service providers — Syncly" }] }),
  component: ProvidersPage,
});

const PROVIDERS = [
  [
    "Supabase",
    "Authentication, database, realtime updates and uploaded files",
    "Account information and records stored in Syncly",
  ],
  [
    "Mapbox",
    "Maps, place search and geocoding",
    "Search queries, relevant addresses and coordinates; browser request details",
  ],
  ["Geoapify (when configured)", "Venue search", "Search queries and coordinates"],
  [
    "OpenStreetMap Nominatim",
    "Place and address lookups",
    "Search queries, ZIP codes and coordinates",
  ],
  ["Open-Meteo", "Weather forecasts", "Coordinates and forecast dates"],
  [
    "Google Gemini (when configured)",
    "AI planning and responses",
    "Submitted prompts, conversations and relevant planning context",
  ],
  [
    "Groq (when configured)",
    "AI planning and responses",
    "Submitted prompts, conversations and relevant planning context",
  ],
  [
    "Lovable AI gateway (fallback)",
    "AI request routing",
    "Submitted prompts, conversations and relevant planning context",
  ],
  [
    "Google",
    "Optional sign-in and font delivery",
    "Authentication information for sign-in; browser request details for fonts",
  ],
  [
    "Resend (when configured)",
    "Security verification email delivery",
    "Destination email address and verification message",
  ],
] as const;

function ProvidersPage() {
  return (
    <LegalLayout
      title="Service providers"
      effectiveDate={LEGAL.effectiveDate}
      toc={[
        { id: "register", label: "Provider register" },
        { id: "business", label: "Business requests" },
      ]}
      intro={
        <p>
          Providers used by Syncly’s implemented integrations. Optional integrations depend on
          deployment configuration. This register is not an executed data processing agreement.
        </p>
      }
    >
      <Section id="register" title="Provider register">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Service providers, purposes and data processed</caption>
            <thead>
              <tr>
                {["Provider", "Purpose", "Data processed"].map((label) => (
                  <th key={label} scope="col" className="p-3 font-semibold">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PROVIDERS.map(([name, purpose, data]) => (
                <tr key={name} className="border-t border-border">
                  <th scope="row" className="p-3 font-medium">
                    {name}
                  </th>
                  <td className="p-3">{purpose}</td>
                  <td className="p-3">{data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Hosting operators, processing locations, retention periods and contractual protections
          depend on the deployed environment. Contact us for deployment-specific details. AI
          provider data use depends on the configured provider terms and account tier.
        </p>
      </Section>
      <Section id="business" title="Business data-processing requests">
        <p>
          If you plan to use Syncly on behalf of a business and require a data processing agreement,
          contact{" "}
          <a
            href={`mailto:${LEGAL.contactEmail}?subject=Business%20data%20processing%20agreement`}
            className="underline underline-offset-4"
          >
            {LEGAL.contactEmail}
          </a>{" "}
          before submitting business personal data. Request the applicable provider contracts,
          processing locations and transfer protections. No business DPA or contractual uptime SLA
          is currently offered through the website.
        </p>
      </Section>
    </LegalLayout>
  );
}
