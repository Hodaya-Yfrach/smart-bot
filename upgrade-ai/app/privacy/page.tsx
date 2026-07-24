import Link from 'next/link'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4" dir="rtl">
      <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">מדיניות פרטיות</h1>
        
        <div className="space-y-6 text-gray-700 leading-relaxed">
          <p>
            אנו מכבדים את פרטיותך ומחויבים להגן על המידע האישי שלך. מסמך זה מפרט כיצד אנו אוספים, שומרים ומשתמשים במידע במסגרת הפרויקט.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">1. איסוף מידע</h2>
            <p>אנו אוספים את כתובת הדואר האלקטרוני שלך ושמך המלא בעת ההרשמה למערכת. נתונים נוספים הנשמרים כוללים את תוכן ההודעות והפעולות שאתה מבצע בתוך האפליקציה לצורך תפעולה התקין.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">2. שימוש במידע</h2>
            <p>המידע משמש אך ורק לצורך זיהוי אישי (Authentication), הצגת הנתונים הרלוונטיים לחשבונך (כגון היסטוריית פעולות), ולשיפור חווית המשתמש במערכת.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">3. אבטחת מידע</h2>
            <p>הסיסמאות במערכת אינן נשמרות בטקסט גלוי אלא מוצפנות באופן מאובטח באמצעות שירותי Supabase. המערכת עושה שימוש במנגנוני הרשאות מבוססי שורות (Row Level Security) כדי להבטיח שכל משתמש חשוף אך ורק למידע האישי שלו.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">4. שיתוף צד שלישי</h2>
            <p>איננו מעבירים, מוכרים או משתפים את המידע האישי שלך עם אף גורם צד שלישי מסחרי.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">5. זכויות המשתמש</h2>
            <p>המשתמש רשאי לבקש את מחיקת חשבונו וכלל המידע המקושר אליו בכל עת. המחיקה תתבצע באופן מוחלט ממסד הנתונים של הפרויקט.</p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200 text-center">
          <Link href="/" className="inline-block bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-2 rounded-md transition font-medium">
            חזרה לעמוד הראשי
          </Link>
        </div>
      </div>
    </div>
  )
}