import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatMessage } from "@/types/chat";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

export async function askGemini(prompt: string, history: ChatMessage[] = []) {
  if (!apiKey) {
    console.error("שגיאה: חסר מפתח API של Gemini");
    return "חסר מפתח API. ודאי שקובץ ה-.env.local שלך מוגדר כראוי.";
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    const today = new Date();
    const currentDateString = today.toLocaleDateString('he-IL');
    const currentTimeString = today.toLocaleTimeString('he-IL');

    // שימוש במודל 1.5-flash המהיר
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.5-flash",
      systemInstruction: `התאריך של היום הוא ${currentDateString} והשעה היא ${currentTimeString}. עליך להתייחס לתאריך זה כזמן ההווה לכל דבר ועניין בתשובותיך. אתה מומחה לפיתוח תוכנה ב-React ו-Next.js.`
    });

    const formattedHistory = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.parts[0].text }],
    }));

    const chat = model.startChat({
      history: formattedHistory,
    });

    const result = await chat.sendMessage([{ text: prompt }]);
    const response = await result.response;
    
    return response.text();
    
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "אופס, נתקלתי בשגיאה בתקשורת עם השרת. כדאי לנסות שוב.";
  }
}