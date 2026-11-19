import { useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage, service } from "./api";
import type { Booking, User } from "./domain";
import { Notice } from "./Notice";

export function CustomerEditor({
  user,
  onSaved,
}: {
  user: User;
  onSaved: (updated: User) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<Booking[]>();
  return (
    <>
      {error && <Notice message={error} />}
      {saved && <Notice tone="success" message="Customer details saved." />}
      {user.role === "user" && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setError("");
            setSaved(false);
            setBusy(true);
            try {
              onSaved(
                await service.updateCustomer(user.id, {
                  name: String(form.get("name") ?? ""),
                  phone: String(form.get("phone") ?? ""),
                  is_active: form.has("active"),
                }),
              );
              setSaved(true);
            } catch (failure) {
              setError(errorMessage(failure));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Name
            <input
              name="name"
              defaultValue={user.name}
              required
              maxLength={150}
            />
          </label>
          <label>
            Phone
            <input name="phone" defaultValue={user.phone} maxLength={32} />
          </label>
          <label className="check">
            <input
              name="active"
              type="checkbox"
              defaultChecked={user.is_active !== false}
            />{" "}
            Active account
          </label>
          <button className="button" disabled={busy}>
            Save customer
          </button>
        </form>
      )}
      <button
        type="button"
        className="text-link"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            setHistory(await service.bookings(true, { user: user.id }));
          } catch (failure) {
            setError(errorMessage(failure));
          } finally {
            setBusy(false);
          }
        }}
      >
        View booking history
      </button>
      {history &&
        (history.length ? (
          <ul>
            {history.map((booking) => (
              <li key={booking.id}>
                <Link to={"/trips/" + booking.id + "?admin=1"}>
                  {booking.reference} · {booking.status}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>No bookings for this customer.</p>
        ))}
    </>
  );
}
