# Air Booking backend

Django runs the API for the React website. Local development uses SQLite. The app stores accounts, flights, bookings, and simulated payments.

**Run locally**

1. Install [Python 3.12](https://www.python.org/downloads/) and check `python --version`.
2. Open a terminal in the project folder and run `cd backend`.
3. Run `python -m venv venv`. On Windows, if `python` points to another version and the Python launcher has 3.12 installed, run `py -3.12 -m venv venv` instead.
4. Activate the environment. In PowerShell, run `.\venv\Scripts\Activate.ps1`. In Command Prompt, run `venv\Scripts\activate.bat`. On macOS or Linux, run `source venv/bin/activate`.
5. Install dependencies with `python -m pip install -r requirements.lock.txt`.
6. Create `.env` from the example. From `backend`, run `Copy-Item .env.example .env` in PowerShell, `copy .env.example .env` in Command Prompt, or `cp .env.example .env` on macOS or Linux. Skip this step if you already have a `.env` file.
7. Generate a Django secret with `python -c "import secrets; print(secrets.token_urlsafe(64))"`.
8. Open `.env` and replace the placeholder after `DJANGO_SECRET_KEY=` with the generated value. Save the file and keep it private.
9. Run `python manage.py migrate`.
10. Run `python manage.py seed_demo_data` to create the demo accounts, or `python manage.py createsuperuser` to create your own administrator. The credentials are under **Demo accounts** in the [project README](../README.md).
11. To try searching and booking without AirLabs, run `python manage.py setup_demo_flights`.
12. Run `python manage.py runserver`. The API listens on port 8000 and the database is saved as `backend/db.sqlite3`. 
Strat the frontend separately using
**Start the website**

1. Open a second terminal in the project folder containing `package.json`.its the root folder.
2. Install dependencies with `npm ci`.
3. Start the site with `npm run dev`.
4. Open [Air Booking](http://localhost:5173), or use the address printed in the terminal. If PowerShell blocks npm's script, use `npm.cmd ci` and `npm.cmd run dev`.

Next time, activate the backend environment, run `python manage.py runserver` from `backend`, and run `npm run dev` from the project folder.  Your data stays in the local database.
Press Ctrl+C in each terminal to stop it.
**Demo accounts**

Use the email address as the username. Run the seed only on your local development database with `DEBUG=true`.
This is the Admin credentials for testing
| Account          | Email                      | Password      |
| ---              | ---                        | ---           |
| Demo Admin       | `admin@airbooking.test`    | `CloudRun42!` |
| Demo Approved    | `approved@airbooking.test` | `BlueWing42!` |
| Demo Pending     | `pending@airbooking.test`  | `GateHold42!` |

The account seed creates only accounts. You can rerun it safely. If an email already exists, the command keeps that account, including its current password, role, and approval status. The approved customer can use search and booking immediately. Flight results come from AirLabs or from saved flights, including the sample flights added by `setup_demo_flights`.



If activation fails in PowerShell, use Command Prompt or substitute `.\venv\Scripts\python.exe` for `python`. After the first setup, activate the environment and start the server. Run migrations again when database changes are added.

**Airports, search, and flight status**

- Run `python manage.py setup_demo_flights` with `DEBUG=true`. It downloads the OurAirports catalogue for airport, city, state, and country suggestions, and adds sample flights for the next 30 days. The download needs internet access. Rerunning the command preserves existing records and adds any missing sample departures for that window. Try Delhi (DEL) to London Heathrow (LHR) about two weeks ahead.
- For the airport catalogue on its own, run `python manage.py import_airports`. For sample flights with just their airports while offline, run `python manage.py seed_demo_flights --confirm-demo`.
- Set `AIRLABS_API_KEY` in `.env` for route search and flight-number lookup. Restart Django after editing settings.
- AirLabs Routes supplies a weekly timetable. Search projects the timetable onto the chosen date and shows scheduled times in UTC. A successful search with zero matches stays empty. If AirLabs is unavailable or unconfigured, search uses saved database flights.
- Air Booking generates simulated fares and seats. Use `AIRLABS_SIMULATION_SEATS` to change the default capacity and `AIRLABS_TIMETABLE_CACHE_SECONDS` to change how long the API caches the timetable.
- **Flight status** shows the occurrence AirLabs reports for a flight number. The separate live schedule feed covers the next 10 hours. Background sync updates eligible saved flights with `FLIGHT_STATUS_PROVIDER=airlabs` and a running scheduler. Missing data and provider failures leave the last recorded status in place.

**Approval email**

The local default prints approval and rejection emails in the Django terminal. To send to a real inbox, set the following values in `.env`.

- `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, and `EMAIL_HOST_PASSWORD` from your SMTP provider
- `DEFAULT_FROM_EMAIL` set to the permitted sender address
- `EMAIL_USE_TLS` and `EMAIL_USE_SSL` set according to the provider's instructions
- `FRONTEND_URL` set to an address recipients can open

Restart Django and approve a fresh test account to check delivery. Local SQLite can send directly. Redis and Celery are needed for queued delivery and automatic retries.

**How the backend works**

- **Accounts.** New registrations are pending and require a password of at least eight characters. Django hashes passwords and checks for common, all-numeric, or personally similar passwords. Admins approve or reject registrations. JWTs secure the application API. The browser restores sessions with an HttpOnly refresh cookie.
- **Reservations.** A hold reserves seats for up to 15 minutes by default. A round trip requires two distinct, reversed legs and a return that departs after the outbound flight arrives. Bookings save their original fares and flight details. Repeating the same request with the same idempotency key reuses the reservation.
- **Payments.** A simulated success confirms the booking. Failed payment, cancellation, or expiry releases seats once. A cancelled successful payment is marked refunded within the simulation. No card details are stored.
- **Admin.** The website dashboard is at `/admin` on the frontend. The separate Django admin is at `/admin/` on port 8000. Flight edits preserve reserved seats and enforce restrictions on changing booked flights.
- **Database.** SQLite is for local development. PostgreSQL supports concurrent deployments. Changing `DATABASE_URL` selects a different database and does not copy records.

See the [project documentation](../docs/project.md#api-reference) for the API reference.

**File layout**

- `manage.py` runs Django commands.
- `config` contains Django settings, URLs, Celery settings, and test settings.
- `apps` groups accounts, flights, bookings, payments, and flight tracking by feature. Migrations live with their apps.
- `common` contains shared API permissions, pagination, errors, and admin summaries.
- `tests` contains API workflow and concurrency tests. `requirements.txt` lists dependency ranges and `requirements.lock.txt` pins the versions for installation.

**Deployment and background jobs**

- When PostgreSQL and Redis are available, point `DATABASE_URL`, `REDIS_URL`, and `CELERY_BROKER_URL` in `.env` to those services and set `CELERY_TASK_ALWAYS_EAGER=false`. Run `python manage.py migrate` against the configured database.
- To run background jobs, activate the backend virtual environment in two terminals. Run `celery -A config worker --loglevel=info` in one and `celery -A config beat --loglevel=info` in the other. Add `--pool=solo` to the worker command on Windows. Run one scheduler. For occasional local cleanup without the scheduler, run `python manage.py process_local_tasks`.
- For deployment, set `DEBUG=false`, use HTTPS, configure `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS`, and run `python manage.py collectstatic --noinput`. Keep `.env` out of Git. Serve React and Django from the same site for browser sessions. Forward `/api` requests to Django and serve `index.html` for frontend routes such as `/trips`.
- During development, Vite proxies `/api` to port 8000. Use `AIRBOOKING_API_TARGET` before starting Vite to change the backend port. For a separate API origin, set `VITE_API_BASE_URL` in a frontend `.env.local` and allow the website origin in Django's CORS settings.

**Check the backend**

- Run `python manage.py check` and `python manage.py makemigrations --check --dry-run`.
- Run `python manage.py test tests --settings=config.test_settings --noinput`. This uses an isolated SQLite database. Set `TEST_DATABASE_URL` to a test PostgreSQL instance to include three row-lock and race tests.

