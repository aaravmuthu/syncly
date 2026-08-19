import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "./Modal";
import { QrCode } from "./QrCode";
import { Button, Card } from "./ui";
import { inviteLink, shareOrCopy } from "@/lib/quorum/invite";

export function InviteCard({ code, groupName }: { code: string; groupName: string }) {
  const [qrOpen, setQrOpen] = useState(false);
  const link = inviteLink(code);

  return (
    <Card className="mb-6">
      <h2 className="font-display text-base font-semibold">Invite people</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Share the code or the link. New members answer their own private questionnaire — nobody sees
        anyone else's answers.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(code);
            toast.success("Invite code copied");
          }}
          className="flex-1 rounded-2xl bg-secondary px-4 py-3 text-center font-display text-2xl font-semibold tracking-[0.35em]"
          aria-label={`Copy invite code ${code}`}
        >
          {code}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => {
            void navigator.clipboard?.writeText(code);
            toast.success("Invite code copied");
          }}
        >
          Copy code
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            void shareOrCopy({
              title: `Join ${groupName} on Syncly`,
              text: `Join ${groupName} on Syncly with code ${code}`,
              url: link,
            }).then((r) => {
              if (r === "copied") toast.success("Invite link copied");
              if (r === "failed") toast.error("Couldn't share that link");
            })
          }
        >
          Share link
        </Button>
        <Button variant="ghost" onClick={() => setQrOpen(true)}>
          QR code
        </Button>
      </div>

      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title={`Join ${groupName}`}>
        <div className="flex flex-col items-center gap-4">
          <QrCode value={link} />
          <p className="text-center text-sm text-muted-foreground">
            Scan to join instantly, or use code{" "}
            <span className="font-semibold tracking-widest text-foreground">{code}</span>
          </p>
        </div>
      </Modal>
    </Card>
  );
}
