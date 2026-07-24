// נגדיר ממשק (Interface) מסודר לתשובה שחוזרת מהפונקציה
export interface GeminiResponse {
  text: string;
  modelUsed: string;
  failedModels: string[];
}

// ניצור מחלקת שגיאות מיוחדת שתדע להחזיר לא רק טקסט, אלא גם את המודלים שנכשלו
export class ChatApiError extends Error {
  failedModels: string[];
  
  constructor(message: string, failedModels: string[] = []) {
    super(message);
    this.name = 'ChatApiError';
    this.failedModels = failedModels;
  }
}

export async function askGemini(
  userText: string, 
  history: any[], 
  systemInstruction: string,
  selectedModel: string,        // המודל שהמשתמש בחר
  fallbackModels: string[] = [], // מודלים לגיבוי (אופציונלי)
  userApiKey: string = ''        // מפתח ה-API של המשתמש (אופציונלי)
): Promise<GeminiResponse> {
  
  // הדפדפן מוסיף את ההודעה החדשה להיסטוריה
  const messages = [...history, { role: 'user', parts: [{ text: userText }] }];

  try {
    // פנייה לשרת ה-Vercel שלנו שמטפל באבטחה ובפניות לגוגל
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        messages, 
        systemInstruction,
        selectedModel,       // נשלח את המודל הנבחר
        fallbackModels,      // נשלח את רשימת הגיבוי
        userApiKey           // נשלח את המפתח האישי אם הוזן
      })
    });

    const data = await response.json();
    
    // אם השרת החזיר סטטוס של שגיאה (כמו 400, 429, 503)
    if (!response.ok || data.error) {
      // אנחנו זורקים שגיאה מותאמת אישית שכוללת את ההודעה המפורטת בעברית שהכנו בשרת,
      // וגם את רשימת המודלים שנכשלו כדי שהחזית תדע להאפיר אותם.
      throw new ChatApiError(
        data.error || 'אירעה שגיאה בלתי צפויה בתקשורת מול השרת.', 
        data.failedModels || []
      );
    }

    // במקרה של הצלחה, מחזירים אובייקט מסודר עם התשובה והמידע על המודלים
    return { 
      text: data.text,
      modelUsed: data.modelUsed,
      failedModels: data.failedModels || [] // אם היו מודלים שנכשלו בדרך להצלחה
    };

  } catch (error: any) {
    // אם זו שגיאה שאנחנו יצרנו (ChatApiError), נזרוק אותה הלאה כמו שהיא
    if (error instanceof ChatApiError) {
      throw error;
    }
    
    // אם זו שגיאת רשת פתאומית (כמו ניתוק אינטרנט של הלקוח), נייצר שגיאה ברורה
    throw new ChatApiError('נראה שיש בעיית חיבור לאינטרנט או שהשרת לא זמין כרגע. אנא בידקו את החיבור ונסו שוב.', []);
  }
}