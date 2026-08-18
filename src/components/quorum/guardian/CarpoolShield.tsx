import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, Field, Pill, inputClass } from "@/components/quorum/ui";
import { markRideLeaving, saveVehicleDetails } from "@/lib/quorum/guardian.functions";

export type ShieldRide = {
  id: string;
  car_label: string;
  leg: string;
  driver_label: string | null;
  driver_profile_id: string | null;
  passenger_profile_ids: string[] | null;
  vehicle_desc?: string | null;
  vehicle_color?: string | null;
  vehicle_plate?: string | null;
  departed_at?: string | null;
  eta_minutes?: number | null;
};

/**
 * Driver verification shield. Drivers add the car details once; a single tap
 * on "We're leaving" tells every rider's parents who is driving and in what.
 */
export function CarpoolShield({
  planId,
  rides,
  meProfileId,
}: {
  planId: string;
  rides: ShieldRide[];
  meProfileId: string | null;
}) {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: ["plan", planId] });
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const saveDetails = useMutation({
    mutationFn: useServerFn(saveVehicleDetails),
    onSuccess: () => {
      setOpenId(null);
      refresh();
      toast.success("Car details saved");
    },
  });
  const leaving = useMutation({
    mutationFn: useServerFn(markRideLeaving),
    onSuccess: () => {
      refresh();
      toast.success("Parents notified you're on the way");
    },
  });

  if (rides.length === 0) return null;

  return (
    <Card className="mb-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold">Carpool shield</h3>
        <Pill tone="neutral">{rides.length} car{rides.length === 1 ? "" : "s"}</Pill>
      </div>

      {rides.map((r) => {
        const iAmDriver = Boolean(meProfileId && r.driver_profile_id === meProfileId);
        const vehicle = [r.vehicle_color, r.vehicle_desc].filter(Boolean).join(" ");
        return (
          <div key={r.id} className="rounded-2xl border border-border px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">
                🚗 {r.car_label} · {r.driver_label ?? "Driver TBD"}
                <span className="text-xs font-normal text-muted-foreground"> · {r.leg}</span>
              </div>
              {r.departed_at ? (
                <Pill tone="good">On the way</Pill>
              ) : iAmDriver ? (
                <Button
                  loading={leaving.isPending}
                  onClick={() => leaving.mutate({ data: { assignmentId: r.id } })}
                >
                  We&apos;re leaving
                </Button>
              ) : null}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {vehicle || "No car description yet"}
              {r.vehicle_plate ? ` · plate ${r.vehicle_plate}` : ""}
              {r.eta_minutes ? ` · ~${r.eta_minutes} min` : ""}
            </div>

            {iAmDriver ? (
              <>
                <button
                  type="button"
                  className="mt-1 text-xs font-medium text-primary"
                  onClick={() => setOpenId(openId === r.id ? null : r.id)}
                >
                  {openId === r.id ? "Close" : "Edit car details"}
                </button>
                {openId === r.id ? (
                  <div className="mt-2 space-y-2">
                    <Field label="Car">
                      <input
                        className={inputClass}
                        placeholder="Honda Civic"
                        defaultValue={r.vehicle_desc ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className={inputClass}
                        placeholder="Color"
                        defaultValue={r.vehicle_color ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                      />
                      <input
                        className={inputClass}
                        placeholder="Plate"
                        defaultValue={r.vehicle_plate ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value }))}
                      />
                    </div>
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      placeholder="ETA in minutes"
                      defaultValue={r.eta_minutes ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, eta: e.target.value }))}
                    />
                    <Button
                      className="w-full"
                      loading={saveDetails.isPending}
                      onClick={() =>
                        saveDetails.mutate({
                          data: {
                            assignmentId: r.id,
                            vehicleDesc: form["desc"] ?? r.vehicle_desc ?? null,
                            vehicleColor: form["color"] ?? r.vehicle_color ?? null,
                            vehiclePlate: form["plate"] ?? r.vehicle_plate ?? null,
                            etaMinutes: form["eta"]
                              ? Number(form["eta"])
                              : (r.eta_minutes ?? null),
                          },
                        })
                      }
                    >
                      Save car details
                    </Button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        );
      })}
    </Card>
  );
}
