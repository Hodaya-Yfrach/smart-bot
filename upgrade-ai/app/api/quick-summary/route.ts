
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
// ============================================================================
// הגדרות
// ============================================================================
// מגבילים את אורך הפרומפט שנשלח למודל הסיכום המהיר - גם מטעמי עלות/ביצועים
// וגם כהגנה מפני ניסיון לשלוח טקסט ענק דרך הנתיב הזה.
const MAX_PROMPT_CHARS = 4000;
const MAX_SUMMARY_WORDS = 7;
const SIMPLE_SUMMARY_MODEL = 'gemini-flash-lite-latest';
const quickSummarySchema = z.object({
  promptText: z.string().min(1).max(MAX_PROMPT_CHARS),
  userApiKey: z.string().max(200).optional(),
});

// ============================================================================
// POST /api/quick-summary
// מחזיר שורת תקציר קצרה (עד 7 מילים) לפרומפט בודד, במודל הקל ביותר.
// ============================================================================
export async function POST(req: Request) {
  try {
    // --- אבטחה: אותה בדיקת CORS כמו בשאר נתיבי ה-API באתר ---
    const origin = req.headers.get('origin');
    const allowedOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    if (origin && origin !== allowedOrigin) {
      return NextResponse.json(
        { error: 'הגישה נדחתה. אנא ודאו שאתם בכתובת הרשמית.' },
        { status: 403 }
      );
    }

    const rawBody = await req.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json({ error: 'לא התקבל מידע בבקשה.' }, { status: 400 });
    }

    const parseResult = quickSummarySchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'המידע שנשלח אינו בפורמט תקין.' },
        { status: 400 }
      );
    }

    const { promptText, userApiKey } = parseResult.data;

    // המפתח מגיע מהגוף (body) של בקשת POST מהשרת שלנו בלבד - לעולם לא נחשף
    // בכתובת URL, ולעולם לא נשלח ישירות מהדפדפן לגוגל (בניגוד למימוש הקודם).
    const apiKey = userApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'חסר מפתח API.' }, { status: 401 });
    }

    const trimmedPrompt = promptText.slice(0, MAX_PROMPT_CHARS);

    const prompt = `סכם/י את בקשת המשתמש הבאה בשורה אחת קצרה של עד ${MAX_SUMMARY_WORDS} מילים בלבד, בעברית, בצורה עניינית וברורה.
אל תוסיף/י מרכאות, נקודה בסוף המשפט, או כל טקסט נוסף מלבד שורת התקציר עצמה.

בקשת המשתמש:
${trimmedPrompt}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: SIMPLE_SUMMARY_MODEL });

    let rawText: string;
    try {
      const result = await model.generateContent(prompt);
      rawText = result.response.text();
    } catch (genErr: any) {
      // חשוב: לא מדפיסים את ה-apiKey ללוג בשום מקרה, גם לא בטעות.
      console.error('שגיאה בקריאה למודל התקציר המהיר:', genErr?.message || 'שגיאה לא ידועה');
      return NextResponse.json(
        { error: 'לא הצלחנו ליצור תקציר קצר כרגע.' },
        { status: 502 }
      );
    }

    // ניקוי מרכאות/רווחים מיותרים שהמודל לעיתים מוסיף
    let cleaned = rawText.trim().replace(/^["'׳״]+|["'׳״]+$/g, '');

    // הגנה נוספת מצד השרת: גם אם המודל "פספס" וכתב יותר מדי מילים,
    // חותכים ל-7 מילים לפני שהתשובה יוצאת מהשרת.
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length > MAX_SUMMARY_WORDS) {
      cleaned = words.slice(0, MAX_SUMMARY_WORDS).join(' ');
    }

    return NextResponse.json({ summary: cleaned });
  } catch (error) {
    console.error('שגיאה כללית בתקציר מהיר:', error);
    return NextResponse.json(
      { error: 'אירעה תקלה בעת יצירת התקציר. נסו שוב.' },
      { status: 500 }
    );
  }
}