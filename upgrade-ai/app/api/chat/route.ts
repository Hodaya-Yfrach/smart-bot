import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// הרשימה מהמפתח האמיתי שלך, מהחדש/החזק ביותר כלפי מטה
const FALLBACK_MODELS = [
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.0-flash"
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, systemInstruction } = body;

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
    const genAI = new GoogleGenerativeAI(apiKey);

    const history = messages.slice(0, -1).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.parts[0].text }]
    }));

    const latestMessage = messages[messages.length - 1].parts[0].text;

    let lastError: any = null;

    for (let i = 0; i < FALLBACK_MODELS.length; i++) {
      const modelName = FALLBACK_MODELS[i];
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemInstruction
        });

        const chat = model.startChat({ history });
        const result = await chat.sendMessage(latestMessage);
        const text = result.response.text();

        // אם זה לא המודל הראשון ברשימה, נחזיר את שמו כ-fallback כדי שהאתר יידע להציג הודעה
        return NextResponse.json({
          text,
          fallbackModelName: i > 0 ? modelName : undefined
        });

      } catch (err: any) {
        lastError = err;
        console.error(`מודל ${modelName} נכשל (${err.message}), עובר לבא בתור...`);
        continue;
      }
    }

    throw lastError || new Error('כל המודלים נכשלו');

  } catch (error: any) {
    console.error("API Error in backend:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}