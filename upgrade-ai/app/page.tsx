"use client";
import { useState, useEffect } from 'react';
import ChatMessage from '@/components/ChatMessage';
import SideModal from '@/components/SideModal';
import { ChatMessage as ChatMessageType } from '@/types/chat';
import { askGemini } from '@/services/gemini';

export default function Home() {
  // 1. מצב כניסה (סיסמה)
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [password, setPassword] = useState('');

  // 2. מצבי הצ'אט
  const [mainMessages, setMainMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // 3. מצבי המתנה ומנגנון נפילה (Fallback)
  const [isWaiting, setIsWaiting] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // פונקציית בדיקת הסיסמה מול קובץ ה-.env
  const checkPassword = () => {
    if (password === process.env.NEXT_PUBLIC_APP_PASSWORD) {
      setIsAuthorized(true);
    } else {
      alert("סיסמה שגויה");
    }
  };

  // מנגנון הספירה לאחור של הטיימר
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isWaiting && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isWaiting, countdown]);

  const startNewChat = () => {
    setMainMessages([]);
  };

  // פונקציית שליחת ההודעה מול ה-API של Gemini
  const handleMainSend = async () => {
    if (!input.trim() || isWaiting) return;

    const userMessage: ChatMessageType = { role: 'user', parts: [{ text: input }] };
    setMainMessages(prev => [...prev, userMessage]);
    setInput('');
    
    setIsWaiting(true);
    setCountdown(15);

    try {
      const response = await askGemini(userMessage.parts[0].text, mainMessages);
      const modelMessage: ChatMessageType = { role: 'model', parts: [{ text: response.text }] };
      setMainMessages(prev => [...prev, modelMessage]);

      // אם השרת דיווח שהמודל הוחלף, נקפיץ הודעה
      if (response.fallbackModelName) {
        setToastMessage(`המגבלה הסתיימה, הועברת למודל ${response.fallbackModelName}`);
        setTimeout(() => {
          setToastMessage(null);
        }, 2000);
      }
      
    } catch (error) {
      console.error("שגיאה בצ'אט הראשי", error);
      alert("הייתה בעיה בתקשורת עם ה-AI.");
    } finally {
      setIsWaiting(false);
    }
  };

  // --------------------------------------------------------
  // מסך 1: מסך הכניסה (נעילה בסיסמה)
  // --------------------------------------------------------
  if (!isAuthorized) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#efeae2] dir-rtl">
        <div className="p-8 bg-white rounded-2xl shadow-xl w-full max-w-sm border border-gray-200">
          <div className="w-16 h-16 bg-[#00a884] rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-sm">
            🔒
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-6 text-center">כניסה למערכת המשפחתית</h1>
          <input 
            type="password" 
            className="w-full p-3 border border-gray-300 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-[#00a884] text-center"
            placeholder="הזיני סיסמה..."
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && checkPassword()}
          />
          <button 
            onClick={checkPassword} 
            className="w-full bg-[#00a884] text-white py-3 rounded-xl font-bold hover:bg-[#008f6f] transition-all"
          >
            כניסה
          </button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // מסך 2: האפליקציה המלאה (אחרי שהסיסמה הוזנה בהצלחה)
  // --------------------------------------------------------
  return (
    <div className="flex h-screen bg-[#efeae2] dir-rtl relative">
      
      {/* תפריט צד (Sidebar) */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-20 hidden md:flex">
        <div className="p-4 border-b border-slate-800">
          <button 
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 bg-[#00a884] hover:bg-[#008f6f] text-white py-3 px-4 rounded-xl font-medium transition-colors"
          >
            <span>+</span>
            שיחה חדשה
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3">
          <h3 className="text-xs font-semibold text-slate-500 mb-3 px-2 uppercase tracking-wider">היסטוריה</h3>
          <div className="space-y-1">
            <button className="w-full text-right p-3 rounded-lg hover:bg-slate-800 transition-colors truncate text-sm">
              התייעצות פיתוח כללית
            </button>
          </div>
        </div>
      </aside>

      {/* האזור המרכזי של הצ'אט */}
      <main className="flex-1 flex flex-col relative">
        <header className="bg-[#f0f2f5] p-4 shadow-sm z-10 flex justify-between items-center border-b border-gray-200">
          <div>
            <h1 className="text-xl font-bold text-gray-800">AI Workspace</h1>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium transition-all shadow-sm flex items-center gap-2 text-sm"
          >
            <span className="text-lg">💡</span>
            התייעצות צדדית
          </button>
        </header>

        {/* הפופ-אפ (Toast) של שינוי המודל */}
        {toastMessage && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
            <div className="bg-slate-800 text-white px-6 py-3 rounded-full shadow-lg text-sm font-medium border border-slate-700">
              {toastMessage}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-3xl mx-auto">
            {mainMessages.length === 0 ? (
              <div className="text-center mt-20 text-gray-400">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl shadow-sm">
                  👋
                </div>
                <p className="text-xl font-medium text-gray-600 mb-1">איך אפשר לעזור היום?</p>
              </div>
            ) : (
              mainMessages.map((msg, index) => (
                <ChatMessage key={index} message={msg} />
              ))
            )}
            
            {/* אנימציית טעינה וטיימר מתחת להודעה */}
            {isWaiting && (
              <div className="flex w-full mb-4 justify-start animate-fade-in">
                <div className="bg-white border border-gray-200 text-gray-600 rounded-2xl rounded-tr-none p-3 px-5 text-sm shadow-sm flex items-center gap-3">
                  <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-[#00a884] rounded-full"></div>
                  <span>
                    ממתין לתשובה... {countdown > 0 ? `(${countdown} שניות)` : '(מעבד נתונים...)'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* שורת ההקלדה למטה */}
        <div className="bg-[#f0f2f5] p-3 md:p-4 border-t border-gray-200">
          <div className="max-w-3xl mx-auto flex gap-3">
            <input 
              className="flex-1 p-3 bg-white border-none rounded-xl focus:outline-none focus:ring-1 focus:ring-gray-300 shadow-sm text-base disabled:opacity-50"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleMainSend()}
              placeholder="הקלידי הודעה..."
              disabled={isWaiting}
            />
            <button 
              onClick={handleMainSend} 
              disabled={isWaiting}
              className="bg-[#00a884] text-white px-8 rounded-xl hover:bg-[#008f6f] font-bold transition-colors shadow-sm disabled:bg-gray-400"
            >
              שלח
            </button>
          </div>
        </div>

        {/* חלון ההתייעצות הצדדי */}
        <SideModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          mainContext={mainMessages}
        />
      </main>
    </div>
  );
}