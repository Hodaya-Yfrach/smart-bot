"use client";
import { useState, useEffect } from 'react';
import ChatMessage from '@/components/ChatMessage';
import SideModal from '@/components/SideModal';
import { ChatMessage as ChatMessageType } from '@/types/chat';
import { askGemini } from '@/services/gemini';

export default function Home() {
  const [mainMessages, setMainMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // ניהול מצב המתנה וטיימר
  const [isWaiting, setIsWaiting] = useState(false);
  const [countdown, setCountdown] = useState(15);

  // מנגנון הספירה לאחור
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

  const handleMainSend = async () => {
    if (!input.trim() || isWaiting) return;

    const userMessage: ChatMessageType = { role: 'user', parts: [{ text: input }] };
    setMainMessages(prev => [...prev, userMessage]);
    setInput('');
    
    // התחלת מצב טעינה ואיפוס טיימר ל-15 שניות
    setIsWaiting(true);
    setCountdown(15);

    try {
      const responseText = await askGemini(userMessage.parts[0].text, mainMessages);
      const modelMessage: ChatMessageType = { role: 'model', parts: [{ text: responseText }] };
      setMainMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      console.error("שגיאה בצ'אט הראשי", error);
      alert("הייתה בעיה בתקשורת עם ה-AI.");
    } finally {
      // עצירת הטעינה כשהתשובה מגיעה
      setIsWaiting(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#efeae2] dir-rtl">
      
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
            
            {/* בועת המתנה עם טיימר שיורד - מופיעה רק כשיש המתנה לתשובה */}
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

        <SideModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          mainContext={mainMessages}
        />
      </main>
    </div>
  );
}