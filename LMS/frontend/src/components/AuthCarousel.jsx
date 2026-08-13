import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import kid from '../assets/kid.jpg';
import youth from '../assets/youth.jpg';
import teacher from '../assets/Teacher.jpg';
import old from '../assets/old.jpg';

export const CAROUSEL_DATA = [
  {
    image: kid,
    title: 'Smart Classrooms for Kids',
    subtitle: 'Interactive lessons, engaging assignments, and real-time progress tracking for schools and young learners.',
    registerTo: '/register/student',
    registerLabel: 'Register as Student',
  },
  {
    image: youth,
    title: 'AI-Powered Learning & Exams',
    subtitle: 'Master topics, join live sessions, and accelerate your study goals with smart AI assistance.',
    registerTo: '/register/student',
    registerLabel: 'Register as Student',
  },
  {
    image: teacher,
    title: 'Teach, Track, and Grow',
    subtitle: 'Create lessons, guide learners, review submissions, and monitor classroom progress from one simple workspace.',
    registerTo: '/register/personal-teacher',
    registerLabel: 'Register as Teacher',
    objectPosition: '50% 33%',
  },
  {
    image: old,
    title: 'All-in-One Teaching Workspace',
    subtitle: 'Manage schools, classrooms, curricula, and student payments seamlessly under one roof.',
    registerTo: '/register/school-admin',
    registerLabel: 'Register as School Admin',
  },
];

const CAROUSEL_INTERVAL = 7000;
const PAN_AMOUNT = 60;
const PAN_DURATION = 6500;

/**
 * Web port of the mobile AuthCarousel: full-bleed background with a slow
 * cinematic pan, cross-fade between slides, an overlaid title/subtitle, and
 * optional progress dots. Fills its parent container (no sizing of its own).
 *
 * Pass `slides` to supply custom slide data. When a slide includes
 * `registerTo`/`registerLabel` and `showRegister` is true, a matching
 * "Register as..." button is rendered on that slide.
 */
const AuthCarousel = ({
  showDots = false,
  hideText = false,
  showRegister = false,
  slides = CAROUSEL_DATA,
  className = '',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const prevIndex = useRef(0);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      prevIndex.current = currentIndex;
      setTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % slides.length);
        setTransitioning(false);
      }, 700);
    }, CAROUSEL_INTERVAL);
    return () => clearInterval(interval);
  }, [currentIndex, slides.length]);

  const current = slides[currentIndex];
  const prev = slides[prevIndex.current];

  return (
    <div className={`absolute inset-0 overflow-hidden bg-slate-900 ${className}`}>
      {/* Previous slide fading out */}
      {transitioning && prevIndex.current !== currentIndex && (
        <div className="absolute inset-0 carousel-fade-out">
          <img
            src={prev.image}
            alt=""
            style={{ objectPosition: prev.objectPosition }}
            className="h-full w-full object-cover carousel-pan"
          />
        </div>
      )}

      {/* Active slide */}
      <div
        key={currentIndex}
        className={`absolute inset-0 ${transitioning ? 'carousel-fade-in' : ''}`}
      >
        <img
          src={current.image}
          alt={current.title}
          style={{ objectPosition: current.objectPosition || 'center top' }}
          className="h-full w-full object-cover carousel-pan"
        />
      </div>

      {/* Dark overlay for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/30" />

      {/* Animated text content overlay */}
      {!hideText && (
        <div
          key={`text-${currentIndex}`}
          className="absolute inset-x-0 top-[10%] px-6 sm:px-10 carousel-text-rise"
        >
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-outfit font-black text-white mb-3 leading-tight drop-shadow-lg">
            {current.title}
          </h3>
          <p className="max-w-md text-sm sm:text-base lg:text-lg text-white/90 leading-relaxed drop-shadow-md">
            {current.subtitle}
          </p>

          {showRegister && current.registerTo && (
            <Link
              to={current.registerTo}
              className="inline-flex items-center gap-2 mt-6 px-5 py-3 rounded-xl bg-white text-primary font-semibold text-sm sm:text-base hover:bg-white/90 hover:scale-105 transition-all shadow-lg"
            >
              {current.registerLabel || 'Register'}
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}

          {showDots && (
            <div className="flex items-center gap-2 mt-6">
              {slides.map((_, index) => (
                <span
                  key={index}
                  className={`h-2 rounded-full transition-all duration-500 ${
                    index === currentIndex ? 'w-6 bg-white' : 'w-2 bg-white/40'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AuthCarousel;
