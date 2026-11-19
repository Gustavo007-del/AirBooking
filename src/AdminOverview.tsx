import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Booking, FlightSearchSource, User } from "./domain";

export interface OperationsSnapshot {
  pending_approvals: number;
  active_reservations: number;
  airlabs_departures: number;
  saved_departures: number;
  approval_queue: User[];
  recent_bookings: {
    id: string;
    reference: string;
    status: Booking["status"];
    payment_status: Booking["paymentStatus"];
    created_at: string;
  }[];
  airlabs_configured: boolean;
  airlabs_status_enabled: boolean;
  email_mode: "console" | "smtp" | "other";
  email_inline: boolean;
  queued_emails: number;
}

export function AdminOverview({
  snapshot,
  reviewApprovals,
  showFlights,
  showBookings,
}: {
  snapshot: OperationsSnapshot;
  reviewApprovals: () => void;
  showFlights: (source: FlightSearchSource) => void;
  showBookings: () => void;
}) {
  const delivery = {
    console: "Console only",
    smtp: "SMTP configured",
    other: "Custom email backend",
  };
  const metrics = [
    {
      label: "Pending approvals",
      value: snapshot.pending_approvals,
      open: reviewApprovals,
    },
    { label: "Open reservations", value: snapshot.active_reservations },
    {
      label: "Upcoming AirLabs departures",
      value: snapshot.airlabs_departures,
      open: () => showFlights("airlabs_routes"),
    },
    {
      label: "Upcoming saved departures",
      value: snapshot.saved_departures,
      open: () => showFlights("database"),
    },
  ];
  return (
    <>
      <div className="stat-grid four">
        {metrics.map(({ label, value, open }) =>
          open ? (
            <button className="stat admin-stat-link" key={label} onClick={open}>
              <small>{label}</small>
              <b>{value}</b>
              <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <div className="stat" key={label}>
              <small>{label}</small>
              <b>{value}</b>
            </div>
          ),
        )}
      </div>
      <div className="admin-overview">
        <section className="panel">
          <div className="row admin-panel-heading">
            <h2>Approval queue</h2>
            {snapshot.pending_approvals > 0 && (
              <button className="text-link" onClick={reviewApprovals}>
                Review pending <ArrowUpRight size={15} />
              </button>
            )}
          </div>
          {snapshot.approval_queue.length ? (
            <ul className="admin-activity">
              {snapshot.approval_queue.map(({ id, name, email }) => (
                <li key={id}>
                  <strong>{name}</strong>
                  <small>{email}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p>No customers waiting for approval.</p>
          )}
        </section>
        <section className="panel">
          <div className="row admin-panel-heading">
            <h2>Recent bookings</h2>
            <button className="text-link" onClick={showBookings}>
              All bookings <ArrowUpRight size={15} />
            </button>
          </div>
          {snapshot.recent_bookings.length ? (
            <ul className="admin-activity">
              {snapshot.recent_bookings.map((booking) => (
                <li key={booking.id}>
                  <div className="row">
                    <Link
                      className="text-link"
                      to={`/trips/${booking.id}?admin=1`}
                    >
                      {booking.reference}
                    </Link>
                    <span className="badge">{booking.status}</span>
                  </div>
                  <small>
                    {new Date(booking.created_at).toLocaleString()}
                    {booking.payment_status === "Simulated" &&
                      " · Simulated payment"}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p>No bookings yet.</p>
          )}
        </section>
        <section className="panel admin-connections">
          <h2>Service setup</h2>
          <dl>
            <div>
              <dt>Flight search</dt>
              <dd>
                {snapshot.airlabs_configured
                  ? "AirLabs Routes with saved-flight fallback"
                  : "Saved flights"}
              </dd>
            </div>
            <div>
              <dt>Background status updates</dt>
              <dd>
                {snapshot.airlabs_status_enabled
                  ? "AirLabs configured for eligible flights"
                  : "Manual updates"}
              </dd>
            </div>
            <div>
              <dt>Approval email</dt>
              <dd>
                {delivery[snapshot.email_mode]} ·{" "}
                {snapshot.email_inline
                  ? "Inline delivery"
                  : "Background delivery"}
              </dd>
            </div>
            <div>
              <dt>Emails waiting to send</dt>
              <dd>{snapshot.queued_emails}</dd>
            </div>
          </dl>
          <Link className="text-link" to="/status">
            Open flight status lookup <ArrowUpRight size={15} />
          </Link>
        </section>
      </div>
    </>
  );
}
