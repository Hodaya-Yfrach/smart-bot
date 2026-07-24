"use client";

import React, { useState, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import { ChatMessage as ChatMessageType } from '@/types/chat';
import { askGemini } from '@/services/gemini';

interface SideModalProps {
  isOpen: boolean;
  onClose: () => void;
  mainContext: ChatMessageType[];
  selectedModel: string;
  userApiKey: string;
  systemInstruction: string; // <-- הוספנו את קבלת הכללים
}

export default function SideModal({ isOpen, onClose, mainContext, selectedModel, userApiKey, systemInstruction }: SideModalProps) {
  const [internalMessages, setInternalMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isWaiting && countdown > 0) {
      interval = setInterval(() => setCountdown((prev) => prev - 1), 1000);
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
      
      // משלבים את הכללים שהמשתמש הגדיר יחד עם תפקיד ההתייעצות
      const finalInstruction = systemInstruction 
        ? `${systemInstruction}\n\n[הוראת מערכת חשובה: אתה כעת עונה בחלון התייעצות צדדי. עזור למשתמש לנתח את השיחה הראשית או את הקוד, תוך ציות לכללים מעלה.]`
        : "אתה עוזר AI בחלון התייעצות צדדי. עזור למשתמש לנתח את השיחה הראשית.";
      
      const response = await askGemini(
        userMessage.parts[0].text, 
        fullContext, 
        finalInstruction, 
        selectedModel, 
        [], 
        userApiKey
      );
      
      const modelMessage: ChatMessageType = { role: 'model', parts: [{ text: response.text }] };
      setInternalMessages(prev => [...prev, modelMessage]);
    } catch (error: unknown) {
      console.error("שגיאה בצ'אט הפנימי", error);
      const errorMessage = error instanceof Error ? error.message : "שגיאה בתקשורת";
      alert(errorMessage);
    } finally {
      setIsWaiting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" dir="rtl">
      {/* רקע כהה - לחיצה עליו סוגרת את החלון */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      {/* הפאנל הצדדי עצמו */}
      <div className="relative w-full max-w-md h-full bg-[#efeae2] shadow-2xl flex flex-col animate-slide-in">

        {/* כותרת */}
        <header className="bg-[#f0f2f5] p-4 shadow-sm flex justify-between items-center border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <span className="text-xl">💡</span> חלון התייעצות
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </header>

        {/* אזור ההודעות */}
        <div className="flex-1 overflow-y-auto p-4">
          {internalMessages.length === 0 ? (
            <div className="text-center mt-10 text-gray-400 px-4">
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-3 text-2xl shadow-sm">💬</div>
              <p className="text-sm">
                כאן אפשר להתייעץ על השיחה הראשית בלי להשפיע עליה. שאלי אותי כל דבר שקשור למה שכתוב שם.
              </p>
            </div>
          ) : (
            internalMessages.map((msg, index) => <ChatMessage key={index} message={msg} />)
          )}

          {isWaiting && (
            <div className="flex w-full mb-4 justify-start animate-fade-in">
              <div className="bg-white border border-gray-200 text-gray-600 rounded-2xl rounded-tr-none p-3 px-5 text-sm shadow-sm flex items-center gap-3">
                <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-[#00a884] rounded-full"></div>
                <span>ממתין לתשובה... {countdown > 0 ? `(${countdown} שניות)` : '(מעבד...)'}</span>
              </div>
            </div>
          )}
        </div>

        {/* שדה קלט */}
        <div className="bg-[#f0f2f5] p-3 border-t border-gray-200 shrink-0 flex gap-2">
          <input
            className="flex-1 p-3 bg-white border-none rounded-xl focus:outline-none focus:ring-1 focus:ring-gray-300 shadow-sm text-sm disabled:opacity-50 disabled:bg-gray-100"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInternalSend()}
            placeholder="שאלי לגבי השיחה הראשית..."
            disabled={isWaiting}
          />
          <button
            onClick={handleInternalSend}
            disabled={isWaiting}
            className="bg-[#00a884] text-white px-5 rounded-xl hover:bg-[#008f6f] font-bold transition-colors shadow-sm disabled:bg-gray-400"
          >
            שלח
          </button>
        </div>
      </div>
    </div>
  );
}