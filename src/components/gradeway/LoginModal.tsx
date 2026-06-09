import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LockKeyhole, Sparkles } from "lucide-react";
import { useGradeway } from "@/lib/gradeway/store";

export function LoginModal() {
  const { connected, connect } = useGradeway();
  const [loading, setLoading] = useState(false);
  const handleConnect = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1400));
    connect();
    setLoading(false);
  };
  return (
    <Dialog open={!connected}>
      <DialogContent className="glass-strong sm:max-w-md border-0 p-0 overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(circle at 30% 0%, oklch(0.70 0.22 305 / 0.25), transparent 60%)" }} />
        <div className="p-7">
          <DialogHeader>
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 glow-primary">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-2xl">Connect HAC Account</DialogTitle>
            <DialogDescription>
              Sync your Home Access Center to unlock real-time grades, GPA simulations, and the interactive transcript.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user">District ID</Label>
              <Input id="user" defaultValue="amorgan2026" className="bg-white/5 border-white/10" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw">Password</Label>
              <Input id="pw" type="password" defaultValue="••••••••••" className="bg-white/5 border-white/10" />
            </div>
            <Button onClick={handleConnect} disabled={loading} className="w-full h-11 bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold glow-primary hover:opacity-95">
              {loading ? (
                <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Syncing your data…</span>
              ) : (
                <span className="inline-flex items-center gap-2"><LockKeyhole className="h-4 w-4" /> Connect securely</span>
              )}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">Demo mode · no credentials are transmitted</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}