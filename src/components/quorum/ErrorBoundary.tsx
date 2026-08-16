import * as React from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

type Props = { children: React.ReactNode; fallback?: React.ReactNode; label?: string };
type State = { failed: boolean };

/**
 * Keeps one broken widget (a map, a third-party embed) from blanking the page.
 * Renders `fallback` instead of the crashing subtree.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    reportLovableError(error, { boundary: this.props.label ?? "widget" });
  }

  override render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
