"use client";
import { useState, useEffect, useRef } from 'react';
import ChatSummaryPanel from './ChatSummaryPanel';
import { ChatMessage as ChatMessageType } from '@/types/chat';
import { getQuickPromptSummary } from '@/services/summary';

interface ChatRecord {
  id: string;
  title: string;
  created_at: string;
}

interface SidebarProps {
  user: any;
  chatHistory: ChatRecord[];
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onStartNewChat: () => void;
  onLogout: () => void;
  onDeleteChat: (chatId: string) => void;
  onUpdateTitle: (chatId: string, newTitle: string) => void;
  mainMessages: ChatMessageType[];
  userApiKey: string;
}

export default function Sidebar({
  user,
  chatHistory,
  currentChatId,
  onSelectChat,
  onStartNewChat,
  onLogout,
  onDeleteChat,
  onUpdateTitle,
  mainMessages,
  userApiKey,
}: SidebarProps) {
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editChatTitle, setEditChatTitle] = useState('');
  const [chatActionLoadingId, setChatActionLoadingId] = useState<string | null>(null);

  // מצב הקטנה/הרחבה של לוח ההיסטוריה
  const [isCollapsed, setIsCollapsed] = useState(false);
  // מצב פתיחה/סגירה של חלון התקציר הראשי
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  // --- מצבים לתקציר בזמן אמת של הפרומפטים (עד 7 מילים לכל תור) ---
  const [realtimeSummaries, setRealtimeSummaries] = useState<string[]>([]);
  const [isSummarizingTurn, setIsSummarizingTurn] = useState(false);

  // כמה הודעות משתמש כבר סוכמו (או נמצאות בתהליך סיכום).
  // זה ref ולא state בכוונה: ref מתעדכן מיידית וסינכרונית, כך שאם ה-effect
  // רץ שוב פעמיים ברצף לפני שהבקשה הראשונה הספיקה לחזור מהשרת, הוא "יידע"
  // מיד שהתור הזה כבר בטיפול ולא ישלח בקשה כפולה (שגרמה לכמה שורות לאותו פרומפט).
  const summarizedCountRef = useRef(0);

  const hasMessagesToSummarize = mainMessages.length > 0;
  const currentChatTitle =
    chatHistory.find((c) => c.id === currentChatId)?.title || 'שיחה נוכחית';

  const startEditingChat = (chat: ChatRecord) => {
    setEditingChatId(chat.id);
    setEditChatTitle(chat.title);
  };

  const handleSaveChatTitle = async (chatId: string) => {
    if (!editChatTitle.trim()) {
      setEditingChatId(null);
      return;
    }
    setChatActionLoadingId(chatId);
    await onUpdateTitle(chatId, editChatTitle);
    setEditingChatId(null);
    setChatActionLoadingId(null);
  };

  const handleDelete = async (chatId: string) => {
    setChatActionLoadingId(chatId);
    await onDeleteChat(chatId);
    setChatActionLoadingId(null);
  };

  // --- מאפסים את התקצירים בזמן אמת כשמתחילים/עוברים שיחה ---
  useEffect(() => {
    setRealtimeSummaries([]);
    summarizedCountRef.current = 0;
  }, [currentChatId]);

  // --- אפקט ליצירת תקציר אוטומטי (עד 7 מילים) עבור כל תור שהושלם ---
  // "תור שהושלם" = יש הודעת משתמש שכבר קיבלה תשובה מה-AI (ולא רק נשלחה).
  // שורה אחת בלבד לכל תור - ראה הערה על summarizedCountRef למעלה.
  useEffect(() => {
    if (mainMessages.length === 0) {
      setRealtimeSummaries([]);
      summarizedCountRef.current = 0;
      return;
    }

    // מחכים לתשובת ה-AI לפני שמסכמים - ההודעה האחרונה צריכה להיות של המודל
    const lastMessage = mainMessages[mainMessages.length - 1];
    if (lastMessage.role !== 'model') return;

    const userMessages = mainMessages.filter((m) => m.role === 'user');
    if (userMessages.length === 0) return;

    // בודק מול ה-ref (סינכרוני!) אם כבר טיפלנו/מטפלים בתור הזה
    if (userMessages.length <= summarizedCountRef.current) return;

    // "נועלים" את התור הזה מיד - לפני הקריאה האסינכרונית - כדי שאם ה-effect
    // יופעל שוב לפני שהבקשה חוזרת, הוא ידע לוותר ולא ישלח בקשה כפולה
    summarizedCountRef.current = userMessages.length;

    const latestMsg = userMessages[userMessages.length - 1];
    const promptText = latestMsg.parts?.[0]?.text || '';
    if (!promptText.trim()) return;

    const generateQuickSummary = async () => {
      setIsSummarizingTurn(true);
      try {
        // הבקשה יוצאת רק לשרת שלנו (/api/quick-summary) - לא ישירות לגוגל.
        // כך מפתח ה-API לעולם לא נחשף בכתובת URL בדפדפן, ותמיד רץ במודל הקל ביותר.
        const shortText = await getQuickPromptSummary(promptText, userApiKey);
        if (shortText) {
          setRealtimeSummaries((prev) => [...prev, shortText]);
        }
      } catch (error) {
        console.error('שגיאה ביצירת תקציר מהיר:', error);
      } finally {
        setIsSummarizingTurn(false);
      }
    };

    generateQuickSummary();
  }, [mainMessages, userApiKey]);

  return (
    <>
      <aside
        className={`${
          isCollapsed ? 'w-16' : 'w-64'
        } bg-slate-900 text-slate-300 flex flex-col shadow-xl z-20 hidden md:flex shrink-0 transition-all duration-300`}
      >
        <div className="p-4 border-b border-slate-800">
          <button
            onClick={onStartNewChat}
            title="שיחה חדשה"
            className="w-full flex items-center justify-center gap-2 bg-[#ec4899] hover:bg-[#db2777] text-white py-3 px-4 rounded-xl font-medium transition-colors"
          >
            <span>+</span> {!isCollapsed && 'שיחה חדשה'}
          </button>
        </div>

        {!isCollapsed && (
          <div className="flex-1 overflow-y-auto p-3 flex flex-col">
            {user ? (
              <>
                <h3 className="text-xs font-semibold text-slate-500 mb-3 px-2 uppercase tracking-wider">
                  היסטוריית שיחות ({chatHistory.length}/10)
                </h3>
                <ul className="space-y-1 mb-4">
                  {chatHistory.map((chat) => (
                    <li
                      key={chat.id}
                      className={`group rounded-lg transition-colors ${
                        currentChatId === chat.id ? 'bg-slate-800' : 'hover:bg-slate-800'
                      }`}
                    >
                      {editingChatId === chat.id ? (
                        <div className="flex items-center gap-2 p-2">
                          <input
                            type="text"
                            value={editChatTitle}
                            onChange={(e) => setEditChatTitle(e.target.value)}
                            className="flex-1 bg-slate-700 text-white text-sm rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[#ec4899]"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveChatTitle(chat.id);
                              if (e.key === 'Escape') setEditingChatId(null);
                            }}
                          />
                          <button
                            onClick={() => handleSaveChatTitle(chat.id)}
                            className="text-[#ec4899] hover:text-[#db2777] text-xs font-medium shrink-0"
                          >
                            שמור
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => onSelectChat(chat.id)}
                            className={`flex-1 text-right p-3 truncate text-sm ${
                              currentChatId === chat.id ? 'text-white' : 'text-slate-400'
                            }`}
                          >
                            {chat.title}
                          </button>
                          <div className="flex gap-2 pl-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => startEditingChat(chat)}
                              disabled={chatActionLoadingId === chat.id}
                              className="text-blue-400 hover:text-blue-300 text-xs"
                              title="ערוך כותרת"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => handleDelete(chat.id)}
                              disabled={chatActionLoadingId === chat.id}
                              className="text-red-400 hover:text-red-300 text-xs"
                              title="מחק שיחה"
                            >
                              {chatActionLoadingId === chat.id ? '...' : '🗑'}
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>

                {/* --- תיבת התקציר הרציף (זמן אמת, עד 7 מילים לכל תור) --- */}
                {hasMessagesToSummarize && (
                  <div className="mt-2 pt-4 border-t border-slate-800 flex-1">
                    <h3 className="text-xs font-semibold text-[#ec4899] mb-3 px-2 uppercase tracking-wider">
                      רצף השיחה (עד 7 מילים)
                    </h3>
                    <ul className="space-y-3 px-2 overflow-y-auto max-h-[30vh] custom-scrollbar">
                      {realtimeSummaries.map((summaryText, idx) => (
                        <li key={idx} className="flex gap-2 text-sm text-slate-300">
                          <span className="text-[#ec4899] shrink-0 mt-1 text-[10px]">⬤</span>
                          <span className="leading-snug">{summaryText}</span>
                        </li>
                      ))}
                      {isSummarizingTurn && (
                        <li className="flex gap-2 text-sm text-slate-500 animate-pulse">
                          <span className="text-[#ec4899] shrink-0 mt-1 text-[10px]">⬤</span>
                          <span>מכין תקציר...</span>
                        </li>
                      )}
                    </ul>

                    {/* --- כפתור לחלון הקופץ: מושגים חדשים + תקציר כל השיחה --- */}
                    <button
                      onClick={() => setIsSummaryOpen(true)}
                      disabled={!hasMessagesToSummarize}
                      title="תקציר שיחה מלא ומושגים חדשים"
                      className="w-full mt-3 flex items-center justify-center gap-2 text-sm bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 py-2 px-3 rounded-lg transition-colors"
                    >
                      <span>📄</span> תקציר שיחה מלא
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center mt-10 text-slate-500 text-sm px-4">
                את/ה מחובר/ת כאורח.
                <br />
                השיחות לא נשמרות.
              </div>
            )}
          </div>
        )}

        {isCollapsed && <div className="flex-1" />}

        {/* --- כפתור הקטנה/הרחבה של הלוח --- */}
        <div className="border-t border-slate-800 p-3 flex flex-col gap-2">
          <button
            onClick={() => setIsCollapsed((prev) => !prev)}
            title={isCollapsed ? 'הרחב לוח' : 'הקטן לוח'}
            className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 py-2 px-3 rounded-lg transition-colors"
          >
            <span>{isCollapsed ? '»' : '«'}</span>
            {!isCollapsed && 'הקטן לוח'}
          </button>
        </div>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={onLogout}
            className="w-full text-center text-sm text-slate-400 hover:text-white transition-colors"
          >
            {isCollapsed ? '⏻' : 'התנתק / החלף משתמש'}
          </button>
        </div>
      </aside>

      <ChatSummaryPanel
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        chatId={currentChatId}
        chatTitle={currentChatTitle}
        messages={mainMessages}
        userApiKey={userApiKey}
      />
    </>
  );
}