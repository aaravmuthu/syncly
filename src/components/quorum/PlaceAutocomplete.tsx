import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { suggestPlaces } from "@/lib/quorum/location.functions";
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
  const search = useServerFn(suggestPlaces);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setText(value), [value]);

  useEffect(() => {
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

  return (
    <div className="relative" ref={boxRef}>
      <input
        className={inputClass}
        aria-label={ariaLabel}
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        onFocus={() => items.length && setOpen(true)}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          if (/^\d{0,5}$/.test(v.trim())) onChange(v.trim());
        }}
      />
      {open && items.length > 0 ? (
        <ul className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {items.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-secondary"
                onClick={() => {
                  setOpen(false);
                  setText(s.zip ?? s.label);
                  onChange(s.zip ?? "", s);
                }}
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
