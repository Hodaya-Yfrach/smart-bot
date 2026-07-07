import React from 'react';
import { ChatMessage as ChatMessageType } from '@/types/chat';

interface Props {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    // ב-RTL (ימין לשמאל), justify-end דוחף את הודעות המשתמש שמאלה, כמו בוואטסאפ
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div 
        // dir="auto" הוא הקסם שמונע בלבול בין עברית לאנגלית
        dir="auto" 
        className={`max-w-[85%] sm:max-w-[75%] p-3 text-sm md:text-base shadow-sm relative
          ${isUser 
            ? 'bg-[#dcf8c6] text-gray-900 rounded-2xl rounded-tl-none' // ירוק וואטסאפ למשתמש
            : 'bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-tr-none' // לבן למודל
          }`}
      >
        <p className="whitespace-pre-wrap leading-relaxed font-normal">
          {message.parts[0].text}
        </p>
      </div>
    </div>
  );
}