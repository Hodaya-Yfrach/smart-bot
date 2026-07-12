import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatMessage } from "@/types/chat";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

// הרשימה ממוינת מהאיכותי ביותר כלפי מטה (משפחת ה-Flash)
const FALLBACK_MODELS = [
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.0-flash"
];

// הפונקציה עכשיו מקבלת גם את הכללים מהאתר כפרמטר נוסף
export async function askGemini(userText: string, history: any[], systemInstruction: string) {
  // הדפדפן מוסיף את ההודעה החדשה להיסטוריה
  const messages = [...history, { role: 'user', parts: [{ text: userText }] }];

  // במקום לפנות לגוגל, הדפדפן פונה לשרת Vercel שלנו!
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, systemInstruction })
  });

  if (!response.ok) {
    throw new Error('שגיאה בתקשורת מול השרת');
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error);
  }

  return { text: data.text };
}
