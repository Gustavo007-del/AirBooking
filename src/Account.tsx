import { useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Plane, Clock3, UserRound, Luggage } from "lucide-react";
import { service, errorMessage, fieldErrors } from "./api";
import { Notice } from "./Notice";
import {
  city,
  dateAfter,
  money,
  prettyDate,
  type Booking,
  type Flight,
  type LiveFlight,
} from "./domain";
import { useStore } from "./store";
import { ErrorState, FlightCard, Loading } from "./components";
import { LiveFlightCard } from "./LiveFlightCard";
import { pollVisible } from "./livePolling";
import { BookingPassengerEditor } from "./BookingPassengerEditor";
const authSchema = z.object({
  name: z.string(),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
const minimumPasswordLength = 8;

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
    setError: setFieldError,
    clearErrors,
    formState: { errors },
  } = useForm<z.infer<typeof authSchema>>({
    resolver: zodResolver(
      registering
        ? authSchema
            .extend({
              password: z
                .string()
                .min(
                  minimumPasswordLength,
                  `Use at least ${minimumPasswordLength} characters`,
                )
                .max(128, "Use no more than 128 characters"),
            })
            .refine((v) => v.name.trim().length >= 2, {
              path: ["name"],
              message: "Enter your name",
            })
        : authSchema,
    ),
    defaultValues: { name: "", email: "", password: "" },
  });
  const destination =
    (
      location.state as {
        from?: string;
      }
    )?.from || "/dashboard";
  useEffect(() => {
    setError("");
    clearErrors();
  }, [registering, clearErrors]);
  return (
    <main className="auth-page">
      <div className="auth-art">
        <span className="eyebrow">AirB / A HIGHER PERSPECTIVE</span>
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
                u.status !== "approved"
                  ? "/pending"
                  : u.role === "admin"
                    ? "/admin"
                    : destination,
                { replace: true },
              );
            } catch (e) {
              setError(errorMessage(e));
              const fields = fieldErrors(e);
              for (const field of ["name", "email", "password"] as const) {
                if (fields[field])
                  setFieldError(field, {
                    type: "server",
                    message: fields[field],
                  });
              }
            } finally {
              setBusy(false);
            }
          })}
          noValidate
        >
          {registering && (
            <label>
              <span id="auth-name-label">Full name</span>
              <input
                {...register("name")}
                autoComplete="name"
                aria-labelledby="auth-name-label"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "auth-name-error" : undefined}
              />
              {errors.name && (
                <em id="auth-name-error">{errors.name.message}</em>
              )}
            </label>
          )}
          <label>
            <span id="auth-email-label">Email address</span>
            <input
              {...register("email")}
              type="email"
              autoComplete="email"
              aria-labelledby="auth-email-label"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "auth-email-error" : undefined}
            />
            {errors.email && (
              <em id="auth-email-error">{errors.email.message}</em>
            )}
          </label>
          <label>
            <span id="auth-password-label">Password</span>
            <input
              {...register("password")}
              type="password"
              autoComplete={registering ? "new-password" : "current-password"}
              aria-labelledby="auth-password-label"
              aria-invalid={!!errors.password}
              aria-describedby={
                errors.password
                  ? "auth-password-error"
                  : registering
                    ? "auth-password-help"
                    : undefined
              }
            />
            {errors.password && (
              <em id="auth-password-error">{errors.password.message}</em>
            )}
            {registering && !errors.password && (
              <small id="auth-password-help" className="field-help">
                Use at least {minimumPasswordLength} characters. Avoid common
                passwords and your name or email address.
              </small>
            )}
          </label>
          {error && (
            <Notice
              title={
                registering
                  ? "We couldn’t create your account yet"
                  : "We couldn’t sign you in"
              }
              message={error}
            />
          )}
          <button disabled={busy} className="button full">
            {busy ? "Please wait…" : registering ? "Create account" : "Sign in"}
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="auth-switch">
          {registering ? "Already have an account?" : "New to Air Booking?"}{" "}
          <Link to={registering ? "/login" : "/register"}>
            {registering ? "Sign in" : "Create an account"}
          </Link>
        </p>
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
  useEffect(
    () =>
      loading || error
        ? undefined
        : pollVisible(() => service.bookings(), setBookings),
    [loading, error],
  );
  useEffect(() => {
    let active = true;
    setError("");
    setLoading(true);
    service
      .bookings()
      .then((value) => {
        if (active) setBookings(value);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
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
                {""}
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
            <p>
              Flight status:{" "}
              {b.flights
                .map((flight) => `${flight.number} ${flight.status}`)
                .join(" · ")}
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
                Payment: {b.paymentStatus} · {money(b.total, b.currency)}
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
  const [params] = useSearchParams();
  const admin = params.get("admin") === "1";
  const [b, setB] = useState<Booking>();
  const [error, setError] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelled, setCancelled] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [editing, setEditing] = useState(false);
  useEffect(
    () =>
      id && !editing && !cancelling
        ? pollVisible(() => service.booking(id, admin), setB)
        : undefined,
    [id, admin, editing, cancelling],
  );
  useEffect(() => {
    let active = true;
    setB(undefined);
    setError("");
    setCancelError("");
    setConfirmCancel(false);
    setCancelled(false);
    setEditing(false);
    service
      .booking(id!, admin)
      .then((value) => {
        if (active) setB(value);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [id, admin]);
  return (
    <main className="page narrow">
      <Link className="text-link" to={admin ? "/admin" : "/trips"}>
        {admin ? "← Administration" : "← My Trips"}
      </Link>
      {error ? (
        <ErrorState message={error} />
      ) : !b ? (
        <Loading />
      ) : (
        <>
          <h1>{b.reference}</h1>
          <p>
            {b.status} · Payment {b.paymentStatus} ·{" "}
            {money(b.total, b.currency)}
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
            {b.status === "Pending" &&
              (!editing ? (
                <button
                  type="button"
                  className="button outline"
                  onClick={() => setEditing(true)}
                >
                  Edit passenger details
                </button>
              ) : (
                <BookingPassengerEditor
                  booking={b}
                  admin={admin}
                  onCancel={() => setEditing(false)}
                  onSave={(value) => {
                    setB(value);
                    setEditing(false);
                  }}
                />
              ))}
          </div>
          {cancelError && <Notice message={cancelError} />}
          {cancelled && (
            <Notice
              tone="success"
              message="Reservation cancelled and seats released."
            />
          )}
          {b.status !== "Cancelled" &&
            (confirmCancel ? (
              <div className="panel">
                <Notice
                  tone="warning"
                  title="Cancel this booking?"
                  message="This will release the reserved seats."
                />
                <div className="actions">
                  <button
                    type="button"
                    disabled={cancelling}
                    className="button"
                    onClick={async () => {
                      setCancelling(true);
                      setCancelError("");
                      try {
                        setB(await service.cancelBooking(b.id, admin));
                        setConfirmCancel(false);
                        setCancelled(true);
                      } catch (failure) {
                        setCancelError(errorMessage(failure));
                      } finally {
                        setCancelling(false);
                      }
                    }}
                  >
                    {cancelling ? "Cancelling…" : "Confirm cancellation"}
                  </button>
                  <button
                    type="button"
                    disabled={cancelling}
                    className="button outline"
                    onClick={() => setConfirmCancel(false)}
                  >
                    Keep booking
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="button outline"
                onClick={() => setConfirmCancel(true)}
              >
                Cancel booking
              </button>
            ))}
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="page narrow">
      <h1>Your profile.</h1>
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setError("");
          setSaved(false);
          try {
            setUser(await service.profile(name));
            setSaved(true);
          } catch (error) {
            setError(errorMessage(error));
          } finally {
            setSaving(false);
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
        <button className="button" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </button>
        {saved && (
          <Notice
            tone="success"
            title="Profile updated"
            message="Your changes have been saved."
          />
        )}
        {error && <ErrorState message={error} />}
      </form>
    </main>
  );
}
export function FlightStatus() {
  const [query, setQuery] = useState("");
  const [flight, setFlight] = useState<Flight>();
  const [live, setLive] = useState<LiveFlight>();
  const [tracked, setTracked] = useState<{
    value: string;
    type: "id" | "number";
  }>();
  const [stale, setStale] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!tracked) return;
    const failed = () => setStale(true);
    if (tracked.type === "id")
      return pollVisible(
        () => service.flight(tracked.value),
        (value) => {
          setFlight(value);
          setStale(false);
        },
        failed,
      );
    return pollVisible(
      () => service.liveFlight(tracked.value),
      (value) => {
        setLive(value);
        setStale(false);
      },
      failed,
      60_000,
    );
  }, [tracked]);
  return (
    <main className="page narrow">
      <span className="eyebrow copper-text">A CLEARER PICTURE</span>
      <h1>Flight status.</h1>
      <p>
        Enter an airline flight number such as BA178, or the flight ID from your
        booking. A flight number returns the occurrence AirLabs currently
        reports.
      </p>
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setFlight(undefined);
          setLive(undefined);
          setTracked(undefined);
          setStale(false);
          try {
            const value = query.trim().replace(/\s+/g, "");
            if (/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)) {
              const id = value.toLowerCase();
              setFlight(await service.flight(id));
              setTracked({ value: id, type: "id" });
            } else {
              const number = value.toUpperCase();
              setLive(await service.liveFlight(number));
              setTracked({ value: number, type: "number" });
            }
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Flight number or ID
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
            placeholder="BA178 or a booking flight ID"
          />
        </label>
        <button className="button" disabled={busy}>
          {busy ? "Checking…" : "Check status"} <ArrowRight size={16} />
        </button>
      </form>
      {error && <ErrorState message={error} />}{" "}
      {stale && (
        <Notice
          tone="warning"
          message="Refresh unavailable. Showing the last successful update."
        />
      )}
      {live && <LiveFlightCard flight={live} />}
      {flight && (
        <>
          <FlightCard flight={flight} />
          <p>
            {flight.updatedAt
              ? "Last updated: " + new Date(flight.updatedAt).toLocaleString()
              : "Update time not supplied by backend"}
            {flight.status_source === "airlabs"
              ? " · AirLabs"
              : " · Recorded status"}
          </p>
        </>
      )}
    </main>
  );
}
