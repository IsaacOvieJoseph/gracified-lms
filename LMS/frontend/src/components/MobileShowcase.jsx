import React, { useEffect, useRef, useState } from 'react';

// ── static imports ─────────────────────────────────────────────
import mobileVideo from '../../page_shots/mobile_video.mp4';
import playStoreLogo from '../../page_shots/Play-Store.png';
import appStoreLogo from '../../page_shots/App_Store.svg';

import ss1 from '../../page_shots/dashboard.PNG';
import ss2 from '../../page_shots/Classrooms.PNG';
import ss3 from '../../page_shots/Exams.PNG';
import ss4 from '../../page_shots/Reports.PNG';
import ss5 from '../../page_shots/find_a_tutor.PNG';
import ss6 from '../../page_shots/payments screen.PNG';
import ss7 from '../../page_shots/ClassroomDetail.PNG';
import ss8 from '../../page_shots/class_exams.PNG';
import ss9 from '../../page_shots/Assignment.PNG';
import ss10 from '../../page_shots/Exam Portal.PNG';
import ss11 from '../../page_shots/find_a_tutor2.PNG';
import ss12 from '../../page_shots/Gracy.PNG';

const SCREENSHOTS = [
  { src: ss1, label: 'Dashboard' },
  { src: ss2, label: 'Classrooms' },
  { src: ss7, label: 'Classroom Details' },
  { src: ss3, label: 'Exams' },
  { src: ss8, label: 'Class Exams' },
  { src: ss10, label: 'Exam Portal' },
  { src: ss9, label: 'Assignment' },
  { src: ss4, label: 'Reports & Analytics' },
  { src: ss5, label: 'Find a Tutor' },
  { src: ss11, label: 'Tutor Match' },
  { src: ss12, label: 'Gracy AI' },
  { src: ss6, label: 'Payments' },
];

const SLIDE_INTERVAL = 3200; // ms between auto-advances

/** Intersection-observer based reveal */
const Reveal = ({ children, delay = 0, className = '' }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('reveal-visible');
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal-on-scroll ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
};

const MobileShowcase = () => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [direction, setDirection] = useState('next');
  const [animating, setAnimating] = useState(false);
  const activeThumbRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => advance('next'), SLIDE_INTERVAL);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx]);

  useEffect(() => {
    activeThumbRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeIdx]);

  const advance = (dir) => {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setActiveIdx((prev) =>
        dir === 'next'
          ? (prev + 1) % SCREENSHOTS.length
          : (prev - 1 + SCREENSHOTS.length) % SCREENSHOTS.length
      );
      setAnimating(false);
    }, 420);
  };

  const goTo = (idx) => {
    if (idx === activeIdx || animating) return;
    setDirection(idx > activeIdx ? 'next' : 'prev');
    setAnimating(true);
    setTimeout(() => {
      setActiveIdx(idx);
      setAnimating(false);
    }, 420);
  };

  const slideClass = animating
    ? direction === 'next'
      ? 'ms-slide-out-left'
      : 'ms-slide-out-right'
    : 'ms-slide-in';

  return (
    <div className="relative z-10 py-8 sm:py-10 md:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-10 lg:gap-16">

          {/* LEFT: phone frame + CTA */}
          <Reveal className="flex-shrink-0 w-full lg:w-auto flex flex-col items-center gap-6">

            {/* Phone frame */}
            <div className="ms-phone-wrapper">
              <div className="ms-phone-notch" />
              <div className="ms-phone-screen">
                <video
                  src={mobileVideo}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="ms-phone-home-bar" />
            </div>

            {/* Store buttons */}
            <div className="flex flex-col items-center gap-3 w-full max-w-[260px]">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Download the App
              </p>
              <div className="flex gap-3 w-full">
                <div className="ms-store-btn group relative flex-1" title="Coming Soon">
                  <img src={playStoreLogo} alt="Get it on Google Play" className="h-10 w-full object-contain opacity-50" />
                  <span className="ms-coming-soon">Coming Soon</span>
                </div>
                <div className="ms-store-btn group relative flex-1" title="Coming Soon">
                  <img src={appStoreLogo} alt="Download on App Store" className="h-10 w-full object-contain opacity-50" />
                  <span className="ms-coming-soon">Coming Soon</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground/60 text-center">
                Mobile app launching soon &middot; Stay tuned!
              </p>
            </div>
          </Reveal>

{/* RIGHT: screenshot carousel */}
          <div className="flex-1 w-full min-w-0">
            {/* Big active screenshot */}
            <Reveal delay={200}>
              <div className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm ms-screenshot-frame">
                <div className="absolute top-3 left-3 z-20 px-3 py-1 rounded-full bg-primary/90 text-primary-foreground text-xs font-semibold backdrop-blur shadow-sm">
                  {SCREENSHOTS[activeIdx].label}
                </div>
                <img
                  key={activeIdx}
                  src={SCREENSHOTS[activeIdx].src}
                  alt={SCREENSHOTS[activeIdx].label}
                  className={`w-full h-full object-contain ${slideClass}`}
                />
                <button
                  onClick={() => advance('prev')}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur transition-all text-xl leading-none opacity-50 hover:opacity-90"
                  aria-label="Previous"
                >
                  &#8249;
                </button>
                <button
                  onClick={() => advance('next')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur transition-all text-xl leading-none opacity-50 hover:opacity-90"
                  aria-label="Next"
                >
                  &#8250;
                </button>

                {/* dot indicators - faded overlay on the image */}
                <div className="absolute inset-x-0 bottom-2.5 z-10 flex justify-center">
                  <div className="flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur px-2.5 py-1.5 opacity-60">
                    {SCREENSHOTS.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => goTo(i)}
                        className={`rounded-full transition-all duration-300 ${
                          i === activeIdx
                            ? 'w-5 h-2 bg-white'
                            : 'w-2 h-2 bg-white/50 hover:bg-white/80'
                        }`}
                        aria-label={`Go to slide ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>

                {/* hover-only thumbnail overlay */}
                <div className="absolute inset-x-0 bottom-0 z-10 px-2 pb-8 pt-12 bg-gradient-to-t from-black/75 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto">
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar snap-x snap-mandatory">
                    {SCREENSHOTS.map((shot, i) => (
                      <button
                        key={i}
                        ref={i === activeIdx ? activeThumbRef : null}
                        onClick={() => goTo(i)}
                        className={`relative shrink-0 w-16 snap-center rounded-lg overflow-hidden border-2 transition-all duration-300 ${
                          i === activeIdx
                            ? 'border-white shadow-sm scale-105'
                            : 'border-transparent opacity-60 hover:opacity-90'
                        }`}
                        aria-label={shot.label}
                      >
                        <img src={shot.src} alt={shot.label} className="w-full aspect-video object-cover object-top" />
                        {i === activeIdx && (
                          <div
                            className="absolute inset-x-0 bottom-0 h-0.5 bg-white"
                            style={{ animation: `ms-progress ${SLIDE_INTERVAL}ms linear forwards` }}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileShowcase;
