import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  Plane,
  Clock3,
  UserRound,
  Luggage,
  CheckCircle2,
} from "lucide-react";
import { service, errorMessage } from "./api";
import {
  DEMO,
  city,
  dateAfter,
  money,
  prettyDate,
  type Booking,
  type Flight,
} from "./domain";
import { useStore } from "./store";
import { DemoNote, ErrorState, FlightCard, Loading } from "./components";
const authSchema = z.object({
  name: z.string(),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
});
export function Auth() {
  const location = useLocation();
  const registering = location.pathname === "/register";
  const navigate = useNavigate();
  const setUser = useStore((s) => s.setUser);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<z.infer<typeof authSchema>>({
    resolver: zodResolver(
      registering
        ? authSchema.refine((v) => v.name.trim().length >= 2, {
            path: ["name"],
            message: "Enter your name",
          })
        : authSchema,
    ),
    defaultValues: { name: "", email: "", password: "" },
  });
  const destination =
    (location.state as { from?: string })?.from || "/dashboard";
  async function demo(role: "user" | "admin") {
    setBusy(true);
    try {
      const u = await service.demoLogin(role);
      setUser(u);
      navigate(role === "admin" ? "/admin" : destination, { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-art">
        <span className="eyebrow">AERÉ / A HIGHER PERSPECTIVE</span>
        <h1>
          Every journey
          <br />
          starts with
          <br />
          <em>possibility.</em>
        </h1>
        <p>Your world. A little more within reach.</p>
      </div>
      <div className="auth-form">
        <span className="eyebrow copper-text">YOUR NEXT CHAPTER</span>
        <h1>{registering ? "Join the journey." : "Welcome back."}</h1>
        <p>
          {registering
            ? "Create an account to start exploring."
            : "Sign in to bring your journeys together."}
        </p>
        <DemoNote />
        <form
          onSubmit={handleSubmit(async (data) => {
            setBusy(true);
            setError("");
            try {
              const u = registering
                ? await service.register(data)
                : await service.login(data.email, data.password);
              setUser(u);
              navigate(
                u.status === "pending"
                  ? "/pending"
                  : u.status === "rejected"
                    ? "/pending"
                    : destination,
                { replace: true },
              );
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          })}
          noValidate
        >
          {registering && (
            <label>
              Full name
              <input {...register("name")} autoComplete="name" />
              {errors.name && <em>{errors.name.message}</em>}
            </label>
          )}
          <label>
            Email address
            <input {...register("email")} type="email" autoComplete="email" />
            {errors.email && <em>{errors.email.message}</em>}
          </label>
          <label>
            Password
            <input
              {...register("password")}
              type="password"
              autoComplete={registering ? "new-password" : "current-password"}
            />
            {errors.password && <em>{errors.password.message}</em>}
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button disabled={busy} className="button full">
            {busy ? "Please wait…" : registering ? "Create account" : "Sign in"}
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="auth-switch">
          {registering ? "Already have an account?" : "New to AERÉ?"}{" "}
          <Link to={registering ? "/login" : "/register"}>
            {registering ? "Sign in" : "Create an account"}
          </Link>
        </p>
        {DEMO && (
          <div className="demo-access">
            <strong>Explore the working demo</strong>
            <p>No credentials needed. Use fictional information.</p>
            <button
              className="button outline"
              disabled={busy}
              onClick={() => demo("user")}
            >
              Demo traveller <ArrowRight size={14} />
            </button>
            <button
              className="text-link"
              disabled={busy}
              onClick={async () => {
                setError("");
                try {
                  const u = await service.demoResume(getValues().email);
                  setUser(u);
                  navigate(u.status === "approved" ? destination : "/pending");
                } catch (e) {
                  setError(errorMessage(e));
                }
              }}
            >
              Resume a registered demo account →
            </button>
            <button
              className="text-link"
              disabled={busy}
              onClick={() => demo("admin")}
            >
              Open demo administration →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
export function Pending() {
  const user = useStore((s) => s.user);
  return (
    <main className="page narrow">
      <div className="panel empty">
        <div className="icon-circle">
          <Clock3 />
        </div>
        <span className="eyebrow copper-text">ACCOUNT REVIEW</span>
        <h1>
          {user?.status === "rejected"
            ? "Account not approved."
            : user?.status === "approved"
              ? "You’re ready to explore."
              : "Good journeys take a moment."}
        </h1>
        <p>
          {user?.status === "approved"
            ? "Your account is active. You can now access booking features."
            : user?.status === "rejected"
              ? "Your registration was not approved. Contact your administrator for assistance."
              : "Your registration is awaiting administrator approval. Booking features become available after your account is approved."}
        </p>
        {DEMO && (
          <p>
            This is a demo approval state. Administrators can review sample
            registrations in the demo console.
          </p>
        )}
        <Link
          className="button"
          to={user?.status === "approved" ? "/flights" : "/login"}
        >
          {user?.status === "approved" ? "Find a flight" : "Return to sign in"}
        </Link>
      </div>
    </main>
  );
}
export function Trips({ dashboard = false }: { dashboard?: boolean }) {
  const user = useStore((s) => s.user);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Upcoming");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    service
      .bookings()
      .then(setBookings)
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [retry]);
  const filtered = bookings.filter((b) =>
    tab === "All" || tab === "Cancelled"
      ? tab === "All" || b.status === "Cancelled"
      : b.status !== "Cancelled" &&
        (tab === "Upcoming"
          ? b.flights[0].date >= dateAfter(0)
          : b.flights[0].date < dateAfter(0)),
  );
  return (
    <main className="page wrap">
      <DemoNote />
      <div className="page-heading">
        <div>
          <span className="eyebrow copper-text">
            YOUR PERSONAL DEPARTURE LOUNGE
          </span>
          <h1>
            {dashboard
              ? `Welcome, ${user?.name.split(" ")[0]}.`
              : "Your journeys, together."}
          </h1>
          <p>A little organisation. A lot to look forward to.</p>
        </div>
        <Link to="/flights" className="button">
          Plan a journey <ArrowRight size={16} />
        </Link>
      </div>
      {dashboard && (
        <div className="stat-grid">
          <div className="stat">
            <Plane />
            <small>UPCOMING JOURNEYS</small>
            <b>
              {
                bookings.filter(
                  (b) =>
                    b.flights[0].date >= dateAfter(0) &&
                    b.status !== "Cancelled",
                ).length
              }
            </b>
          </div>
          <div className="stat">
            <Luggage />
            <small>ALL BOOKINGS</small>
            <b>{bookings.length}</b>
          </div>
          <Link className="stat" to="/profile">
            <UserRound />
            <small>YOUR ACCOUNT</small>
            <b className="text-stat">
              Profile <ArrowRight size={18} />
            </b>
          </Link>
        </div>
      )}
      <div className="tabs">
        {["Upcoming", "Previous", "Cancelled", "All"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={() => setRetry((x) => x + 1)} />
      ) : filtered.length ? (
        filtered.map((b) => (
          <article className="trip-card panel" key={b.id}>
            <div className="row">
              <span className="eyebrow">{b.reference}</span>
              <span className="badge">
                {b.demo ? "Demo · " : ""}
                {b.status}
              </span>
            </div>
            <h2>
              {city(b.flights[0].origin)} <ArrowRight size={24} />{" "}
              {city(b.flights[0].destination)}
            </h2>
            <p>
              {prettyDate(b.flights[0].date)} · {b.flights[0].number} ·{" "}
              {b.passengers.length} traveller(s)
            </p>
            <div className="trip-line">
              <b>
                {b.flights[0].departure} {b.flights[0].origin}
              </b>
              <span />
              <Plane size={18} />
              <span />
              <b>
                {b.flights[0].arrival} {b.flights[0].destination}
              </b>
            </div>
            <div className="row">
              <small>
                Payment: {b.paymentStatus} · {money(b.total)}
              </small>
              <Link className="text-link" to={"/trips/" + b.id}>
                View booking <ArrowRight size={16} />
              </Link>
            </div>
          </article>
        ))
      ) : (
        <div className="empty panel">
          <Luggage size={38} />
          <h2>Your next chapter is unwritten.</h2>
          <p>
            No {tab.toLowerCase()} bookings yet. Let’s find somewhere worth
            going.
          </p>
          <Link className="button" to="/flights">
            Explore flights <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </main>
  );
}
export function TripDetails() {
  const { id } = useParams();
  const [b, setB] = useState<Booking>();
  const [error, setError] = useState("");
  useEffect(() => {
    service
      .booking(id!)
      .then(setB)
      .catch((e) => setError(errorMessage(e)));
  }, [id]);
  return (
    <main className="page narrow">
      <DemoNote />
      <Link className="text-link" to="/trips">
        ← My Trips
      </Link>
      {error ? (
        <ErrorState message={error} />
      ) : !b ? (
        <Loading />
      ) : (
        <>
          <h1>{b.reference}</h1>
          <p>
            {b.status} · Payment {b.paymentStatus} · {money(b.total)}
          </p>
          {b.flights.map((f) => (
            <FlightCard flight={f} key={f.id} />
          ))}
          <div className="panel">
            <h2>Travellers</h2>
            {b.passengers.map((p, i) => (
              <p key={i}>
                {p.firstName} {p.lastName} · {p.email}
              </p>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
export function Profile() {
  const user = useStore((s) => s.user)!;
  const setUser = useStore((s) => s.setUser);
  const [name, setName] = useState(user.name);
  const [saved, setSaved] = useState(false);
  return (
    <main className="page narrow">
      <DemoNote />
      <h1>Your profile.</h1>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          if (DEMO) {
            setUser({ ...user, name });
            setSaved(true);
          }
        }}
      >
        <label>
          Display name
          <input
            required
            minLength={2}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
          />
        </label>
        <label>
          Email
          <input value={user.email} readOnly />
        </label>
        <p>
          Account: {user.status} · Role: {user.role}
        </p>
        <button className="button" disabled={!DEMO}>
          Save demo profile
        </button>
        {saved && (
          <p role="status">
            <CheckCircle2 size={16} /> Profile updated for this session.
          </p>
        )}
        {!DEMO && <p>Profile updates require a configured backend endpoint.</p>}
      </form>
    </main>
  );
}
export function FlightStatus() {
  const [query, setQuery] = useState("");
  const [flight, setFlight] = useState<Flight>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="page narrow">
      <DemoNote />
      <span className="eyebrow copper-text">A CLEARER PICTURE</span>
      <h1>Flight status.</h1>
      <p>
        Look up a flight by its booking flight ID.{" "}
        {DEMO
          ? "All status information shown here is sample data."
          : "Status comes from the connected backend."}
      </p>
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setFlight(undefined);
          try {
            setFlight(await service.flight(query));
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Flight ID
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
            placeholder="Copy a flight ID from the details URL"
          />
        </label>
        <button className="button" disabled={busy}>
          {busy ? "Checking…" : "Check status"} <ArrowRight size={16} />
        </button>
      </form>
      {error && <ErrorState message={error} />}{" "}
      {flight && (
        <>
          <FlightCard flight={flight} />
          <p>
            {flight.updatedAt
              ? "Last updated: " + new Date(flight.updatedAt).toLocaleString()
              : DEMO
                ? "Sample status · no live connection"
                : "Update time not supplied by backend"}
          </p>
        </>
      )}
    </main>
  );
}
