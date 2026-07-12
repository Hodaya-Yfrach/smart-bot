export async function askGemini(userText: string, history: any[], systemInstruction: string): Promise<{ text: string; fallbackModelName?: string }> {
  // הדפדפן מוסיף את ההודעה החדשה להיסטוריה
  const messages = [...history, { role: 'user', parts: [{ text: userText }] }];

  // פנייה לשרת ה-Vercel שלנו כדי לעקוף את נטפרי
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

  // מחזירים גם את הטקסט וגם את המודל החלופי (אם יש)
  return { 
    text: data.text,
    fallbackModelName: data.fallbackModelName
  };
}