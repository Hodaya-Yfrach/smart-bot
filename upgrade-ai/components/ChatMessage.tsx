"use client";
import { ChatMessage as ChatMessageType } from '@/types/chat';

export default function ChatMessage({ message, onEdit }: { message: ChatMessageType; onEdit?: () => void }) {
  // בודקים האם ההודעה נשלחה על ידי המשתמש או על ידי המודל
  const isUser = message.role === 'user';

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'} group`}>
      <div 
        className={`max-w-[85%] md:max-w-[75%] p-4 md:px-6 rounded-[1.5rem] text-[15px] leading-relaxed shadow-sm transition-all ${
          isUser 
            ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-tl-sm shadow-teal-500/20'
            : 'bg-white border border-slate-100 text-slate-700 rounded-tr-sm shadow-slate-200/50'
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{message.parts[0].text}</div>
        
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