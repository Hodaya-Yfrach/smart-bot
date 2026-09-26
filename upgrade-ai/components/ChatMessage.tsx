"use client";
// =============================================================================
// components/ChatMessage.tsx
// קומפוננטת הצגת הודעה בודדת בשיחה (בועת צ'אט).
//
// מציגה טקסט רגיל של משתמש או מודל.
//   שניהם מוצגים כ-<img> רגיל — אין טעינה חיצונית.
//
// DEV NOTE — כפתור עריכה:
//   onEdit מועבר רק להודעת המשתמש האחרונה (מ-page.tsx).
//   לחיצה עליו מחזירה את הטקסט לתיבת הקלט ומוחקת מהמסד הנתונים את
//   כל ההודעות מאותה נקודה ואילך.
// =============================================================================

import { ChatMessage as ChatMessageType } from '@/types/chat';
import { useEffect, useState } from 'react';

interface ChatMessageProps {
  message: ChatMessageType;
  onEdit?: () => void;
}

export default function ChatMessage({ message, onEdit }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [visibleScore, setVisibleScore] = useState(0);

  useEffect(() => {
    if (typeof message.studyScore !== 'number') return;
    setVisibleScore(0);
    const duration = 700;
    const startedAt = performance.now();
    let frameId = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      setVisibleScore(Math.round(message.studyScore! * progress));
      if (progress < 1) frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [message.studyScore]);

  // מאחדים את כל הטקסטים מה-parts להצגה
  const textContent = message.parts
    .filter((p) => p.text !== undefined)
    .map((p) => p.text)
    .join('');

  const uploadedImageUrl = message.parts.find((part) => part.imageUrl)?.imageUrl;
  const copyResponse = async (selectedOnly = false) => {
    const selection = window.getSelection()?.toString().trim();
    await navigator.clipboard.writeText(selectedOnly && selection ? selection : textContent);
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'} group`}>
      <div
        className={`max-w-[85%] md:max-w-[75%] p-4 md:px-6 rounded-[1.5rem] text-[15px] leading-relaxed shadow-sm transition-all ${
          isUser
            ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-tl-sm shadow-teal-500/20'
            : 'bg-white border border-slate-100 text-slate-700 rounded-tr-sm shadow-slate-200/50'
        }`}
      >
        {uploadedImageUrl && (
          <div className="mb-3 overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={uploadedImageUrl} alt="תמונה שהועלתה" className="max-h-64 max-w-full rounded-xl object-contain" />
          </div>
        )}

        {/* טקסט ההודעה */}
        {textContent && (
          <div className="whitespace-pre-wrap break-words">{textContent}</div>
        )}

        {!isUser && textContent && (
          <div>
            {typeof message.studyScore === 'number' && (
              <div className="mb-2 inline-flex items-center rounded-lg border border-teal-100 bg-gradient-to-r from-teal-50 to-blue-50 px-2.5 py-1 text-[11px] font-extrabold text-teal-700 shadow-sm">
                🎯 דיוק בתשובה: {visibleScore}%
              </div>
            )}
            <button
              onClick={() => copyResponse()}
              className="mt-3 text-[11px] font-bold text-slate-400 hover:text-teal-600 transition-colors"
            >
              📋 העתק תשובה
            </button>
            <button
              onClick={() => copyResponse(true)}
              className="mr-3 mt-3 text-[11px] font-bold text-slate-400 hover:text-teal-600 transition-colors"
            >
              📄 העתק חלק מסומן
            </button>
          </div>
        )}

        {/* כפתור עריכה — מוצג רק בהודעת המשתמש האחרונה */}
        {isUser && onEdit && (
          <button
            onClick={onEdit}
            className="mt-3 text-[11.5px] font-medium text-teal-100 hover:text-white transition-all flex items-center gap-1.5 opacity-70 group-hover:opacity-100"
          >
            <span className="text-[10px]">✏️</span> עריכת שאלה
          </button>
        )}
      </div>
    </div>
  );
}
