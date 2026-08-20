"use client";

// =============================================================================
// ChatSummaryPanel — פאנל תקציר שיחה
//
// זרימה:
//   פתיחה → בודק DB → אם יש: מציג ישר (ללא AI) → אם אין: קורא ל-AI ושומר.
//   כפתור 🔄 → מייצר מחדש ומעדכן DB (upsert).
//   מחיקת שיחה → CASCADE ב-DB מוחק תקציר אוטומטית.
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import { ChatMessage as ChatMessageType } from '@/types/chat';
import { ChatSummary } from '@/types/chatSummary';
import { getChatSummary, SummaryApiError } from '@/services/summary';
import { supabase } from '@/services/supabase';

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
  isOpen, onClose, chatId, chatTitle, messages, userApiKey,
}: ChatSummaryPanelProps) {
  const [summary, setSummary] = useState<ChatSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('steps');
  const [showOverall, setShowOverall] = useState(false);
  const [showExpandedOverall, setShowExpandedOverall] = useState(false);
  const loadedForChat = useRef<string | null>(null);

  // ── שמירה/עדכון ב-DB ──────────────────────────────────────────────────────
  const saveToDb = async (s: ChatSummary) => {
    if (!chatId) return;
    await supabase.from('chat_summaries').upsert({
      chat_id: chatId,
      summary: s,
      updated_at: new Date().toISOString(),
    });
  };

  // ── יצירת תקציר מ-AI + שמירה ──────────────────────────────────────────────
  const generateAndSave = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getChatSummary(messages, userApiKey);
      setSummary(result);
      await saveToDb(result);
      loadedForChat.current = chatId;
    } catch (err) {
      setError(err instanceof SummaryApiError ? err.message : 'שגיאה ביצירת הסיכום.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── פתיחת פאנל ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !chatId) return;
    setActiveTab('steps');
    setShowOverall(false);
    setShowExpandedOverall(false);

    // אם כבר טענו לשיחה זו — לא נייצר שוב
    if (loadedForChat.current === chatId) return;

    const init = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data } = await supabase
          .from('chat_summaries')
          .select('summary')
          .eq('chat_id', chatId)
          .maybeSingle();

        if (data?.summary) {
          // יש ב-DB — מציגים ישר
          setSummary(data.summary as ChatSummary);
          loadedForChat.current = chatId;
          setIsLoading(false);
        } else {
          // אין — יוצרים
          setIsLoading(false);
          await generateAndSave();
        }
      } catch {
        setIsLoading(false);
        setError('שגיאה בטעינת התקציר.');
      }
    };

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, chatId]);

  // איפוס כשעוברים לשיחה אחרת
  useEffect(() => {
    setSummary(null);
    setError(null);
    loadedForChat.current = null;
  }, [chatId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-slate-800/15 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.08)] w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-fade-in border border-slate-100">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-teal-600 via-blue-600 to-teal-600" />

        {/* כותרת */}
        <header className="px-6 pt-7 pb-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
          <div>
            <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
              <span className="text-2xl">📄</span> תקציר שיחה
            </h2>
            <p className="text-sm text-slate-500 truncate max-w-[280px] mt-0.5 font-medium">{chatTitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={generateAndSave}
              disabled={isLoading}
              title="יצירת תקציר מחדש ועדכון ב-DB"
              className="text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-full w-9 h-9 flex items-center justify-center transition-all disabled:opacity-40"
            >
              <span className={isLoading ? 'inline-block animate-spin' : ''}>🔄</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full w-9 h-9 flex items-center justify-center transition-colors">✕</button>
          </div>
        </header>

        {/* טאבים */}
        <div className="flex border-b border-slate-100 shrink-0 bg-white px-2">
          {(['steps', 'terms'] as TabKey[]).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3.5 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === tab ? 'text-teal-700 border-b-2 border-teal-600 bg-teal-50/30' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab === 'steps' ? 'מהלך השיחה' : (
                <>
                  <span>מושגים חדשים</span>
                  {summary && summary.newTerms.length > 0 && (
                    <span className={`text-[10px] rounded-full px-2 py-0.5 font-bold ${activeTab === 'terms' ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-600'}`}>
                      {summary.newTerms.length}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>

        {/* תוכן */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-48 gap-4 text-slate-500">
              <div className="animate-spin w-8 h-8 border-[3px] border-slate-200 border-t-teal-600 rounded-full" />
              <span className="text-sm font-medium">מכין את התקציר...</span>
            </div>
          )}
          {!isLoading && error && (
            <div className="text-center text-sm font-medium text-red-600 bg-red-50 border border-red-100 p-4 rounded-2xl">{error}</div>
          )}
          {!isLoading && !error && summary && activeTab === 'steps' && (
            <div className="space-y-6">
              {/* סיכום כללי */}
              <div className="border border-teal-100/60 bg-white rounded-2xl overflow-hidden shadow-sm">
                <button onClick={() => setShowOverall(p => !p)}
                  className="w-full flex justify-between items-center hover:bg-teal-50/50 transition-colors px-5 py-4 text-sm font-bold text-teal-800">
                  <span className="flex items-center gap-2"><span className="text-teal-600 text-lg">✨</span> סיכום כללי</span>
                  <span className="text-[11px] font-bold text-teal-600/80 bg-teal-50 px-2.5 py-1 rounded-md">{showOverall ? '▲ הסתר' : '▼ הצג'}</span>
                </button>
                {showOverall && (
                  <div className="p-5 pt-2 bg-white text-[15px] text-slate-700 space-y-3 leading-relaxed">
                    {!summary.oneLineSummary && summary.overallSummary.length === 0 ? (
                      <p className="text-slate-400 italic">אין מספיק תוכן לסיכום כללי.</p>
                    ) : !showExpandedOverall ? (
                      <div className="flex items-start justify-between gap-4">
                        <p className="flex-1 font-medium">{summary.oneLineSummary || summary.overallSummary[0]}</p>
                        {summary.overallSummary.length > 0 && (
                          <button onClick={() => setShowExpandedOverall(true)} className="text-xs font-bold text-teal-600 hover:underline shrink-0 mt-1">הרחב פירוט</button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2 text-slate-600 font-medium animate-fade-in">
                        {summary.overallSummary.map((line, i) => (
                          <p key={i} className="flex gap-2"><span className="text-teal-400">•</span>{line}</p>
                        ))}
                        <button onClick={() => setShowExpandedOverall(false)} className="text-xs font-bold text-teal-600 hover:underline mt-2 block">חזרה לקיצור</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* פירוט */}
              {summary.turns.length === 0 ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center shadow-sm">
                  <p className="text-sm text-slate-400 font-medium">אין עדיין מספיק הודעות ליצירת תקציר מפורט.</p>
                </div>
              ) : (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">נקודות מרכזיות שעלו</h3>
                  <ul className="space-y-3.5">
                    {summary.turns.flatMap((turn, idx) => {
                      const items: React.ReactNode[] = [
                        <li key={`t-${idx}`} className="flex gap-3 text-[15px] font-medium text-slate-800 items-start">
                          <span className="text-teal-500 shrink-0 mt-1 text-[10px]">●</span>
                          <span className="leading-snug">{turn.topic}</span>
                        </li>,
                      ];
                      if (turn.nextPrompt) items.push(
                        <li key={`p-${idx}`} className="flex gap-3 text-sm text-slate-500 pr-2 items-start">
                          <span className="text-slate-300 shrink-0 mt-1 text-[10px]">○</span>
                          <span className="leading-snug">{turn.nextPrompt}</span>
                        </li>
                      );
                      return items;
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
          {!isLoading && !error && summary && activeTab === 'terms' && (
            <div className="space-y-4">
              {summary.newTerms.length === 0 ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center shadow-sm">
                  <p className="text-sm text-slate-400 font-medium">לא זוהו מושגים חדשים בשיחה זו.</p>
                </div>
              ) : (
                summary.newTerms.map((term, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 hover:border-teal-200 hover:shadow-md transition-all">
                    <p className="text-base font-extrabold text-slate-800 mb-1.5">{term.term}</p>
                    <p className="text-sm font-medium text-slate-600 leading-relaxed">{term.explanation}</p>
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
