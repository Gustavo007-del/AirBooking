import {
  useCallback,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Plane,
  Luggage,
  Plus,
  Search,
  Check,
  X,
  ArrowUpRight,
  MapPin,
  Route as RouteIcon,
  RefreshCw,
  LoaderCircle,
} from "lucide-react";
import { service, errorMessage } from "./api";
import {
  type Airport,
  type Route,
  dateAfter,
  money,
  type User,
  type Flight,
  type Booking,
  type Status,
  type FlightSearchSource,
} from "./domain";
import { ErrorState } from "./components";
import { AdminCatalog } from "./AdminCatalog";
import { AdminOverview, type OperationsSnapshot } from "./AdminOverview";
import { CustomerEditor } from "./CustomerEditor";
import { Notice } from "./Notice";
const statuses: Status[] = [
  "Scheduled",
  "On time",
  "Delayed",
  "Cancelled",
  "Departed",
  "Arrived",
];
const tabs = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Users", icon: Users },
  { label: "Bookings", icon: Luggage },
  { label: "Flights", icon: Plane },
  { label: "Airports", icon: MapPin },
  { label: "Routes", icon: RouteIcon },
] as const;
type AdminTab = (typeof tabs)[number]["label"];

function Modal({
  children,
  label,
  onClose,
}: {
  children: ReactNode;
  label: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog ref={ref} className="modal" aria-label={label} onCancel={onClose}>
      {children}
    </dialog>
  );
}
export default function Admin() {
  const [tab, setTab] = useState<AdminTab>("Overview");
  const activeTab = useRef<AdminTab>("Overview");
  const loadSequence = useRef(0);
  const [users, setUsers] = useState<User[]>([]);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [snapshot, setSnapshot] = useState<OperationsSnapshot>();
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [recordStatus, setRecordStatus] = useState("");
  const [flightSource, setFlightSource] = useState<FlightSearchSource | "">("");
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingFlight, setBookingFlight] = useState("");
  const [bookingCustomer, setBookingCustomer] = useState("");
  const [flights, setFlights] = useState<Flight[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [requestedPage, setPage] = useState(1);
  useEffect(
    () => setPage(1),
    [
      tab,
      query,
      recordStatus,
      flightSource,
      upcomingOnly,
      bookingDate,
      bookingCustomer,
      bookingFlight,
    ],
  );
  const [editing, setEditing] = useState<Flight | null>(null);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<User | null>(null);
  function editFlight(flight: Flight | null) {
    setError("");
    setEditing(flight);
  }
  const load = useCallback(async (section: AdminTab, showSpinner = true) => {
    if (section !== activeTab.current) return;
    const sequence = ++loadSequence.current;
    const isCurrent = () =>
      activeTab.current === section && loadSequence.current === sequence;
    if (showSpinner) setLoading(true);
    setError("");
    try {
      switch (section) {
        case "Overview": {
          const data = await service.operations();
          if (!isCurrent()) return;
          setSnapshot(data);
          setPendingApprovals(data.pending_approvals);
          break;
        }
        case "Users": {
          const data = await service.users();
          if (!isCurrent()) return;
          setUsers(data);
          setPendingApprovals(
            data.filter(
              (user) => user.role === "user" && user.status === "pending",
            ).length,
          );
          break;
        }
        case "Bookings": {
          const [data, customers] = await Promise.all([
            service.bookings(true),
            service.users(),
          ]);
          if (!isCurrent()) return;
          setBookings(data);
          setUsers(customers);
          break;
        }
        case "Flights": {
          const [data, catalog] = await Promise.all([
            service.adminFlights(),
            service.routes(true),
          ]);
          if (!isCurrent()) return;
          setFlights(data);
          setRoutes(catalog);
          break;
        }
        case "Airports": {
          const data = await service.airports(true);
          if (isCurrent()) setAirports(data);
          break;
        }
        case "Routes": {
          const [catalog, data] = await Promise.all([
            service.airports(true),
            service.routes(true),
          ]);
          if (!isCurrent()) return;
          setAirports(catalog);
          setRoutes(data);
          break;
        }
      }
    } catch (e) {
      if (isCurrent()) setError(errorMessage(e));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load(tab);
  }, [load, tab]);
  function openSection(
    section: AdminTab,
    filters: {
      status?: string;
      source?: FlightSearchSource;
      upcoming?: boolean;
    } = {},
  ) {
    if (section !== tab) {
      activeTab.current = section;
      setLoading(true);
      setError("");
      setNotice("");
      setTab(section);
    }
    setQuery("");
    setRecordStatus(filters.status ?? "");
    setFlightSource(filters.source ?? "");
    setUpcomingOnly(filters.upcoming ?? false);
    setBookingDate("");
    setBookingFlight("");
    setBookingCustomer("");
  }
  async function action(fn: () => Promise<void>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      if (activeTab.current === tab) setNotice(message);
      await load(tab, false);
      return true;
    } catch (e) {
      if (activeTab.current === tab) setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const filtered = <T extends { status: string }>(rows: T[]) =>
    rows.filter(
      (x) =>
        (!recordStatus || x.status === recordStatus) &&
        JSON.stringify(x).toLowerCase().includes(query.toLowerCase()),
    );
  const customerRows = tab === "Users" ? filtered(users) : [];
  const flightRows =
    tab === "Flights"
      ? filtered(flights).filter(
          (flight) =>
            (!flightSource ||
              (flight.schedule_source ?? "database") === flightSource) &&
            (!upcomingOnly ||
              (!!flight.departure_datetime &&
                Date.parse(flight.departure_datetime) >= Date.now() &&
                ["Scheduled", "On time", "Delayed"].includes(flight.status))),
        )
      : [];
  const bookingRows =
    tab === "Bookings"
      ? filtered(
          bookings.filter(
            (booking) =>
              (!bookingDate || booking.createdAt.startsWith(bookingDate)) &&
              (!bookingCustomer || booking.userId === bookingCustomer) &&
              (!bookingFlight ||
                booking.flights.some((flight) => flight.id === bookingFlight)),
          ),
        )
      : [];
  const bookedFlights = new Map<string, Flight>();
  if (tab === "Bookings")
    for (const booking of bookings)
      for (const flight of booking.flights)
        bookedFlights.set(flight.id, flight);
  const count = customerRows.length + flightRows.length + bookingRows.length;
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const pageRows = <T,>(rows: T[]) =>
    rows.slice((page - 1) * pageSize, page * pageSize);
  return (
    <main className="admin-layout">
      <aside className="admin-nav">
        <h2>Air Booking Admin</h2>
        {tabs.map(({ label, icon: Icon }) => (
          <button
            key={label}
            className={tab === label ? "active" : ""}
            aria-current={tab === label ? "page" : undefined}
            onClick={() => openSection(label)}
          >
            <Icon size={18} />
            {label}
            {label === "Users" && pendingApprovals > 0 && (
              <span aria-label={`${pendingApprovals} pending approvals`}>
                {pendingApprovals}
              </span>
            )}
          </button>
        ))}
        <Link className="text-link" to="/">
          Back to website <ArrowUpRight size={16} />
        </Link>
      </aside>
      <section className="admin-main">
        <div className="page-heading">
          <div>
            <h1>{tab === "Overview" ? "Operations overview" : tab}</h1>
            {tab === "Flights" && (
              <p>
                AirLabs timetable departures and saved flights. All times are in
                UTC.
              </p>
            )}
          </div>
          {tab === "Overview" && (
            <button
              className="button outline"
              disabled={loading}
              onClick={() => void load(tab)}
            >
              <RefreshCw size={16} /> Refresh
            </button>
          )}
          {tab === "Flights" && (
            <button
              className="button"
              disabled={loading}
              onClick={() =>
                editFlight({
                  id: crypto.randomUUID(),
                  number: "",
                  airline: "",
                  origin: "",
                  destination: "",
                  date: dateAfter(1),
                  departure: "09:00",
                  arrival: "15:00",
                  arrivalDay: 0,
                  duration: 540,
                  price: 42000,
                  seats: 20,
                  stops: 0,
                  status: "On time",
                })
              }
            >
              <Plus size={16} /> Add saved flight
            </button>
          )}
        </div>
        {notice && (
          <Notice
            tone="success"
            message={notice}
            onDismiss={() => setNotice("")}
          />
        )}
        {error && !editing && (
          <ErrorState message={error} retry={() => void load(tab)} />
        )}
        {loading ? (
          <div className="empty" role="status">
            <LoaderCircle className="spin" />
            <p>Loading {tab.toLowerCase()}…</p>
          </div>
        ) : (
          <>
            {tab === "Overview" ? (
              snapshot && (
                <AdminOverview
                  snapshot={snapshot}
                  reviewApprovals={() =>
                    openSection("Users", { status: "pending" })
                  }
                  showFlights={(source) =>
                    openSection("Flights", { source, upcoming: true })
                  }
                  showBookings={() => openSection("Bookings")}
                />
              )
            ) : tab === "Airports" || tab === "Routes" ? (
              <AdminCatalog
                key={tab}
                kind={tab}
                airports={airports}
                routes={routes}
                reload={() => load(tab, false)}
              />
            ) : (
              <>
                <div className="admin-filters">
                  <label>
                    Status
                    <select
                      value={recordStatus}
                      onChange={(event) => setRecordStatus(event.target.value)}
                    >
                      <option value="">All statuses</option>
                      {(tab === "Users"
                        ? ["pending", "approved", "rejected"]
                        : tab === "Flights"
                          ? statuses
                          : ["Pending", "Confirmed", "Cancelled"]
                      ).map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                  {tab === "Flights" && (
                    <>
                      <label>
                        Schedule source
                        <select
                          value={flightSource}
                          onChange={(event) =>
                            setFlightSource(
                              event.target.value as FlightSearchSource | "",
                            )
                          }
                        >
                          <option value="">All sources</option>
                          <option value="airlabs_routes">AirLabs Routes</option>
                          <option value="database">Saved database</option>
                        </select>
                      </label>
                      <label>
                        Departures
                        <select
                          value={upcomingOnly ? "upcoming" : ""}
                          onChange={(event) =>
                            setUpcomingOnly(event.target.value === "upcoming")
                          }
                        >
                          <option value="">All departures</option>
                          <option value="upcoming">Upcoming</option>
                        </select>
                      </label>
                    </>
                  )}
                  {tab === "Bookings" && (
                    <>
                      <label>
                        Booked on
                        <input
                          type="date"
                          value={bookingDate}
                          onChange={(event) =>
                            setBookingDate(event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Customer
                        <select
                          value={bookingCustomer}
                          onChange={(event) =>
                            setBookingCustomer(event.target.value)
                          }
                        >
                          <option value="">All customers</option>
                          {users.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.email}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Flight
                        <select
                          value={bookingFlight}
                          onChange={(event) =>
                            setBookingFlight(event.target.value)
                          }
                        >
                          <option value="">All flights</option>
                          {Array.from(bookedFlights.values(), (flight) => (
                            <option key={flight.id} value={flight.id}>
                              {flight.number} · {flight.date} {flight.departure}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                </div>
                <label className="table-search">
                  <Search size={17} />
                  <input
                    aria-label={`Search ${tab.toLowerCase()}`}
                    placeholder={`Search ${tab.toLowerCase()}…`}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {(tab === "Users"
                          ? ["User", "Email", "Role", "Status", "Actions"]
                          : tab === "Flights"
                            ? [
                                "Flight",
                                "Route / date",
                                "Schedule",
                                "Fare / seats",
                                "Source",
                                "Status",
                                "Actions",
                              ]
                            : [
                                "Reference",
                                "Journey",
                                "Travellers",
                                "Payment",
                                "Status",
                                "Total",
                              ]
                        ).map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tab === "Users"
                        ? pageRows(customerRows).map((u) => (
                            <tr key={u.id}>
                              <td>
                                <button
                                  className="text-link"
                                  onClick={() => setDetail(u)}
                                >
                                  {u.name}
                                </button>
                              </td>
                              <td>{u.email}</td>
                              <td>{u.role}</td>
                              <td>
                                <span
                                  className={
                                    "badge " +
                                    (u.status === "pending" ? "pending" : "")
                                  }
                                >
                                  {u.status}
                                </span>
                              </td>
                              <td>
                                {u.status === "pending" && (
                                  <div className="actions">
                                    <button
                                      className="small-button"
                                      disabled={busy}
                                      onClick={() =>
                                        action(
                                          () => service.approve(u.id),
                                          "User approved.",
                                        )
                                      }
                                    >
                                      <Check size={14} /> Approve
                                    </button>
                                    <button
                                      className="small-button danger"
                                      disabled={busy}
                                      onClick={() => {
                                        if (
                                          window.confirm(
                                            `Reject ${u.name}'s registration?`,
                                          )
                                        )
                                          void action(
                                            () => service.reject(u.id),
                                            "Registration rejected.",
                                          );
                                      }}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))
                        : tab === "Flights"
                          ? pageRows(flightRows).map((f) => (
                              <tr key={f.id}>
                                <td>
                                  <strong>{f.number}</strong>
                                  <small>{f.airline}</small>
                                </td>
                                <td>
                                  {f.origin} → {f.destination}
                                  <small>{f.date}</small>
                                </td>
                                <td>
                                  {f.departure} – {f.arrival}
                                </td>
                                <td>
                                  {money(f.price, f.currency)}
                                  <small>{f.seats} available</small>
                                </td>
                                <td>
                                  <span className="badge">
                                    {f.schedule_source === "airlabs_routes"
                                      ? "AirLabs Routes"
                                      : "Saved database"}
                                  </span>
                                  {f.schedule_source === "airlabs_routes" && (
                                    <small>Simulated inventory</small>
                                  )}
                                </td>
                                <td>
                                  <select
                                    aria-label={"Status for " + f.number}
                                    value={f.status}
                                    disabled={busy}
                                    onChange={(e) =>
                                      action(
                                        () =>
                                          service.status(
                                            f.id,
                                            e.target.value as Status,
                                          ),
                                        "Flight status updated.",
                                      )
                                    }
                                  >
                                    {statuses.map((s) => (
                                      <option key={s}>{s}</option>
                                    ))}
                                  </select>
                                  <small>
                                    {f.status_source === "airlabs"
                                      ? "AirLabs update"
                                      : "Recorded status"}
                                  </small>
                                </td>
                                <td>
                                  <button
                                    className="text-link"
                                    onClick={() => editFlight(f)}
                                  >
                                    Edit
                                  </button>
                                </td>
                              </tr>
                            ))
                          : pageRows(bookingRows).map((b) => (
                              <tr key={b.id}>
                                <td>
                                  <Link
                                    className="text-link"
                                    to={"/trips/" + b.id + "?admin=1"}
                                  >
                                    {b.reference}
                                  </Link>
                                </td>
                                <td>
                                  {b.flights[0].origin} →{" "}
                                  {b.flights[0].destination}
                                  <small>{b.flights[0].date}</small>
                                </td>
                                <td>{b.passengers.length}</td>
                                <td>{b.paymentStatus}</td>
                                <td>{b.status}</td>
                                <td>{money(b.total, b.currency)}</td>
                              </tr>
                            ))}
                    </tbody>
                  </table>
                  {count === 0 && (
                    <div className="empty">No matching records.</div>
                  )}
                </div>
                {pageCount > 1 && (
                  <div className="actions admin-pages">
                    <button
                      className="button outline"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous
                    </button>
                    <span>
                      Page {page} of {pageCount}
                    </span>
                    <button
                      className="button outline"
                      disabled={page === pageCount}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
        {editing && (
          <div className="modal-backdrop">
            <Modal label="Flight editor" onClose={() => editFlight(null)}>
              <div className="row">
                <h2 id="flight-editor-title">Flight editor</h2>
                <button
                  onClick={() => editFlight(null)}
                  aria-label="Close flight editor"
                >
                  <X />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editing.origin === editing.destination) {
                    setError("Origin and destination must differ.");
                    return;
                  }
                  void action(
                    () => service.saveFlight(editing),
                    "Flight saved.",
                  ).then((saved) => {
                    if (saved) setEditing(null);
                  });
                }}
              >
                {error && (
                  <Notice
                    title="We couldn’t save this flight"
                    message={error}
                  />
                )}
                <div className="form-grid">
                  {(
                    [
                      "number",
                      "airline",
                      "date",
                      "departure",
                      "arrival",
                      "price",
                      "seats",
                    ] as const
                  ).map((k) => (
                    <label key={k}>
                      {k}
                      <input
                        required
                        value={editing[k]}
                        type={
                          ["price", "seats"].includes(k)
                            ? "number"
                            : k === "date"
                              ? "date"
                              : ["departure", "arrival"].includes(k)
                                ? "time"
                                : "text"
                        }
                        min={k === "price" ? 0.01 : 0}
                        step={k === "price" ? 0.01 : undefined}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            [k]: ["price", "seats"].includes(k)
                              ? Number(e.target.value)
                              : e.target.value,
                          })
                        }
                      />
                    </label>
                  ))}
                  <label>
                    Route
                    <select
                      aria-label="Route"
                      required
                      value={editing.route ?? ""}
                      onChange={(event) => {
                        const route = routes.find(
                          (item) => item.id === Number(event.target.value),
                        );
                        setEditing({
                          ...editing,
                          route: route?.id,
                          origin: route?.origin_detail.code ?? "",
                          destination: route?.destination_detail.code ?? "",
                        });
                      }}
                    >
                      <option value="">Select a route</option>
                      {routes
                        .filter(
                          (route) =>
                            route.id === editing.route ||
                            (route.active &&
                              route.origin_detail.active &&
                              route.destination_detail.active),
                        )
                        .map((route) => (
                          <option key={route.id} value={route.id}>
                            {route.origin_detail.code} →{" "}
                            {route.destination_detail.code}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <p>
                  {
                    "Changes are saved to the backend. Flight times use UTC; duration is calculated from departure and arrival."
                  }
                </p>
                <button className="button" disabled={busy}>
                  Save flight
                </button>
              </form>
            </Modal>
          </div>
        )}
        {detail && (
          <div className="modal-backdrop">
            <Modal label="User details" onClose={() => setDetail(null)}>
              <div className="row">
                <h2>{detail.name}</h2>
                <button
                  onClick={() => setDetail(null)}
                  aria-label="Close user details"
                >
                  <X />
                </button>
              </div>
              <p>{detail.email}</p>
              <p>Role: {detail.role}</p>
              <p>Approval: {detail.status}</p>
              <CustomerEditor
                key={detail.id}
                user={detail}
                onSaved={(user) => {
                  setDetail(user);
                  setUsers((rows) =>
                    rows.map((item) => (item.id === user.id ? user : item)),
                  );
                }}
              />
            </Modal>
          </div>
        )}
      </section>
    </main>
  );
}
