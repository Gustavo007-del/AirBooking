import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUpRight,
  ArrowRight,
  Compass,
  ShieldCheck,
  MoveRight,
  Pause,
  Play,
} from "lucide-react";
import gsap from "gsap";
import Lenis from "lenis";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SearchPanel } from "./components";
import { useStore } from "./store";
const Scene = lazy(() => import("./Scene"));
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="scene-fallback" />
    ) : (
      this.props.children
    );
  }
}
function Visual({ mode = "hero" }: { mode?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(mode === "hero");
  useEffect(() => {
    const observer = new IntersectionObserver(
      (e) => {
        setVisible(e[0].isIntersecting);
      },
      { rootMargin: "200px" },
    );
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div className={`scene scene-${mode}`} ref={root} aria-hidden="true">
      <SceneBoundary>
        {visible && (
          <Suspense fallback={<div className="scene-loading" />}>
            <Scene mode={mode} />
          </Suspense>
        )}
      </SceneBoundary>
    </div>
  );
}
export const destinations = [
  {
    name: "Bali",
    country: "INDONESIA",
    code: "DPS",
    line: "Find your slower pace.",
    image:
      "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1000&q=85",
    tag: "ISLAND ESCAPES",
  },
  {
    name: "Tokyo",
    country: "JAPAN",
    code: "NRT",
    line: "A world within a city.",
    image:
      "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=900&q=85",
    tag: "CITY DISCOVERIES",
  },
  {
    name: "The Alps",
    country: "SWITZERLAND",
    code: "ZRH",
    line: "A different kind of altitude.",
    image:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=85",
    tag: "OPEN HORIZONS",
  },
];
export function DestinationGrid() {
  const set = useStore((s) => s.setSearch);
  const search = useStore((s) => s.search);
  return (
    <div className="destination-grid">
      {destinations.map((d, i) => (
        <Link
          to="/flights"
          className="destination"
          key={d.name}
          onClick={() =>
            set({
              ...search,
              destination: d.code,
              origin: search.origin === d.code ? "DEL" : search.origin,
            })
          }
        >
          <img
            src={d.image}
            alt={
              d.name === "Bali"
                ? "Tropical temples and landscape in Bali"
                : d.name === "Tokyo"
                  ? "Tokyo skyline at dusk"
                  : "Dramatic alpine mountain peaks"
            }
            loading="lazy"
          />
          <div className="destination-shade" />
          <div className="destination-top">
            <span>{d.tag}</span>
            <span>0{i + 1}</span>
          </div>
          <div className="destination-caption">
            <span className="eyebrow">{d.country}</span>
            <h3>{d.name}</h3>
            <p>{d.line}</p>
          </div>
          <span className="round-link">
            <ArrowUpRight size={21} />
          </span>
        </Link>
      ))}
    </div>
  );
}
export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const [motion, setMotion] = useState(
    !matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    if (!motion) return;
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    lenis.on("scroll", ScrollTrigger.update);
    const ctx = gsap.context(() => {
      gsap.from(".hero-copy > *", {
        y: 24,
        opacity: 0,
        duration: 1,
        stagger: 0.14,
        ease: "power2.out",
      });
      gsap.utils
        .toArray<HTMLElement>(".reveal")
        .forEach((el) =>
          gsap.from(el, {
            y: 32,
            opacity: 0,
            duration: 0.8,
            scrollTrigger: {
              trigger: el,
              start: "top 90%",
              toggleActions: "play none none reverse",
            },
          }),
        );
    }, root);
    return () => {
      lenis.destroy();
      gsap.ticker.remove(tick);
      ctx.revert();
    };
  }, [motion]);
  return (
    <div ref={root} className={!motion ? "motion-paused" : ""}>
      <section className="hero" id="hero">
        <div className="sky-glow" />
        {motion ? <Visual /> : <div className="still-aircraft" />}
        <div className="hero-grain" />
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="tiny-line" /> A HIGHER PERSPECTIVE
          </div>
          <h1>
            The world is
            <br />
            yours to <span>explore.</span>
          </h1>
          <p>
            Extraordinary places. Effortless journeys.
            <br />
            Your next chapter begins above the clouds.
          </p>
          <a href="#flight-search" className="hero-link">
            Find your flight <ArrowUpRight size={20} />
          </a>
        </div>
        <div className="hero-coordinate">
          <span>ABOVE THE HORIZON</span>
          <i />
          <span>A NEW WAY TO GO</span>
        </div>
        <div className="hero-bottom">
          <a href="#destinations">
            <ArrowDown size={16} /> SCROLL TO DISCOVER
          </a>
          <span>01 — THE JOURNEY BEGINS</span>
          <button
            onClick={() => setMotion(!motion)}
            aria-label={
              motion ? "Pause cinematic motion" : "Enable cinematic motion"
            }
          >
            {motion ? <Pause size={13} /> : <Play size={13} />} MOTION{" "}
            {motion ? "ON" : "OFF"}
          </button>
        </div>
        <div className="hero-search">
          <SearchPanel />
        </div>
      </section>
      <section className="intro-strip wrap">
        <div>
          <Compass />
          <p>
            <strong>Follow your curiosity</strong>
            <span>Find a place that feels like you.</span>
          </p>
        </div>
        <div>
          <ShieldCheck />
          <p>
            <strong>Clarity at every step</strong>
            <span>Thoughtful details. Simple decisions.</span>
          </p>
        </div>
        <div>
          <MoveRight />
          <p>
            <strong>Make room for possibility</strong>
            <span>Your next chapter is out there.</span>
          </p>
        </div>
      </section>
      <section className="destinations-section wrap" id="destinations">
        <div className="section-heading reveal">
          <div>
            <span className="eyebrow copper-text">
              04 / PLACES THAT STAY WITH YOU
            </span>
            <h2>
              Somewhere new.
              <br />
              <span>Something unforgettable.</span>
            </h2>
          </div>
          <div>
            <p>
              From the quietly beautiful to the wonderfully
              <br className="desktop" /> unexpected. Where will curiosity take
              you?
            </p>
            <Link className="text-link" to="/destinations">
              Explore destinations <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
        <DestinationGrid />
        <div className="editorial-note">
          A little inspiration for your next journey. Destination imagery is
          editorial.
        </div>
      </section>
      <section id="take-flight" className="take-flight">
        <Visual mode="take" />
        <div className="chapter-copy reveal">
          <span className="eyebrow">02 / TAKE FLIGHT</span>
          <h2>
            Leave the familiar.
            <br />
            Find the extraordinary.
          </h2>
          <p>
            There’s a moment when the everyday falls away.
            <br />
            Let your journey begin there.
          </p>
          <Link className="text-link light" to="/flights">
            Discover your next flight <ArrowRight size={18} />
          </Link>
        </div>
        <span className="scene-caption">THE ART OF GOING SOMEWHERE</span>
      </section>
      <section className="world-section wrap" id="explore">
        <div className="world-copy reveal">
          <span className="eyebrow copper-text">03 / CONNECT THE WORLD</span>
          <h2>
            A world of possibilities.
            <br />
            <span>One beautiful journey.</span>
          </h2>
          <p>
            Across oceans. Between cultures. Beyond the places you already know.
            Start with a destination, and see where it takes you.
          </p>
          <Link to="/destinations" className="button">
            Find your inspiration <ArrowUpRight size={17} />
          </Link>
          <small>Illustrative routes · not live flight tracking</small>
        </div>
        <Visual mode="globe" />
      </section>
      <section className="experience" id="experience">
        <Visual mode="detail" />
        <div className="chapter-copy reveal">
          <span className="eyebrow">05 / THE AIRCRAFT EXPERIENCE</span>
          <h2>
            Considered.
            <br />
            Down to the last detail.
          </h2>
          <p>
            A closer perspective on the form of flight.
            <br />
            Explore our original AERÉ aircraft concept.
          </p>
          <div className="spec-line">
            <span>SCULPTED FORM</span>
            <span>QUIET PRECISION</span>
          </div>
        </div>
      </section>
      <section className="next-journey wrap">
        <div className="section-heading reveal">
          <div>
            <span className="eyebrow copper-text">06 / YOUR NEXT JOURNEY</span>
            <h2>
              Good things begin
              <br />
              <span>with a departure.</span>
            </h2>
          </div>
          <p>
            A window seat. A new perspective.
            <br />A place you’ve been meaning to go.
          </p>
        </div>
        <SearchPanel compact />
      </section>
      <section className="closing" id="final-flight">
        <Visual mode="final" />
        <div className="closing-copy">
          <span className="eyebrow">07 / ABOVE THE ORDINARY</span>
          <h2>
            The horizon is
            <br />
            only the beginning.
          </h2>
          <Link className="button copper" to="/flights">
            Find your next flight <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
