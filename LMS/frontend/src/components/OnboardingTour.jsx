import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles, Layout, BookOpen, GraduationCap, Calendar, CreditCard, MousePointer2, Users, DollarSign } from 'lucide-react';

const ROLE_STEPS = {
  student: [
    {
      title: "Welcome to Gracified LMS!",
      content: "Ready to start your learning journey? Let's take a quick look around your student hub.",
      icon: <Sparkles className="w-8 h-8 text-amber-400" />,
      target: "body",
      position: "center"
    },
    {
      title: "Explore Classrooms",
      content: "Find your school classes or join new ones from the global marketplace here.",
      icon: <BookOpen className="w-8 h-8 text-emerald-500" />,
      target: "nav-classrooms",
      position: "right"
    },
    {
      title: "Exams & Assignments",
      content: "Keep track of all your upcoming assessments and view your submitted work here.",
      icon: <GraduationCap className="w-8 h-8 text-purple-500" />,
      target: "nav-exams",
      position: "right"
    },
    {
      title: "Payments & Invoices",
      content: "Manage your class enrollments and view your payment history in one place.",
      icon: <CreditCard className="w-8 h-8 text-rose-500" />,
      target: "nav-payments",
      position: "right"
    }
  ],
  school_admin: [
    {
      title: "Administrator Dashboard",
      content: "Welcome! Manage your institution's growth and academic performance from here.",
      icon: <Sparkles className="w-8 h-8 text-amber-400" />,
      target: "body",
      position: "center"
    },
    {
      title: "School Overview",
      content: "Review key statistics on total students, active teachers, and enrollment trends.",
      icon: <Layout className="w-8 h-8 text-indigo-500" />,
      target: "dashboard-main",
      position: "bottom"
    },
    {
      title: "User Management",
      content: "Easily manage your teaching staff and student database across all school branches.",
      icon: <Users className="w-8 h-8 text-blue-500" />,
      target: "nav-users",
      position: "right"
    },
    {
      title: "Institution Finances",
      content: "Track revenue streams, monitor disbursements, and manage subscription plans.",
      icon: <DollarSign className="w-8 h-8 text-emerald-600" />,
      target: "nav-payments",
      position: "right"
    }
  ],
  teacher_common: [
    {
      title: "Educator Workspace",
      content: "Welcome! Everything you need to create engaging classes and manage students is here.",
      icon: <Sparkles className="w-8 h-8 text-amber-400" />,
      target: "body",
      position: "center"
    },
    {
      title: "Classroom Creation",
      content: "Set up your virtual classrooms, define schedules, and customize your curriculum.",
      icon: <BookOpen className="w-8 h-8 text-emerald-500" />,
      target: "nav-classrooms",
      position: "right"
    },
    {
      title: "AI Assessment Tools",
      content: "Design comprehensive exams and assignments using our productivity-boosting AI tools.",
      icon: <GraduationCap className="w-8 h-8 text-purple-500" />,
      target: "nav-exams",
      position: "right"
    },
    {
      title: "Earnings & Analytics",
      content: "Watch your growth with detailed reports on student performance and your revenue.",
      icon: <Layout className="w-8 h-8 text-indigo-500" />,
      target: "nav-reports",
      position: "right"
    }
  ]
};

const OnboardingTour = ({ user }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const tourCardRef = useRef(null);

  const tourSteps = React.useMemo(() => {
    if (user?.role === 'student') return ROLE_STEPS.student;
    if (user?.role === 'school_admin') return ROLE_STEPS.school_admin;
    if (user?.role === 'personal_teacher' || user?.role === 'teacher') return ROLE_STEPS.teacher_common;
    return ROLE_STEPS.student; // Default
  }, [user?.role]);

  const updateSpotlight = useCallback(() => {
    const step = tourSteps[currentStep];
    if (!step || step.target === 'body') {
      setSpotlightRect(null);
      return;
    }

    const element = document.getElementById(step.target);
    if (element) {
      const rect = element.getBoundingClientRect();
      setSpotlightRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setSpotlightRect(null);
    }
  }, [currentStep, tourSteps]);

  useEffect(() => {
    // Show tour if it's one of the first 3 logins and hasn't been dismissed this session
    const isFirstLogins = user?.loginCount && user?.loginCount <= 3;
    const sessionDismissed = sessionStorage.getItem('tour_dismissed');
    
    if (isFirstLogins && !sessionDismissed) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  useEffect(() => {
    if (isVisible) {
      updateSpotlight();
      window.addEventListener('resize', updateSpotlight);
      return () => window.removeEventListener('resize', updateSpotlight);
    }
  }, [isVisible, currentStep, updateSpotlight]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleDismiss();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('tour_dismissed', 'true');
  };

  if (!isVisible || !tourSteps || tourSteps.length === 0) return null;

  const step = tourSteps[currentStep];

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Spotlight Overlay */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px] transition-all duration-500 pointer-events-auto" style={{
        maskImage: spotlightRect ? `radial-gradient(circle at ${spotlightRect.left + spotlightRect.width / 2}px ${spotlightRect.top + spotlightRect.height / 2}px, transparent ${Math.max(spotlightRect.width, spotlightRect.height) / 1.1}px, black ${Math.max(spotlightRect.width, spotlightRect.height)}px)` : 'none',
        WebkitMaskImage: spotlightRect ? `radial-gradient(circle at ${spotlightRect.left + spotlightRect.width / 2}px ${spotlightRect.top + spotlightRect.height / 2}px, transparent ${Math.max(spotlightRect.width, spotlightRect.height) / 1.1}px, black ${Math.max(spotlightRect.width, spotlightRect.height)}px)` : 'none',
      }} onClick={handleDismiss} />

      {/* Floating Pointer (Hand/Cursor icon next to target) */}
      {spotlightRect && (
        <div 
          className="absolute z-[10000] pointer-events-none transition-all duration-500 animate-bounce-pointer"
          style={{
            top: spotlightRect.top + spotlightRect.height / 2,
            left: spotlightRect.left + spotlightRect.width,
            transform: 'translate(10px, -50%)'
          }}
        >
          <div className="bg-indigo-600 p-2 rounded-full shadow-lg shadow-indigo-500/50">
            <MousePointer2 className="w-5 h-5 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Tour Card */}
      <div 
        ref={tourCardRef}
        className={`absolute z-[10001] transition-all duration-500 pointer-events-auto ${!spotlightRect ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm' : ''}`}
        style={spotlightRect ? {
          top: spotlightRect.top > window.innerHeight / 2 ? 'auto' : spotlightRect.top + spotlightRect.height + 20,
          bottom: spotlightRect.top > window.innerHeight / 2 ? window.innerHeight - spotlightRect.top + 20 : 'auto',
          left: Math.min(Math.max(20, spotlightRect.left), window.innerWidth - 380),
          width: '340px'
        } : {}}
      >
        <div className="bg-white rounded-[2rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] border border-slate-100 overflow-hidden">
           {/* Progress Bar */}
           <div className="h-1.5 w-full bg-slate-100 flex">
            {tourSteps.map((_, idx) => (
              <div 
                key={idx}
                className={`h-full transition-all duration-700 ${idx <= currentStep ? 'bg-indigo-600' : 'bg-transparent'}`}
                style={{ width: `${100 / tourSteps.length}%` }}
              />
            ))}
          </div>

          <div className="p-8">
            <button 
              onClick={handleDismiss}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                  {step.icon}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
                    {step.title}
                  </h3>
                   <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                    Step {currentStep + 1} of {tourSteps.length}
                  </div>
                </div>
              </div>

              <p className="text-slate-500 font-medium leading-relaxed text-sm mb-8">
                {step.content}
              </p>

              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={handlePrev}
                  className={`p-3 rounded-xl transition-all ${
                    currentStep === 0 
                      ? 'text-slate-200 pointer-events-none' 
                      : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                  }`}
                >
                  <ChevronLeft size={20} />
                </button>

                <div className="flex gap-2 flex-1">
                  <button
                    onClick={handleDismiss}
                    className="flex-1 px-4 py-2.5 text-slate-400 font-bold hover:text-slate-600 transition-all text-xs"
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex-3 flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all text-sm"
                  >
                    {currentStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
                    {currentStep < tourSteps.length - 1 && <ChevronRight size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bounce-pointer {
          0%, 100% { transform: translate(10px, -50%); }
          50% { transform: translate(25px, -50%); }
        }
        .animate-bounce-pointer {
          animation: bounce-pointer 1.5s ease-in-out infinite;
        }
      `}} />
    </div>
  );
};

export default OnboardingTour;
