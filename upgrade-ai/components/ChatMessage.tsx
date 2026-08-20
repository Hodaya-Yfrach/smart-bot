"use client";
// =============================================================================
// components/ChatMessage.tsx
// קומפוננטת הצגת הודעה בודדת בשיחה (בועת צ'אט).
//
// תומכת בשלושה סוגי תוכן:
//   1. טקסט רגיל     — message.parts[].text
//   2. תמונת קלט     — message.parts[].imageUrl (תמונה שהמשתמש העלה לשאלה)
//   3. תמונה שנוצרה  — message.parts[].generatedImage (base64 ממודל image-gen)
//
// DEV NOTE — imageUrl לעומת generatedImage:
//   - imageUrl: blob: URL או data-URL של תמונה שהמשתמש העלה; מוצג בצד המשתמש.
//   - generatedImage: base64 PNG שהמודל יצר; מוצג בצד המודל.
//   שניהם מוצגים כ-<img> רגיל — אין טעינה חיצונית.
//
// DEV NOTE — כפתור עריכה:
//   onEdit מועבר רק להודעת המשתמש האחרונה (מ-page.tsx).
//   לחיצה עליו מחזירה את הטקסט לתיבת הקלט ומוחקת מהמסד הנתונים את
//   כל ההודעות מאותה נקודה ואילך.
// =============================================================================

import Image from 'next/image';
import { ChatMessage as ChatMessageType } from '@/types/chat';

interface ChatMessageProps {
  message: ChatMessageType;
  onEdit?: () => void;
}

export default function ChatMessage({ message, onEdit }: ChatMessageProps) {
  const isUser = message.role === 'user';

  // מאחדים את כל הטקסטים מה-parts להצגה
  const textContent = message.parts
    .filter((p) => p.text !== undefined)
    .map((p) => p.text)
    .join('');

  // תמונת קלט (העלאה של המשתמש) — blob URL או data-URL
  const uploadedImageUrl = message.parts.find((p) => p.imageUrl)?.imageUrl;

  // תמונה שנוצרה על ידי המודל — base64 PNG
  const generatedImageBase64 = message.parts.find((p) => p.generatedImage)?.generatedImage;

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'} group`}>
      <div
        className={`max-w-[85%] md:max-w-[75%] p-4 md:px-6 rounded-[1.5rem] text-[15px] leading-relaxed shadow-sm transition-all ${
          isUser
            ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-tl-sm shadow-teal-500/20'
            : 'bg-white border border-slate-100 text-slate-700 rounded-tr-sm shadow-slate-200/50'
        }`}
      >
        {/* תמונה שהמשתמש העלה — מוצגת מעל הטקסט */}
        {uploadedImageUrl && (
          <div className="mb-3 overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={uploadedImageUrl}
              alt="תמונה שהועלתה"
              className="max-w-full max-h-64 object-contain rounded-xl"
            />
          </div>
        )}

        {/* טקסט ההודעה */}
        {textContent && (
          <div className="whitespace-pre-wrap break-words">{textContent}</div>
        )}

        {/* תמונה שנוצרה על ידי מודל image-gen — מוצגת מתחת לטקסט */}
        {generatedImageBase64 && (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${generatedImageBase64}`}
              alt="תמונה שנוצרה על ידי ה-AI"
              className="max-w-full rounded-xl"
            />
            {/* כפתור הורדה — מאפשר שמירת התמונה */}
            <a
              href={`data:image/png;base64,${generatedImageBase64}`}
              download="generated-image.png"
              className="mt-2 text-[11px] font-medium text-slate-400 hover:text-teal-600 flex items-center gap-1 transition-colors"
            >
              <span>⬇️</span> הורד תמונה
            </a>
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
