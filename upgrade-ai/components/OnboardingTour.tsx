"use client";

// =============================================================================
// OnboardingTour — מדריך היכרות אינטראקטיבי
//
// מציג tooltip עם חץ שמצביע על אלמנט בממשק.
// מתקדם בין שלבים עד שנגמרים, ואז נסגר ושומר ב-localStorage.
// כפתור "תדריך" ב-header מאפשר הפעלה מחדש בכל עת.
//
// שימוש:
//   <OnboardingTour steps={TOUR_STEPS} onDone={() => setTourOpen(false)} />
//
// כל שלב:
//   targetId  — id של האלמנט שמצביעים עליו (data-tour-id="..." ב-JSX)
//   title     — כותרת בועת ההסבר
//   text      — טקסט מפרט
//   position  — איפה מופיעה הבועה יחסית לאלמנט: top | bottom | left | right
// =============================================================================

import { useEffect, useState, useCallback } from 'react';

export interface TourStep {
  targetId: string;
  title: string;
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface Props {
  steps: TourStep[];
  onDone: () => void;
}

const ARROW_SIZE = 10; // px — גודל החץ
const OFFSET = 14;     // px — מרווח בין הבועה לאלמנט

export const TOUR_DONE_KEY = 'upgrade-ai-tour-done';

export default function OnboardingTour({ steps, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = steps[index];

  // מציאת מיקום האלמנט הנוכחי
  const measureTarget = useCallback(() => {
    const el = document.querySelector(`[data-tour-id="${step.targetId}"]`);
    if (el) setRect(el.getBoundingClientRect());
  }, [step?.targetId]);

  useEffect(() => {
    measureTarget();
    window.addEventListener('resize', measureTarget);
    window.addEventListener('scroll', measureTarget, true);
    return () => {
      window.removeEventListener('resize', measureTarget);
      window.removeEventListener('scroll', measureTarget, true);
    };
  }, [measureTarget]);

  const handleNext = () => {
    if (index < steps.length - 1) {
      setIndex(i => i + 1);
    } else {
      localStorage.setItem(TOUR_DONE_KEY, '1');
      onDone();
    }
  };

  const handleSkip = () => {
    localStorage.setItem(TOUR_DONE_KEY, '1');
    onDone();
  };

  if (!rect || !step) return null;

  const pos = step.position ?? 'bottom';

  // חישוב מיקום הבועה
  const bubbleStyle = (() => {
    const w = 280;
    switch (pos) {
      case 'bottom': return {
        top:  rect.bottom + OFFSET + window.scrollY,
        left: Math.max(8, rect.left + rect.width / 2 - w / 2 + window.scrollX),
        width: w,
      };
      case 'top': return {
        top:  rect.top - OFFSET + window.scrollY,
        left: Math.max(8, rect.left + rect.width / 2 - w / 2 + window.scrollX),
        width: w,
        transform: 'translateY(-100%)',
      };
      case 'right': return {
        top:  rect.top + rect.height / 2 + window.scrollY,
        left: rect.right + OFFSET + window.scrollX,
        width: w,
        transform: 'translateY(-50%)',
      };
      case 'left': return {
        top:  rect.top + rect.height / 2 + window.scrollY,
        left: rect.left - w - OFFSET + window.scrollX,
        width: w,
        transform: 'translateY(-50%)',
      };
    }
  })();

  // מיקום החץ
  const arrowStyle = (() => {
    const cx = rect.left + rect.width / 2 + window.scrollX;
    const cy = rect.top + rect.height / 2 + window.scrollY;
    switch (pos) {
      case 'bottom': return {
        top:  rect.bottom + OFFSET / 2 + window.scrollY - ARROW_SIZE / 2,
        left: cx - ARROW_SIZE / 2,
      };
      case 'top': return {
        top:  rect.top - OFFSET / 2 + window.scrollY - ARROW_SIZE / 2,
        left: cx - ARROW_SIZE / 2,
      };
      case 'right': return {
        top:  cy - ARROW_SIZE / 2,
        left: rect.right + OFFSET / 2 + window.scrollX - ARROW_SIZE / 2,
      };
      case 'left': return {
        top:  cy - ARROW_SIZE / 2,
        left: rect.left - OFFSET / 2 + window.scrollX - ARROW_SIZE / 2,
      };
    }
  })();

  return (
    <>
      {/* overlay שקוף — לחיצה על מחוץ מדלגת */}
      <div
        className="fixed inset-0 z-[9998]"
        onClick={handleSkip}
        aria-hidden
      />

      {/* הדגשת האלמנט */}
      <div
        className="fixed z-[9999] rounded-xl ring-2 ring-teal-500 ring-offset-2 pointer-events-none animate-pulse"
        style={{
          top:    rect.top    + window.scrollY - 4,
          left:   rect.left   + window.scrollX - 4,
          width:  rect.width  + 8,
          height: rect.height + 8,
        }}
      />

      {/* חץ */}
      <div
        className="fixed z-[10000] pointer-events-none"
        style={{
          ...arrowStyle,
          width:  ARROW_SIZE * 2,
          height: ARROW_SIZE * 2,
        }}
      >
        <svg viewBox="0 0 20 20" fill="none" className="w-full h-full drop-shadow">
          {pos === 'bottom' && <polygon points="10,2 18,18 2,18" fill="#0d9488" />}
          {pos === 'top'    && <polygon points="10,18 18,2 2,2"  fill="#0d9488" />}
          {pos === 'right'  && <polygon points="2,10 18,2 18,18" fill="#0d9488" />}
          {pos === 'left'   && <polygon points="18,10 2,2 2,18"  fill="#0d9488" />}
        </svg>
      </div>

      {/* בועת הסבר */}
      <div
        className="fixed z-[10000] bg-white rounded-2xl shadow-2xl border border-teal-100 p-5 animate-fade-in"
        style={bubbleStyle}
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* מד התקדמות */}
        <div className="flex gap-1 mb-3">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= index ? 'bg-teal-500' : 'bg-slate-200'}`}
            />
          ))}
        </div>

        <p className="text-sm font-extrabold text-slate-800 mb-1">{step.title}</p>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">{step.text}</p>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={handleSkip}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors font-medium"
          >
            דלג על הכל
          </button>
          <button
            onClick={handleNext}
            className="bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold px-5 py-2 rounded-xl transition-colors shadow-sm"
          >
            {index < steps.length - 1 ? 'הבא ←' : 'סיום ✓'}
          </button>
        </div>
      </div>
    </>
  );
}
