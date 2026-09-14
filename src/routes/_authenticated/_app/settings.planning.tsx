import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { MapPinned } from "lucide-react";
import { SubpageHeader } from "@/components/quorum/AppShell";
import { PushEnter } from "@/components/quorum/interactions";
import { Button, Card, Field, Skeleton, inputClass } from "@/components/quorum/ui";
import { SectionHeader } from "@/components/quorum/settings/shared";
import { getMe, saveProfile } from "@/lib/quorum/plan.functions";
import { toast } from "sonner";
import { isValidZip } from "@/lib/quorum/location";
import { PlaceAutocomplete } from "@/components/quorum/PlaceAutocomplete";
import { TimePicker } from "@/components/quorum/TimePicker";
import { AddressPicker } from "@/components/quorum/AddressPicker";

export const Route = createFileRoute("/_authenticated/_app/settings/planning")({
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData({ queryKey: ["me"], queryFn: () => getMe() });
  },
  head: () => ({
    meta: [{ title: "Planning defaults — Syncly" }],
  }),
  component: PlanningPage,
});

const GRAD_YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i - 1);

function PlanningPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: useServerFn(getMe) });
  const [form, setForm] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (me.data) setForm(me.data as unknown as Record<string, unknown>);
  }, [me.data]);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: useServerFn(saveProfile),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Saved");
    },
    onError: (e: unknown) =>
      toast.error("Couldn't save", {
        description: e instanceof Error ? e.message : "Please try again.",
      }),
  });

  if (me.isLoading) {
    return (
      <PushEnter>
        <SubpageHeader title="Planning defaults" backTo="/settings" />
        <Skeleton className="h-40 rounded-3xl" />
      </PushEnter>
    );
  }

  return (
    <PushEnter>
      <SubpageHeader title="Planning defaults" backTo="/settings" />

      <Card className="space-y-4">
        <SectionHeader
          icon={MapPinned}
          title="School & location"
          subtitle="Pre-fills your answers in every plan questionnaire — never shared with your group."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="School" hint="Optional">
            <input
              className={inputClass}
              value={String(form["school"] ?? "")}
              onChange={(e) => set("school", e.target.value)}
              placeholder="Frisco High"
            />
          </Field>
          <Field label="Graduation year" hint="Optional">
            <select
              className={inputClass}
              value={String(form["grad_year"] ?? "")}
              onChange={(e) =>
                set("grad_year", e.target.value === "" ? null : Number(e.target.value))
              }
            >
              <option value="">Not set</option>
              {GRAD_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="Home address"
          hint="Required for exact mile distances. Private — never shared with your group."
        >
          <AddressPicker
            value={String(form["home_address"] ?? "")}
            onTextChange={(t) => set("home_address", t)}
            proximity={
              form["home_lat"] != null && form["home_lon"] != null
                ? { lat: Number(form["home_lat"]), lon: Number(form["home_lon"]) }
                : null
            }
            onPick={(p) => {
              set("home_address", p.address);
              set("home_lat", p.lat);
              set("home_lon", p.lon);
              if (p.zip) set("zip_code", p.zip);
            }}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ZIP code" hint="Finds real venues nearby — never shared with your group">
            <PlaceAutocomplete
              value={String(form["zip_code"] ?? "")}
              onChange={(zip) => set("zip_code", zip)}
            />
          </Field>
          <Field label="Home area" hint="Used only to estimate travel time">
            <input
              className={inputClass}
              value={String(form["home_area"] ?? "")}
              onChange={(e) => set("home_area", e.target.value)}
            />
          </Field>
          <Field label="Usual curfew" hint="Pre-fills your hard return time">
            <TimePicker
              allowNone
              value={(form["curfew_time"] as string | null) ?? null}
              onChange={(v) => set("curfew_time", v)}
            />
          </Field>
        </div>
      </Card>

      <div className="mt-5">
        <Button
          loading={save.isPending}
          onClick={() => {
            const zip = String(form["zip_code"] ?? "").trim();
            if (zip && !isValidZip(zip)) return toast.error("Enter a valid 5-digit ZIP code");
            save.mutate({
              data: {
                school: form["school"],
                grad_year: form["grad_year"],
                home_address: form["home_address"],
                home_lat: form["home_lat"],
                home_lon: form["home_lon"],
                zip_code: form["zip_code"],
                home_area: form["home_area"],
                curfew_time: form["curfew_time"],
              },
            });
          }}
        >
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </PushEnter>
  );
}
