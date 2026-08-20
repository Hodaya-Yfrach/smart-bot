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
  systemInstruction: string;
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
      {/* רקע חצי-שקוף ועדין - לחיצה עליו סוגרת את החלון */}
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-md transition-opacity" onClick={onClose} />

      {/* הפאנל הצדדי עצמו */}
      <div className="relative w-full max-w-md h-full bg-slate-50 text-slate-800 shadow-[[-20px_0_60px_rgba(0,0,0,0.1)]] flex flex-col animate-slide-in">

        {/* האדר צבעוני, רחב ודומיננטי לפי הבקשה */}
        <header className="px-6 pt-8 pb-6 bg-gradient-to-br from-teal-500 via-teal-600 to-blue-600 flex justify-between items-center shadow-lg shrink-0 relative z-10 rounded-bl-[2rem]">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-3">
            <span className="text-3xl drop-shadow-md">💡</span> 
            <span className="drop-shadow-sm tracking-wide">חלון התייעצות</span>
          </h2>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center transition-all backdrop-blur-sm"
          >
            ✕
          </button>
        </header>

        {/* אזור ההודעות */}
        <div className="flex-1 overflow-y-auto p-5 scroll-smooth">
          {internalMessages.length === 0 ? (
            <div className="text-center mt-12 text-slate-400 px-4 animate-fade-in">
              <div className="w-16 h-16 bg-white border border-slate-200 rounded-3xl flex items-center justify-center mx-auto mb-5 text-3xl shadow-sm transform rotate-3">💬</div>
              <h3 className="text-lg font-bold text-slate-700 mb-2">צריכים עזרה מהצד?</h3>
              <p className="text-sm font-medium leading-relaxed">
                כאן אפשר להתייעץ על השיחה הראשית מבלי להשפיע עליה. שאלו כל דבר שקשור לתוכן, לקוד או לניתוח השיחה.
              </p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {internalMessages.map((msg, index) => (
                <div className="animate-fade-in-up" key={index}>
                  <ChatMessage message={msg} />
                </div>
              ))}
            </div>
          )}

          {/* בועת המתנה - תואמת לעיצוב הכללי */}
          {isWaiting && (
            <div className="flex w-full mb-6 justify-start animate-fade-in mt-4">
              <div className="bg-white text-slate-700 rounded-2xl p-4 px-6 text-sm shadow-sm flex items-center justify-between gap-6 max-w-[85%] relative overflow-hidden border border-slate-100">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-teal-500 via-blue-500 to-teal-500"></div>
                <span className="font-medium text-[15px] pt-1">
                  ממתין לתשובה... {countdown > 0 ? <span className="text-slate-400">({countdown} שניות)</span> : <span className="text-slate-400">(מעבד...)</span>}
                </span>
                <div className="animate-spin w-5 h-5 border-[2.5px] border-slate-200 border-t-teal-600 rounded-full shrink-0"></div>
              </div>
            </div>
          )}
        </div>

        {/* שדה קלט מרחף */}
        <div className="bg-white p-5 border-t border-slate-100 shrink-0 flex gap-3 shadow-[0_-15px_40px_rgba(0,0,0,0.03)] z-10 relative">
          <textarea
            rows={1}
            className="flex-1 min-h-[52px] max-h-32 resize-y p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 shadow-inner text-sm transition-all duration-300 disabled:opacity-50 disabled:bg-slate-100 leading-relaxed"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleInternalSend();
              }
            }}
            placeholder="מה תרצו לשאול?..."
            disabled={isWaiting}
          />
          <button
            onClick={handleInternalSend}
            disabled={isWaiting || !input.trim()}
            className="h-[52px] bg-slate-800 text-white px-6 rounded-2xl hover:bg-slate-700 hover:shadow-lg hover:-translate-y-0.5 font-bold transition-all duration-300 shadow-md disabled:bg-slate-300 disabled:text-slate-500 disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2 group"
          >
            <span>שלח</span>
          </button>
        </div>
      </div>
    </div>
  );
}