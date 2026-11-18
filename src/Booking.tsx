import { useEffect, useRef, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Check, CheckCircle2, ArrowRight, LockKeyhole } from "lucide-react";
import {
  DEMO,
  city,
  money,
  passengerSchema,
  prettyDate,
  type Flight,
  type Passenger,
  type Booking as BookingType,
} from "./domain";
import { useStore } from "./store";
import { service, errorMessage } from "./api";
import { DemoNote, ErrorState, FlightCard, Loading } from "./components";
const schema = z.object({ passengers: z.array(passengerSchema).min(1) });
export default function Booking() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const back = params.get("return");
  const search = useStore((s) => s.search);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const key = useRef(crypto.randomUUID());
  const navigate = useNavigate();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<{ passengers: Passenger[] }>({
    resolver: zodResolver(schema),
    defaultValues: {
      passengers: Array.from({ length: search.passengers }, () => ({
        firstName: "",
        lastName: "",
        email: "",
        birthDate: "",
      })),
    },
  });
  const { fields } = useFieldArray({ control, name: "passengers" });
  useEffect(() => {
    Promise.all([service.flight(id!), ...(back ? [service.flight(back)] : [])])
      .then(setFlights)
      .catch((e) => setError(errorMessage(e)));
  }, [id, back]);
  const total = flights.reduce((s, f) => s + f.price, 0) * fields.length;
  async function pay() {
    setBusy(true);
    setError("");
    try {
      const booking = await service.book(
        flights,
        getValues().passengers,
        key.current,
      );
      navigate("/confirmation/" + booking.id, { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page wrap">
      <DemoNote />
      <div className="page-heading">
        <div>
          <span className="eyebrow copper-text">
            A FEW STEPS TO SOMEWHERE NEW
          </span>
          <h1>Your journey starts here.</h1>
        </div>
        <LockKeyhole size={25} />
      </div>
      <ol className="steps">
        {["Your flights", "Travellers", "Review", "Payment"].map((label, i) => (
          <li
            key={label}
            className={i === step ? "active" : i < step ? "done" : ""}
          >
            <span>{i < step ? <Check size={14} /> : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      {error && <ErrorState message={error} />}{" "}
      {!flights.length && !error ? (
        <Loading />
      ) : (
        <div className="booking-layout">
          <section>
            {step === 0 && (
              <>
                <h2>A little closer to take-off.</h2>
                {flights.map((f) => (
                  <FlightCard key={f.id} flight={f} />
                ))}
                <button
                  className="button"
                  onClick={() => setStep(1)}
                  disabled={!flights.length}
                >
                  Continue to travellers <ArrowRight size={16} />
                </button>
              </>
            )}
            {step === 1 && (
              <form
                className="panel"
                onSubmit={handleSubmit(() => setStep(2))}
                noValidate
              >
                <h2>Who’s coming along?</h2>
                <p>
                  Use names exactly as shown on your travel documents. In demo
                  mode, use fictional details.
                </p>
                {fields.map((f, i) => (
                  <fieldset key={f.id}>
                    <legend>Traveller {i + 1}</legend>
                    <div className="form-grid">
                      {(
                        ["firstName", "lastName", "email", "birthDate"] as const
                      ).map((k) => (
                        <label key={k}>
                          {
                            {
                              firstName: "First name",
                              lastName: "Last name",
                              email: "Email address",
                              birthDate: "Date of birth",
                            }[k]
                          }{" "}
                          *
                          <input
                            type={
                              k === "birthDate"
                                ? "date"
                                : k === "email"
                                  ? "email"
                                  : "text"
                            }
                            {...register(`passengers.${i}.${k}`)}
                            autoComplete="off"
                          />
                          {errors.passengers?.[i]?.[k] && (
                            <em>{errors.passengers[i]![k]!.message}</em>
                          )}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
                <div className="actions">
                  <button
                    type="button"
                    className="button outline"
                    onClick={() => setStep(0)}
                  >
                    Back
                  </button>
                  <button className="button">
                    Review journey <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            )}
            {step === 2 && (
              <div className="panel">
                <h2>Every detail, in one place.</h2>
                {flights.map((f) => (
                  <div className="review-leg" key={f.id}>
                    <span className="eyebrow">
                      {prettyDate(f.date)} · {f.number}
                    </span>
                    <h3>
                      {city(f.origin)} → {city(f.destination)}
                    </h3>
                    <p>
                      {f.departure} — {f.arrival}
                      {f.arrivalDay ? " (+1 day)" : ""}
                    </p>
                  </div>
                ))}
                <h3>Your travellers</h3>
                {getValues().passengers.map((p, i) => (
                  <p key={i}>
                    {p.firstName} {p.lastName} · {p.email}
                  </p>
                ))}
                <div className="actions">
                  <button className="button outline" onClick={() => setStep(1)}>
                    Edit travellers
                  </button>
                  <button className="button" onClick={() => setStep(3)}>
                    Continue to payment <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="panel">
                <div className="icon-circle">
                  <LockKeyhole />
                </div>
                <h2>
                  {DEMO ? "Try the final step." : "Complete your reservation."}
                </h2>
                <p>
                  {DEMO
                    ? "This is a payment simulation. No card details are requested, no payment is taken, and no real ticket is issued."
                    : "Submit your booking to the connected service. Payment status is determined by the backend; a real payment provider is not configured in this frontend."}
                </p>
                <div className="demo-payment">
                  <span>PAYMENT METHOD</span>
                  <h3>
                    {DEMO ? "Demonstration payment" : "Backend reservation"}
                  </h3>
                  <small>
                    {DEMO
                      ? "No financial information required"
                      : "No card collection available"}
                  </small>
                  <CheckCircle2 />
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  {DEMO
                    ? "I understand this creates a demo booking only."
                    : "I have reviewed the passenger and journey details."}
                </label>
                <div className="actions">
                  <button
                    className="button outline"
                    disabled={busy}
                    onClick={() => setStep(2)}
                  >
                    Back
                  </button>
                  <button
                    className="button"
                    disabled={!consent || busy}
                    onClick={pay}
                  >
                    {busy
                      ? "Processing…"
                      : DEMO
                        ? "Complete simulation"
                        : "Submit booking"}{" "}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </section>
          <aside className="panel booking-summary">
            <span className="eyebrow copper-text">YOUR ITINERARY</span>
            <h3>
              {city(flights[0]?.origin || "")} →{" "}
              {city(flights[0]?.destination || "")}
            </h3>
            <p>
              {flights.length === 2 ? "Round trip" : "One way"} ·{" "}
              {fields.length} traveller{fields.length > 1 ? "s" : ""}
            </p>
            {flights.map((f, i) => (
              <div className="price-row" key={f.id}>
                <span>
                  {i ? "Return" : "Outbound"} × {fields.length}
                </span>
                <strong>{money(f.price * fields.length)}</strong>
              </div>
            ))}
            <div className="price-row">
              <span>Additional fees</span>
              <strong>{money(0)}</strong>
            </div>
            <div className="price-row total">
              <span>Total</span>
              <strong>{money(total)}</strong>
            </div>
            <small>
              {DEMO
                ? "Illustrative fare, including demo taxes. No real fare availability is represented."
                : "Final pricing is validated by the backend when submitted."}
            </small>
          </aside>
        </div>
      )}
    </main>
  );
}
export function Confirmation() {
  const { id } = useParams();
  const [booking, setBooking] = useState<BookingType>();
  const [error, setError] = useState("");
  useEffect(() => {
    service
      .booking(id!)
      .then(setBooking)
      .catch((e) => setError(errorMessage(e)));
  }, [id]);
  return (
    <main className="page narrow">
      <DemoNote />
      {error ? (
        <ErrorState message={error} />
      ) : !booking ? (
        <Loading />
      ) : (
        <>
          <div className="confirmation">
            <CheckCircle2 size={46} />
            <span className="eyebrow">
              {booking.demo ? "SIMULATION COMPLETE" : "BOOKING RECEIVED"}
            </span>
            <h1>
              {booking.demo
                ? "Your demo journey is ready."
                : "Your journey, all together."}
            </h1>
            <p>
              {booking.demo
                ? "No payment was taken and no real ticket was issued."
                : "Your reservation status is shown below."}
            </p>
            <div className="reference">{booking.reference}</div>
            <p>
              {booking.status} · Payment: {booking.paymentStatus}
            </p>
          </div>
          {booking.flights.map((f) => (
            <FlightCard key={f.id} flight={f} />
          ))}
          <div className="panel">
            <h3>Travellers</h3>
            {booking.passengers.map((p, i) => (
              <p key={i}>
                {p.firstName} {p.lastName}
              </p>
            ))}
            <strong>Total: {money(booking.total)}</strong>
          </div>
          <Link className="button" to="/trips">
            Go to My Trips <ArrowRight size={17} />
          </Link>
        </>
      )}
    </main>
  );
}
