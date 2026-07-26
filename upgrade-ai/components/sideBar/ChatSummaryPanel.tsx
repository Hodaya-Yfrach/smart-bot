"use client";

import { useState, useEffect, useRef } from 'react';
import { ChatMessage as ChatMessageType } from '@/types/chat';
import { ChatSummary } from '@/types/chatSummary';
import { getChatSummary, SummaryApiError } from '@/services/summary';

interface ChatSummaryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string | null;
  chatTitle: string;
  messages: ChatMessageType[];
  userApiKey: string;
}

type TabKey = 'steps' | 'terms';

export default function ChatSummaryPanel({
  isOpen,
  onClose,
  chatId,
  chatTitle,
  messages,
  userApiKey,
}: ChatSummaryPanelProps) {
  const [summary, setSummary] = useState<ChatSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('steps');
  const [showOverall, setShowOverall] = useState(false);
  const [showExpandedOverall, setShowExpandedOverall] = useState(false);

  // שומר לאיזו שיחה שייך התקציר שכרגע שמור ב-state, כדי לדעת מתי המטמון "פג תוקף"
  const cachedChatIdRef = useRef<string | null>(null);

  const fetchSummary = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getChatSummary(messages, userApiKey);
      setSummary(result);
      cachedChatIdRef.current = chatId;
    } catch (err) {
      const message =
        err instanceof SummaryApiError ? err.message : 'שגיאה ביצירת הסיכום.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // כשעוברים לשיחה אחרת - מבטלים את התקציר השמור, אבל לא שולחים בקשה חדשה מיד.
  // הבקשה החדשה תישלח רק בפעם הבאה שהחלון ייפתח (או בלחיצה על "סיכום חוזר").
  useEffect(() => {
    if (cachedChatIdRef.current !== chatId) {
      setSummary(null);
      setError(null);
      cachedChatIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  useEffect(() => {
    if (!isOpen) return;

    setActiveTab('steps');
    setShowOverall(false);
    setShowExpandedOverall(false);

    // *** הליבה של הדרישה: שולחים בקשה ל-AI רק אם עוד אין תקציר שמור לשיחה הזו. ***
    // פתיחה חוזרת של החלון לאותה שיחה תציג את התקציר השמור בלי לשלוח בקשה נוספת.
    if (summary === null && cachedChatIdRef.current !== chatId) {
      fetchSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  // "סיכום חוזר" - היחיד שבאמת שולח בקשה מחדש ל-AI, בלחיצה מפורשת של המשתמש/ת.
  const handleRegenerate = () => {
    if (isLoading) return;
    fetchSummary();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-fade-in">
        {/* כותרת */}
        <header className="p-4 border-b flex justify-between items-center bg-gray-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span className="text-xl">📄</span> תקציר שיחה
            </h2>
            <p className="text-xs text-gray-500 truncate max-w-[280px]">{chatTitle}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleRegenerate}
              disabled={isLoading}
              title="סיכום חוזר (שולח בקשה חדשה ל-AI)"
              className="text-gray-500 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className={isLoading ? 'inline-block animate-spin' : ''}>🔄</span>
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>
        </header>

        {/* טאבים */}
        <div className="flex border-b shrink-0 bg-white">
          <button
            onClick={() => setActiveTab('steps')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'steps'
                ? 'text-[#ec4899] border-b-2 border-[#ec4899]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            מהלך השיחה
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'terms'
                ? 'text-[#ec4899] border-b-2 border-[#ec4899]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            מושגים חדשים
            {summary && summary.newTerms.length > 0 && (
              <span className="mr-1 bg-pink-100 text-pink-700 text-xs rounded-full px-2 py-0.5">
                {summary.newTerms.length}
              </span>
            )}
          </button>
        </div>

        {/* תוכן */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-500">
              <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-[#ec4899] rounded-full" />
              <span className="text-sm">מכין את התקציר...</span>
            </div>
          )}

          {!isLoading && error && (
            <div className="text-center text-sm text-red-500 bg-red-50 p-4 rounded-lg">
              {error}
            </div>
          )}

          {!isLoading && !error && summary && activeTab === 'steps' && (
            <div className="space-y-4">
              {/* כפתור נעיל לסיכום כללי בן 3 שורות */}
              <div className="border border-pink-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowOverall((prev) => !prev)}
                  className="w-full flex justify-between items-center bg-pink-50 hover:bg-pink-100 transition-colors px-4 py-3 text-sm font-bold text-pink-700"
                >
                  <span>סיכום כללי</span>
                  <span className="text-xs">{showOverall ? '▲ הסתר' : '▼ הצג'}</span>
                </button>
                {showOverall && (
                  <div className="p-4 bg-white text-sm text-gray-700 space-y-2">
                    {!summary.oneLineSummary && summary.overallSummary.length === 0 ? (
                      <p className="text-gray-400 italic">אין מספיק תוכן לסיכום כללי.</p>
                    ) : !showExpandedOverall ? (
                      <div className="flex items-start justify-between gap-3">
                        <p className="flex-1">
                          {summary.oneLineSummary || summary.overallSummary[0]}
                        </p>
                        {summary.overallSummary.length > 0 && (
                          <button
                            onClick={() => setShowExpandedOverall(true)}
                            className="text-xs text-pink-600 hover:underline shrink-0 whitespace-nowrap"
                          >
                            הרחב ל-3 שורות
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {summary.overallSummary.map((line, idx) => (
                          <p key={idx}>{line}</p>
                        ))}
                        <button
                          onClick={() => setShowExpandedOverall(false)}
                          className="text-xs text-pink-600 hover:underline mt-1"
                        >
                          חזרה לשורה אחת
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* פירוט לפי סבבים */}
              {summary.turns.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-6">
                  אין עדיין מספיק הודעות ליצירת תקציר מפורט.
                </p>
              ) : (
                <ul className="space-y-2">
                  {summary.turns.flatMap((turn, idx) => {
                    const items = [
                      <li key={`topic-${idx}`} className="flex gap-2 text-sm text-gray-800">
                        <span className="text-gray-400 shrink-0">•</span>
                        <span>{turn.topic}</span>
                      </li>,
                    ];
                    if (turn.nextPrompt) {
                      items.push(
                        <li
                          key={`prompt-${idx}`}
                          className="flex gap-2 text-sm text-gray-500 pr-1"
                        >
                          <span className="text-gray-300 shrink-0">•</span>
                          <span>{turn.nextPrompt}</span>
                        </li>
                      );
                    }
                    return items;
                  })}
                </ul>
              )}
            </div>
          )}

          {!isLoading && !error && summary && activeTab === 'terms' && (
            <div className="space-y-3">
              {summary.newTerms.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-6">
                  לא זוהו מושגים חדשים בשיחה זו.
                </p>
              ) : (
                summary.newTerms.map((term, idx) => (
                  <div key={idx} className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <p className="text-sm font-bold text-blue-900">{term.term}</p>
                    <p className="text-xs text-blue-800 mt-1">{term.explanation}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}