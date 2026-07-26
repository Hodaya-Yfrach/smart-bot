"use client";

import Link from 'next/link';

// ============================================================================
// דף "אודות - Smart Bot"
// ============================================================================

export default function AboutPage() {
  return (
    <div dir="rtl" className="min-h-[100dvh] bg-[#efeae2] py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-8">
        <div className="flex items-center justify-between mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-3xl">ℹ️</span> אודות Smart Bot
          </h1>
          <Link
            href="/"
            className="text-sm text-pink-600 hover:underline shrink-0"
          >
            חזרה לצ'אט
          </Link>
        </div>

        {/* --- פתיח --- */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-3">מערכת הצ'אט החכמה שלך</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            Smart Bot היא מערכת צ'אט בינה מלאכותית (AI) מתקדמת, המציעה פתרונות ייחודיים שנועדו לשפר את חווית השיחה ולפתור מגבלות שקיימות באתרים אחרים. המערכת תוכננה להיות פשוטה, מאובטחת וידידותית לכל משתמש.
          </p>
        </section>

        {/* --- היכולות הייחודיות --- */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-3">מה הופך את המערכת למיוחדת?</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-700 leading-relaxed">
            <li>
              <span className="font-medium">אזור אישי ופרטי:</span> לכל משתמש יש אזור פרטי משלו, אליו נכנסים עם שם משתמש וסיסמה. שכחתם את הסיסמה? המערכת תשלח לכם בקלות קישור לאיפוס ישירות למייל.
            </li>
            <li>
              <span className="font-medium">תשובות ללא עיכובים:</span> המערכת מזהה עומסים, ואם המודל שבחרתם לא זמין, היא תעביר אתכם אוטומטית למודל חלופי ברקע כדי שהשיחה תמשיך לזרום.
            </li>
            <li>
              <span className="font-medium">פיצול שיחות מתוחכם:</span> אפשרות "לפצל" את הצ'אט לענף שונה, כדי לחקור מספר כיוונים בלי לאבד את רצף השיחה המקורית.
            </li>
            <li>
              <span className="font-medium">סיכומים חכמים:</span> תקציר קצר לכל תשובה, חלון צדדי למושגים חשובים שעלו בשיחה, וסיכום מקיף של כל השיחה בלחיצת כפתור.
            </li>
            <li>
              <span className="font-medium">רובוט שמתאים את עצמו אליכם:</span> באפשרותכם לקבוע "חוקים אישיים" שיהיו תקפים לשיחה אחת בלבד, או חוקים כלליים שילוו אתכם באופן קבוע.
            </li>
            <li>
              <span className="font-medium">ניהול היסטוריה נוח:</span> המערכת שומרת את 10 השיחות האחרונות שלכם, עם אפשרות לשנות כותרת או למחוק אותן לחלוטין.
            </li>
            <li>
              <span className="font-medium">שקיפות ותמיכה:</span> עמוד "אודות" מפורט וכפתור יצירת קשר נגיש לכל שאלה, רעיון או בקשה.
            </li>
          </ul>
        </section>

        {/* --- בפיתוח --- */}
        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-3">⏳ בקרוב (בפיתוח)</h2>
          <p className="text-gray-700 leading-relaxed">
            <span className="font-medium">עריכת הודעות:</span> היכולת לחזור אחורה ולערוך הודעה שכבר שלחתם לרובוט, כדי לדייק את הבקשה שלכם בקלות.
          </p>
        </section>
      </div>
    </div>
  );
}