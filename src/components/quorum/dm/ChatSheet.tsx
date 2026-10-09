import type { ReactNode } from "react";
import { X } from "lucide-react";
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
        <Drawer.Content className="mobile-sheet fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-surface border border-border bg-card/90 text-foreground shadow-2xl backdrop-blur-2xl outline-none !px-0">
          <Drawer.Title className="sr-only">Chat</Drawer.Title>
          <Drawer.Description className="sr-only">
            Conversation messages and composer.
          </Drawer.Description>
          <div className="relative flex h-12 shrink-0 items-center justify-center">
            <div aria-hidden className="h-1.5 w-10 rounded-full bg-foreground/20" />
            <Drawer.Close
              aria-label="Close chat"
              className="tap-target absolute right-2 top-1 grid place-items-center rounded-full text-muted-foreground hover:bg-secondary"
            >
              <X className="size-5" aria-hidden />
            </Drawer.Close>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
