import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "./Modal";
import { Button, inputClass } from "./ui";
import { isValidCode, normalizeCode } from "@/lib/quorum/invite";
import { joinGroup } from "@/lib/quorum/plan.functions";
import { haptic } from "@/lib/quorum/haptics";

export function JoinGroupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [code, setCode] = useState("");
  const qc = useQueryClient();
  const navigate = useNavigate();

  const join = useMutation({
    mutationFn: useServerFn(joinGroup),
    onSuccess: (group) => {
      const g = group as { id: string; name: string };
      haptic("success");
      toast.success(`Joined ${g.name}`);
      setCode("");
      onClose();
      void qc.invalidateQueries({ queryKey: ["groups"] });
      void navigate({ to: "/groups/$groupId", params: { groupId: g.id } });
    },
    onError: (e: Error) => {
      haptic("warn");
      toast.error("Couldn't join that group", { description: e.message });
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Join a group">
      <p className="text-sm text-muted-foreground">
        Enter the six-character code from whoever made the group.
      </p>
      <input
        className={`${inputClass} mt-4 text-center text-lg font-semibold uppercase tracking-[0.35em]`}
        value={code}
        maxLength={8}
        autoFocus
        inputMode="text"
        placeholder="SQUAD9"
        onChange={(e) => {
          const next = normalizeCode(e.target.value);
          setCode(next);
          // Auto-submit as soon as a full six-character code lands.
          if (next.length === 6 && !join.isPending) join.mutate({ data: { code: next } });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && isValidCode(code)) join.mutate({ data: { code } });
        }}
      />

      <Button
        className="mt-4 w-full"
        loading={join.isPending}
        disabled={!isValidCode(code)}
        onClick={() => join.mutate({ data: { code } })}
      >
        {join.isPending ? "Joining…" : "Join group"}
      </Button>
    </Modal>
  );
}
