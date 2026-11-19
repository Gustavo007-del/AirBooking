import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  useRef,
  useState,
  createContext,
  useContext,
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
import { ErrorState, Loading, SearchPanel } from "./components";
import { useAirports } from "./catalog";
import { useStore } from "./store";
import { chapterProgress, type SceneMode } from "./cinematic";

// Register before page effects create timelines; never depend on the lazy 3D module.
gsap.registerPlugin(ScrollTrigger);

const sceneOrder: SceneMode[] = ["hero", "take", "globe", "cabin", "final"];
const Preparation = createContext({
  warmThrough: 0,
  reportReady: (_mode: SceneMode) => {},
});

let sceneModule: Promise<typeof import("./Scene")> | undefined;
const loadScene = () =>
  (sceneModule ??= import("./Scene").catch((error) => {
    sceneModule = undefined;
    throw error;
  }));
class SceneBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
function Visual({
  mode = "hero",
  motion = true,
}: {
  mode?: SceneMode;
  motion?: boolean;
}) {
  const { warmThrough, reportReady } = useContext(Preparation);
  const root = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(mode === "hero");
  const [active, setActive] = useState(mode === "hero");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [hidden, setHidden] = useState(document.hidden);
  const Scene = useMemo(() => lazy(loadScene), [attempt]);
  const onReady = useCallback(() => {
    setReady(true);
    setSlow(false);
    reportReady(mode);
  }, [mode, reportReady]);
  useEffect(() => {
    if (sceneOrder.indexOf(mode) <= warmThrough) setMounted(true);
  }, [mode, warmThrough]);
  const onFailure = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    // Warm up before arrival; never tear down a loaded canvas on reverse scrolling.
    const preload = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true);
          preload.disconnect();
        }
      },
      { rootMargin: "900px" },
    );
    const visibility = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: "80px" },
    );
    preload.observe(el);
    visibility.observe(el);
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      preload.disconnect();
      visibility.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  useEffect(() => {
    if (!mounted || ready || failed) return;
    const timer = setTimeout(() => setSlow(true), 10000);
    return () => clearTimeout(timer);
  }, [mounted, ready, failed, attempt]);
  async function retry() {
    setSlow(false);
    setReady(false);
    try {
      const module = await loadScene();
      module.resetSceneAssets();
      setAttempt((n) => n + 1);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }
  return (
    <div
      className={`scene scene-${mode} ${ready ? "scene-ready" : ""}`}
      ref={root}
    >
      {!ready && (
        <div
          className={`scene-placeholder placeholder-${mode}`}
          aria-hidden="true"
        />
      )}
      {mounted && !failed && (
        <SceneBoundary key={attempt} onFailure={onFailure}>
          <Suspense fallback={null}>
            <Scene
              mode={mode}
              motion={motion}
              active={active && !hidden}
              onReady={onReady}
              onFailure={onFailure}
            />
          </Suspense>
        </SceneBoundary>
      )}
      {ready && mode === "globe" && (
        <div className="globe-interaction-hint">
          ↔ Drag to explore the world
        </div>
      )}
      {!ready && (failed || slow) && (
        <div className="scene-status" role="status">
          {failed
            ? "3D is temporarily unavailable."
            : slow
              ? "Still loading — you can keep exploring."
              : "Preparing the view…"}
          {(failed || slow) && <button onClick={retry}>Retry 3D</button>}
        </div>
      )}
    </div>
  );
}
function ChapterControls({ mode }: { mode: SceneMode }) {
  return (
    <div className="chapter-controls">
      <span>SCROLL TO EXPLORE</span>
      <div className="chapter-meter" aria-hidden="true">
        <i />
      </div>
      <button
        onClick={() => {
          const trigger = ScrollTrigger.getById(`chapter-${mode}`);
          if (trigger)
            window.dispatchEvent(
              new CustomEvent("aere:skip-chapter", { detail: trigger.end + 2 }),
            );
        }}
      >
        Skip scene ↓
      </button>
    </div>
  );
}
export const destinations = [
  {
    name: "Bali",
    country: "INDONESIA",
    code: "DPS",
    line: "Find your slower pace.",
    image: "bali",
    tag: "ISLAND ESCAPES",
  },
  {
    name: "Tokyo",
    country: "JAPAN",
    code: "NRT",
    line: "A world within a city.",
    image: "tokyo",
    tag: "CITY DISCOVERIES",
  },
  {
    name: "The Alps",
    country: "SWITZERLAND",
    code: "ZRH",
    line: "A different kind of altitude.",
    image: "swiss-alps",
    tag: "OPEN HORIZONS",
  },
];
const destinationPhotos = new Map([
  ["BLR", "bengaluru"],
  ["BOM", "mumbai"],
  ["CCU", "kolkata"],
  ["CDG", "paris"],
  ["DEL", "new-delhi"],
  ["DXB", "dubai"],
  ["HYD", "hyderabad"],
  ["JFK", "new-york"],
  ["LHR", "london"],
  ["MAA", "chennai"],
  ["SIN", "singapore"],
]);

export function DestinationGrid({ featured = false }: { featured?: boolean }) {
  const { airports, error, loading, retry } = useAirports("destinations");
  const set = useStore((s) => s.setSearch);
  const search = useStore((s) => s.search);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} retry={retry} />;
  const available = airports
    .map((airport) => ({
      airport,
      editorial: destinations.find((item) => item.code === airport.code),
    }))
    .sort((a, b) => Number(!!b.editorial) - Number(!!a.editorial));
  const cards = featured ? available.slice(0, 3) : available;
  if (!cards.length) return <p>No destinations are available yet.</p>;
  return (
    <div className="destination-grid">
      {cards.map(({ airport, editorial }, i) => (
        <Link
          to="/flights"
          className="destination"
          key={airport.code}
          onClick={() =>
            set({
              ...search,
              destination: airport.code,
              origin: search.origin === airport.code ? "" : search.origin,
            })
          }
        >
          <img
            src={`/destinations/${editorial?.image ?? destinationPhotos.get(airport.code) ?? "in-flight"}.webp`}
            alt=""
            loading="lazy"
            decoding="async"
          />
          <div className="destination-shade" />
          <div className="destination-top">
            <span>{editorial?.tag ?? airport.code}</span>
            <span>0{i + 1}</span>
          </div>
          <div className="destination-caption">
            <span className="eyebrow">{airport.country || airport.code}</span>
            <h3>{airport.city}</h3>
            <p>{editorial?.line ?? airport.name}</p>
          </div>
          <span className="round-link">
            <ArrowUpRight size={21} />
          </span>
        </Link>
      ))}
    </div>
  );
}
export default function Landing({
  onOpeningProgress,
}: {
  onOpeningProgress?: (ready: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [warmThrough, setWarmThrough] = useState(0);
  const [prepared, setPrepared] = useState<SceneMode[]>([]);
  const reportReady = useCallback((mode: SceneMode) => {
    setPrepared((current) =>
      current.includes(mode) ? current : [...current, mode],
    );
  }, []);
  const preparation = useMemo(
    () => ({ warmThrough, reportReady }),
    [warmThrough, reportReady],
  );
  useEffect(() => {
    if (warmThrough >= sceneOrder.length - 1) return;
    // Give each canvas a turn to upload/compile before preparing the next one.
    // A failed scene must not prevent the remaining scenes from warming up.
    const timer = setTimeout(
      () => setWarmThrough((current) => current + 1),
      prepared.includes(sceneOrder[warmThrough]) ? 350 : 2500,
    );
    return () => clearTimeout(timer);
  }, [warmThrough, prepared]);
  useEffect(() => {
    // The app shell and the landing page loaded before these scene milestones.
    onOpeningProgress?.(2 + prepared.length);
  }, [onOpeningProgress, prepared.length]);
  const [motion, setMotion] = useState(
    !matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setMotion(!preference.matches);
    preference.addEventListener("change", change);
    return () => preference.removeEventListener("change", change);
  }, []);
  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    media.add(
      {
        desktop: "(min-width: 851px) and (min-height: 620px)",
        mobile: "(max-width: 850px) and (min-height: 700px)",
        reduced: "(prefers-reduced-motion: reduce)",
        all: "all",
      },
      (context) => {
        const { desktop, mobile, reduced } = context.conditions!;
        const pin = motion && !reduced && (desktop || mobile);
        const header = () =>
          document.querySelector("header")?.getBoundingClientRect().height ??
          88;
        Object.values(chapterProgress).forEach((value) => (value.value = 0));
        if (!motion || reduced) return;
        // Build all pins in document order before lazy 3D or textures resolve.
        root.current
          ?.querySelectorAll<HTMLElement>("[data-chapter]")
          .forEach((section) => {
            const mode = section.dataset.chapter as SceneMode;
            section.classList.toggle("cinematic-pinned", !!pin);
            gsap.to(chapterProgress[mode], {
              value: 1,
              ease: "none",
              onUpdate: () =>
                section.style.setProperty(
                  "--chapter-progress",
                  String(chapterProgress[mode].value),
                ),
              scrollTrigger: {
                id: `chapter-${mode}`,
                trigger: section,
                pin: pin ? section : false,
                pinSpacing: true,
                anticipatePin: 1,
                start: () => (pin ? `top ${header()}px` : "top 65%"),
                end: () =>
                  pin
                    ? `+=${Math.round(innerHeight * (mobile ? 0.85 : 1.35))}`
                    : "bottom 25%",
                scrub: true,
                invalidateOnRefresh: true,
              },
            });
          });
        gsap.to(chapterProgress.hero, {
          value: 1,
          ease: "none",
          scrollTrigger: {
            trigger: "#hero",
            start: "top top",
            end: "bottom top",
            scrub: 0.6,
          },
        });
        return () =>
          root.current
            ?.querySelectorAll<HTMLElement>("[data-chapter]")
            .forEach((el) => {
              el.classList.remove("cinematic-pinned");
              el.style.removeProperty("--chapter-progress");
            });
      },
      root,
    );
    let disposed = false;
    const refresh = () => {
      if (!disposed) ScrollTrigger.refresh();
    };
    const frame = requestAnimationFrame(refresh);
    document.fonts.ready.then(refresh);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      media.revert();
    };
  }, [motion]);
  useEffect(() => {
    if (!motion) return;
    const lenis = new Lenis({
      duration: 0.85,
      smoothWheel: true,
      syncTouch: false,
      anchors: { offset: -88 },
    });
    const tick = (time: number) => lenis.raf(time * 1000);
    const skip = (event: Event) =>
      lenis.scrollTo((event as CustomEvent<number>).detail, {
        immediate: true,
      });
    window.addEventListener("aere:skip-chapter", skip);
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
      gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) =>
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
      window.removeEventListener("aere:skip-chapter", skip);
      gsap.ticker.remove(tick);
      ctx.revert();
    };
  }, [motion]);
  return (
    <Preparation.Provider value={preparation}>
      <div ref={root} className={!motion ? "motion-paused" : ""}>
        <section className="hero" id="hero">
          <div className="sky-glow" />
          <Visual motion={motion} />
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
          <DestinationGrid featured />
          <div className="editorial-note">
            A little inspiration for your next journey. Destination imagery is
            editorial.
          </div>
        </section>
        <section id="take-flight" className="take-flight" data-chapter="take">
          <Visual mode="take" motion={motion} />
          <ChapterControls mode="take" />
          <div className="chapter-copy reveal">
            <span className="eyebrow">02 / TAKE FLIGHT</span>
            <h2>
              Leave the familiar.
              <br />
              Find the extraordinary.
            </h2>
            <p>
              The runway falls away. The horizon opens.
              <br />
              Let your journey begin there.
            </p>
            <Link className="text-link light" to="/flights">
              Discover your next flight <ArrowRight size={18} />
            </Link>
          </div>
          <span className="scene-caption">THE ART OF GOING SOMEWHERE</span>
        </section>
        <section
          className="world-section wrap"
          data-chapter="globe"
          id="explore"
        >
          <div className="world-copy reveal">
            <span className="eyebrow copper-text">03 / CONNECT THE WORLD</span>
            <h2>
              A world of possibilities.
              <br />
              <span>One beautiful journey.</span>
            </h2>
            <p>
              Across oceans. Between cultures. Beyond the places you already
              know. Start with a destination, and see where it takes you.
            </p>
            <Link to="/destinations" className="button">
              Find your inspiration <ArrowUpRight size={17} />
            </Link>
            <small>Illustrative routes · not live flight tracking</small>
          </div>
          <Visual mode="globe" motion={motion} />
          <ChapterControls mode="globe" />
        </section>
        <section className="experience" data-chapter="cabin" id="experience">
          <Visual mode="cabin" motion={motion} />
          <ChapterControls mode="cabin" />
          <div className="chapter-copy reveal">
            <span className="eyebrow">05 / THE ONBOARD EXPERIENCE</span>
            <h2>
              Your own little
              <br />
              corner of the sky.
            </h2>
            <p>
              Soft light. A window to somewhere new.
              <br />A considered cabin concept, made for the journey.
            </p>
            <div className="spec-line">
              <span>A WINDOW TO THE WORLD</span>
              <span>ROOM TO UNWIND</span>
            </div>
          </div>
        </section>
        <section className="next-journey wrap">
          <div className="section-heading reveal">
            <div>
              <span className="eyebrow copper-text">
                06 / YOUR NEXT JOURNEY
              </span>
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
        <section className="closing" data-chapter="final" id="final-flight">
          <Visual mode="final" motion={motion} />
          <ChapterControls mode="final" />
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
    </Preparation.Provider>
  );
}
