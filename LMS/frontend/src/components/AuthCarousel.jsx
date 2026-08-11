import React, { useEffect, useRef, useState } from 'react';
import kid from '../assets/kid.jpg';
import youth from '../assets/youth.jpg';
import teacher from '../assets/Teacher.jpg';
import old from '../assets/old.jpg';

const CAROUSEL_DATA = [
  {
    image: kid,
    title: 'Smart Classrooms for Kids',
    subtitle: 'Interactive lessons, engaging assignments, and real-time progress tracking for schools and young learners.',
  },
  {
    image: youth,
    title: 'AI-Powered Learning & Exams',
    subtitle: 'Master topics, join live sessions, and accelerate your study goals with smart AI assistance.',
  },
  {
    image: teacher,
    title: 'Teach, Track, and Grow',
    subtitle: 'Create lessons, guide learners, review submissions, and monitor classroom progress from one simple workspace.',
  },
  {
    image: old,
    title: 'All-in-One Teaching Workspace',
    subtitle: 'Manage schools, classrooms, curricula, and student payments seamlessly under one roof.',
  },
];

const CAROUSEL_INTERVAL = 7000;
const PAN_AMOUNT = 60;
const PAN_DURATION = 6500;

/**
 * Web port of the mobile AuthCarousel: full-bleed background with a slow
 * cinematic pan, cross-fade between slides, an overlaid title/subtitle, and
 * optional progress dots. Fills its parent container (no sizing of its own).
 */
const AuthCarousel = ({ showDots = false, hideText = false, className = '' }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const prevIndex = useRef(0);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      prevIndex.current = currentIndex;
      setTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % CAROUSEL_DATA.length);
        setTransitioning(false);
      }, 700);
    }, CAROUSEL_INTERVAL);
    return () => clearInterval(interval);
  }, [currentIndex]);

  const current = CAROUSEL_DATA[currentIndex];
  const prev = CAROUSEL_DATA[prevIndex.current];

  return (
    <div className={`relative h-full w-full overflow-hidden bg-slate-900 ${className}`}>
      {/* Previous slide fading out */}
      {transitioning && prevIndex.current !== currentIndex && (
        <div className="absolute inset-0 carousel-fade-out">
          <img
            src={prev.image}
            alt=""
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
          className="h-full w-full object-cover carousel-pan"
        />
      </div>

      {/* Dark overlay for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/30" />

      {/* Animated text content overlay */}
      {!hideText && (
        <div
          key={`text-${currentIndex}`}
          className="absolute inset-x-0 top-[12%] px-6 sm:px-10 carousel-text-rise"
        >
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-outfit font-black text-white mb-3 leading-tight drop-shadow-lg">
            {current.title}
          </h3>
          <p className="max-w-md text-sm sm:text-base lg:text-lg text-white/90 leading-relaxed drop-shadow-md">
            {current.subtitle}
          </p>
          {showDots && (
            <div className="flex items-center gap-2 mt-6">
              {CAROUSEL_DATA.map((_, index) => (
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
