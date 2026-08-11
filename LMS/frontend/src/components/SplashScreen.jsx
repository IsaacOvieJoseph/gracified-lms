import React, { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import iconLight from '../assets/gracified/icon-light.png';
import iconDark from '../assets/gracified/icon-dark.png';
import titleLight from '../assets/gracified/title-light.png';
import titleDark from '../assets/gracified/title-dark.png';
import subtitleLight from '../assets/gracified/subtitle-light.png';
import subtitleDark from '../assets/gracified/subtitle-dark.png';

/**
 * Animated Gracified LMS splash / intro screen for the web.
 *
 * Sequence (matches the mobile version):
 *   0.3s  book icon fades/scales in (with an overshoot pop + glow pulse)
 *   1.9s  "Gracified" slides up + fades in
 *   3.1s  "Learning Management System" slides up + fades in
 *   4.3s  loading bar fades in and starts looping its gradient sweep
 *   ~5.0s onFinish() fires and the splash fades out
 *
 * Ambient drifting particles float across the stage for liveliness.
 */
const PARTICLES = [
  { top: 25, left: 14, size: 5, delay: 3200, color: '#4fd1ff' },
  { top: 62, left: 70, size: 4, delay: 4400, color: '#3b6fe0' },
  { top: 72, left: 24, size: 5, delay: 5600, color: '#4fd1ff' },
  { top: 34, left: 62, size: 3, delay: 6600, color: '#5b4fd6' },
  { top: 20, left: 55, size: 4, delay: 5000, color: '#3b6fe0' },
  { top: 80, left: 45, size: 4, delay: 4000, color: '#5b4fd6' },
  { top: 48, left: 88, size: 3, delay: 3800, color: '#4fd1ff' },
  { top: 15, left: 30, size: 3, delay: 7200, color: '#5b4fd6' },
  { top: 66, left: 8, size: 4, delay: 3000, color: '#3b6fe0' },
  { top: 40, left: 45, size: 5, delay: 6800, color: '#4fd1ff' },
];

const SplashScreen = ({ onFinish }) => {
  const { theme } = useTheme();
  const [leaving, setLeaving] = useState(false);

  const isDark = theme === 'dark';

  useEffect(() => {
    const finishTimer = setTimeout(() => {
      setLeaving(true);
      setTimeout(onFinish, 600);
    }, 5000);
    return () => clearTimeout(finishTimer);
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-700 ${
        leaving ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ backgroundColor: isDark ? '#0a0d1f' : '#fbfcff' }}
    >
      {/* Ambient drifting particles */}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-[2px] splash-particle"
          style={{
            top: `${p.top}%`,
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: `${p.delay}ms`,
          }}
        />
      ))}

      {/* Logo lockup */}
      <div className="relative w-[min(420px,80vw)] splash-lockup">
        {/* Glow pulse behind the icon */}
        <span
          className="absolute rounded-full splash-glow"
          style={{
            left: '10%',
            top: '10%',
            width: '30%',
            height: '34%',
            backgroundColor: '#4fd1ff',
          }}
        />
        <img
          src={isDark ? iconDark : iconLight}
          alt=""
          className="splash-icon block w-[40%] mx-auto"
        />
        <img
          src={isDark ? titleDark : titleLight}
          alt="Gracified"
          className="splash-rise block w-[46%] mx-auto mt-4"
          style={{ animationDelay: '1.9s' }}
        />
        <img
          src={isDark ? subtitleDark : subtitleLight}
          alt="Learning Management System"
          className="splash-rise block w-[62%] mx-auto mt-2"
          style={{ animationDelay: '3.1s' }}
        />
      </div>

      {/* Loading bar with looping gradient sweep */}
      <div className="splash-loader mt-12 w-[168px] h-[3px] rounded-full overflow-hidden">
        <div className="splash-loader-fill h-full w-[40%] rounded-full" />
      </div>
    </div>
  );
};

export default SplashScreen;
