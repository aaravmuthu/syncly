import { useRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/quorum/haptics";

/** Search stays focused when cleared, including on mobile keyboards. */
export function ListSearch({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="mb-3 flex items-center gap-2 rounded-2xl border border-border bg-card px-3 focus-within:border-primary/60">
      <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <input
        ref={input}
        type="search"
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent py-3 outline-none [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          className="tap-target -mr-2 grid place-items-center rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** Native pressed buttons: Tab, Enter and Space work without custom tab semantics. */
export function ListFilters<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="scrollbar-none -mx-1 mb-5 flex gap-2 overflow-x-auto px-1 py-1"
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => {
            haptic("select");
            onChange(option.id);
          }}
          className={cn(
            "tap-target shrink-0 rounded-full px-4 text-sm font-semibold transition-colors",
            value === option.id
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
