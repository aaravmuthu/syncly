import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { reverseZip, suggestPlaces } from "@/lib/quorum/location.functions";
import { inputClass } from "@/components/quorum/ui";

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
  const [text, setText] = useState(value);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locked, setLocked] = useState(false);
  const skipNextSearch = useRef(false);
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
    const q = text.trim();
    if (q.length < 3) {
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
        .catch(() => setItems([]));
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
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
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
          .catch(() => undefined)
          .finally(() => setLocating(false));
      },
      () => setLocating(false),
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
          value={text}
          placeholder={placeholder}
          onFocus={() => !locked && items.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Tab") setOpen(false);
            if (e.key === "Enter") {
              e.preventDefault();
              const first = items[0];
              if (open && first) commit(first);
              else setOpen(false);
            }
          }}
          onChange={(e) => {
            setLocked(false);
            lastLocal.current = e.target.value;
            setText(e.target.value);
            onTextChange?.(e.target.value);
          }}
        />
        {locked ? (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-success/15 px-2 py-0.5 text-caption font-medium text-success">
            ✓ Address saved
          </span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={useMyLocation}
        disabled={locating}
        className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
      >
        <span aria-hidden>📍</span>
        {locating ? "Finding you…" : "Use my current location"}
      </button>
      {open && items.length > 0 ? (
        <ul className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {items.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-secondary active:bg-secondary"
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
