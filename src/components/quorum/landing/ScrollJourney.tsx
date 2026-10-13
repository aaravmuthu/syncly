import { useEffect, useRef, useState, type RefObject, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  ArrowRight,
  Check,
  LockKeyhole,
  CalendarDays,
  Car,
  MapPin,
  ShieldCheck,
  Users,
  ListChecks,
} from "lucide-react";
import { JourneyOrb } from "./JourneyOrb";
import { useOrbHandoff } from "./useOrbHandoff";
import type { OrbitControl } from "./SyncOrbit";
import "./scroll-journey.css";

const CHAPTERS = [
  {
    label: "Your people",
    title: ["Different people.", "Different needs.", "One group."],
    body: "The budget. The ride. The curfew. All the things nobody wants to type in the group chat.",
    note: "Same friends. A better way to plan.",
  },
  {
    label: "Privacy",
    title: ["Say it once.", "Keep it private."],
    body: "Give Syncly your limits. Your friends only see what works for the group, never your answers or why something was ruled out.",
    note: "Private answers. Shared possibilities.",
  },
  {
    label: "Options",
    title: ["Good options.", "No awkward", "compromises."],
    body: "Hard limits filter first. Preferences rank what remains. Fairness helps keep the same friend from always compromising.",
    note: "Choose an example option to see it in the final plan.",
  },
  {
    label: "Approval",
    title: ["One link.", "A little peace", "of mind."],
    body: "The people, place, cost, ride, and return time. Parents get the full picture and can approve without downloading an app.",
    note: "An example approval, just for this preview.",
  },
  {
    label: "Rides",
    title: ["Getting there", "is part of", "the plan."],
    body: "Seats, drivers, and return times are worked out together. Nobody gets left wondering how they're getting home.",
    note: "Tap a driver to inspect their example ride.",
  },
  {
    label: "Radar",
    title: ["Together,", "without", "oversharing."],
    body: "See who's close, who's on the way, and who's arrived. Location sharing starts off and stays in your control.",
    note: "Try the sharing switch. No actual location is used.",
  },
  {
    label: "The plan",
    title: ["Everyone gets", "a seat at", "the table."],
    body: "Private answers become real options. One plan brings your people together.",
    note: "Free to start with your group.",
  },
];
const EXAMPLES = [
  {
    name: "Dinner",
    plan: "Friday dinner",
    first: "Pizza & a catch-up",
    second: "Noodles downtown",
    price: 18,
    otherPrice: 26,
    time: "Friday, 6:30 pm",
  },
  {
    name: "Movies",
    plan: "Movie night",
    first: "A movie & a late snack",
    second: "An early matinee",
    price: 16,
    otherPrice: 14,
    time: "Saturday, 5:00 pm",
  },
  {
    name: "Games",
    plan: "Game night",
    first: "Board games & pizza",
    second: "An evening at the arcade",
    price: 12,
    otherPrice: 24,
    time: "Saturday, 6:00 pm",
  },
];
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const CHAPTER_ICONS = [Users, LockKeyhole, ListChecks, ShieldCheck, Car, MapPin, Check];

function SceneLayer({
  progress,
  index,
  active,
  enhanced,
  children,
}: {
  progress: MotionValue<number>;
  index: number;
  active: number;
  enhanced: boolean;
  children: ReactNode;
}) {
  const opacity = useTransform(progress, (p) => {
    const local = p * CHAPTERS.length - index;
    const enter = index === 0 ? 1 : clamp((local + 0.08) / 0.2);
    const leave = index === CHAPTERS.length - 1 ? 1 : clamp((1.08 - local) / 0.2);
    return Math.min(enter, leave);
  });
  const transform = useTransform(progress, (p) => {
    const local = p * CHAPTERS.length - index;
    return `translateY(${Math.max(-24, Math.min(24, (0.35 - local) * 30))}px)`;
  });
  return (
    <motion.article
      className="journey-chapter"
      aria-labelledby={`journey-title-${index}`}
      aria-hidden={enhanced && active !== index ? true : undefined}
      inert={enhanced && active !== index}
      style={enhanced ? { opacity, transform } : undefined}
      data-active={active === index || undefined}
    >
      {children}
    </motion.article>
  );
}

export function ScrollJourney({
  heroRef,
  orbitRef,
}: {
  heroRef: RefObject<HTMLElement | null>;
  orbitRef: RefObject<OrbitControl | null>;
}) {
  const track = useRef<HTMLElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [enhanced, setEnhanced] = useState(false);
  const [orbReady, setOrbReady] = useState(false);
  const orbReadyRef = useRef(false);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const [category, setCategory] = useState(0);
  const [budget, setBudget] = useState(20);
  const [option, setOption] = useState(0);
  const [approved, setApproved] = useState(false);
  const [driver, setDriver] = useState(0);
  const [sharing, setSharing] = useState(false);
  const { scrollYProgress } = useScroll({ target: track, offset: ["start start", "end end"] });
  const example = EXAMPLES[category];
  const selected = option === 0 ? example.first : example.second;
  const selectedPrice = option === 0 ? example.price : example.otherPrice;
  const handoff = useOrbHandoff(heroRef, track, anchor, orbitRef, enhanced);
  const storyArrival = useTransform(handoff.arrival, [0, 0.65, 1], [0, 0, 1]);
  useMotionValueEvent(handoff.arrival, "change", (value) => {
    const ready = value === 1;
    if (orbReadyRef.current !== ready) {
      orbReadyRef.current = ready;
      setOrbReady(ready);
    }
  });
  const ringScale = useTransform(
    scrollYProgress,
    (p) => `scale(${0.55 + clamp((p - 5 / 7) * 7) * 1.5})`,
  );
  const ringOpacity = useTransform(scrollYProgress, (p) =>
    sharing ? clamp((p - 5 / 7) * 14) * 0.45 : 0,
  );

  useEffect(() => {
    const roomy = window.matchMedia("(min-height: 700px)");
    const update = () => setEnhanced(!reduced && roomy.matches);
    update();
    roomy.addEventListener("change", update);
    return () => roomy.removeEventListener("change", update);
  }, [reduced]);
  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const next = Math.min(CHAPTERS.length - 1, Math.floor(value * CHAPTERS.length));
    if (activeRef.current !== next) {
      activeRef.current = next;
      setActive(next);
    }
  });
  useEffect(() => {
    if (option === 1 && example.otherPrice >= budget) setOption(0);
  }, [budget, example.otherPrice, option]);
  useEffect(() => {
    setApproved(false);
  }, [selected, selectedPrice, example.time]);

  const jump = (index: number, fromKeyboard = false) => {
    const element = track.current;
    if (!element) return;
    if (!enhanced) {
      element
        .querySelector(`#journey-title-${index}`)
        ?.scrollIntoView({ behavior: "instant", block: "center" });
      return;
    }
    const rect = element.getBoundingClientRect();
    const range = element.offsetHeight - window.innerHeight;
    window.scrollTo({
      top: rect.top + window.scrollY + (range * (index + 0.34)) / CHAPTERS.length,
      behavior: fromKeyboard || reduced ? "instant" : "smooth",
    });
  };
  const changeCategory = (index: number) => {
    setCategory(index);
    setOption(0);
    setApproved(false);
  };

  const scene = (index: number) => {
    if (index === 0)
      return (
        <>
          <div className="journey-whispers" aria-hidden="true">
            <span>Under $20?</span>
            <span>I need a ride.</span>
            <span>Home by 10.</span>
            <span>Somewhere close.</span>
          </div>
          {enhanced && (
            <p className="journey-orb-hint">Move around the orb. Tap to bring a little chaos.</p>
          )}
        </>
      );
    if (index === 1)
      return (
        <div className="journey-panel journey-private">
          <div className="journey-panel__heading">
            <LockKeyhole className="size-4 text-primary" aria-hidden="true" />
            <span>Your side of the plan</span>
            <span className="journey-small-label">Private</span>
          </div>
          <p className="mt-6 text-base font-semibold">What feels right for your budget?</p>
          <div className="journey-budget mt-3" role="group" aria-label="Example budget">
            {[20, 30, 40].map((amount) => (
              <button
                type="button"
                key={amount}
                aria-pressed={budget === amount}
                onClick={() => setBudget(amount)}
              >
                Under ${amount}
              </button>
            ))}
          </div>
          <dl className="journey-details mt-5">
            <div>
              <dt>Back home</dt>
              <dd>By 10 pm</dd>
            </div>
            <div>
              <dt>Getting there</dt>
              <dd>I need a ride</dd>
            </div>
          </dl>
          <p className="mt-4 flex items-center gap-2 text-xs text-primary">
            <LockKeyhole className="size-3.5" aria-hidden="true" />
            Only you can see these answers.
          </p>
        </div>
      );
    if (index === 2)
      return (
        <div className="journey-panel">
          <div className="journey-panel__heading">
            <span>Options for your group</span>
            <span className="journey-small-label">{example.plan}</span>
          </div>
          {[example.first, example.second].map((place, i) => {
            const price = i === 0 ? example.price : example.otherPrice;
            const fits = price < budget;
            return (
              <button
                key={place}
                type="button"
                className="journey-option"
                aria-pressed={option === i && fits}
                disabled={!fits}
                onClick={() => setOption(i)}
              >
                <span className="journey-option__icon">
                  {fits ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : (
                    <LockKeyhole className="size-4" aria-hidden="true" />
                  )}
                </span>
                <span>
                  <span className="block font-semibold">{place}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {fits ? `$${price} each · Ride arranged` : "Doesn't meet every requirement"}
                  </span>
                </span>
                {option === i && fits && <span className="journey-choice">Chosen</span>}
              </button>
            );
          })}
          <p className="mt-4 text-xs text-muted-foreground">
            All eligible options fit the example group's limits.
          </p>
        </div>
      );
    if (index === 3)
      return (
        <div className="journey-panel">
          <div className="journey-panel__heading">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            <span>A clear picture</span>
            <span className="journey-small-label">Parent view</span>
          </div>
          <h3 className="mt-5 text-xl font-semibold">{selected}</h3>
          <dl className="journey-details mt-3">
            <div>
              <dt>When</dt>
              <dd>{example.time}</dd>
            </div>
            <div>
              <dt>Cost</dt>
              <dd>${selectedPrice} each</dd>
            </div>
            <div>
              <dt>Return</dt>
              <dd>Home by 10 pm</dd>
            </div>
          </dl>
          <button
            type="button"
            className="journey-primary mt-5"
            aria-pressed={approved}
            onClick={() => setApproved((value) => !value)}
          >
            {approved ? (
              <>
                <Check className="size-4" aria-hidden="true" />
                Example approved
              </>
            ) : (
              <>
                Approve example plan
                <ArrowRight className="size-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      );
    if (index === 4)
      return (
        <>
          <svg className="journey-route" viewBox="0 0 500 260" aria-hidden="true">
            <path
              d="M65 210 C65 120 200 240 240 130 S370 180 435 55"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="5 8"
            />
            <circle cx="65" cy="210" r="7" fill="currentColor" />
            <circle cx="435" cy="55" r="7" fill="currentColor" />
          </svg>
          <div className="journey-panel">
            <div className="journey-panel__heading">
              <Car className="size-4 text-primary" aria-hidden="true" />
              <span>Everyone has a ride</span>
            </div>
            <div className="journey-driver mt-5" role="group" aria-label="Inspect an example ride">
              {["Alex's car", "Jordan's car"].map((name, i) => (
                <button
                  type="button"
                  key={name}
                  aria-pressed={driver === i}
                  onClick={() => setDriver(i)}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="journey-passengers mt-5">
              <span className="journey-person">{driver === 0 ? "A" : "J"}</span>
              <div>
                <p className="font-semibold">
                  {driver === 0 ? "Alex + you + Sam" : "Jordan + Morgan"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {driver === 0 ? "3 of 4 seats filled" : "2 of 4 seats filled"} · Return ride
                  included
                </p>
              </div>
              <Check className="ml-auto size-5 text-primary" aria-hidden="true" />
            </div>
          </div>
        </>
      );
    if (index === 5)
      return (
        <>
          <div className="journey-radar" data-sharing={sharing || undefined} aria-hidden="true">
            <span />
            <span />
            <span />
            <motion.i
              style={enhanced ? { transform: ringScale, opacity: ringOpacity } : undefined}
            />
            <b className="journey-radar__pin journey-radar__pin--a">A</b>
            <b className="journey-radar__pin journey-radar__pin--j">J</b>
            <b className="journey-radar__pin journey-radar__pin--m">M</b>
          </div>
          <div className="journey-panel journey-radar-panel">
            <div className="journey-panel__heading">
              <MapPin className="size-4 text-primary" aria-hidden="true" />
              <span>Your location. Your call.</span>
            </div>
            <div className="mt-5 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">Example location sharing</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {sharing ? "Alex arrived · Jordan is 3 min away" : "Off until you choose"}
                </p>
              </div>
              <button
                type="button"
                className="journey-switch"
                role="switch"
                aria-checked={sharing}
                aria-label="Example location sharing"
                onClick={() => setSharing((value) => !value)}
              >
                <span />
              </button>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">Turn it off whenever you want.</p>
          </div>
        </>
      );
    return (
      <div className="journey-panel journey-final-panel">
        <div className="journey-panel__heading">
          <Check className="size-4 text-primary" aria-hidden="true" />
          <span>It's a plan.</span>
          <span className="journey-small-label">Illustrative example</span>
        </div>
        <h3 className="mt-5 text-2xl font-semibold">{selected}</h3>
        <ul className="mt-4 space-y-3 text-sm">
          <li className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" aria-hidden="true" />
            {example.time}
          </li>
          <li className="flex items-center gap-2">
            <Car className="size-4 text-primary" aria-hidden="true" />A ride there. A ride home.
          </li>
          <li className="flex items-center gap-2">
            <Check className="size-4 text-primary" aria-hidden="true" />${selectedPrice} each. Works
            for everyone.
          </li>
        </ul>
        <Link
          to="/auth"
          search={{ next: "/home", mode: "signup" }}
          className="journey-primary mt-6"
        >
          Start planning
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    );
  };

  return (
    <section
      ref={track}
      className="scroll-journey"
      id="journey"
      data-enhanced={enhanced || undefined}
      aria-label="How Syncly brings a plan together"
    >
      <div className="journey-stage">
        {enhanced && (
          <div ref={anchor} className="journey-shared-orb">
            <motion.div
              inert={!orbReady}
              aria-hidden={!orbReady || undefined}
              className="journey-orb-transfer"
              style={{
                transform: handoff.transform,
                transformOrigin: handoff.transformOrigin,
                opacity: handoff.opacity,
                pointerEvents: handoff.pointerEvents,
              }}
            >
              <JourneyOrb progress={scrollYProgress} arrival={handoff.arrival} />
            </motion.div>
          </div>
        )}
        <motion.div
          inert={enhanced && !orbReady}
          className="journey-inner"
          style={enhanced ? { opacity: storyArrival } : undefined}
        >
          {CHAPTERS.map((chapter, index) => (
            <SceneLayer
              key={chapter.label}
              progress={scrollYProgress}
              index={index}
              active={active}
              enhanced={enhanced}
            >
              <div className="journey-copy">
                <h2 id={`journey-title-${index}`}>
                  {chapter.title.map((line, i) => (
                    <span
                      key={line}
                      className={i === chapter.title.length - 1 ? "text-primary" : undefined}
                    >
                      {line}
                    </span>
                  ))}
                </h2>
                <p className="journey-description">{chapter.body}</p>
                {index === 0 ? (
                  <button
                    type="button"
                    className="journey-text-action"
                    onClick={(event) => jump(1, event.detail === 0)}
                  >
                    See how it comes together
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                ) : (
                  <p className="journey-note">{chapter.note}</p>
                )}
                {index === 6 && (
                  <Link to="/demo" className="journey-text-action">
                    Try the full demo
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                )}
              </div>
              <div className="journey-scene">
                {!enhanced && <span className="journey-static-orb" aria-hidden="true" />}
                {index > 0 && (
                  <div
                    className="journey-categories"
                    role="group"
                    aria-label="Choose an example hangout"
                  >
                    {EXAMPLES.map((item, i) => (
                      <button
                        type="button"
                        key={item.name}
                        aria-pressed={category === i}
                        onClick={() => changeCategory(i)}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                )}
                {scene(index)}
              </div>
            </SceneLayer>
          ))}
        </motion.div>
        <nav className="journey-nav" aria-label="Planning story chapters">
          {CHAPTERS.map((chapter, index) => (
            <button
              type="button"
              key={chapter.label}
              aria-label={chapter.label}
              aria-current={active === index && enhanced ? "step" : undefined}
              onClick={(event) => jump(index, event.detail === 0)}
            >
              <span className="journey-nav__dot" aria-hidden="true" />
              <span className="journey-nav__label">{chapter.label}</span>
              <span className="journey-nav__icon" aria-hidden="true">
                {(() => {
                  const Icon = CHAPTER_ICONS[index];
                  return <Icon size={17} />;
                })()}
              </span>
            </button>
          ))}
        </nav>
        <p className="journey-example-note">
          Interactive examples. Your changes stay in this preview.
        </p>
      </div>
    </section>
  );
}
