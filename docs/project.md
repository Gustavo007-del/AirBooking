# Air Booking project guide

Air Booking is a flight reservation demo with a 3D landing page, airport and destination browsing, flight search, trip management, and an administrator dashboard. AirLabs can supply schedule and status data. Fares, seat inventory, reservations, and payments are part of the simulation.

## Run locally

Follow the [README setup](../README.md) to install dependencies, create the backend environment file, migrate the SQLite database, seed demo data, and start both servers. The React site runs on port 5173 and Django runs on port 8000 by default. Vite proxies requests under `/api` to Django.

Use `python manage.py setup_demo_flights` from `backend` to import airports and add sample departures. The airport download needs internet access. To seed sample flights and their airports offline, use `python manage.py seed_demo_flights --confirm-demo`. For optional AirLabs, SMTP, PostgreSQL, and Celery settings, see the [backend guide](../backend/README.md).

## Walk through a reservation

1. Register a customer through the website or use the pending demo account from the README.
2. Sign in as an administrator in a separate browser profile, open **Users**, and approve the pending account. With the default development settings, approval emails appear in the Django terminal.
3. Sign in as the approved customer. Search for a seeded route such as Delhi (DEL) to London Heathrow (LHR), using a departure roughly two weeks after seeding.
4. Select a flight and enter passenger details. Django calculates the fare and holds seats for 15 minutes by default. A successful simulated payment confirms the booking.
5. Open **My Trips** to view the booking or cancel an eligible trip. Cancellation, expiry, and failed payment release reserved seats. Use **Flight status** for live flight-number lookup when AirLabs is configured.

## Project structure

| Location | Responsibility |
| --- | --- |
| `src/main.tsx`, `src/api.ts`, `src/store.ts` | React routing, the HTTP client, and application state |
| `src/Flights.tsx`, `src/Booking.tsx`, `src/Account.tsx`, `src/Admin.tsx` | Flight search, booking, account and trip management, and the administrator dashboard |
| `src/scenes/`, `public/`, `assets-source/` | React Three Fiber scenes, browser assets, and editable Blender sources |
| `backend/config/`, `backend/common/` | Django settings and URLs, Celery configuration, and shared API behavior |
| `backend/apps/accounts/`, `backend/apps/flights/` | Registration and approvals, flight inventory, route and airport catalogues, and schedule search |
| `backend/apps/bookings/`, `backend/apps/payments/`, `backend/apps/flight_tracking/` | Seat holds, simulated transactions, and status lookups |

## API reference

Send JSON for request bodies and include `Authorization: Bearer <access_token>` on protected requests. Public catalogue reads, registration, and sign-in are available without a token. Flight search and customer bookings require an approved account. Administrative endpoints require an administrator. Browser sign-in uses the `X-Air-Session: 1` header to set an HttpOnly refresh cookie.

| Method and path | Purpose |
| --- | --- |
| `POST /api/auth/register/`, `POST /api/auth/login/` | Create a pending account or sign in and receive tokens |
| `POST /api/auth/session/`, `DELETE /api/auth/session/` | Restore or end a browser session with `X-Air-Session: 1` |
| `GET /api/auth/me/`, `PATCH /api/auth/me/` | Read or update your profile |
| `GET /api/airports/`, `GET /api/routes/`, `GET /api/destinations/` | Browse the public catalogue |
| `GET /api/flights/search/` | Search using `origin`, `destination` and `departure` in YYYY-MM-DD format. Round-trip search uses `type=round` and `returnDate`. |
| `GET /api/flights/{id}/`, `GET /api/flights/{id}/status/` | Read a flight or its recorded status |
| `GET /api/flights/live-status/`, `GET /api/flights/schedules/` | Look up an AirLabs flight by `number` or request a live schedule by route and departure date |
| `GET /api/bookings/`, `POST /api/bookings/` | List your trips or reserve seats |
| `GET /api/bookings/{id}/`, `PATCH /api/bookings/{id}/` | Read a trip or update its passenger details |
| `POST /api/bookings/{id}/payment/` | Submit a simulated payment with `outcome` set to `success` or `failure` and `signal_at` set to a timestamp or `null` |
| `POST /api/bookings/{id}/cancel/`, `GET /api/bookings/{id}/status/` | Cancel an eligible trip or read its flight status |
| `/api/admin/` | Administrator routes for users, flights, bookings, airports, routes, and the dashboard |

To create a booking, send one or two flight UUIDs in `flight_ids`, a `cabin`, and a `passengers` array with each traveller's `firstName`, `lastName`, `email`, and `birthDate`. Send an `Idempotency-Key` header and reuse that key when retrying the same request. A new reservation returns HTTP 201 and a successful replay returns HTTP 200.

Paginated endpoints accept `page` and `page_size`. API errors generally include `detail`, `code`, and `errors`. The backend stores prices as decimals and uses UTC for timestamps.

## Run checks

From the project root, run `npm test` and `npm run build`. The build output goes to `dist/`.

From `backend`, with the virtual environment active, run:

```text
python manage.py check
python manage.py test tests --settings=config.test_settings --noinput
```

Tests use an isolated SQLite database by default. Set `TEST_DATABASE_URL` to a test PostgreSQL database to run the PostgreSQL concurrency cases.
