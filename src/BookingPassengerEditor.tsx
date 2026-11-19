import { useState, type FormEvent } from "react";
import { errorMessage, service } from "./api";
import { passengerSchema, type Booking } from "./domain";
import { Notice } from "./Notice";

export function BookingPassengerEditor({
  booking,
  admin,
  onCancel,
  onSave,
}: {
  booking: Booking;
  admin: boolean;
  onCancel: () => void;
  onSave: (booking: Booking) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const passengers = booking.passengers.map((_, i) => {
      return passengerSchema.safeParse(
        Object.fromEntries(
          (["firstName", "lastName", "email", "birthDate"] as const).map(
            (key) => [key, values.get(`${i}.${key}`)],
          ),
        ),
      );
    });
    const invalid = passengers.find((item) => !item.success);
    if (invalid && !invalid.success) {
      setError(invalid.error.issues[0].message);
      return;
    }
    setError("");
    setBusy(true);
    try {
      const details = passengers.flatMap((item) =>
        item.success ? [item.data] : [],
      );
      onSave(await service.updateBooking(booking.id, details, admin));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      {error && <Notice message={error} />}
      {booking.passengers.map((passenger, i) => (
        <fieldset key={i} disabled={busy}>
          <legend>Traveller {i + 1}</legend>
          <div className="form-grid">
            <label>
              First name
              <input
                name={`${i}.firstName`}
                defaultValue={passenger.firstName}
                required
                maxLength={80}
              />
            </label>
            <label>
              Last name
              <input
                name={`${i}.lastName`}
                defaultValue={passenger.lastName}
                required
                maxLength={80}
              />
            </label>
            <label>
              Email address
              <input
                name={`${i}.email`}
                type="email"
                defaultValue={passenger.email}
                required
              />
            </label>
            <label>
              Date of birth
              <input
                name={`${i}.birthDate`}
                type="date"
                defaultValue={passenger.birthDate}
                required
              />
            </label>
          </div>
        </fieldset>
      ))}
      <div className="actions">
        <button type="submit" className="button" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          className="button outline"
          disabled={busy}
          onClick={onCancel}
        >
          Discard changes
        </button>
      </div>
    </form>
  );
}
