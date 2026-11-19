import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ArrowRight, SlidersHorizontal, ArrowLeft } from "lucide-react";
import { service, errorMessage } from "./api";
import {
  city,
  duration,
  money,
  prettyDate,
  searchSchema,
  type Flight,
  type FlightSearchSource,
  type Search,
} from "./domain";
import { useStore } from "./store";
import { ErrorState, FlightCard, Loading, SearchPanel } from "./components";
import { Notice } from "./Notice";
import { LiveSchedules } from "./LiveSchedules";
import { pollVisible } from "./livePolling";
export default function Flights() {
  const saved = useStore((s) => s.search);
  const [params] = useSearchParams();
  const parsed = searchSchema.safeParse({
    ...Object.fromEntries(params),
    passengers: Number(params.get("passengers")),
  });
  const search: Search = parsed.success ? parsed.data : saved;
  const canSearch = searchSchema.safeParse(search).success;
  const key = JSON.stringify(search);
  useEffect(() => {
    if (JSON.stringify(useStore.getState().search) !== key)
      useStore.getState().setSearch(search);
  }, [key]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [source, setSource] = useState<FlightSearchSource>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [sort, setSort] = useState("recommended");
  const [price, setPrice] = useState(200000);
  const [stops, setStops] = useState(false);
  const [depart, setDepart] = useState("");
  const [arrival, setArrival] = useState("");
  const [maxDuration, setMaxDuration] = useState(24);
  const [available, setAvailable] = useState(true);
  const [edit, setEdit] = useState(false);
  const [filters, setFilters] = useState(false);
  const [outbound, setOutbound] = useState<Flight | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    setOutbound(null);
  }, [key]);
  useEffect(() => {
    let active = true;
    if (!canSearch) {
      setFlights([]);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setSource(undefined);
    setError("");
    service
      .search(
        outbound
          ? {
              ...search,
              origin: search.destination,
              destination: search.origin,
              departure: search.returnDate,
            }
          : search,
      )
      .then((result) => {
        if (active) {
          setFlights(result.flights);
          setSource(result.source);
        }
      })
      .catch((e) => active && setError(errorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [key, retry, outbound, canSearch]);
  const visible = flights
    .filter(
      (f) =>
        (!outbound?.arrival_datetime ||
          !f.departure_datetime ||
          Date.parse(f.departure_datetime) >
            Date.parse(outbound.arrival_datetime)) &&
        f.price <= price &&
        (!stops || !f.stops) &&
        (!available ||
          (f.seats >= search.passengers && f.status !== "Cancelled")) &&
        (!depart || Number(f.departure.slice(0, 2)) >= Number(depart)) &&
        (!arrival || Number(f.arrival.slice(0, 2)) <= Number(arrival)) &&
        f.duration <= maxDuration * 60,
    )
    .sort((a, b) =>
      sort === "cheapest"
        ? a.price - b.price
        : sort === "fastest"
          ? a.duration - b.duration
          : sort === "earliest"
            ? a.departure.localeCompare(b.departure)
            : 0,
    );
  function select(f: Flight) {
    if (search.type === "round" && !outbound) {
      setOutbound(f);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else
      navigate(
        "/booking/" +
          (outbound?.id || f.id) +
          (outbound ? "?return=" + encodeURIComponent(f.id) : ""),
      );
  }
  if (!canSearch)
    return (
      <main className="page wrap">
        <h1>Find a flight</h1>
        <SearchPanel />
      </main>
    );
  return (
    <main className="page wrap">
      <div className="page-heading">
        <div>
          <span className="eyebrow copper-text">YOUR JOURNEY, YOUR WAY</span>
          <h1>
            {city(outbound ? search.destination : search.origin)} <ArrowRight />{" "}
            {city(outbound ? search.origin : search.destination)}
          </h1>
          <p>
            {prettyDate(outbound ? search.returnDate : search.departure)} ·{" "}
            {search.passengers} traveller{search.passengers > 1 ? "s" : ""} ·{" "}
            {search.cabin} ·{" "}
            {search.type === "round" ? "Round trip" : "One way"}
          </p>
        </div>
        <button className="button outline" onClick={() => setEdit(!edit)}>
          Edit search
        </button>
      </div>
      {edit && <SearchPanel compact />}
      {source === "airlabs_routes" && (
        <Notice
          tone="info"
          title="AirLabs timetable"
          message="Flight times are expected schedules shown in UTC. Fares, seats, and reservations are simulated by Air Booking."
        />
      )}
      {source === "database" && (
        <Notice
          tone="info"
          title="Saved flights"
          message="The AirLabs timetable is unavailable. Showing flights saved in Air Booking."
        />
      )}
      {outbound && (
        <div className="notice">
          <strong>
            Outbound selected: {outbound.number} at {outbound.departure}.
          </strong>{" "}
          Choose your return flight.
          <button className="text-link" onClick={() => setOutbound(null)}>
            Change outbound
          </button>
        </div>
      )}
      <div className="results-layout">
        <button
          className="mobile-filter button outline"
          onClick={() => setFilters(!filters)}
        >
          <SlidersHorizontal size={17} /> Filters
        </button>
        <aside className={`filters ${filters ? "show" : ""}`}>
          <div className="row">
            <h3>Refine your flight</h3>
            <button
              className="text-link"
              onClick={() => {
                setPrice(200000);
                setStops(false);
                setDepart("");
                setArrival("");
                setMaxDuration(24);
                setAvailable(true);
              }}
            >
              Reset
            </button>
          </div>
          <label>
            Maximum price <strong>{money(price)}</strong>
            <input
              type="range"
              min="20000"
              max="200000"
              step="1000"
              value={price}
              onChange={(e) => setPrice(+e.target.value)}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={stops}
              onChange={(e) => setStops(e.target.checked)}
            />{" "}
            Nonstop only
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
            />{" "}
            Available seats only
          </label>
          <label>
            Depart after
            <select value={depart} onChange={(e) => setDepart(e.target.value)}>
              <option value="">Any time</option>
              <option value="6">06:00</option>
              <option value="12">12:00</option>
              <option value="18">18:00</option>
            </select>
          </label>
          <label>
            Arrive before
            <select
              value={arrival}
              onChange={(e) => setArrival(e.target.value)}
            >
              <option value="">Any time</option>
              <option value="12">12:59</option>
              <option value="18">18:59</option>
            </select>
          </label>
          <label>
            Maximum duration
            <select
              value={maxDuration}
              onChange={(e) => setMaxDuration(+e.target.value)}
            >
              <option value="24">24 hours</option>
              <option value="10">10 hours</option>
              <option value="9">9 hours</option>
            </select>
          </label>
          <div className="filter-help">
            <SlidersHorizontal size={20} />
            <p>A little flexibility goes a long way.</p>
            <small>Change airports or dates using Edit search.</small>
          </div>
        </aside>
        <section>
          <div className="results-toolbar">
            <span>
              <strong>{visible.length} flights</strong> ·{" "}
              {outbound ? "Return" : "Outbound"}
            </span>
            <label>
              Sort by{" "}
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="recommended">Recommended</option>
                <option value="cheapest">Cheapest</option>
                <option value="fastest">Fastest</option>
                <option value="earliest">Earliest departure</option>
              </select>
            </label>
          </div>
          {loading ? (
            <Loading />
          ) : error ? (
            <ErrorState message={error} retry={() => setRetry((v) => v + 1)} />
          ) : visible.length ? (
            visible.map((f) => (
              <FlightCard key={f.id} flight={f} onSelect={() => select(f)} />
            ))
          ) : (
            <div className="empty">
              <h3>No flights match your search.</h3>
              <p>Try another date, route, or a broader price range.</p>
              <button className="button outline" onClick={() => setEdit(true)}>
                Change search
              </button>
            </div>
          )}
          <LiveSchedules
            key={`${key}-${outbound?.id ?? "outbound"}`}
            origin={outbound ? search.destination : search.origin}
            destination={outbound ? search.origin : search.destination}
            departure={outbound ? search.returnDate : search.departure}
          />
        </section>
      </div>
    </main>
  );
}
export function FlightDetails() {
  const { id } = useParams();
  const [flight, setFlight] = useState<Flight>();
  const [error, setError] = useState("");
  useEffect(
    () => (id ? pollVisible(() => service.flight(id), setFlight) : undefined),
    [id],
  );
  useEffect(() => {
    service
      .flight(id!)
      .then(setFlight)
      .catch((e) => setError(errorMessage(e)));
  }, [id]);
  return (
    <main className="page narrow">
      <Link className="text-link" to="/flights">
        <ArrowLeft size={16} /> Back to results
      </Link>
      <h1>Your flight, in detail.</h1>
      {error ? (
        <ErrorState message={error} />
      ) : !flight ? (
        <Loading />
      ) : (
        <>
          <FlightCard flight={flight} />
          <div className="panel">
            <h2>A clear view of your journey</h2>
            <div className="detail-grid">
              <div>
                <small>TRAVEL DATE</small>
                <h3>{prettyDate(flight.date)}</h3>
              </div>
              <div>
                <small>JOURNEY DURATION</small>
                <h3>{duration(flight.duration)}</h3>
              </div>
              <div>
                <small>FLIGHT STATUS</small>
                <h3>{flight.status}</h3>
                <small>
                  {flight.updatedAt
                    ? "Updated " + new Date(flight.updatedAt).toLocaleString()
                    : "Update time unavailable"}
                </small>
              </div>
            </div>
            <p>
              Confirm fare conditions and baggage allowance with the airline
              before travelling.
            </p>
            {flight.seats > 0 &&
            ["Scheduled", "On time", "Delayed"].includes(flight.status) &&
            flight.date >= new Date().toISOString().slice(0, 10) ? (
              <Link className="button" to={"/booking/" + flight.id}>
                Continue with this one-way flight <ArrowRight size={17} />
              </Link>
            ) : (
              <Notice
                tone="warning"
                title="Flight unavailable"
                message="This flight is no longer available to book."
              />
            )}
          </div>
        </>
      )}
    </main>
  );
}
