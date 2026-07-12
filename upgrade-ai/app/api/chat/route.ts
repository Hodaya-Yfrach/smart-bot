
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, systemInstruction } = body;

    // השרת ב-Vercel מושך את המפתח מההגדרות
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
    const genAI = new GoogleGenerativeAI(apiKey);
    
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemInstruction
    });

    // סידור היסטוריית ההודעות לפורמט שגוגל דורש
    const history = messages.slice(0, -1).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.parts[0].text }]
    }));
    
    // השאלה החדשה של המשתמש
    const latestMessage = messages[messages.length - 1].parts[0].text;

    // שליחת הבקשה מתוך השרת של Vercel
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(latestMessage);
    const text = result.response.text();

    return NextResponse.json({ text });
    
  } catch (error: any) {
    console.error("API Error in backend:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}