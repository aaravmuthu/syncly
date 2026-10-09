import { useEffect, useId, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { reverseZip, suggestPlaces } from "@/lib/quorum/location.functions";
import { inputClass } from "@/components/quorum/ui";
import { DynamicButton } from "@/components/quorum/DynamicButton";

export type PickedPlace = {
  address: string;
  zip: string | null;
  city?: string | null;
  state?: string | null;
  lat: number;
  lon: number;
};

type Suggestion = {
  id: string;
  label: string;
  zip: string | null;
  city?: string | null;
  state?: string | null;
  lat: number;
  lon: number;
};

/**
 * Mapbox-backed street address autocomplete. Emits the formatted address, city,
 * state, ZIP code and exact coordinates so the profile can store a precise home
 * location. Typed text is preserved even when no suggestion is chosen.
 */
export function AddressPicker({
  value,
  onPick,
  onTextChange,
  proximity,
  placeholder = "6390 Main St, Frisco, TX 75034",
  ariaLabel = "Home address",
}: {
  value: string;
  onPick: (place: PickedPlace) => void;
  /** Fired on every keystroke so a manually typed street line is kept. */
  onTextChange?: (text: string) => void;
  /** Bias search near these coordinates (defaults to Texas server-side). */
  proximity?: { lat: number; lon: number } | null;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const listId = useId();
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState(value);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locked, setLocked] = useState(false);
  const skipNextSearch = useRef(false);
  // A saved address arrives as the initial text; searching it would pop the
  // suggestion list open on page load over the fields below. Only look up
  // suggestions once the person has actually typed.
  const typed = useRef(false);
  const search = useServerFn(suggestPlaces);
  const toZip = useServerFn(reverseZip);
  const boxRef = useRef<HTMLDivElement>(null);

  // Only sync from the parent when it pushes a genuinely different value
  // (e.g. a loaded profile). Echoes of our own onTextChange must not reset
  // state, or the suggestion dropdown closes on every keystroke.
  const lastLocal = useRef(value);
  useEffect(() => {
    if (value === lastLocal.current) return;
    lastLocal.current = value;
    skipNextSearch.current = true;
    setText(value);
  }, [value]);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      setItems([]);
      setOpen(false);
      return;
    }
    setActiveIndex(-1);
    setOpen(false);
    setItems([]);
    const q = text.trim();
    if (!typed.current || q.length < 3) {
      setItems([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      void search({ data: { query: q, addressOnly: true, proximity: proximity ?? null } })
        .then((res) => {
          if (!cancelled) {
            setItems(res as Suggestion[]);
            setOpen(true);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setItems([]);
            setOpen(false);
            setError("Couldn't look up addresses. Try again in a moment.");
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [text, search, proximity]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const commit = (s: Suggestion) => {
    setError(null);
    setOpen(false);
    setItems([]);
    setLocked(true);
    skipNextSearch.current = true;
    lastLocal.current = s.label;
    setText(s.label);
    const base = {
      address: s.label,
      city: s.city ?? null,
      state: s.state ?? null,
      lat: s.lat,
      lon: s.lon,
    };
    if (s.zip) {
      onPick({ ...base, zip: s.zip });
      return;
    }
    void toZip({ data: { lat: s.lat, lon: s.lon } })
      .then((zip) => onPick({ ...base, zip: zip ?? null }))
      .catch(() => onPick({ ...base, zip: null }));
  };

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location is unavailable in this browser. Enter your address or ZIP code instead.");
      return;
    }
    setError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        void toZip({ data: { lat, lon } })
          .then((zip) => {
            const label = zip ? `Current location · ${zip}` : "Current location";
            skipNextSearch.current = true;
            lastLocal.current = label;
            setText(label);
            setOpen(false);
            setItems([]);
            setLocked(true);
            onPick({ address: label, zip: zip ?? null, lat, lon });
          })
          .catch(() =>
            setError("Couldn't look up your location. Enter your address or ZIP code instead."),
          )
          .finally(() => setLocating(false));
      },
      (e) => {
        setLocating(false);
        setError(
          e.code === 1
            ? "Location access is blocked. Enable it in your browser or enter your address or ZIP code."
            : "Couldn't find your location. Try again or enter your address or ZIP code.",
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
    );
  };

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <input
          className={inputClass}
          aria-label={ariaLabel}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && items.length > 0}
          aria-controls={open && items.length > 0 ? listId : undefined}
          aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          aria-describedby={error ? `${listId}-error` : undefined}
          maxLength={300}
          onBlur={() => setOpen(false)}
          value={text}
          placeholder={placeholder}
          onFocus={() => !locked && items.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if ((e.key === "ArrowDown" || e.key === "ArrowUp") && items.length) {
              e.preventDefault();
              setOpen(true);
              setActiveIndex((i) =>
                e.key === "ArrowDown" ? (i + 1) % items.length : i <= 0 ? items.length - 1 : i - 1,
              );
            } else if (e.key === "Escape" || e.key === "Tab") {
              setOpen(false);
            } else if (e.key === "Enter" && open && items.length) {
              e.preventDefault();
              commit(items[Math.max(0, activeIndex)]!);
            }
          }}
          onChange={(e) => {
            setError(null);
            setOpen(false);
            setItems([]);
            setActiveIndex(-1);
            typed.current = true;
            setLocked(false);
            lastLocal.current = e.target.value;
            setText(e.target.value);
            onTextChange?.(e.target.value);
          }}
        />
        {locked ? (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-success/15 px-2 py-0.5 text-caption font-medium text-success">
            ✓ Address selected
          </span>
        ) : null}
      </div>

      <DynamicButton
        variant="plain"
        stateKey="pin"
        icon={<span aria-hidden>📍</span>}
        type="button"
        onClick={useMyLocation}
        disabled={locating}
        className="hit-slop mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
      >
        {locating ? "Finding you…" : "Use my current location"}
      </DynamicButton>
      {error ? (
        <p id={`${listId}-error`} role="status" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {open && items.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Suggested places"
          className="absolute z-30 mt-1.5 max-h-[min(16rem,40dvh)] w-full overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover shadow-lg"
        >
          {items.map((s, i) => (
            <li key={s.id} role="presentation">
              <button
                type="button"
                id={`${listId}-${i}`}
                role="option"
                aria-selected={activeIndex === i}
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-secondary active:bg-secondary aria-selected:bg-secondary"
                onClick={() => commit(s)}
              >
                <span className="font-medium">{s.label}</span>
                {s.zip ? <span className="ml-2 text-xs text-muted-foreground">{s.zip}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
