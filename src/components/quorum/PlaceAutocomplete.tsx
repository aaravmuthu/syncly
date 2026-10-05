import { useEffect, useId, useRef, useState } from "react";
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
  showLocate = true,
}: {
  value: string;
  onChange: (zip: string, place?: Suggestion) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** Hide the "Use my current location" link when a sibling field (e.g. an
   *  address picker) already offers it and fills this field as a side effect. */
  showLocate?: boolean;
}) {
  const listId = useId();
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState(value);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const skipNextSearch = useRef(false);
  const search = useServerFn(suggestPlaces);
  const toZip = useServerFn(reverseZip);
  const [locating, setLocating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

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
        .catch(() => {
          if (!cancelled) {
            setItems([]);
            setOpen(false);
            setError("Couldn't look up places. Try again or enter your ZIP code.");
          }
        });
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
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location is unavailable in this browser. Enter your address or ZIP code instead.");
      return;
    }
    setError(null);
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
              lastLocal.current = zip;
              onChange(zip, {
                id: "current",
                label: "Current location",
                zip,
                lat: pos.coords.latitude,
                lon: pos.coords.longitude,
              });
            } else {
              setError("Couldn't find a ZIP code here. Enter a 5-digit ZIP code.");
            }
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
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  };

  const commit = (s: Suggestion) => {
    setError(null);
    setOpen(false);
    setItems([]);
    setLocked(true);
    skipNextSearch.current = true;
    setText(s.zip ?? s.label);
    if (s.zip) {
      lastLocal.current = s.zip;
      onChange(s.zip, s);
      return;
    }
    setLocked(false);
    void toZip({ data: { lat: s.lat, lon: s.lon } })
      .then((zip) => {
        if (zip) {
          skipNextSearch.current = true;
          setLocked(true);
          setText(zip);
          lastLocal.current = zip;
          onChange(zip, s);
        } else {
          setError("Couldn't find a ZIP code for this place. Enter a 5-digit ZIP code.");
        }
      })
      .catch(() => setError("Couldn't find a ZIP code for this place. Enter a 5-digit ZIP code."));
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
            const v = e.target.value;
            setLocked(false);
            setText(v);
            lastLocal.current = /^\d{0,5}$/.test(v.trim()) ? v.trim() : "";
            onChange(/^\d{0,5}$/.test(v.trim()) ? v.trim() : "");
          }}
        />
        {locked ? (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-success/15 px-2 py-0.5 text-caption font-medium text-success">
            ✓ Selected
          </span>
        ) : null}
      </div>
      {showLocate ? (
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="hit-slop mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
        >
          <span aria-hidden>📍</span>
          {locating ? "Finding you…" : "Use my current location"}
        </button>
      ) : null}
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
          className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
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
