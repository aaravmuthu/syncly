import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Modal } from "@/components/quorum/Modal";
import { HoldToConfirmButton } from "@/components/quorum/HoldToConfirmButton";
import { Button, Card, inputClass } from "@/components/quorum/ui";
import { deleteGroup, leaveGroup, transferGroupOwnership } from "@/lib/quorum/group.functions";

type Member = {
  profile_id: string;
  role: string;
  profiles: { display_name?: string | null } | null;
};

export function GroupSettings({
  groupId,
  groupName,
  members,
  myProfileId,
}: {
  groupId: string;
  groupName: string;
  members: Member[];
  myProfileId: string | null;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const mine = members.find((m) => m.profile_id === myProfileId);
  const isOwner = mine?.role === "owner";
  const others = members.filter((m) => m.profile_id !== myProfileId);

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [heir, setHeir] = useState<string>("");

  const afterExit = () => {
    void qc.invalidateQueries({ queryKey: ["groups"] });
    void qc.invalidateQueries({ queryKey: ["plans"] });
    void navigate({ to: "/groups" });
  };

  const leave = useMutation({
    mutationFn: useServerFn(leaveGroup),
    onSuccess: () => {
      toast.success(`You left ${groupName}`);
      afterExit();
    },
    onError: (e: unknown) =>
      toast.error("Could not leave the group", {
        description: e instanceof Error ? e.message : "Please try again.",
      }),
  });

  const remove = useMutation({
    mutationFn: useServerFn(deleteGroup),
    onSuccess: () => {
      toast.success("Group deleted", { description: "All of its plans were cancelled." });
      afterExit();
    },
    onError: (e: unknown) =>
      toast.error("Could not delete the group", {
        description: e instanceof Error ? e.message : "Please try again.",
      }),
  });

  const transfer = useMutation({
    mutationFn: useServerFn(transferGroupOwnership),
    onSuccess: () => {
      toast.success("Ownership transferred");
      setTransferOpen(false);
      void qc.invalidateQueries({ queryKey: ["group", groupId] });
    },
    onError: (e: unknown) =>
      toast.error("Could not transfer ownership", {
        description: e instanceof Error ? e.message : "Please try again.",
      }),
  });

  const memberOptions = (
    <select
      value={heir}
      onChange={(e) => setHeir(e.target.value)}
      className={inputClass}
      aria-label="New owner"
    >
      <option value="">Choose a member…</option>
      {others.map((m) => (
        <option key={m.profile_id} value={m.profile_id}>
          {m.profiles?.display_name ?? "Member"}
        </option>
      ))}
    </select>
  );

  return (
    <section className="mt-8 space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Group settings
      </h2>
      <Card className="space-y-3">
        {isOwner && others.length > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Transfer ownership</p>
              <p className="text-xs text-muted-foreground">Hand the circle to another member.</p>
            </div>
            <Button variant="outline" onClick={() => setTransferOpen(true)}>
              Transfer
            </Button>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Leave group</p>
            <p className="text-xs text-muted-foreground">
              You'll be removed from this circle and its active polls.
            </p>
          </div>
          <Button variant="outline" onClick={() => setLeaveOpen(true)}>
            Leave
          </Button>
        </div>

        {isOwner ? (
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <div>
              <p className="text-sm font-medium text-destructive">Delete group</p>
              <p className="text-xs text-muted-foreground">
                Permanently removes plans, votes and members.
              </p>
            </div>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              Delete group
            </Button>
          </div>
        ) : null}
      </Card>

      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title="Transfer ownership">
        <div className="space-y-3">
          {memberOptions}
          <Button
            className="w-full"
            loading={transfer.isPending}
            disabled={!heir}
            onClick={() => transfer.mutate({ data: { groupId, toProfileId: heir } })}
          >
            Make them owner
          </Button>
        </div>
      </Modal>

      <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title={`Leave ${groupName}?`}>
        <div className="space-y-3">
          {isOwner ? (
            others.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  You own this group. Pass ownership to someone else before you go, or delete the
                  group entirely.
                </p>
                {memberOptions}
                <Button
                  className="w-full"
                  loading={leave.isPending}
                  disabled={!heir}
                  onClick={() => leave.mutate({ data: { groupId, transferToProfileId: heir } })}
                >
                  Transfer & leave
                </Button>
                <Button
                  variant="danger"
                  className="w-full"
                  onClick={() => {
                    setLeaveOpen(false);
                    setDeleteOpen(true);
                  }}
                >
                  Delete group instead
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  You're the only member left, so leaving means deleting the group.
                </p>
                <HoldToConfirmButton
                  className="w-full"
                  loading={remove.isPending}
                  confirmedContent="Deleting…"
                  onConfirm={() => remove.mutate({ data: { groupId } })}
                >
                  Hold to delete group
                </HoldToConfirmButton>
              </>
            )
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Your votes and private constraints in this group's plans will be cleared.
              </p>
              <HoldToConfirmButton
                className="w-full"
                loading={leave.isPending}
                confirmedContent="Leaving…"
                onConfirm={() => leave.mutate({ data: { groupId } })}
              >
                Hold to leave group
              </HoldToConfirmButton>
            </>
          )}
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete group?">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Delete {groupName} and cancel all active plans? This removes every plan, vote and member
            entry. This can't be undone.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <HoldToConfirmButton
              className="flex-1"
              loading={remove.isPending}
              confirmedContent="Deleting…"
              onConfirm={() => remove.mutate({ data: { groupId } })}
            >
              Hold to delete
            </HoldToConfirmButton>
          </div>
        </div>
      </Modal>
    </section>
  );
}
