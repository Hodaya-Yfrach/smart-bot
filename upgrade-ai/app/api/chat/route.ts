import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { COOKIE_NAME, isValidToken } from '../guest/route';
import { resolveModel } from '@/services/models';

const MAX_MESSAGE_LENGTH = 16000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      parts: z.array(z.object({ text: z.string() }))
    })
  ).min(1),
  selectedModel: z.string().min(1),
  fallbackModels: z.array(z.string()).optional(),
  userApiKey: z.string().optional(),
  systemInstruction: z.string().optional(),
  isGuest: z.boolean().default(false),
});

const rateLimitMap = new Map<string, { count: number; startTime: number }>();
const consumedGuestTokens = new Set<string>();

async function isAuthenticated(accessToken: string | null) {
  if (!accessToken) return false;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
  );
  const { data } = await supabase.auth.getUser(accessToken);
  return Boolean(data.user);
}

// ============================================================================
// 2. הפונקציה הראשית לטיפול בבקשה
// ============================================================================
export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin');
    const allowedOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    
    if (origin && origin !== allowedOrigin) {
      return NextResponse.json({ 
        error: 'הגישה נדחתה. נראה שהבקשה לא הגיעה מהאתר הרשמי. אנא ודאו שאתם בכתובת הנכונה.' 
      }, { status: 403 });
    }

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
          error: 'שלחתם יותר מדי בקשות ברצף. המערכת זקוקה לרגע מנוחה, אנא המתינו כדקה ונסו שוב.' 
        }, { status: 429 });
      }
    }
    rateLimitMap.set(ip, userRateData);

    const rawBody = await req.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json({ 
        error: 'לא התקבל מידע בבקשה. אנא רעננו את הדף ונסו שוב.' 
      }, { status: 400 });
    }

    const parseResult = chatRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json({ 
        error: 'המידע שנשלח אינו בפורמט תקין. נסו לרענן את הדף או לבדוק שההודעה שלכם אינה ריקה.' 
      }, { status: 400 });
    }

    const { messages, selectedModel, fallbackModels, userApiKey, systemInstruction, isGuest } = parseResult.data;

    const accessToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
    const authenticated = await isAuthenticated(accessToken);
    const guestToken = (await cookies()).get(COOKIE_NAME)?.value;

    if (isGuest) {
      if (!isValidToken(guestToken) || consumedGuestTokens.has(guestToken!)) {
        return NextResponse.json({ error: 'מגבלת האורח נוצלה. התחברו כדי להמשיך.' }, { status: 403 });
      }
    } else if (!authenticated) {
      return NextResponse.json({ error: 'נדרשת התחברות כדי להשתמש בשירות.' }, { status: 401 });
    }

    const latestMessageText = messages[messages.length - 1].parts[0].text;
    if (latestMessageText.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ 
        error: `ההודעה שלכם ארוכה מדי (מעל ${MAX_MESSAGE_LENGTH} תווים). המודל יתקשה לעבד אותה. אנא קצרו את הטקסט ונסו שוב.` 
      }, { status: 413 });
    }

    const apiKey = (userApiKey || process.env.GEMINI_API_KEY)?.trim();
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'חסר מפתח API. אנא הזינו מפתח פעיל בהגדרות כדי שנוכל להתחבר למודל החכם.' 
      }, { status: 401 });
    }

    // ============================================================================
    // 3. עבודה מול המודלים עם מנגנון Fallback אינטליגנטי
    // ============================================================================
    const genAI = new GoogleGenerativeAI(apiKey);
    const history = messages.slice(0, -1)
      .map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.parts[0].text.trim() }],
      }))
      .filter((msg) => msg.parts[0].text.length > 0)
      .filter((msg, index) => index > 0 || msg.role === 'user');

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
        const model = genAI.getGenerativeModel({ model: apiModelName, systemInstruction });
        const chat = model.startChat({ history });
        const result = await chat.sendMessage(latestMessageText);
        
        const cleanedText = result.response.text().replace(/^\s*[\r\n]+/, '').trim();
        
        if (isGuest && guestToken) consumedGuestTokens.add(guestToken);
        return NextResponse.json({
          text: '\u200F' + cleanedText,
          modelUsed: modelName,
          failedModels: failedModels 
        });

      } catch (err: any) {
        const errorMessage = err?.message || 'Unknown error';
        console.error(`Gemini request failed for ${modelName}:`, errorMessage);
        failedModels.push(modelName);

        if (errorMessage.includes('NetFree') || errorMessage.includes('418 Blocked')) {
          networkBlocked = true;
          break;
        }
      }
    }

    if (networkBlocked) {
      return NextResponse.json({
        error: 'החיבור ל-Gemini נחסם על ידי NetFree. יש לאשר את generativelanguage.googleapis.com בסינון, או להתחבר מרשת שאינה חוסמת את שירותי Google AI.',
        failedModels,
      }, { status: 502 });
    }

    return NextResponse.json({ 
      error: 'Gemini לא החזיר תשובה. בדקו שהמפתח פעיל ושיש הרשאה למודל שנבחר, ולאחר מכן נסו שוב.',
      failedModels 
    }, { status: 503 });

  } catch (error: any) {
    console.error("שגיאת שרת כללית:", error);
    return NextResponse.json({ 
      error: 'התרחשה תקלה בלתי צפויה בשרת שלנו. אנחנו עובדים על זה, אנא נסו שוב מאוחר יותר.' 
    }, { status: 500 });
  }
}