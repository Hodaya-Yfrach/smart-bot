"use client";

import Link from 'next/link';

// ============================================================================
// דף "אודות - Smart Bot"
// ============================================================================

export default function AboutPage() {
  return (
    <div dir="rtl" className="min-h-[100dvh] bg-[#F8FAFC] py-12 px-4 relative overflow-hidden flex items-center justify-center font-sans">
      
      {/* רקע דקורטיבי מרחף */}
      <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-teal-100/40 rounded-full blur-[100px] -z-10 animate-pulse" style={{ animationDuration: '8s' }}></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[30rem] h-[30rem] bg-blue-100/40 rounded-full blur-[80px] -z-10 animate-pulse" style={{ animationDuration: '10s' }}></div>

      <div className="max-w-3xl w-full mx-auto bg-white/90 backdrop-blur-xl rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.05)] p-8 md:p-10 border border-white relative z-10">
        
        {/* --- האדר --- */}
        <header className="flex flex-wrap items-center justify-between mb-8 border-b border-slate-100 pb-6 gap-4">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 flex items-center gap-3 tracking-tight">
            <span className="text-3xl drop-shadow-sm">ℹ️</span> 
            אודות <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-blue-600">Smart Bot</span>
          </h1>
          <Link
            href="/"
            className="text-sm font-bold text-slate-500 hover:text-teal-600 bg-slate-50 border border-slate-200 hover:border-teal-200 hover:bg-teal-50 px-5 py-2.5 rounded-xl transition-all shadow-sm shrink-0"
          >
            חזרה לצ'אט ◂
          </Link>
        </header>

        <div className="overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar space-y-10">
          
          {/* --- פתיח --- */}
          <section className="bg-gradient-to-br from-slate-50 to-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-teal-500 rounded-full"></span>
              מערכת הצ'אט החכמה שלך
            </h2>
            <p className="text-slate-600 leading-relaxed font-medium">
              Smart Bot היא מערכת צ'אט בינה מלאכותית (AI) מתקדמת, המציעה פתרונות ייחודיים שנועדו לשפר את חווית השיחה ולפתור מגבלות שקיימות באתרים אחרים. המערכת תוכננה להיות פשוטה, מאובטחת וידידותית לכל משתמש.
            </p>
          </section>

          {/* --- היכולות הייחודיות --- */}
          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-5 pl-2">מה הופך את המערכת למיוחדת?</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* קלף תכונה */}
              <div className="bg-white border border-slate-200 p-5 rounded-2xl hover:border-teal-300 hover:shadow-md transition-all group">
                <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 text-lg mb-3 group-hover:scale-110 transition-transform">🔒</div>
                <h3 className="font-bold text-slate-800 mb-1">אזור אישי ופרטי</h3>
                <p className="text-sm text-slate-500 leading-relaxed">לכל משתמש אזור פרטי משלו (שם משתמש וסיסמה). ניתן לשחזר סיסמה בקלות למייל.</p>
              </div>

              {/* קלף תכונה */}
              <div className="bg-white border border-slate-200 p-5 rounded-2xl hover:border-blue-300 hover:shadow-md transition-all group">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 text-lg mb-3 group-hover:scale-110 transition-transform">⚡</div>
                <h3 className="font-bold text-slate-800 mb-1">תשובות ללא עיכובים</h3>
                <p className="text-sm text-slate-500 leading-relaxed">המערכת מזהה עומסים ועוברת אוטומטית למודל חלופי ברקע, כדי שהשיחה תמשיך לזרום.</p>
              </div>

              {/* קלף תכונה */}
              <div className="bg-white border border-slate-200 p-5 rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all group">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 text-lg mb-3 group-hover:scale-110 transition-transform">🔀</div>
                <h3 className="font-bold text-slate-800 mb-1">פיצול שיחות מתוחכם</h3>
                <p className="text-sm text-slate-500 leading-relaxed">אפשרות "לפצל" צ'אט לענף שונה לחקירת כיוונים חדשים, בלי לאבד את רצף השיחה המקורית.</p>
              </div>

              {/* קלף תכונה */}
              <div className="bg-white border border-slate-200 p-5 rounded-2xl hover:border-emerald-300 hover:shadow-md transition-all group">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 text-lg mb-3 group-hover:scale-110 transition-transform">📝</div>
                <h3 className="font-bold text-slate-800 mb-1">סיכומים חכמים</h3>
                <p className="text-sm text-slate-500 leading-relaxed">תקציר קצר לכל תשובה, חלון מושגים, וסיכום מקיף של כל השיחה בלחיצת כפתור.</p>
              </div>

              {/* קלף תכונה */}
              <div className="bg-white border border-slate-200 p-5 rounded-2xl hover:border-purple-300 hover:shadow-md transition-all group">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 text-lg mb-3 group-hover:scale-110 transition-transform">🧠</div>
                <h3 className="font-bold text-slate-800 mb-1">התאמה אישית</h3>
                <p className="text-sm text-slate-500 leading-relaxed">קביעת "חוקים אישיים" (זמניים או קבועים) שמנחים את הרובוט כיצד לענות לכם.</p>
              </div>

              {/* קלף תכונה */}
              <div className="bg-white border border-slate-200 p-5 rounded-2xl hover:border-sky-300 hover:shadow-md transition-all group">
                <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center text-sky-600 text-lg mb-3 group-hover:scale-110 transition-transform">📚</div>
                <h3 className="font-bold text-slate-800 mb-1">ניהול היסטוריה נוח</h3>
                <p className="text-sm text-slate-500 leading-relaxed">שמירה אוטומטית של 10 השיחות האחרונות, כולל שינוי כותרות ומחיקה מהירה.</p>
              </div>
            </div>
          </section>

          {/* --- בפיתוח --- */}
          <section className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 rounded-2xl border border-amber-100/60 shadow-sm relative overflow-hidden">
            <div className="absolute -left-6 -top-6 text-9xl opacity-5">⏳</div>
            <h2 className="text-lg font-bold text-amber-800 mb-2 flex items-center gap-2 relative z-10">
              <span className="text-xl">⏳</span> בקרוב (בפיתוח)
            </h2>
            <div className="relative z-10 pl-6 border-r-2 border-amber-200">
              <h3 className="font-bold text-amber-900 mb-1">עריכת הודעות</h3>
              <p className="text-amber-700/80 text-sm font-medium">
                היכולת לחזור אחורה ולערוך הודעה שכבר שלחתם לרובוט, כדי לדייק את הבקשה שלכם בקלות מבלי לכתוב הכל מחדש.
              </p>
            </div>
          </section>

        </div>
      </div>
      
      {/* סגנון פס גלילה מותאם אישית לדף זה */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 20px;
        }
      `}} />
    </div>
  );
}