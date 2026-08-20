"use client";

import { useState } from 'react';

interface ApiKeyGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

const steps = [
  {
    title: 'למה בכלל צריך מפתח אישי?',
    text: 'אפשר להמשיך גם בלי מפתח אישי: האתר ישתמש זמנית במפתח המערכת. מפתח אישי נותן לך מכסה נפרדת, שליטה טובה יותר בשימוש, ופחות תלות במשתמשים אחרים.',
    visual: 'why',
  },
  {
    title: 'פותחים את Google AI Studio',
    text: 'לחץ על הכפתור למטה. ייפתח אתר של Google בחלון חדש. זה אתר רשמי של Google, ולא צריך לדעת תכנות כדי להשתמש בו.',
    link: 'https://aistudio.google.com/app/apikey',
    linkText: 'פתיחת Google AI Studio',
    visual: 'studio',
  },
  {
    title: 'מתחברים אם Google מבקשת',
    text: 'אם מופיע מסך התחברות, הזן את כתובת Gmail שלך ולחץ על הבא. לאחר מכן הזן את הסיסמה ולחץ שוב על הבא. אם יש אימות בטלפון, אשר אותו לפי ההוראות של Google.',
    visual: 'login',
  },
  {
    title: 'יוצרים ומעתיקים את המפתח',
    text: 'בעמוד שנפתח חפש כפתור בשם Create API key או יצירת מפתח API. לחץ עליו, המתן כמה שניות, ואז לחץ על סמל ההעתקה ליד המפתח. אין צורך לבחור פרויקט או לשנות הגדרות.',
    visual: 'key',
  },
  {
    title: 'מדביקים באתר',
    text: 'חזור לאתר, פתח הגדרות, הדבק את המפתח בשדה מפתח API אישי ולחץ על שמירת שינויים. מעכשיו הבקשות שלך ישתמשו במפתח האישי שלך.',
    visual: 'paste',
  },
];

function GuideVisual({ type }: { type: string }) {
  if (type === 'why') return <div className="grid grid-cols-2 gap-2"><div className="rounded-xl bg-teal-50 p-3 text-center"><div className="text-2xl">🛡️</div><span className="text-[11px] font-bold text-teal-800">שליטה אישית</span></div><div className="rounded-xl bg-blue-50 p-3 text-center"><div className="text-2xl">⚡</div><span className="text-[11px] font-bold text-blue-800">מכסה נפרדת</span></div></div>;
  if (type === 'login') return <div className="mx-auto max-w-[230px] rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="mb-2 h-2 w-20 rounded bg-slate-200" /><div className="mb-2 h-8 rounded border border-slate-200 bg-slate-50" /><div className="h-8 rounded-lg bg-blue-600 text-center text-[11px] font-bold leading-8 text-white">הבא</div></div>;
  if (type === 'key') return <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="mb-2 flex items-center justify-between"><span className="h-2 w-28 rounded bg-slate-200" /><span className="rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-bold text-white">Create API key</span></div><div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2"><span className="h-2 flex-1 rounded bg-slate-300" /><span>📋</span></div></div>;
  if (type === 'paste') return <div className="rounded-xl border border-teal-100 bg-teal-50 p-3"><div className="mb-2 text-[11px] font-bold text-slate-700">מפתח API אישי</div><div className="mb-2 h-8 rounded-lg border border-teal-200 bg-white px-2 text-left text-xs leading-8 text-slate-400">••••••••••••••</div><div className="rounded-lg bg-slate-800 py-2 text-center text-[11px] font-bold text-white">שמירת שינויים</div></div>;
  return <div className="mx-auto flex h-16 max-w-[230px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-3xl shadow-inner">🌐</div>;
}

export default function ApiKeyGuide({ isOpen, onClose, onOpenSettings }: ApiKeyGuideProps) {
  const [stepIndex, setStepIndex] = useState(0);
  if (!isOpen) return null;

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const closeGuide = () => {
    setStepIndex(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" dir="rtl">
      <button className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeGuide} aria-label="סגירת מדריך" />
      <section className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-teal-100 bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-teal-600 to-blue-700 px-6 py-7 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-teal-100">מדריך פשוט וברור</p>
                <h2 className="text-2xl font-extrabold">מפתח AI אישי, צעד אחר צעד</h2>
                <p className="mt-2 text-sm leading-relaxed text-teal-50">לא צריך לדעת קוד, תכנות או מושגים טכניים.</p>
            </div>
            <button onClick={closeGuide} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-lg hover:bg-white/25" aria-label="סגירת מדריך">✕</button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-6 flex gap-1.5">
            {steps.map((item, index) => <div key={item.title} className={`h-1.5 flex-1 rounded-full ${index <= stepIndex ? 'bg-teal-500' : 'bg-slate-200'}`} />)}
          </div>
          <div className="mb-7 rounded-2xl border border-slate-100 bg-slate-50 p-5">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 font-extrabold text-teal-700">{stepIndex + 1}</span>
              <h3 className="text-lg font-extrabold text-slate-800">{step.title}</h3>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">{step.text}</p>
            <div className="mt-4"><GuideVisual type={step.visual} /></div>
            {step.link && <a href={step.link} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-bold text-teal-700 shadow-sm ring-1 ring-teal-100 hover:bg-teal-50">{step.linkText} ↗</a>}
          </div>
          <div className="flex items-center justify-between gap-3">
            <button onClick={closeGuide} className="text-sm font-bold text-slate-400 hover:text-slate-700">לא עכשיו</button>
            {isLast ? (
              <button onClick={() => { closeGuide(); onOpenSettings(); }} className="rounded-xl bg-slate-800 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-700">פתיחת הגדרות</button>
            ) : (
              <button onClick={() => setStepIndex((index) => index + 1)} className="rounded-xl bg-teal-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-teal-700">הבא ←</button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
