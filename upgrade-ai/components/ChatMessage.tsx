"use client";
import { ChatMessage as ChatMessageType } from '@/types/chat';

export default function ChatMessage({ message }: { message: ChatMessageType }) {
  // בודקים האם ההודעה נשלחה על ידי המשתמש או על ידי המודל
  const isUser = message.role === 'user';

  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`max-w-[80%] p-3 px-5 rounded-2xl text-sm shadow-sm ${
          isUser 
            ? 'bg-[#ec4899] text-white rounded-tl-none' // בועת הלקוח שונתה לוורוד
            : 'bg-white border border-gray-200 text-gray-800 rounded-tr-none' // בועת המודל נשארה לבנה
        }`}
      >
        <span className="whitespace-pre-wrap">{message.parts[0].text}</span>
      </div>
    </div>
  );
}