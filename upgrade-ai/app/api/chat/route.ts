// =============================================================================
// app/api/chat/route.ts
// נתיב ה-API המרכזי לשליחת הודעות לגמיני (POST /api/chat).
//
// תפקידים עיקריים:
//   1. אבטחה — בדיקת CORS, Rate-Limit, אימות משתמש/אורח.
//   2. ולידציה — zod schema על גוף הבקשה.
//   3. שליחה לגמיני — תמיכה בטקסט בלבד.
//   4. Fallback אוטומטי — אם מודל נכשל, מנסים את הבא ברשימה.
//
//
// DEV NOTE — שדות חשובים בבקשה:
//   messages       — היסטוריית השיחה כולל ההודעה החדשה
//   selectedModel  — מזהה המודל שהמשתמש בחר (לדוגמה "gemini-3.7-flash")
//   fallbackModels — מודלים לגיבוי אם הנבחר נכשל
//   userApiKey     — מפתח אישי (BYOK); אם ריק, משתמשים ב-GEMINI_API_KEY
//   isGuest        — האם הבקשה מגיעה ממשתמש אורח (מוגבל לשאלה אחת)
// =============================================================================

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { COOKIE_NAME, isValidToken } from '../guest/route';
import { resolveModel } from '@/services/models';

// ─── קבועי אבטחה וביצועים ────────────────────────────────────────────────────
const MAX_MESSAGE_LENGTH = 16000;       // תווים מקסימאליים בהודעה טקסטואלית
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // חלון זמן ל-rate limit (60 שניות)
const MAX_REQUESTS_PER_WINDOW = 60;     // בקשות מקסימאליות לחלון
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;

// ─── Zod Schema לולידציה של גוף הבקשה ──────────────────────────────────────
// MessagePart: טקסט, או תמונת קלט לניתוח
const messagePartSchema = z.union([
  z.object({ text: z.string() }),
  z.object({
    inlineData: z.object({
      mimeType: z.string().regex(/^image\/(jpeg|png|webp|gif)$/),
      data: z.string().max(MAX_IMAGE_SIZE_BYTES * 1.4),
    }),
  }),
  z.object({ imageUrl: z.string() }),
]);

const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      parts: z.array(messagePartSchema),
    })
  ).min(1),
  selectedModel: z.string().min(1),
  fallbackModels: z.array(z.string()).optional(),
  userApiKey: z.string().optional(),
  systemInstruction: z.string().optional(),
  isGuest: z.boolean().default(false),
  studyMode: z.boolean().default(false),
  studyQuestionMode: z.enum(['ai', 'user']).default('ai'),
});

// ─── Rate Limit Map (in-memory, per-process) ─────────────────────────────────
// DEV NOTE: בסביבת production עם מספר instances השתמשו ב-Redis במקום.
const rateLimitMap = new Map<string, { count: number; startTime: number }>();

/** אסימוני אורח שכבר נוצלו — לא בשימוש בסביבת Vercel (serverless, multi-instance) */
// DEV NOTE: ההגבלה לשאלה אחת נאכפת בצד הלקוח דרך guestLimitReached ב-page.tsx.
// const consumedGuestTokens = new Set<string>();

// ─── פונקציית עזר: אימות JWT של Supabase ─────────────────────────────────────
async function isAuthenticated(accessToken: string | null) {
  if (!accessToken) return false;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
  );
  const { data } = await supabase.auth.getUser(accessToken);
  return Boolean(data.user);
}

function extractGeminiParts(parts: any[]): any[] {
  return parts
    .map((part) => {
      if (part.inlineData) return { inlineData: part.inlineData };
      if (part.text !== undefined) return { text: part.text };
      return null;
    })
    .filter(Boolean);
}

// =============================================================================
// POST /api/chat — הפונקציה הראשית
// =============================================================================
export async function POST(req: Request) {
  try {
    // ── 1. CORS ──────────────────────────────────────────────────────────────
    const origin = req.headers.get('origin');
    const allowedOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    if (origin && origin !== allowedOrigin) {
      return NextResponse.json({
        error: 'הגישה נדחתה. נראה שהבקשה לא הגיעה מהאתר הרשמי. אנא ודאו שאתם בכתובת הנכונה.',
      }, { status: 403 });
    }

    // ── 2. Rate Limit ─────────────────────────────────────────────────────────
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'anonymous';
    const now = Date.now();
    const userRateData = rateLimitMap.get(ip) || { count: 0, startTime: now };

    if (now - userRateData.startTime > RATE_LIMIT_WINDOW_MS) {
      userRateData.count = 1;
      userRateData.startTime = now;
    } else {
      userRateData.count++;
      if (userRateData.count > MAX_REQUESTS_PER_WINDOW) {
        return NextResponse.json({
          error: 'שלחתם יותר מדי בקשות ברצף. המערכת זקוקה לרגע מנוחה, אנא המתינו כדקה ונסו שוב.',
        }, { status: 429, headers: { 'Retry-After': '60' } });
      }
    }
    rateLimitMap.set(ip, userRateData);

    // ── 3. פיענוח גוף הבקשה ──────────────────────────────────────────────────
    const rawBody = await req.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json({
        error: 'לא התקבל מידע בבקשה. אנא רעננו את הדף ונסו שוב.',
      }, { status: 400 });
    }

    const parseResult = chatRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json({
        error: 'המידע שנשלח אינו בפורמט תקין. נסו לרענן את הדף או לבדוק שההודעה שלכם אינה ריקה.',
      }, { status: 400 });
    }

    const { messages, selectedModel, fallbackModels, userApiKey, systemInstruction, isGuest, studyMode, studyQuestionMode } =
      parseResult.data;

    // ── 4. אימות משתמש / אורח ────────────────────────────────────────────────
    const accessToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
    const authenticated = await isAuthenticated(accessToken);
    const guestToken = (await cookies()).get(COOKIE_NAME)?.value;

    if (isGuest) {
      if (!isValidToken(guestToken)) {
        return NextResponse.json(
          { error: 'מגבלת האורח נוצלה. התחברו כדי להמשיך.' },
          { status: 403 }
        );
      }
    } else if (!authenticated) {
      return NextResponse.json(
        { error: 'נדרשת התחברות כדי להשתמש בשירות.' },
        { status: 401 }
      );
    }

    // ── 5. ולידציה על אורך ההודעה הטקסטואלית ────────────────────────────────
    const lastMessage = messages[messages.length - 1];
    const lastTextPart = lastMessage.parts.find((p: any) => p.text !== undefined);
    const latestMessageText: string = (lastTextPart as any)?.text ?? '';

    if (latestMessageText.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({
        error: `ההודעה שלכם ארוכה מדי (מעל ${MAX_MESSAGE_LENGTH} תווים). המודל יתקשה לעבד אותה. אנא קצרו את הטקסט ונסו שוב.`,
      }, { status: 413 });
    }

    // ── 6. מפתח API ──────────────────────────────────────────────────────────
    const apiKey = (userApiKey || process.env.GEMINI_API_KEY)?.trim();
    if (!apiKey) {
      return NextResponse.json({
        error: 'חסר מפתח API. אנא הזינו מפתח פעיל בהגדרות כדי שנוכל להתחבר למודל החכם.',
      }, { status: 401 });
    }

    // ── 7. בניית היסטוריה לגמיני ─────────────────────────────────────────────
    // ההיסטוריה = כל ההודעות פרט לאחרונה.
    const history = messages
      .slice(0, -1)
      .map((msg) => ({
        role: msg.role,
        parts: extractGeminiParts(msg.parts).filter((part: any) => !part.inlineData),
      }))
      .filter((msg) => msg.parts.length > 0)
      .filter((msg, index) => index > 0 || msg.role === 'user');

    const latestParts = extractGeminiParts(lastMessage.parts);

    // ── 8. Fallback loop — ניסיון על כל מודל בתור ───────────────────────────
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelsToTry = [selectedModel, ...(fallbackModels || [])].filter(Boolean);
    const failedModels: string[] = [];
    let networkBlocked = false;

    for (const modelName of modelsToTry) {
      try {
        const apiModelName = resolveModel(modelName);
        if (!apiModelName) {
          failedModels.push(modelName);
          continue;
        }

        const studyQuestionInstruction = studyQuestionMode === 'user'
          ? 'צור את שאלת הסיום לפי השאלה, הנושא או המידע שהמשתמש ביקש. אפשר להשתמש גם בידע כללי נוסף, אבל הוא חייב להיות קשור ישירות לנושא שהמשתמש העלה. אל תשאל על פרט צדדי או על נושא שלא ביקש.'
          : 'צור את שאלת הסיום אך ורק לפי התוכן, ההסברים והדוגמאות שהופיעו בתשובת ה-AI הנוכחית. אל תוסיף ידע כללי חדש ואל תשאל על מידע שלא הופיע בתשובה.';
        const studyInstruction = studyMode
          ? `${systemInstruction || ''}\nמצב לימודים פעיל. הערך את התשובה האחרונה של המשתמש מול השאלה וההקשר. בתגובה כתוב בשורה הראשונה בדיוק [[STUDY_SCORE:מספר שלם בין 0 ל-100]]. לאחר מכן הסבר קצר וברור, ואם יש טעות הסבר מה לתקן. ${studyQuestionInstruction} בסוף כתוב שורת שאלה נפרדת שמתחילה בדיוק ב-[[STUDY_QUESTION: ומסתיימת ב-]]. השאלה חייבת להיות מאתגרת אך פשוטה להבנה. אל תכתוב את סימוני הציון או השאלה במקום אחר.`
          : systemInstruction;
        const model = genAI.getGenerativeModel({ model: apiModelName, systemInstruction: studyInstruction });
        const chat = model.startChat({ history });

        const result = await chat.sendMessage(latestParts.length > 0 ? latestParts : latestMessageText);
        const cleanedText = result.response.text().replace(/^\s*[\r\n]+/, '').trim();

        if (isGuest && guestToken) { /* שמירת token נוצלה — מנוהל בצד לקוח */ }
        const studyScoreMatch = cleanedText.match(/^\s*\[\[STUDY_SCORE:(\d{1,3})\]\]\s*/);
        const studyScore = studyScoreMatch ? Math.min(100, Number(studyScoreMatch[1])) : undefined;
        let responseText = studyScoreMatch ? cleanedText.slice(studyScoreMatch[0].length).trim() : cleanedText;
        if (studyMode) {
          const studyQuestionMatch = responseText.match(/\[\[STUDY_QUESTION:\s*([\s\S]*?)\]\]\s*$/);
          const studyQuestion = studyQuestionMatch?.[1].trim();
          responseText = studyQuestionMatch ? responseText.slice(0, studyQuestionMatch.index).trim() : responseText;
          if (studyQuestion) {
            responseText = `${responseText}\n\n${studyQuestion}`;
          } else if (!/[?؟]\s*$/.test(responseText)) {
            const fallbackQuestion = studyQuestionMode === 'user'
              ? 'איך אפשר להסביר במילים שלך את הקשר בין הנושא שביקשת לבין התשובה שקיבלת?'
              : 'מהו הרעיון המרכזי שהוסבר בתשובה, ואיך אפשר ליישם אותו?';
            responseText = `${responseText}\n\n${fallbackQuestion}`;
          }
        }
        return NextResponse.json({
          text: '\u200F' + responseText,
          studyScore,
          modelUsed: modelName,
          failedModels,
        });

      } catch (err: any) {
        const errorMessage = err?.message || 'Unknown error';
        console.error(`Gemini request failed for ${modelName}:`, errorMessage);

        const isQuotaError =
          errorMessage.includes('429') ||
          /quota|rate.?limit|resource.?exhausted|too many requests/i.test(errorMessage);
        if (isQuotaError) {
          return NextResponse.json({
            error: 'מכסת השימוש ב-Gemini הסתיימה או שהגעתם למגבלת הקצב. נסו שוב מאוחר יותר או הגדירו מפתח Gemini אישי בהגדרות.',
            failedModels: [modelName],
          }, { status: 429, headers: { 'Retry-After': '60' } });
        }

        failedModels.push(modelName);

        // NetFree חוסם את Gemini — אין טעם לנסות מודלים נוספים
        if (errorMessage.includes('NetFree') || errorMessage.includes('418 Blocked')) {
          networkBlocked = true;
          break;
        }
      }
    }

    // ── 9. טיפול בכשלון מלא ─────────────────────────────────────────────────
    if (networkBlocked) {
      return NextResponse.json({
        error:
          'החיבור ל-Gemini נחסם על ידי NetFree. יש לאשר את generativelanguage.googleapis.com בסינון, או להתחבר מרשת שאינה חוסמת את שירותי Google AI.',
        failedModels,
      }, { status: 502 });
    }

    return NextResponse.json({
      error: 'Gemini לא החזיר תשובה. בדקו שהמפתח פעיל ושיש הרשאה למודל שנבחר, ולאחר מכן נסו שוב.',
      failedModels,
    }, { status: 503 });

  } catch (error: any) {
    console.error('שגיאת שרת כללית:', error);
    return NextResponse.json({
      error: 'התרחשה תקלה בלתי צפויה בשרת שלנו. אנחנו עובדים על זה, אנא נסו שוב מאוחר יותר.',
    }, { status: 500 });
  }
}
