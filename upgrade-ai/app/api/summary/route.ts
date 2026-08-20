// =============================================================================
// app/api/summary/route.ts — POST /api/summary
// יוצר תקציר מובנה (JSON) לשיחה שלמה באמצעות מודל קל (Flash-Lite).
// מחזיר: turns, oneLineSummary, overallSummary, newTerms.
// DEV NOTE: תמיד רץ על SIMPLE_SUMMARY_MODEL ללא קשר למודל הצ'אט הראשי.
// =============================================================================
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

// ─── קבועים ──────────────────────────────────────────────────────────────────
const MAX_MESSAGE_CHARS = 4000; // הגנה מפני הודעה בודדת ענקית שמנפחת את הבקשה
const SIMPLE_SUMMARY_MODEL = 'gemini-flash-lite-latest';
const summaryRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      parts: z.array(z.object({ text: z.string().max(MAX_MESSAGE_CHARS) })),
    })
  ).min(1).max(500), // תקרה סבירה - מונעת שליחת מערך ענק שמייצר עלות/עומס מיותרים
  // selectedModel נשמר כשדה אופציונלי לצורך תאימות לאחור עם קריאות ישנות,
  // אך אינו בשימוש בפועל: תקצירים תמיד רצים על המודל הקל ביותר (SIMPLE_SUMMARY_MODEL).
  selectedModel: z.string().optional(),
  userApiKey: z.string().max(200).optional(),
});

// ============================================================================
// POST /api/summary
// ============================================================================
export async function POST(req: Request) {
  try {
    // --- אבטחה: CORS (זהה לנתיב /api/chat) ---
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

    const parseResult = summaryRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'המידע שנשלח אינו בפורמט תקין.' },
        { status: 400 }
      );
    }

    const { messages, userApiKey } = parseResult.data;

    const apiKey = userApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'חסר מפתח API.' }, { status: 401 });
    }

    // מגבילים את כמות ההודעות שנשלחות למודל הסיכום
    const trimmedMessages = messages.slice(-MAX_TRANSCRIPT_MESSAGES);

    const transcript = trimmedMessages
      .map((m) => `${m.role === 'user' ? 'משתמש' : 'עוזר'}: ${m.parts[0].text}`)
      .join('\n\n');

    const prompt = `להלן תמלול שיחה בין משתמש לעוזר AI.
המשימה שלך: להחזיר אך ורק אובייקט JSON תקין (ללא טקסט נוסף, ללא הסברים, ללא Markdown, ללא גדרות קוד), במבנה המדויק הבא:

{
  "turns": [
    { "topic": "משפט אחד קצר (עד שורה) המתאר במה עסקה תשובת העוזר בסבב הזה", "nextPrompt": "משפט קצר המתאר את השאלה/הפרומפט הבא של המשתמש, או מחרוזת ריקה אם זה הסבב האחרון" }
  ],
  "oneLineSummary": "משפט אחד יחיד (שורה אחת בלבד!) שמתמצת את כל השיחה מתחילתה ועד סופה",
  "overallSummary": ["שורה 1", "שורה 2", "שורה 3"],
  "newTerms": [
    { "term": "שם המושג", "explanation": "הסבר קצר עד שתי שורות" }
  ]
}

הנחיות מחייבות:
- "turns": פריט אחד לכל תשובת עוזר בשיחה, לפי סדר כרונולוגי.
- "oneLineSummary": משפט תמציתי אחד בלבד (לא יותר משורה), שמכיל את התמצית הכי חשובה של כל השיחה.
- "overallSummary": מקסימום 3 מחרוזות (3 שורות), גרסה מעט מורחבת יותר מ-oneLineSummary עבור מי שרוצה פירוט נוסף.
- "newTerms": רק מושגים/מונחים חדשים או טכניים שהמשתמש שאל לגביהם ("מה זה X") או שהוסברו לראשונה במהלך השיחה. אם אין כאלה - החזר מערך ריק [].
- כל הטקסטים בעברית, תמציתיים וברורים.
- אין להוסיף שום טקסט מחוץ לאובייקט ה-JSON.

תמלול השיחה:
${transcript}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    // שימו לב: תמיד רצים על המודל הקל ביותר (SIMPLE_SUMMARY_MODEL), ולא על המודל
    // שנבחר לצ'אט הראשי - כפי שביקשת, כדי לשמור על עלות ומהירות סבירים לתכונת הסיכום.
    const model = genAI.getGenerativeModel({
      model: SIMPLE_SUMMARY_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    // --- קריאה למודל: מטפלים בנפרד בשגיאות תקשורת/מכסה מול גוגל ---
    let rawText: string;
    try {
      const result = await model.generateContent(prompt);
      rawText = result.response.text();
    } catch (genErr: any) {
      // כאן תראה בטרמינל של השרת את השגיאה המדויקת מגוגל (מפתח שגוי, מודל לא קיים, עומס וכו')
      console.error('שגיאה בקריאה למודל הסיכום:', genErr?.message || genErr);
      return NextResponse.json(
        {
          error:
            'לא הצלחנו ליצור את התקציר (בעיה בתקשורת מול המודל, ייתכן מפתח שגוי או שהמודל אינו זמין). נסו שוב או בדקו את הגדרות ה-AI.',
        },
        { status: 502 }
      );
    }

    // חלק מהמודלים עדיין עשויים לעטוף את התשובה ב-```json למרות ה-responseMimeType,
    // אז מנקים כל עטיפת Markdown לפני הפענוח
    const cleanedText = rawText
      .trim()
      .replace(/^```(json)?/i, '')
      .replace(/```$/, '')
      .trim();

    let parsedSummary;
    try {
      parsedSummary = JSON.parse(cleanedText);
    } catch (jsonErr) {
      console.error('סיכום: JSON לא תקין מהמודל. תוכן שהתקבל:', rawText);
      return NextResponse.json(
        { error: 'התקבלה תשובה לא תקינה בעת יצירת הסיכום. נסו שוב.' },
        { status: 502 }
      );
    }

    // הגנות בסיסיות על המבנה, כדי שקומפוננטת הלקוח לא תיפול
    const safeSummary = {
      turns: Array.isArray(parsedSummary.turns) ? parsedSummary.turns : [],
      oneLineSummary:
        typeof parsedSummary.oneLineSummary === 'string' ? parsedSummary.oneLineSummary : '',
      overallSummary: Array.isArray(parsedSummary.overallSummary)
        ? parsedSummary.overallSummary.slice(0, 3)
        : [],
      newTerms: Array.isArray(parsedSummary.newTerms) ? parsedSummary.newTerms : [],
    };

    return NextResponse.json({ summary: safeSummary });
  } catch (error: any) {
    console.error('שגיאה כללית בסיכום שיחה:', error);
    return NextResponse.json(
      { error: 'אירעה תקלה בעת יצירת הסיכום. אנא נסו שוב מאוחר יותר.' },
      { status: 500 }
    );
  }
}