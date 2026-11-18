import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  Navigate,
  useLocation,
} from "react-router-dom";
import { ArrowUpRight, Menu, X, Plane, UserRound } from "lucide-react";
import { brand } from "./domain";
import { useStore } from "./store";
import { logout } from "./api";
import { Loading, ErrorState } from "./components";
import "./styles.css";
const Landing = lazy(() => import("./Landing"));
const Destinations = lazy(() =>
  import("./Landing").then((m) => ({ default: m.DestinationGrid })),
);
const Flights = lazy(() => import("./Flights"));
const FlightDetails = lazy(() =>
  import("./Flights").then((m) => ({ default: m.FlightDetails })),
);
const Booking = lazy(() => import("./Booking"));
const Confirmation = lazy(() =>
  import("./Booking").then((m) => ({ default: m.Confirmation })),
);
const Auth = lazy(() => import("./Account").then((m) => ({ default: m.Auth })));
const Pending = lazy(() =>
  import("./Account").then((m) => ({ default: m.Pending })),
);
const Trips = lazy(() =>
  import("./Account").then((m) => ({ default: m.Trips })),
);
const TripDetails = lazy(() =>
  import("./Account").then((m) => ({ default: m.TripDetails })),
);
const Profile = lazy(() =>
  import("./Account").then((m) => ({ default: m.Profile })),
);
const FlightStatus = lazy(() =>
  import("./Account").then((m) => ({ default: m.FlightStatus })),
);
const Admin = lazy(() => import("./Admin"));
class Boundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="page narrow">
        <ErrorState
          message="The page could not load. Reload to try again."
          retry={() => window.location.reload()}
        />
      </main>
    ) : (
      this.props.children
    );
  }
}
function Guard({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const user = useStore((s) => s.user);
  const location = useLocation();
  if (!user)
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  if (user.status !== "approved") return <Navigate to="/pending" replace />;
  if (admin && user.role !== "admin")
    return <Navigate to="/dashboard" replace />;
  return children;
}
function App() {
  const location = useLocation();
  const home = location.pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const user = useStore((s) => s.user);
  useEffect(() => {
    setMenu(false);
    if (location.hash)
      setTimeout(
        () => document.querySelector(location.hash)?.scrollIntoView(),
        150,
      );
    else window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);
  useEffect(() => {
    const fn = () => setScrolled(scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className={`header ${home && !scrolled ? "over-hero" : ""}`}>
        <Link className="brand" to="/" aria-label="AERÉ home">
          <span className="brand-symbol">╱</span>
          {brand.name}
          <sup>®</sup>
        </Link>
        <nav aria-label="Main navigation" className={menu ? "open" : ""}>
          <NavLink to="/" end>
            Home
          </NavLink>
          <Link to="/#explore">Explore</Link>
          <NavLink to="/destinations">Destinations</NavLink>
          <NavLink to="/flights">Flights</NavLink>
          <NavLink to="/trips">My Trips</NavLink>
          {user?.role === "admin" && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <Link className="account-link" to="/dashboard">
                <UserRound size={16} />
                {user.name.split(" ")[0]}
              </Link>
              <button className="logout" onClick={logout}>
                Sign out
              </button>
            </>
          ) : (
            <Link className="sign-in" to="/login">
              Sign in
            </Link>
          )}
          <Link to="/flights" className="nav-cta">
            Book a flight <ArrowUpRight size={16} />
          </Link>
          <button
            className="menu-toggle"
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <div id="main-content">
        <Boundary>
          <Suspense
            fallback={
              <main className="page">
                <Loading />
              </main>
            }
          >
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route
                path="/destinations"
                element={
                  <main className="page wrap">
                    <span className="eyebrow copper-text">
                      FOLLOW YOUR CURIOSITY
                    </span>
                    <h1>Where will your story go?</h1>
                    <p className="lede">
                      A collection of places to inspire your next chapter.
                    </p>
                    <Destinations />
                  </main>
                }
              />
              <Route path="/flights" element={<Flights />} />
              <Route path="/flight/:id" element={<FlightDetails />} />
              <Route
                path="/booking/:id"
                element={
                  <Guard>
                    <Booking />
                  </Guard>
                }
              />
              <Route
                path="/confirmation/:id"
                element={
                  <Guard>
                    <Confirmation />
                  </Guard>
                }
              />
              <Route path="/login" element={<Auth />} />
              <Route path="/register" element={<Auth />} />
              <Route path="/pending" element={<Pending />} />
              <Route path="/activation" element={<Pending />} />
              <Route
                path="/dashboard"
                element={
                  <Guard>
                    <Trips dashboard />
                  </Guard>
                }
              />
              <Route
                path="/trips"
                element={
                  <Guard>
                    <Trips />
                  </Guard>
                }
              />
              <Route
                path="/trips/:id"
                element={
                  <Guard>
                    <TripDetails />
                  </Guard>
                }
              />
              <Route
                path="/profile"
                element={
                  <Guard>
                    <Profile />
                  </Guard>
                }
              />
              <Route path="/status" element={<FlightStatus />} />
              <Route
                path="/admin"
                element={
                  <Guard admin>
                    <Admin />
                  </Guard>
                }
              />
              <Route
                path="*"
                element={
                  <main className="page narrow empty">
                    <Plane size={40} />
                    <h1>A little off course.</h1>
                    <p>We couldn’t find this page.</p>
                    <Link className="button" to="/">
                      Return home
                    </Link>
                  </main>
                }
              />
            </Routes>
          </Suspense>
        </Boundary>
      </div>
      <footer>
        <div className="footer-main wrap">
          <div>
            <Link className="brand" to="/">
              ╱ {brand.name}
            </Link>
            <p>Above the ordinary.</p>
          </div>
          <div>
            <span>YOUR JOURNEY</span>
            <Link to="/flights">Find a flight</Link>
            <Link to="/destinations">Destinations</Link>
            <Link to="/trips">My Trips</Link>
          </div>
          <div>
            <span>HERE TO HELP</span>
            <Link to="/status">Flight status</Link>
            <Link to="/profile">Your account</Link>
            <Link to="/login">Sign in</Link>
          </div>
          <p className="footer-statement">
            A world of possibility.
            <br />A more considered way to go.
          </p>
        </div>
        <div className="footer-bottom wrap">
          <span>
            © {new Date().getFullYear()} {brand.name}. An original aviation
            concept.
          </span>
          <span>Designed for the journey.</span>
        </div>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
