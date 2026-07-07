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
export async function askGemini(
  prompt: string, 
  history: ChatMessage[] = [], 
  systemRules: string = "", // <-- התוספת שלנו מ-page.tsx
  modelIndex = 0
): Promise<{ text: string; fallbackModelName?: string }> {
  
  if (!apiKey) {
    return { text: "חסר מפתח API. ודאי שקובץ ה-.env.local שלך מוגדר כראוי." };
  }

  // הגנת קצה: אם עברנו על כל הרשימה וכולם חסומים
  if (modelIndex >= FALLBACK_MODELS.length) {
    return { text: "שגיאה: נגמרו המכסות לכל מודלי הגיבוי שלנו להיום. נסה שוב מחר." };
  }

  const currentModelName = FALLBACK_MODELS[modelIndex];

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const today = new Date();
    
    // שילוב ההוראה הקבועה שלך יחד עם הכללים שהמשתמש מקליד באתר
    const baseInstruction = `התאריך של היום הוא ${today.toLocaleDateString('he-IL')} והשעה היא ${today.toLocaleTimeString('he-IL')}. אתה מומחה לפיתוח תוכנה ב-React ו-Next.js.`;
    const finalInstruction = systemRules ? `${baseInstruction}\n\n${systemRules}` : baseInstruction;

    const model = genAI.getGenerativeModel({ 
      model: currentModelName,
      systemInstruction: finalInstruction // כאן ה-AI מקבל את ההנחיות המשולבות
    });

    let safeHistory = [...history];
    if (safeHistory.length > 0 && safeHistory[safeHistory.length - 1].role === 'user') {
      safeHistory.pop();
    }

    const formattedHistory = safeHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.parts[0].text }],
    }));

    const chat = model.startChat({ history: formattedHistory });
    const result = await chat.sendMessage(prompt);
    const responseText = await result.response.text();
    
    return { 
      text: responseText, 
      // נדווח לצד הקדמי על שינוי מודל רק אם אנחנו לא באינדקס 0 (המודל הראשי)
      fallbackModelName: modelIndex > 0 ? currentModelName : undefined 
    };
    
  } catch (error: any) {
    const errorMessage = error?.message?.toLowerCase() || "";
    // הוספתי גם את 503 למקרה של עומס בשרתי גוגל
    const isQuotaError = errorMessage.includes("429") || errorMessage.includes("503") || errorMessage.includes("quota") || errorMessage.includes("exhausted");

    // אם נגמרה המכסה, נפעיל את הפונקציה שוב (רקורסיה) עם המודל הבא בתור
    if (isQuotaError && modelIndex < FALLBACK_MODELS.length - 1) {
      console.warn(`מכסת ${currentModelName} הסתיימה או שיש עומס, עובר למודל הבא ברשימה...`);
      // חובה להעביר את systemRules הלאה כדי שהגיבוי גם יקבל את הכללים
      return await askGemini(prompt, history, systemRules, modelIndex + 1);
    }

    console.error("Gemini API Error:", error);
    return { text: "אופס, נתקלתי בשגיאה בתקשורת עם השרת. כדאי לנסות שוב." };
  }
}