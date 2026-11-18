# AERÉ — Above the ordinary

React 19 + Vite + TypeScript flight-booking frontend. No backend is included or modified.

## Run

Requires Node 22 or newer.

```sh
npm install
npm run dev
npm test
npm run build
```

Open the local URL Vite prints. The production SPA is in `dist/`; configure your host to serve `index.html` for application routes. Sites hosting is declared in `.openai/hosting.json`.

## Try the complete flow

1. Search from the home panel. Sample airport options, dates, passenger count, and cabin are editable.
2. Choose an outbound flight, then a return flight for round trips.
3. At sign-in, choose **Demo traveller**. Use fictional passenger details.
4. Review the journey, acknowledge the simulation, and complete the demo payment.
5. The booking appears in My Trips only after the demo persistence operation succeeds. No actual payment or ticket is created.
6. Sign out and use **Open demo administration** on the sign-in page to inspect registrations, approvals, flight edits/status, and bookings.
7. Registration creates a pending demo user. After approval in the admin console, enter that email on the sign-in page and choose **Resume a registered demo account**. No password is retained in demo mode.

Demo users, flight edits, and bookings live under `aere-demo-*` keys in localStorage. They are sample data, not secure production records. User sessions and JWTs live only in memory; reload requires a new sign-in. Search preferences persist separately. The demo administrator is available only in demo builds. Real roles and permissions must also be enforced by Django.

## Backend integration

Copy `.env.example` to `.env.local`, set `VITE_DATA_MODE=api` and `VITE_API_BASE_URL`, then restart Vite/rebuild. All API calls are isolated in `src/api.ts`; domain types are in `src/domain.ts`. The API mode never falls back to mocks after an error. Errors, loading, and empty results are explicit.

The provided brief specified endpoint paths but no response schema. **The types below are a proposed adapter contract, not a verified Django integration.** Adjust the single service layer to your serializer contract before connecting production data.

| Endpoint | Expected request/response |
| --- | --- |
| `POST /api/auth/register/` | `{name,email,password}` → `User` |
| `POST /api/auth/login/` | `{email,password}` → `{access,refresh,user:User}` |
| `POST /api/auth/token/refresh/` | `{refresh}` → `{access,refresh?}` |
| `GET /api/flights/search/` | `Search` query fields → `Flight[]` or `{results:Flight[]}` |
| `GET /api/flights/{id}/` | `Flight` |
| `POST /api/bookings/` | `{flight_ids,passengers}` plus Idempotency-Key → `Booking` |
| `GET /api/bookings/` | `Booking[]` or `{results:Booking[]}`; backend scopes to user/role |
| `GET /api/bookings/{id}/` | authorized `Booking` |
| `GET /api/admin/users/pending/` | `User[]` or `{results:User[]}` |
| `POST /api/admin/users/{id}/approve/` | approval action |
| `GET /api/admin/flights/` | `Flight[]` or `{results:Flight[]}` |
| `PUT /api/admin/flights/{id}/status/` | `{status}` |

The Axios client provides in-memory bearer tokens, a shared refresh request for concurrent 401s, one retry per failed request, timeout handling, and logout on failed refresh. Configure Django CORS for the frontend origin. Do not put secrets in Vite environment variables.

Unknown endpoints are deliberately not invented: rejection, flight creation/editing, profile persistence, all-user totals, analytics, account activation, cancellation, and real payment authorization require an agreed backend contract. Their sample workflows work locally where applicable; unavailable API-mode mutations are disabled or return a clear configuration error. Pending/activation screens are prepared, but activation requires backend approval followed by sign-in. No live tracking is fabricated. Status is read from returned flight data with its timestamp when supplied.

## Routes

`/`, `/destinations`, `/flights`, `/flight/:id`, `/booking/:id`, `/confirmation/:id`, `/login`, `/register`, `/pending`, `/activation`, `/dashboard`, `/trips`, `/trips/:id`, `/profile`, `/status`, `/admin`.

Booking, confirmations, trips, profile and dashboard require an approved session; administration additionally requires the admin role. The browser guard is for navigation only; server authorization is required.

## Design and assets

- Brand name/currency: `src/domain.ts` (`brand`). Color, spacing, typography and responsive styles: `src/styles.css`.
- Manrope and Inter from Google Fonts, with system fallbacks. Photography is editorial and loaded from Unsplash. No partnerships, awards or customer statistics are represented.
- Original aircraft: `assets-source/aere-aircraft.blend`. Reproducible model script: `assets-source/build_aircraft.py`. The script uses a separate Blender scene; update `ROOT` for another machine.
- Browser model: `public/models/aere-aircraft.glb` (~1.7 MB), PBR materials, shaped fuselage, cockpit, windows, doors, swept wings, winglets, nacelles and fan blades. This is a brand concept, not a certified aircraft engineering model.
- Transparent fallback: `public/aircraft-poster.png` (rendered from the original Blender scene).
- Globe texture: Three.js example Earth texture, derived from NASA Blue Marble imagery, downloaded from `https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg`.
- Cloud billboards use Drei's cloud texture. Earth routes are illustrative, not live flight feeds.
- Lucide icons (ISC), Three.js (MIT), and the listed npm packages retain their respective licenses.

## Motion, performance, and accessibility

3D is route-lazy and viewport-mounted, with a capped device pixel ratio, simplified mobile postprocessing, and a static fallback. One reusable camera controller owns each canvas camera. GSAP contexts clean up ScrollTriggers, and Lenis is destroyed on unmount. Scrolling reverses camera interpolation. A motion toggle and reduced-motion media query provide a still experience. Independent scene canvases are used for aircraft/cloud, globe and close-up chapters; this is not a single continuous physically shared world.

Forms have labels, native date controls, keyboard-friendly airport datalists, validation messages, focus outlines, skip navigation, and visible simulation notices. Application pages use restrained motion. All operational forms remain accessible independently of 3D loading.

## Validation and remaining integration work

- TypeScript and production bundle verified.
- 11 tests cover search dates/airports/counts, passenger validation, approval protection, booking idempotency, user scoping, and cabin price preservation.
- Browser walkthrough covers round-trip search, approval guard, required-field validation, payment simulation and confirmation; desktop/mobile visual checks are recorded during development.
- `npm audit --omit=dev` reports zero production vulnerabilities. The full audit currently flags the development-only picomatch dependency chain; the configured registry's newest picomatch is 4.0.7 and has no fixed release. Re-audit when a patch becomes available. Never expose the Vite development server publicly as a production service.
- 3D vendor bundle is ~380 KB gzip and lazy-loaded. Imagery/fonts and Drei cloud assets require network access. For an entirely offline build, self-host those third-party assets after confirming their licenses.
- No real backend endpoint or payment provider was supplied, so real reservations, real-time updates, and production account approval have not been integration-tested.

Editable globe studio: assets-source/aere-world.blend contains a packed Earth texture and editable curved route objects. Regenerate with assets-source/build_globe.py.
