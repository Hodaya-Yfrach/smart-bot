import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

// ============================================================================
// 1. הגדרות וקבועים
// ============================================================================
const MAX_MESSAGE_LENGTH = 8000; // הגבלת אורך הודעה - כ-1500 מילים, מונע עומס
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // חלון זמן של דקה
const MAX_REQUESTS_PER_WINDOW = 20; // עד 20 בקשות בדקה כדי לא להקריס את השרת

// בדיקת תקינות הנתונים הנכנסים (Zod Validation)
const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      parts: z.array(z.object({ text: z.string() }))
    })
  ).min(1),
  selectedModel: z.string().min(1),
  fallbackModels: z.array(z.string()).optional(), // רשימת המודלים לגיבוי
  userApiKey: z.string().optional(),
  systemInstruction: z.string().optional()
});

// זיכרון זמני למניעת הצפות (Rate Limiting)
const rateLimitMap = new Map<string, { count: number; startTime: number }>();

// ============================================================================
// 2. הפונקציה הראשית לטיפול בבקשה
// ============================================================================
export async function POST(req: Request) {
  try {
    // --- אבטחה: האם הבקשה הגיעה מהאתר שלנו? (CORS) ---
    const origin = req.headers.get('origin');
    const allowedOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'; 
    
    if (origin && origin !== allowedOrigin) {
      return NextResponse.json({ 
        error: 'הגישה נדחתה. נראה שהבקשה לא הגיעה מהאתר הרשמי. אנא ודאו שאתם בכתובת הנכונה.' 
      }, { status: 403 });
    }

    // --- אבטחה: חסימת הצפות (Rate Limiting) ---
    const ip = req.headers.get('x-forwarded-for') || 'anonymous';
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

    // --- אבטחה: בדיקת תקינות הנתונים (Zod) ---
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

    const { messages, selectedModel, fallbackModels, userApiKey, systemInstruction } = parseResult.data;

    // --- אבטחה: הגבלת אורך טקסט ---
    const latestMessageText = messages[messages.length - 1].parts[0].text;
    if (latestMessageText.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ 
        error: `ההודעה שלכם ארוכה מדי (מעל ${MAX_MESSAGE_LENGTH} תווים). המודל יתקשה לעבד אותה. אנא קצרו את הטקסט ונסו שוב.` 
      }, { status: 413 });
    }

    // --- בדיקת מפתח API ---
    const apiKey = userApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'חסר מפתח API. אנא הזינו מפתח פעיל בהגדרות כדי שנוכל להתחבר למודל החכם.' 
      }, { status: 401 });
    }

    // ============================================================================
    // 3. עבודה מול המודלים עם מנגנון Fallback אינטליגנטי
    // ============================================================================
    const genAI = new GoogleGenerativeAI(apiKey);
    const history = messages.slice(0, -1).map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.parts[0].text }]
    }));

    // בונים רשימה: קודם המודל שנבחר, ואחריו מודלי הגיבוי (מסננים ערכים ריקים)
    const modelsToTry = [selectedModel, ...(fallbackModels || [])].filter(Boolean);
    const failedModels: string[] = []; // נשמור כאן רק את מי שנכשל בסיבוב הנוכחי

    // עוברים על המודלים לפי הסדר, עד שאחד מהם מצליח
    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName, systemInstruction });
        const chat = model.startChat({ history });
        const result = await chat.sendMessage(latestMessageText);
        
        const cleanedText = result.response.text().replace(/^\s*[\r\n]+/, '').trim();
        
        // הצלחנו! מחזירים את התשובה, את המודל שעבד, ואת רשימת אלו שנכשלו בדרך (אם היו)
        return NextResponse.json({
          text: '\u200F' + cleanedText,
          modelUsed: modelName,
          failedModels: failedModels 
        });

      } catch (err: any) {
        console.error(`ניסיון כשל במודל ${modelName}:`, err.message);
        failedModels.push(modelName); // רושמים אותו כנכשל ועוברים מיד לבא בתור
      }
    }

    // אם הגענו לפה, הלולאה הסתיימה וכל המודלים ברשימה נכשלו
    return NextResponse.json({ 
      error: 'הייתה בעיה להתחבר למודלים (ייתכן עומס בשרתי גוגל או שהמפתח שגוי). אנא נסו שוב בעוד מספר דקות.',
      failedModels 
    }, { status: 503 });

  } catch (error: any) {
    console.error("שגיאת שרת כללית:", error);
    return NextResponse.json({ 
      error: 'התרחשה תקלה בלתי צפויה בשרת שלנו. אנחנו עובדים על זה, אנא נסו שוב מאוחר יותר.' 
    }, { status: 500 });
  }
}