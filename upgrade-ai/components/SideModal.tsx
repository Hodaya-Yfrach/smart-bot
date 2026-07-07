import React, { useState, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import { ChatMessage as ChatMessageType } from '@/types/chat';
import { askGemini } from '@/services/gemini';

interface SideModalProps {
  isOpen: boolean;
  onClose: () => void;
  mainContext: ChatMessageType[];
}

export default function SideModal({ isOpen, onClose, mainContext }: SideModalProps) {
  const [internalMessages, setInternalMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState('');
  
  // ניהול מצב טעינה בחלון הצדדי
  const [isWaiting, setIsWaiting] = useState(false);
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isWaiting && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isWaiting, countdown]);

  if (!isOpen) return null;

  const handleInternalSend = async () => {
    if (!input.trim() || isWaiting) return;

    const userMessage: ChatMessageType = { role: 'user', parts: [{ text: input }] };
    setInternalMessages(prev => [...prev, userMessage]);
    setInput('');
    
    setIsWaiting(true);
    setCountdown(15);

    try {
      const fullContext = [...mainContext, ...internalMessages];
      const responseText = await askGemini(userMessage.parts[0].text, fullContext);
      
      const modelMessage: ChatMessageType = { role: 'model', parts: [{ text: responseText }] };
      setInternalMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      console.error("שגיאה בצ'אט הפנימי", error);
    } finally {
      setIsWaiting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full md:w-[450px] h-full bg-[#efeae2] shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
        
        <header className="bg-white p-4 flex justify-between items-center shadow-sm z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-800">התייעצות פנימית</h2>
            <p className="text-xs text-gray-500">המידע לא עובר לשיחה הראשית</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setInternalMessages([])}
              className="text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors"
            >
              נקה שיחה
            </button>
            <button 
              onClick={onClose} 
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 bg-[#efeae2]">
          {internalMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-60">
              <span className="text-4xl mb-3">🤫</span>
              <p className="text-center text-sm text-gray-600 px-4">
                כאן תוכלי להתייעץ איתי על הקוד או על השיחה בחוץ.
              </p>
            </div>
          ) : (
            internalMessages.map((msg, index) => (
              <ChatMessage key={index} message={msg} />
            ))
          )}
          
          {/* בועת ההמתנה לצ'אט הפנימי */}
          {isWaiting && (
            <div className="flex w-full mb-4 justify-start animate-fade-in">
              <div className="bg-white border border-gray-200 text-gray-600 rounded-2xl rounded-tr-none p-3 text-sm shadow-sm flex items-center gap-3">
                <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-[#00a884] rounded-full"></div>
                <span>
                  בודק... {countdown > 0 ? `(${countdown}s)` : ''}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 bg-[#f0f2f5] border-t border-gray-200">
          <div className="flex gap-2">
            <input 
              className="flex-1 p-3 bg-white border-none rounded-xl focus:outline-none focus:ring-1 focus:ring-gray-300 shadow-sm text-sm disabled:opacity-50"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInternalSend()}
              placeholder="כתבי הודעה..."
              disabled={isWaiting}
            />
            <button 
              onClick={handleInternalSend} 
              disabled={isWaiting}
              className="bg-[#00a884] text-white px-5 rounded-xl hover:bg-[#008f6f] font-medium transition-colors shadow-sm disabled:bg-gray-400"
            >
              שלח
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}