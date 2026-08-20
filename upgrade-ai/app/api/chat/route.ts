// =============================================================================
// app/api/chat/route.ts
// נתיב ה-API המרכזי לשליחת הודעות לגמיני (POST /api/chat).
//
// תפקידים עיקריים:
//   1. אבטחה — בדיקת CORS, Rate-Limit, אימות משתמש/אורח.
//   2. ולידציה — zod schema על גוף הבקשה.
//   3. שליחה לגמיני — תמיכה בטקסט בלבד, בתמונת-קלט (vision), וביצירת תמונה.
//   4. Fallback אוטומטי — אם מודל נכשל, מנסים את הבא ברשימה.
//
// מודלי תמונה (image-gen):
//   כאשר capabilities של המודל כוללות "image-gen", השרת משתמש ב-
//   responseModalities: ['Text', 'Image'] וחולץ את התמונה מה-inlineData
//   שמוחזר בתשובה. התמונה מוחזרת ללקוח כ-base64.
//
// תמיכה בתמונות בקלט (vision):
//   אם ה-parts של ההודעה האחרונה כוללים inlineData (base64 + mimeType),
//   הם נשלחים לגמיני כחלק מה-parts ישירות — הדגמים gemini-2.5-* תומכים בזה.
//   ההיסטוריה הקודמת ממשיכה להישלח כטקסט בלבד (הגבלה של ה-SDK).
//
// DEV NOTE — שדות חשובים בבקשה:
//   messages       — היסטוריית השיחה כולל ההודעה החדשה
//   selectedModel  — מזהה המודל שהמשתמש בחר (לדוגמה "gemini-3.7-flash")
//   fallbackModels — מודלים לגיבוי אם הנבחר נכשל
//   userApiKey     — מפתח אישי (BYOK); אם ריק, משתמשים ב-GEMINI_API_KEY
//   isGuest        — האם הבקשה מגיעה ממשתמש אורח (מוגבל לשאלה אחת)
//   isImageModel   — האם המודל הנבחר הוא מודל יצירת תמונות
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
const MAX_REQUESTS_PER_WINDOW = 20;     // בקשות מקסימאליות לחלון
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB — גבול בטוח לתמונות

// ─── Zod Schema לולידציה של גוף הבקשה ──────────────────────────────────────
// MessagePart: טקסט בלבד, או inlineData (תמונת קלט base64)
const messagePartSchema = z.union([
  z.object({ text: z.string() }),
  z.object({
    inlineData: z.object({
      mimeType: z.string().regex(/^image\/(jpeg|png|webp|gif)$/),
      data: z.string().max(MAX_IMAGE_SIZE_BYTES * 1.4), // base64 ~33% גדול יותר
    }),
  }),
  // imageUrl ו-generatedImage משמשים ל-UI בלבד — השרת מתעלם מהם
  z.object({ imageUrl: z.string() }),
  z.object({ generatedImage: z.string() }),
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
  /** האם המודל הנבחר הוא מודל יצירת תמונות */
  isImageModel: z.boolean().default(false),
});

// ─── Rate Limit Map (in-memory, per-process) ─────────────────────────────────
// DEV NOTE: בסביבת production עם מספר instances השתמשו ב-Redis במקום.
const rateLimitMap = new Map<string, { count: number; startTime: number }>();

/** אסימוני אורח שכבר נוצלו — מונע שימוש כפול */
const consumedGuestTokens = new Set<string>();

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

// ─── פונקציית עזר: חילוץ parts תקינים לשליחה לגמיני ─────────────────────────
// מסנן החוצה שדות UI-only (imageUrl, generatedImage) ומשאיר רק text + inlineData
function extractGeminiParts(parts: any[]): any[] {
  return parts
    .map((p) => {
      if (p.inlineData) return { inlineData: p.inlineData };
      if (p.text !== undefined) return { text: p.text };
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
        }, { status: 429 });
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

    const { messages, selectedModel, fallbackModels, userApiKey, systemInstruction, isGuest, isImageModel } =
      parseResult.data;

    // ── 4. אימות משתמש / אורח ────────────────────────────────────────────────
    const accessToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
    const authenticated = await isAuthenticated(accessToken);
    const guestToken = (await cookies()).get(COOKIE_NAME)?.value;

    if (isGuest) {
      if (!isValidToken(guestToken) || consumedGuestTokens.has(guestToken!)) {
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
    // שדות UI-only (imageUrl, generatedImage) מסוננים לפני השליחה.
    const history = messages
      .slice(0, -1)
      .map((msg) => ({
        role: msg.role,
        parts: extractGeminiParts(msg.parts).filter(
          (p: any) => !p.inlineData // ההיסטוריה — טקסט בלבד (SDK לא תומך ב-vision בהיסטוריה)
        ),
      }))
      .filter((msg) => msg.parts.length > 0)
      .filter((msg, index) => index > 0 || msg.role === 'user');

    // ה-parts של ההודעה האחרונה — כוללים גם תמונת קלט אם המשתמש העלה
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

        // ── מודל יצירת תמונות ───────────────────────────────────────────────
        if (isImageModel) {
          const model = genAI.getGenerativeModel({ model: apiModelName });

          const prompt = latestMessageText || 'צור תמונה';

          // responseModalities חייב להיות ב-request ישירות (לא ב-generationConfig)
          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            // @ts-ignore — responseModalities אינו בטיפוסים הרשמיים עדיין
            generationConfig: { responseModalities: ['Text', 'Image'] },
          });

          const responseParts = result.response.candidates?.[0]?.content?.parts ?? [];

          let generatedImageBase64: string | undefined;
          let responseText = '';
          for (const part of responseParts) {
            if ((part as any).inlineData?.data) {
              generatedImageBase64 = (part as any).inlineData.data;
            } else if (part.text) {
              responseText += part.text;
            }
          }

          if (!generatedImageBase64) {
            console.error(`Image model ${modelName} returned no image. Parts:`, JSON.stringify(responseParts));
            failedModels.push(modelName);
            continue;
          }

          if (isGuest && guestToken) consumedGuestTokens.add(guestToken);
          return NextResponse.json({
            text: responseText || '\u200F',
            generatedImage: generatedImageBase64,
            modelUsed: modelName,
            failedModels,
          });
        }

        // ── מודל שיחה (text / vision) ────────────────────────────────────────
        const model = genAI.getGenerativeModel({ model: apiModelName, systemInstruction });
        const chat = model.startChat({ history });

        // שולחים את ה-parts של ההודעה האחרונה (כולל תמונה אם יש)
        const result = await chat.sendMessage(latestParts.length > 0 ? latestParts : latestMessageText);
        const cleanedText = result.response.text().replace(/^\s*[\r\n]+/, '').trim();

        if (isGuest && guestToken) consumedGuestTokens.add(guestToken);
        return NextResponse.json({
          text: '\u200F' + cleanedText,
          modelUsed: modelName,
          failedModels,
        });

      } catch (err: any) {
        const errorMessage = err?.message || 'Unknown error';
        console.error(`Gemini request failed for ${modelName}:`, errorMessage);
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
