import type { ReactNode } from "react";
import { Drawer } from "vaul";

/**
 * iOS-style frosted slide-over used for every chat surface (DMs + squads).
 * Full-height on mobile, centred sheet on desktop.
 */
export function ChatSheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-surface border border-border bg-card/90 text-foreground shadow-2xl backdrop-blur-2xl outline-none">
          <Drawer.Title className="sr-only">Chat</Drawer.Title>
          <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-foreground/20" />
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
