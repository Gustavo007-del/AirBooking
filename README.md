# Air Booking

Air Booking is a flight booking website with an interactive 3D homepage. Explore destinations, search for flights, reserve seats, and manage your trips. Fares, payments, and bookings are simulated. The app does not charge money or issue airline tickets.

**Technologies**

The website uses React, TypeScript, Vite, and React Three Fiber. The backend uses Python, Django REST Framework, and JWT authentication. SQLite is included for local development. PostgreSQL is supported, and Celery with Redis can run background jobs.

**Before you start**

Install [Python 3.12](https://www.python.org/downloads/) and [Node.js](https://nodejs.org/en/download), either 22.12 or later in the 22 series or Node.js 24. On Windows, make sure Python is available in your terminal. You’ll use two terminals, one for Django and one for the website.

**Start the backend**

1. Open a terminal in the project folder, the one that contains `package.json`. Run `cd backend`.
2. Check `python --version`, then run `python -m venv venv` with Python 3.12. If Windows points to a different version and the Python launcher has 3.12 installed, use `py -3.12 -m venv venv`.
3. Activate the environment. In PowerShell, run `.\venv\Scripts\Activate.ps1`. In Command Prompt, run `venv\Scripts\activate.bat`. On macOS or Linux, run `source venv/bin/activate` and use `python3.12` to create it if needed.
4. Install dependencies with `python -m pip install -r requirements.lock.txt`.
5. Create `.env` from the example. From `backend`, run `Copy-Item .env.example .env` in PowerShell, `copy .env.example .env` in Command Prompt, or `cp .env.example .env` on macOS or Linux. Skip this step if you already have a `.env` file.
6. Generate a Django secret with `python -c "import secrets; print(secrets.token_urlsafe(64))"`.
7. Open `.env` and replace the placeholder after `DJANGO_SECRET_KEY=` with the generated value. Save the file and keep it private.
8. Keep `DEBUG=true` and `DATABASE_URL=sqlite:///db.sqlite3` in `.env` for local development. Run `python manage.py migrate` to prepare `backend/db.sqlite3`.
9. Run `python manage.py seed_demo_data` to add the three demo accounts below. To use your own administrator instead, run `python manage.py createsuperuser`.
10. To try flight search without an AirLabs key, run `python manage.py setup_demo_flights`. This one command downloads the airport catalogue for the dropdown and adds sample flights for the next 30 days. It needs internet access for the download. Try Delhi (DEL) to London Heathrow (LHR) about two weeks ahead.
11. Run `python manage.py runserver` and leave this terminal open.

If PowerShell blocks activation, use Command Prompt or replace `python` in the backend commands with `.\venv\Scripts\python.exe`.

**Use AirLabs**
To View Flights and realtime status Create account in Airlabs and get api key from there and put in the .env file as AIRLABS_API_KEY="your api key here", detailed instruction is given below.

1. Create a free [AirLabs account](https://airlabs.co/signup). After signing in, copy the API key from your [AirLabs dashboard](https://airlabs.co/account).
2. If you skipped `setup_demo_flights`, run `python manage.py import_airports` from `backend` to load the airport catalogue on its own.
3. Set `AIRLABS_API_KEY=your_airlabs_key_here` in `backend/.env`, replacing the sample text with your key. If you have a manual status setting, change it to `FLIGHT_STATUS_PROVIDER=airlabs`. Keep the actual key in `.env`, which Git ignores.
4. To restart Django, press Ctrl+C in the backend terminal, then run `python manage.py runserver` again from `backend`.

AirLabs advertises 1,000 free requests per month. Routes responses are limited to 50 rows per request with a free key. Check **Usage** in the AirLabs dashboard for your account’s quota. [AirLabs free allowance](https://airlabs.co/OAG-Airline-Schedules-Database-API) · [Routes API limits](https://airlabs.co/docs/routes)

Search uses the AirLabs weekly timetable first. If your key is missing or AirLabs rejects a request because the quota is exhausted, search uses saved flights when available. A new database with no saved flights may show no matches. Cached results can still be served until they expire. Live flight-number lookup depends on AirLabs, while saved flights keep their last recorded status. A successful timetable search with no matches stays empty.

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

**Try registration and approval**

1. Sign in as **Demo Pending**. The website displays an approval-required message. To test registration as well, use **Create an account** with a different email and a password of at least eight characters.
2. In another browser profile or private window, sign in as **Demo Admin**. Sign-in opens the [admin dashboard](http://localhost:5173/admin) directly.
3. Open **Users** and choose **Approve** for the pending account. Local approval emails appear in the Django terminal with the default settings.
4. Return to the customer window and sign in. The approved account can now search for flights and make simulated reservations.

**Use Air Booking**

- **Accounts.** Register with a customer email address different from your admin address. Use a password of at least eight characters. New customers wait for admin approval before signing in.
- **Admin.** Sign in as an admin to open the dashboard. Open **Users** to approve the new customer. **Overview** shows the approval queue, bookings, and service settings. The other sections manage bookings, flights, airports, and routes.
- **Search and book.** Type an airport code, city, state, or country, then select an airport. A new search starts with Bengaluru (BLR) to New Delhi (DEL). Select a flight, enter traveller details, and complete the simulated payment.
- **My Trips.** Open a booking to view its details or cancel an eligible trip.
- **Flight status.** Open **Flight status** in the main menu. An airline flight number looks up the current occurrence from AirLabs. A flight ID shows the recorded status for a booked flight.
- **Approval email.** Local approval emails appear in the Django terminal. Follow the [backend guide](backend/README.md) to send email to real inboxes.


**Project guide**

Read the [project documentation](docs/project.md) for the application structure, a walkthrough, and the API reference.

- `src` contains React pages, components, animations, tests, and the API client.
- `public` contains browser-ready 3D models, textures, and images. See the [destination photo credits](public/destinations/credits.txt).
- `assets-source` contains the editable Blender files and export scripts.
- `backend` contains Django, database migrations, and background jobs. See the [backend guide](backend/README.md) for settings, email, background jobs, and deployment.

Use `npm test` to run frontend tests and `npm run build` to create a production build in `dist`. During development, Vite forwards API calls to Django on port 8000.
