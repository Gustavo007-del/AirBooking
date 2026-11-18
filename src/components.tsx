import { useId, useState } from "react";
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
  airports,
  city,
  DEMO,
  duration,
  money,
  searchSchema,
  dateAfter,
  type Search,
  type Flight,
} from "./domain";
import { useStore } from "./store";
export function DemoNote() {
  return DEMO ? (
    <div className="demo-note">
      <span className="dot" /> FRONTEND PREVIEW{" "}
      <span>Sample flights · simulated payments · no real reservations</span>
    </div>
  ) : null;
}
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
  return (
    <div className="empty" role="alert">
      <h3>We couldn’t complete that.</h3>
      <p>{message}</p>
      {retry && (
        <button onClick={retry} className="button">
          Try again
        </button>
      )}
    </div>
  );
}
export function AirportInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const id = useId();
  return (
    <label className="search-field">
      <span>{label}</span>
      <input
        list={id}
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v.includes(" — ") ? v.split(" — ")[0] : v.toUpperCase());
        }}
        aria-invalid={!!error}
        aria-describedby={error ? id + "-error" : undefined}
      />
      <small>
        {airports.find((a) => a.code === value)?.city || "City or airport code"}
      </small>
      <datalist id={id}>
        {airports.map((a) => (
          <option key={a.code} value={a.code}>
            {a.city} — {a.name}
          </option>
        ))}
      </datalist>
      {error && <em id={id + "-error"}>{error}</em>}
    </label>
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
        <span className="sample-label">
          {DEMO ? "DEMO SEARCH" : "SECURE SEARCH"}
        </span>
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
            {f.number} · {DEMO ? "Sample service" : "Scheduled service"}
          </small>
        </div>
      </div>
      <div className="flight-main">
        <div>
          <b>{f.departure}</b>
          <span>{f.origin}</span>
          <small>{city(f.origin)}</small>
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
            <sup>{f.arrivalDay ? "+1" : ""}</sup>
          </b>
          <span>{f.destination}</span>
          <small>{city(f.destination)}</small>
        </div>
        <div className="fare">
          <b>{money(f.price)}</b>
          <small>per traveller</small>
          {onSelect ? (
            <button
              className="button"
              disabled={f.status === "Cancelled" || f.seats < 1}
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
        <span className="badge">
          {DEMO ? "Sample · " : ""}
          {f.status}
        </span>
        <small>
          {f.seats} {DEMO ? "sample " : ""}seats available
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
          <Link to={"/flight/" + f.id}>View complete flight details →</Link>
        </div>
      )}
    </article>
  );
}
