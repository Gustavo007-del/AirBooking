import { useEffect, useState, useRef, type ReactNode } from "react";
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
} from "lucide-react";
import { service, errorMessage } from "./api";
import {
  airports,
  DEMO,
  defaultSearch,
  money,
  type User,
  type Flight,
  type Booking,
  type Status,
} from "./domain";
import { DemoNote, ErrorState, Loading } from "./components";
const statuses: Status[] = [
  "On time",
  "Delayed",
  "Cancelled",
  "Departed",
  "Arrived",
];
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
  const [tab, setTab] = useState("Overview");
  const [users, setUsers] = useState<User[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Flight | null>(null);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<User | null>(null);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const [u, f, b] = await Promise.all([
        service.users(),
        service.adminFlights(),
        service.bookings(),
      ]);
      setUsers(u);
      setFlights(f);
      setBookings(b);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function action(fn: () => Promise<void>, message: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setNotice(message);
      await load();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const filtered = <T,>(rows: T[]) =>
    rows.filter((x) =>
      JSON.stringify(x).toLowerCase().includes(query.toLowerCase()),
    );
  return (
    <main className="admin-layout">
      <aside className="admin-nav">
        <span className="eyebrow copper-text">OPERATIONS</span>
        <h2>Flight desk.</h2>
        {[
          ["Overview", LayoutDashboard],
          ["Users", Users],
          ["Flights", Plane],
          ["Bookings", Luggage],
        ].map(([label, Icon]) => {
          const C = Icon as typeof Plane;
          return (
            <button
              key={String(label)}
              className={tab === label ? "active" : ""}
              onClick={() => {
                setTab(String(label));
                setQuery("");
              }}
            >
              <C size={18} />
              {String(label)}
              {label === "Users" && (
                <span>
                  {users.filter((u) => u.status === "pending").length}
                </span>
              )}
            </button>
          );
        })}
        <Link className="text-link" to="/">
          Back to website <ArrowUpRight size={16} />
        </Link>
      </aside>
      <section className="admin-main">
        <DemoNote />
        <div className="page-heading">
          <div>
            <span className="eyebrow copper-text">AERÉ ADMINISTRATION</span>
            <h1>
              {tab === "Overview"
                ? "A clear view of operations."
                : tab === "Users"
                  ? "People, at the centre."
                  : tab === "Flights"
                    ? "Every flight, in view."
                    : "Journeys in progress."}
            </h1>
            <p>
              {DEMO
                ? "Demonstration workspace. Changes stay in this browser."
                : "Connected operations workspace."}
            </p>
          </div>
          {tab === "Flights" && (
            <button
              className="button"
              onClick={() =>
                setEditing({
                  id: crypto.randomUUID(),
                  number: "AE 600",
                  airline: "AERÉ Demonstration",
                  origin: "DEL",
                  destination: "LHR",
                  date: defaultSearch.departure,
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
              <Plus size={16} /> Create flight
            </button>
          )}
        </div>
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button
              onClick={() => setNotice("")}
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {error && <ErrorState message={error} retry={load} />}{" "}
        {loading ? (
          <Loading />
        ) : (
          <>
            {tab === "Overview" ? (
              <>
                <div className="stat-grid four">
                  {[
                    [
                      DEMO ? "REGISTERED DEMO USERS" : "PENDING USER RECORDS",
                      users.length,
                    ],
                    [
                      "PENDING APPROVALS",
                      users.filter((u) => u.status === "pending").length,
                    ],
                    ["FLIGHT RECORDS", flights.length],
                    ["BOOKINGS", bookings.length],
                  ].map(([label, n]) => (
                    <div className="stat" key={label}>
                      <small>{label}</small>
                      <b>{n}</b>
                      <span>{DEMO ? "Sample workspace" : "API records"}</span>
                    </div>
                  ))}
                </div>
                <div className="admin-overview">
                  <div className="panel">
                    <div className="row">
                      <h3>Approval queue</h3>
                      <button
                        className="text-link"
                        onClick={() => setTab("Users")}
                      >
                        View users →
                      </button>
                    </div>
                    {users
                      .filter((u) => u.status === "pending")
                      .map((u) => (
                        <div key={u.id} className="queue-row">
                          <span className="avatar">{u.name[0]}</span>
                          <div>
                            <strong>{u.name}</strong>
                            <small>{u.email}</small>
                          </div>
                          <span className="badge pending">Pending</span>
                        </div>
                      ))}
                  </div>
                  <div className="panel">
                    <h3>Booking overview</h3>
                    <p>
                      Confirmed{" "}
                      <strong>
                        {
                          bookings.filter((b) => b.status === "Confirmed")
                            .length
                        }
                      </strong>
                    </p>
                    <div className="bar">
                      <i style={{ width: bookings.length ? "100%" : "0%" }} />
                    </div>
                    <p>
                      Cancelled{" "}
                      <strong>
                        {
                          bookings.filter((b) => b.status === "Cancelled")
                            .length
                        }
                      </strong>
                    </p>
                    <div className="bar">
                      <i
                        style={{
                          width: bookings.length
                            ? `${(bookings.filter((b) => b.status === "Cancelled").length / bookings.length) * 100}%`
                            : "0%",
                        }}
                      />
                    </div>
                    <p>Total booking value</p>
                    <h2>{money(bookings.reduce((s, b) => s + b.total, 0))}</h2>
                    <small>
                      {DEMO
                        ? "Simulated value, not revenue"
                        : "Based on returned booking records"}
                    </small>
                  </div>
                </div>
              </>
            ) : (
              <>
                <label className="table-search">
                  <Search size={17} />
                  <input
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
                                "Price / seats",
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
                        ? filtered(users).map((u) => (
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
                          ? filtered(flights).map((f) => (
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
                                  {money(f.price)}
                                  <small>{f.seats} seats</small>
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
                                </td>
                                <td>
                                  <button
                                    className="text-link"
                                    onClick={() => setEditing(f)}
                                  >
                                    Edit
                                  </button>
                                </td>
                              </tr>
                            ))
                          : filtered(bookings).map((b) => (
                              <tr key={b.id}>
                                <td>
                                  <Link
                                    className="text-link"
                                    to={"/trips/" + b.id}
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
                                <td>{money(b.total)}</td>
                              </tr>
                            ))}
                    </tbody>
                  </table>
                  {(tab === "Users"
                    ? filtered(users)
                    : tab === "Flights"
                      ? filtered(flights)
                      : filtered(bookings)
                  ).length === 0 && (
                    <div className="empty">No matching records.</div>
                  )}
                </div>
              </>
            )}
          </>
        )}
        {editing && (
          <div className="modal-backdrop">
            <Modal label="Flight editor" onClose={() => setEditing(null)}>
              <div className="row">
                <h2 id="flight-editor-title">Flight editor</h2>
                <button
                  onClick={() => setEditing(null)}
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
                      "duration",
                    ] as const
                  ).map((k) => (
                    <label key={k}>
                      {k}
                      <input
                        required
                        value={editing[k]}
                        type={
                          ["price", "seats", "duration"].includes(k)
                            ? "number"
                            : k === "date"
                              ? "date"
                              : ["departure", "arrival"].includes(k)
                                ? "time"
                                : "text"
                        }
                        min={k === "duration" ? 1 : 0}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            [k]: ["price", "seats", "duration"].includes(k)
                              ? Number(e.target.value)
                              : e.target.value,
                          })
                        }
                      />
                    </label>
                  ))}
                  {(["origin", "destination"] as const).map((k) => (
                    <label key={k}>
                      {k}
                      <select
                        value={editing[k]}
                        onChange={(e) =>
                          setEditing({ ...editing, [k]: e.target.value })
                        }
                      >
                        {airports.map((a) => (
                          <option key={a.code}>{a.code}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <p>
                  {DEMO
                    ? "Changes affect local demo search results."
                    : "Create/edit endpoint must be supplied by your backend."}
                </p>
                <button className="button" disabled={busy || !DEMO}>
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
              <small>ID: {detail.id}</small>
            </Modal>
          </div>
        )}
      </section>
    </main>
  );
}
