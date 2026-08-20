import Link from 'next/link';

export default function AboutPage() {
  const features = [
    {
      icon: '🤖',
      title: 'שיחת AI מתקדמת',
      desc: 'שיחה עם מגוון מודלים של Gemini — Flash לשאלות מהירות, Pro לניתוח עמוק. מודל ברירת המחדל עובר אוטומטית למודל גיבוי אם יש עומס.',
    },
    {
      icon: '🖼️',
      title: 'תמיכה בתמונות',
      desc: 'צרפי תמונה לשאלה וה-AI יתאר, ינתח ויענה עליה. מודלי Vision של Gemini תומכים ב-JPEG, PNG, WebP ו-GIF.',
    },
    {
      icon: '✨',
      title: 'יצירת תמונות',
      desc: 'בחרי מודל יצירת תמונות, כתבי תיאור ו-AI ייצור תמונה בהתאם. אפשר להוריד את התמונה שנוצרה ישירות מהצ\'אט.',
    },
    {
      icon: '📄',
      title: 'תקציר שיחה חכם',
      desc: 'לחצי "תקציר" בסוף שיחה — המערכת מייצרת סיכום עם נקודות מרכזיות ומושגים חדשים, ושומרת אותו ב-DB. פתיחה חוזרת מציגה את השמור ישר, ו-🔄 מאפשר עדכון.',
    },
    {
      icon: '🧠',
      title: 'זיכרון וכללים',
      desc: 'הגדירי כללים קבועים שתקפים לכל השיחות ("תמיד תענה בעברית") וכללים ספציפיים לשיחה אחת. הכללים משפיעים על כל תשובה.',
    },
    {
      icon: '💡',
      title: 'חלון התייעצות',
      desc: 'פאנל צדדי שמאפשר לשאול שאלות על השיחה הראשית מבלי להשפיע עליה — שימושי לניתוח קוד, בדיקת הבנה, ופיתוח רעיונות.',
    },
    {
      icon: '🔑',
      title: 'מפתח API אישי (BYOK)',
      desc: 'הביאי מפתח Gemini משלך לשימוש בלתי מוגבל. המפתח נשמר מאובטח בחשבון ומשמש בכל מחשב שממנו תתחברי.',
    },
    {
      icon: '📚',
      title: 'היסטוריית שיחות',
      desc: 'כל השיחות נשמרות ב-Supabase ומאורגנות בסרגל הצד. ניתן לפתוח שיחה ישנה, לערוך את כותרתה, או למחוק — מחיקה מוחקת גם את התקציר אוטומטית.',
    },
    {
      icon: '🗺️',
      title: 'מדריך היכרות',
      desc: 'בכניסה הראשונה מוצג מדריך אינטראקטיבי שמסביר כל כפתור עם חץ ובועת הסבר. ניתן לצפות בו שוב בכל עת דרך כפתור "תדריך" בכותרת.',
    },
    {
      icon: '✏️',
      title: 'עריכת שאלה אחרונה',
      desc: 'לחצי "עריכת שאלה" בהודעה האחרונה — הטקסט חוזר לתיבת הקלט, ההמשך נמחק מה-DB, ואפשר לשלוח מחדש עם שינויים.',
    },
    {
      icon: '🔄',
      title: 'Fallback אוטומטי',
      desc: 'אם המודל שבחרת עמוס, המערכת עוברת אוטומטית למודל הבא ברשימה ומציגה הודעה. מודלים עמוסים משתחררים אחרי כדקה.',
    },
    {
      icon: '🔒',
      title: 'גישת אורח',
      desc: 'ניתן לנסות את המערכת שאלה אחת ללא הרשמה — מאובטח עם cookie חתום חד-פעמי. להמשך נדרש חשבון.',
    },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-16">
      <div className="max-w-4xl mx-auto">

        {/* כותרת */}
        <div className="text-center mb-16">
          <div className="w-20 h-20 bg-gradient-to-tr from-slate-800 to-slate-600 rounded-3xl flex items-center justify-center mx-auto mb-6 text-4xl shadow-xl shadow-slate-300/40 rotate-3 hover:rotate-0 transition-all duration-500">
            🤖
          </div>
          <h1 className="text-4xl font-extrabold text-slate-800 mb-4 tracking-tight">AI Workspace</h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto leading-relaxed">
            סביבת עבודה חכמה המבוססת על Gemini — שיחה, ניתוח תמונות, יצירת תמונות, זיכרון וסיכומים, הכל במקום אחד.
          </p>
        </div>

        {/* כרטיסיות */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-16">
          {features.map((f, i) => (
            <div
              key={i}
              className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-teal-100 transition-all duration-300 flex gap-4"
            >
              <div className="text-3xl shrink-0 mt-0.5">{f.icon}</div>
              <div>
                <h2 className="font-extrabold text-slate-800 mb-1.5 text-[15px]">{f.title}</h2>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* קישורים */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-slate-800 text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 shadow-md text-sm"
          >
            ← חזרה לצ&#39;אט
          </Link>
          <p className="mt-6 text-xs text-slate-400">
            בנוי עם Next.js · Supabase · Gemini API · Tailwind CSS
          </p>
        </div>
      </div>
    </div>
  );
}
