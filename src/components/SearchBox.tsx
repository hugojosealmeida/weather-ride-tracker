import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin, Search, X } from "lucide-react";
import type { Place } from "../types";
import { searchPlaces } from "../lib/geocode";

interface SearchBoxProps {
  onPick: (place: Place) => void;
}

export function SearchBox({ onPick }: SearchBoxProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setResults([]);
      setStatus("idle");
      setError("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setStatus("loading");
      searchPlaces(trimmed, controller.signal)
        .then((places) => {
          if (controller.signal.aborted) return;
          setResults(places);
          setStatus("ready");
          setActive(places.length > 0 ? 0 : -1);
          setOpen(true);
        })
        .catch((cause: Error) => {
          if (controller.signal.aborted) return;
          setResults([]);
          setStatus("error");
          setError(cause.message);
          setOpen(true);
        });
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const choose = (place: Place) => {
    onPick(place);
    setQuery("");
    setResults([]);
    setStatus("idle");
    setOpen(false);
    setActive(-1);
    inputRef.current?.blur();
  };

  const showPanel = open && query.trim().length >= 2;

  return (
    <div
      className="search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <div className="search-field">
        <Search size={16} className="search-icon" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Search a place or address"
          aria-label="Search for a place"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            active >= 0 && results[active] ? `${listId}-${results[active].id}` : undefined
          }
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (query.trim().length >= 2) setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
              return;
            }
            if (!showPanel || results.length === 0) return;

            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((current) => (current + 1) % results.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((current) => (current - 1 + results.length) % results.length);
            } else if (event.key === "Enter") {
              event.preventDefault();
              const place = results[active >= 0 ? active : 0];
              if (place) choose(place);
            }
          }}
        />
        {status === "loading" && <Loader2 size={15} className="spin search-status" aria-label="Searching" />}
        {query.length > 0 && status !== "loading" && (
          <button
            type="button"
            className="search-clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
              inputRef.current?.focus();
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="search-panel" role="listbox" id={listId} aria-label="Search results">
          {status === "error" && <p className="search-message">{error}</p>}
          {status === "ready" && results.length === 0 && (
            <p className="search-message">No places found for “{query.trim()}”.</p>
          )}
          {results.map((place, index) => (
            <button
              key={place.id}
              id={`${listId}-${place.id}`}
              type="button"
              role="option"
              aria-selected={index === active}
              className={`search-result ${index === active ? "is-active" : ""}`}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(place)}
            >
              <MapPin size={15} aria-hidden />
              <span>
                <strong>{place.name}</strong>
                <em>{place.detail}</em>
              </span>
            </button>
          ))}
          <p className="search-credit">Search by OpenStreetMap Nominatim</p>
        </div>
      )}
    </div>
  );
}
