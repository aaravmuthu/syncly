import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { reverseZip, suggestPlaces } from "@/lib/quorum/location.functions";
import { inputClass } from "@/components/quorum/ui";

type Suggestion = { id: string; label: string; zip: string | null; lat: number; lon: number };

/**
 * ZIP / address autocomplete. Typing a ZIP works exactly like the old plain
 * input; typing a place name resolves to a ZIP via the server geocoder.
 * If the lookup fails the field still behaves as a normal text input.
 */
export function PlaceAutocomplete({
  value,
  onChange,
  placeholder = "75034 or Frisco, TX",
  ariaLabel = "ZIP code or place",
}: {
  value: string;
  onChange: (zip: string, place?: Suggestion) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(value);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const skipNextSearch = useRef(false);
  const search = useServerFn(suggestPlaces);
  const toZip = useServerFn(reverseZip);
  const [locating, setLocating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
    if (q.length < 3 || /^\d{5}$/.test(q)) {
      setItems([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      void search({ data: { query: q } })
        .then((res) => {
          if (!cancelled) {
            setItems(res as Suggestion[]);
            setOpen(true);
          }
        })
        .catch(() => setItems([]));
    }, 260);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [text, search]);


  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void toZip({ data: { lat: pos.coords.latitude, lon: pos.coords.longitude } })
          .then((zip) => {
            if (zip) {
              skipNextSearch.current = true;
              setLocked(true);
              setOpen(false);
              setText(zip);
              onChange(zip, {
                id: "current",
                label: "Current location",
                zip,
                lat: pos.coords.latitude,
                lon: pos.coords.longitude,
              });
            }
          })
          .catch(() => undefined)
          .finally(() => setLocating(false));
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  };

  const commit = (s: Suggestion) => {
    setOpen(false);
    setItems([]);
    setLocked(true);
    skipNextSearch.current = true;
    setText(s.zip ?? s.label);
    if (s.zip) {
      onChange(s.zip, s);
      return;
    }
    void toZip({ data: { lat: s.lat, lon: s.lon } })
      .then((zip) => {
        if (zip) {
          skipNextSearch.current = true;
          setText(zip);
          onChange(zip, s);
        }
      })
      .catch(() => undefined);
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
            const v = e.target.value;
            setLocked(false);
            setText(v);
            if (/^\d{0,5}$/.test(v.trim())) onChange(v.trim());
          }}
        />
        {locked ? (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
            ✓ Saved
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
                className="w-full px-3 py-2 text-left text-sm hover:bg-secondary"
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
