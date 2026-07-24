import React, { memo } from 'react';
import { ChatMessage as ChatMessageType } from '@/types/chat';

interface Props {
  message: ChatMessageType;
}

// שימוש ב-memo לשיפור ביצועים משמעותי בשיחות ארוכות
const ChatMessage = memo(function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div 
        dir="auto" 
        className={`max-w-[85%] sm:max-w-[75%] p-3 text-sm md:text-base shadow-sm relative transition-all
          ${isUser 
            ? 'bg-[#dcf8c6] text-gray-900 rounded-2xl rounded-tl-none' 
            : 'bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-tr-none'
          }`}
      >
        <p className="whitespace-pre-wrap leading-relaxed font-normal">
          {message.parts[0].text}
        </p>
      </div>
    </div>
  );
});

export default ChatMessage;