import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowLeftRight,
  Plane,
  ShieldCheck,
  LoaderCircle,
  ChevronDown,
} from "lucide-react";
import {
  city,
  duration,
  money,
  searchSchema,
  dateAfter,
  type Search,
  type Flight,
  type Airport,
} from "./domain";
import { useStore } from "./store";
import { Notice } from "./Notice";
import { service } from "./api";
export function Loading() {
  return (
    <div className="empty" role="status">
      <LoaderCircle className="spin" />
      <p>Preparing your journey…</p>
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return <Notice message={message} retry={retry} />;
}

const defaultAirportNames = new Map([
  ["BLR", "Kempegowda International"],
  ["DEL", "Indira Gandhi International"],
]);

export function AirportInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const id = useId();
  const listId = id + "-suggestions";
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<{
    query: string;
    airports: Airport[];
    failed?: boolean;
  }>();
  const [activeIndex, setActiveIndex] = useState(-1);
  const [lastSelected, setLastSelected] = useState<Airport>();
  const query = value.trim();
  const current = results?.query === query ? results : undefined;
  const airports = current?.airports ?? [];
  const selected =
    lastSelected?.code === value
      ? lastSelected
      : airports.find((airport) => airport.code === value);
  const expanded = open;
  const active = expanded ? airports[activeIndex] : undefined;

  useEffect(() => {
    if (query.length < 2 || (!open && !/^[A-Z]{3}$/.test(query))) return;
    let current = true;
    const timer = window.setTimeout(() => {
      service
        .airportSuggestions(query)
        .then((airports) => {
          if (current) setResults({ query, airports });
        })
        .catch(() => {
          if (current) setResults({ query, airports: [], failed: true });
        });
    }, 220);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [query, open]);

  useEffect(() => {
    if (active)
      document
        .getElementById(listId + "-" + active.code)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  function choose(airport: Airport) {
    setLastSelected(airport);
    setOpen(false);
    setActiveIndex(-1);
    onChange(airport.code);
  }

  return (
    <div className="search-field airport-field">
      <label htmlFor={id}>{label}</label>
      <div className="airport-entry">
        <input
          id={id}
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-activedescendant={
            active ? listId + "-" + active.code : undefined
          }
          aria-describedby={error ? id + "-error" : id + "-hint"}
          aria-invalid={!!error}
          placeholder="City or country"
          value={value}
          onFocus={(event) => {
            setOpen(true);
            setActiveIndex(-1);
            if (selected) event.currentTarget.select();
          }}
          onBlur={() => setOpen(false)}
          onChange={(event) => {
            setLastSelected(undefined);
            setOpen(true);
            setActiveIndex(-1);
            onChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && open) {
              event.preventDefault();
              setOpen(false);
              setActiveIndex(-1);
            } else if (
              (event.key === "ArrowDown" || event.key === "ArrowUp") &&
              query.length >= 2
            ) {
              event.preventDefault();
              setOpen(true);
              if (airports.length) {
                const direction = event.key === "ArrowDown" ? 1 : -1;
                setActiveIndex((index) =>
                  index < 0
                    ? direction === 1
                      ? 0
                      : airports.length - 1
                    : (index + direction + airports.length) % airports.length,
                );
              }
            } else if (event.key === "Enter" && active) {
              event.preventDefault();
              choose(active);
            }
          }}
        />
        <button
          type="button"
          className="airport-chevron"
          aria-label={`Show ${label.toLowerCase()} suggestions`}
          aria-expanded={expanded}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (open) setOpen(false);
            else {
              document.getElementById(id)?.focus();
              setOpen(true);
            }
          }}
        >
          <ChevronDown size={15} aria-hidden="true" />
        </button>
      </div>
      <small id={id + "-hint"}>
        {selected?.name ??
          defaultAirportNames.get(value) ??
          "Search by city, state, country or airport"}
      </small>
      {expanded && (
        <div className="airport-suggestions">
          {query.length < 2 ||
          !current ||
          current.failed ||
          !airports.length ? (
            <p role="status">
              {query.length < 2
                ? "Type at least two letters to find an airport."
                : !current
                  ? "Finding airports…"
                  : current.failed
                    ? "Suggestions unavailable. Try again or enter an airport code."
                    : "No airports found. Try a nearby city or a different spelling."}
            </p>
          ) : null}
          <ul id={listId} role="listbox" aria-label={`${label} airports`}>
            {airports.map((airport) => (
              <li
                id={listId + "-" + airport.code}
                key={airport.code}
                role="option"
                aria-selected={active?.code === airport.code}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(airport)}
              >
                <div>
                  <strong>
                    {airport.city} · {airport.name}
                  </strong>
                  <small>
                    {[airport.region, airport.country]
                      .filter(Boolean)
                      .join(", ")}
                  </small>
                </div>
                <span className="airport-code">{airport.code}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <em id={id + "-error"}>{error}</em>}
    </div>
  );
}
export function SearchPanel({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const saved = useStore((s) => s.search);
  const setSearch = useStore((s) => s.setSearch);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Search>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      ...saved,
      departure:
        saved.departure < dateAfter(0) ? dateAfter(14) : saved.departure,
      returnDate:
        saved.returnDate < dateAfter(0) ? dateAfter(21) : saved.returnDate,
    },
  });
  const v = watch();
  return (
    <form
      id={compact ? undefined : "flight-search"}
      className={`search-panel ${compact ? "compact" : ""}`}
      onSubmit={handleSubmit((data) => {
        setSearch(data);
        navigate(
          "/flights?" +
            new URLSearchParams(
              Object.entries(data).map(([k, v]) => [k, String(v)]),
            ).toString(),
        );
      })}
      noValidate
    >
      <div className="search-top">
        <div className="trip-toggle">
          {(["round", "one"] as const).map((t) => (
            <button
              type="button"
              key={t}
              aria-pressed={v.type === t}
              className={v.type === t ? "active" : ""}
              onClick={() => setValue("type", t)}
            >
              <span className="radio" />
              {t === "round" ? "Round trip" : "One way"}
            </button>
          ))}
        </div>
        <div className="search-options">
          <label>
            <span className="sr-only">Passengers</span>
            <select {...register("passengers", { valueAsNumber: true })}>
              {Array.from({ length: 9 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1} {i ? "Travellers" : "Traveller"}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Cabin class</span>
            <select {...register("cabin")}>
              <option>Economy</option>
              <option>Premium economy</option>
              <option>Business</option>
            </select>
          </label>
        </div>
      </div>
      <div className="search-grid">
        <div className="airport-pair">
          <AirportInput
            label="FROM"
            value={v.origin}
            onChange={(v) => setValue("origin", v)}
            error={errors.origin?.message}
          />
          <button
            className="swap"
            type="button"
            aria-label="Swap airports"
            onClick={() => {
              setValue("origin", v.destination);
              setValue("destination", v.origin);
            }}
          >
            <ArrowLeftRight size={16} />
          </button>
          <AirportInput
            label="TO"
            value={v.destination}
            onChange={(v) => setValue("destination", v)}
            error={errors.destination?.message}
          />
        </div>
        <label className="search-field date">
          <span>DEPARTURE</span>
          <input type="date" min={dateAfter(0)} {...register("departure")} />
          <small>Your journey begins</small>
          {errors.departure && <em>{errors.departure.message}</em>}
        </label>
        {v.type === "round" && (
          <label className="search-field date">
            <span>RETURN</span>
            <input type="date" min={v.departure} {...register("returnDate")} />
            <small>Make your way home</small>
            {errors.returnDate && <em>{errors.returnDate.message}</em>}
          </label>
        )}
        <button className="button copper search-submit" type="submit">
          Find flights <ArrowRight size={18} />
        </button>
      </div>
      <div className="search-bottom">
        <ShieldCheck size={13} />
        <span>A little less planning. A little more possibility.</span>
        <span className="search-label">{"SECURE SEARCH"}</span>
      </div>
    </form>
  );
}
export function FlightCard({
  flight: f,
  onSelect,
  selected = false,
}: {
  flight: Flight;
  onSelect?: () => void;
  selected?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`flight-card ${selected ? "selected" : ""}`}>
      <div className="flight-brand">
        <span className="airline-mark">
          <Plane size={21} />
        </span>
        <div>
          <strong>{f.airline}</strong>
          <small>
            {f.number} · {"Scheduled service"}
          </small>
        </div>
      </div>
      <div className="flight-main">
        <div>
          <b>{f.departure}</b>
          <span>{f.origin}</span>
          <small>{city(f.origin, f.origin_city)}</small>
        </div>
        <div className="flight-path">
          <small>{duration(f.duration)}</small>
          <div>
            <i />
            <span />
            <Plane size={17} />
          </div>
          <small>{f.stops ? `${f.stops} stop` : "Nonstop"}</small>
        </div>
        <div>
          <b>
            {f.arrival}
            <sup>{f.arrivalDay ? `+${f.arrivalDay}` : ""}</sup>
          </b>
          <span>{f.destination}</span>
          <small>{city(f.destination, f.destination_city)}</small>
        </div>
        <div className="fare">
          <b>{money(f.price, f.currency)}</b>
          <small>
            {f.schedule_source === "airlabs_routes"
              ? "Simulated fare per traveller"
              : "per traveller"}
          </small>
          {onSelect ? (
            <button
              className="button"
              disabled={
                ["Cancelled", "Departed", "Arrived"].includes(f.status) ||
                f.seats < 1
              }
              onClick={onSelect}
            >
              {selected ? "Selected" : "Select flight"} <ArrowRight size={15} />
            </button>
          ) : (
            <Link className="text-link" to={"/flight/" + f.id}>
              Flight details <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
      <div className="flight-foot">
        {f.schedule_source === "airlabs_routes" ? (
          <small>Expected timetable · simulated booking</small>
        ) : (
          f.demonstration && (
            <small>Demonstration flight · no airline ticket</small>
          )
        )}
        <span className="badge">
          {""}
          {f.status}
        </span>
        <small>
          {f.seats}{" "}
          {f.schedule_source === "airlabs_routes"
            ? "simulation seats"
            : "seats available"}
        </small>
        <button onClick={() => setOpen(!open)} aria-expanded={open}>
          Journey details <ChevronDown size={14} />
        </button>
      </div>
      {open && (
        <div className="flight-expanded">
          <p>
            Cabin allowance: illustrative 7 kg. Checked baggage and fare rules
            must be confirmed by the operating airline.
          </p>
          <p>
            Duration is supplied separately from local airport times.{" "}
            {f.arrivalDay ? "Arrival is the following day." : ""}
          </p>
          {(f.aircraft?.model || f.aircraft?.aircraft_icao) && (
            <p>
              Aircraft: {f.aircraft.model || f.aircraft.aircraft_icao}
              {f.aircraft.reg_number ? ` · ${f.aircraft.reg_number}` : ""}
            </p>
          )}
          {f.status_source === "airlabs" && (
            <small>Status source: AirLabs</small>
          )}
          <Link to={"/flight/" + f.id}>View complete flight details →</Link>
        </div>
      )}
    </article>
  );
}
