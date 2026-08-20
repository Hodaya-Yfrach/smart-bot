"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import ChatMessage from '@/components/ChatMessage';
import SideModal from '@/components/SideModal';
import ChatSummaryPanel from '@/components/sideBar/ChatSummaryPanel';
import Sidebar from '@/components/sideBar/sidBar';
import { ChatMessage as ChatMessageType, GeminiResponse } from '@/types/chat';
import { ChatSummary } from '@/types/chatSummary';
import { askGemini, ChatApiError } from '@/services/gemini';
import { supabase } from '@/services/supabase';
import { User } from '@supabase/supabase-js';

// --- הגדרות טיפוסים מקומיות למניעת שגיאות TS ---
interface RuleRecord {
  id: string;
  rule_text: string;
}

interface ChatRecord {
  id: string;
  title: string;
  created_at: string;
}

interface DbMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
}

const AVAILABLE_MODELS = [
  "gemini-3.7-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
  "gemini-3.1-flash-image",
  "gemini-3.1-flash-tts-preview",
  "gemini-3.1-flash-live-preview"
];

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "gemini-3.7-flash": "Flash — מהיר ומאוזן",
  "gemini-2.5-pro": "Pro — חשיבה עמוקה",
  "gemini-2.5-flash-lite": "Flash Lite — הכי זול",
  "gemini-3.1-flash-image": "יצירת תמונות",
  "gemini-3.1-flash-tts-preview": "קול — טקסט לדיבור",
  "gemini-3.1-flash-live-preview": "שיחה קולית חיה"
};

const getModelDisplayName = (name: string) => {
  const baseName = name.replace(' (גיבוי)', '');
  const displayName = MODEL_DISPLAY_NAMES[baseName] || baseName;
  return name.includes(' (גיבוי)') ? `${displayName} (גיבוי)` : displayName;
};

// כתובת המייל שאליה כפתור "תמיכה" יפנה - **חשוב: תחליפי כאן למייל שלך בפועל**
const SUPPORT_EMAIL = '8564417@gmail.com';

// פונקציית עזר לתרגום שגיאות Supabase לעברית מובנת
const getHebrewAuthError = (errorMsg: string) => {
  const msg = errorMsg.toLowerCase();

  if (msg.includes('user already registered')) {
    return "כתובת האימייל הזו כבר רשומה במערכת. אנא לחצו על 'התחברות פרופיל קיים'.";
  }
  if (msg.includes('invalid login credentials')) {
    return "כתובת האימייל או הסיסמה שהזנתם שגויים. אנא נסו שוב.";
  }
  if (msg.includes('email not confirmed')) {
    return "טרם אימתם את כתובת האימייל. אנא בדקו את תיבת הדואר הנכנס שלכם (או הספאם).";
  }
  if (msg.includes('password should be at least 6 characters')) {
    return "הסיסמה חלשה מדי. היא חייבת להכיל לפחות 6 תווים.";
  }
  if (msg.includes('valid email')) {
    return "אנא הזינו כתובת אימייל תקינה.";
  }

  return "אירעה שגיאה בתקשורת. אנא ודאו שכל הפרטים נכונים ונסו שוב.";
};

export default function Home() {
  // 1. משתמשים
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true); // מעבר בין התחברות להרשמה
  const [fullName, setFullName] = useState(''); // שם
  const [phone, setPhone] = useState('');       // טלפון
  const [email, setEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);

  // 2. צ'אט והיסטוריה
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [mainMessages, setMainMessages] = useState<ChatMessageType[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatRecord[]>([]);
  const [input, setInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [savedSummary, setSavedSummary] = useState<ChatSummary | null>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  // 3. מודלים (Modals) וזיכרון
  const [isSideModalOpen, setIsSideModalOpen] = useState(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportCopied, setSupportCopied] = useState(false);

  const [globalRules, setGlobalRules] = useState<RuleRecord[]>([]);
  const [chatRules, setChatRules] = useState<RuleRecord[]>([]);
  const [newGlobalRule, setNewGlobalRule] = useState('');
  const [newChatRule, setNewChatRule] = useState('');

  // 4. מצבי AI וחיבור (BYOK + Fallback)
  const [isWaiting, setIsWaiting] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0]);
  const [disabledModels, setDisabledModels] = useState<string[]>([]);

  // 5. ניהול מפתח API נעילה/עריכה ב-DB
  const [userApiKey, setUserApiKey] = useState('');
  const [isApiKeyLocked, setIsApiKeyLocked] = useState(false);
  const [currentModelName, setCurrentModelName] = useState(AVAILABLE_MODELS[0]);

  const guestLimitReached = isGuest && mainMessages.some(msg => msg.role === 'user');

  // פונקציית עזר לבניית הוראות המערכת המאוחדות
  const getCombinedSystemInstructions = () => {
    const currentDate = new Date().toLocaleDateString('he-IL');
    let combined = `התאריך היום הוא ${currentDate}.\n`;
    if (globalRules.length > 0) {
      combined += "הוראות קבועות למערכת (חובה תמיד לציית):\n" + globalRules.map(r => "- " + r.rule_text).join("\n") + "\n\n";
    }
    if (chatRules.length > 0) {
      combined += "הוראות לשיחה הנוכחית בלבד:\n" + chatRules.map(r => "- " + r.rule_text).join("\n");
    }
    return combined;
  };

  // --- Effects ---
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setUser(session.user);
    };
    checkUser();
  }, []);

  // טעינת כל נתוני המשתמש מה-DB כשהוא מתחבר (כולל מפתח ומודל מועדף)
  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        // משיכת ההגדרות מהפרופיל
        const { data: profile } = await supabase
          .from('profiles')
          .select('api_key, preferred_model')
          .eq('id', user.id)
          .single();

        if (profile) {
          if (profile.api_key) {
            setUserApiKey(profile.api_key);
            setIsApiKeyLocked(true); // נועל אוטומטית אם יש מפתח
          }
          if (profile.preferred_model) {
            setSelectedModel(profile.preferred_model);
            setCurrentModelName(profile.preferred_model);
          }
        }

        loadChatHistory();
        loadRules();
      } else {
        setChatHistory([]);
        setGlobalRules([]);
        setUserApiKey('');
        setIsApiKeyLocked(false);
      }
    };

    fetchUserData();
  }, [user]);

  useEffect(() => {
    if (currentChatId) {
      loadRules();
    } else {
      setChatRules([]);
    }
  }, [currentChatId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isWaiting && countdown > 0) {
      interval = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isWaiting, countdown]);

  // --- פונקציות זיכרון וכללים ---
  const loadRules = async () => {
    if (!user) return;
    const { data: gRules } = await supabase.from('global_rules').select('id, rule_text').eq('user_id', user.id);
    if (gRules) setGlobalRules(gRules as RuleRecord[]);

    if (currentChatId) {
      const { data: cRules } = await supabase.from('chat_rules').select('id, rule_text').eq('chat_id', currentChatId);
      if (cRules) setChatRules(cRules as RuleRecord[]);
    }
  };

  const addGlobalRule = async () => {
    if (!newGlobalRule.trim() || !user) return;
    const { data, error } = await supabase.from('global_rules').insert([{ user_id: user.id, rule_text: newGlobalRule }]).select('id, rule_text');
    if (!error && data) {
      setGlobalRules([...globalRules, data[0] as RuleRecord]);
      setNewGlobalRule('');
    }
  };

  const deleteGlobalRule = async (id: string) => {
    await supabase.from('global_rules').delete().eq('id', id);
    setGlobalRules(globalRules.filter(r => r.id !== id));
  };

  const addChatRule = async () => {
    if (!newChatRule.trim() || !currentChatId) return alert("יש להתחיל שיחה כדי להוסיף לה כלל");
    const { data, error } = await supabase.from('chat_rules').insert([{ chat_id: currentChatId, rule_text: newChatRule }]).select('id, rule_text');
    if (!error && data) {
      setChatRules([...chatRules, data[0] as RuleRecord]);
      setNewChatRule('');
    }
  };

  const deleteChatRule = async (id: string) => {
    await supabase.from('chat_rules').delete().eq('id', id);
    setChatRules(chatRules.filter(r => r.id !== id));
  };

  // --- פונקציות היסטוריה ומסד נתונים ---
  const loadChatHistory = async () => {
    if (!user) return;
    const { data } = await supabase.from('chats').select('id, title, created_at').eq('user_id', user.id).order('created_at', { ascending: false });
    if (data) setChatHistory(data as ChatRecord[]);
  };

  const loadSingleChat = async (chatId: string) => {
    setCurrentChatId(chatId);
    setSavedSummary(null); // מאפסים מיד - מונע הצגה רגעית של תקציר שיחה שגוי
    const [{ data }, { data: summaryData }] = await Promise.all([
      supabase.from('messages').select('id, role, content').eq('chat_id', chatId).order('created_at', { ascending: true }),
      supabase.from('chat_summaries').select('summary').eq('chat_id', chatId).maybeSingle(),
    ]);
    if (data) {
      const formattedMessages: ChatMessageType[] = (data as DbMessage[]).map((msg) => ({
        id: msg.id,
        role: msg.role,
        parts: [{ text: msg.content }]
      }));
      setMainMessages(formattedMessages);
      setCurrentModelName(selectedModel);
    }
    setSavedSummary((summaryData?.summary as ChatSummary | undefined) || null);
  };

  const ensureChatExists = async (firstMessageText: string) => {
    if (currentChatId) return currentChatId;
    if (!user) return null;

    const { data: chats } = await supabase.from('chats').select('id').eq('user_id', user.id).order('created_at', { ascending: true });
    if (chats && chats.length >= 10) {
      await supabase.from('chats').delete().eq('id', chats[0].id);
    }

    const title = firstMessageText.substring(0, 25) + "...";
    const { data: newChat, error } = await supabase.from('chats').insert([{ user_id: user.id, title }]).select('id').single();
    if (error || !newChat) return null;

    setCurrentChatId(newChat.id);
    await loadChatHistory();
    return newChat.id;
  };

  const handleDeleteChat = async (chatId: string) => {
    const { error } = await supabase.from('chats').delete().eq('id', chatId);
    if (!error) {
      setChatHistory(prev => prev.filter(c => c.id !== chatId));
      if (currentChatId === chatId) {
        startNewChat();
      }
    } else {
      alert("שגיאה במחיקת השיחה");
    }
  };

  const handleUpdateChatTitle = async (chatId: string, newTitle: string) => {
    const { error } = await supabase.from('chats').update({ title: newTitle }).eq('id', chatId);
    if (!error) {
      setChatHistory(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle } : c));
    } else {
      alert("שגיאה בעדכון כותרת השיחה");
    }
  };

  // --- Authentication ---
  const handleLogin = async () => {
    if (!email || !authPassword) {
      alert("אנא מלאו אימייל וסיסמה.");
      return;
    }

    setIsLoadingAuth(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: authPassword });

    if (error) {
      alert(getHebrewAuthError(error.message));
    } else {
      setUser(data.user);
    }
    setIsLoadingAuth(false);
  };

  const handleSignUp = async () => {
    if (!fullName || !phone || !email || !authPassword) {
      alert("אנא מלאו את כל השדות להרשמה (שם, טלפון, אימייל וסיסמה).");
      return;
    }

    setIsLoadingAuth(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: authPassword,
      options: {
        data: {
          full_name: fullName,
          phone: phone
        }
      }
    });

    if (error) {
      alert(getHebrewAuthError(error.message));
    } else {
      if (data.user && !data.session) {
        alert("הרשמה בוצעה! נשלח אליכם אימייל לאימות (או שיש לאשר התחברות).");
      } else {
        alert("הרשמה בוצעה בהצלחה! מתחבר כעת...");
        setUser(data.user);
      }
    }
    setIsLoadingAuth(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsGuest(false);
    setMainMessages([]);
    setCurrentChatId(null);
    setCurrentModelName(AVAILABLE_MODELS[0]);
  };

  const startNewChat = () => {
    setMainMessages([]);
    setCurrentChatId(null);
    setChatRules([]);
    setCurrentModelName(selectedModel);
    setSavedSummary(null);
    setIsSummaryOpen(false);
    setEditingMessageId(null);
  };

  const saveSummary = async (summary: ChatSummary) => {
    if (!user || !currentChatId) return;
    const { error } = await supabase.from('chat_summaries').upsert({
      chat_id: currentChatId,
      summary,
      updated_at: new Date().toISOString(),
    });
    if (!error) setSavedSummary(summary);
  };

  const editLastPrompt = async (message: ChatMessageType) => {
    if (message.role !== 'user' || !message.id || !currentChatId) return;
    const messageIndex = mainMessages.findIndex((item) => item.id === message.id);
    if (messageIndex < 0) return;

    const idsToRemove = mainMessages.slice(messageIndex).map((item) => item.id).filter(Boolean) as string[];
    const { error } = await supabase.from('messages').delete().in('id', idsToRemove);
    if (error) {
      alert('לא ניתן לערוך את ההודעה כרגע.');
      return;
    }

    setMainMessages(mainMessages.slice(0, messageIndex));
    setInput(message.parts[0].text);
    setEditingMessageId(message.id);
    setSavedSummary(null);
    await supabase.from('chat_summaries').delete().eq('chat_id', currentChatId);
  };

  const handleCopySupportEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setSupportCopied(true);
      setTimeout(() => setSupportCopied(false), 2500);
    } catch {
      alert('לא הצלחנו להעתיק אוטומטית. אנא סמנו והעתיקו את הכתובת: ' + SUPPORT_EMAIL);
    }
  };

  const handleSaveUserSettings = async () => {
    if (!user) {
      alert("יש להתחבר כדי לשמור הגדרות לחשבון.");
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        api_key: userApiKey.trim(),
        preferred_model: selectedModel
      })
      .eq('id', user.id);

    if (error) {
      alert("אירעה שגיאה בשמירת ההגדרות.");
      console.error(error);
    } else {
      alert("ההגדרות נשמרו בחשבונך בהצלחה!");
      if (userApiKey.trim() !== '') {
        setIsApiKeyLocked(true);
      } else {
        setIsApiKeyLocked(false);
      }
      setIsSettingsModalOpen(false);
    }
  };

  const enterAsGuest = async () => {
    const response = await fetch('/api/guest', { method: 'POST' });
    if (response.ok) {
      setIsGuest(true);
      return;
    }
    alert('לא ניתן להפעיל מצב אורח כרגע. נסו שוב מאוחר יותר.');
  };

  // --- Chat ---
  const handleMainSend = async () => {
    if (guestLimitReached) {
      alert("אורחים יכולים לשאול רק שאלה אחת. כדי להמשיך, אנא התחברו או צרו פרופיל חדש 💙");
      return;
    }

    if (!input.trim() || isWaiting) return;

    const userText = input;
    const userMessage: ChatMessageType = { role: 'user', parts: [{ text: userText }] };

    setMainMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsWaiting(true);
    setCountdown(15);

    try {
      let activeChatId = currentChatId;
      if (user) {
        activeChatId = await ensureChatExists(userText);
        if (activeChatId) {
          const { data: savedUserMessage } = await supabase
            .from('messages')
            .insert([{ chat_id: activeChatId, role: 'user', content: userText }])
            .select('id')
            .single();
          if (savedUserMessage) {
            setMainMessages(prev => prev.map((message, index) =>
              index === prev.length - 1 ? { ...message, id: savedUserMessage.id } : message
            ));
          }
        }
      }

      const combinedSystemInstructions = getCombinedSystemInstructions();
      const fallbackModels = AVAILABLE_MODELS.filter(m => m !== selectedModel && !disabledModels.includes(m));

      const response: GeminiResponse = await askGemini(
        userText,
        mainMessages,
        combinedSystemInstructions,
        selectedModel,
        fallbackModels,
        userApiKey,
        isGuest
      );

      const modelMessage: ChatMessageType = { role: 'model', parts: [{ text: response.text }] };
      setMainMessages(prev => [...prev, modelMessage]);

      if (user && activeChatId) {
        const { data: savedModelMessage } = await supabase
          .from('messages')
          .insert([{ chat_id: activeChatId, role: 'model', content: response.text }])
          .select('id')
          .single();
        if (savedModelMessage) {
          setMainMessages(prev => prev.map((message, index) =>
            index === prev.length - 1 ? { ...message, id: savedModelMessage.id } : message
          ));
        }
      }

      if (response.modelUsed !== selectedModel) {
        setCurrentModelName(`${response.modelUsed} (גיבוי)`);
        setToastMessage(`עקב עומס, הועברת אוטומטית למודל ${getModelDisplayName(response.modelUsed)}`);
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setCurrentModelName(selectedModel);
      }

      if (response.failedModels && response.failedModels.length > 0) {
        setDisabledModels(prev => [...new Set([...prev, ...response.failedModels])]);
        setTimeout(() => {
          setDisabledModels(prev => prev.filter(m => !response.failedModels.includes(m)));
        }, 60000);
      }

    } catch (error: unknown) {
      console.error("שגיאה בצ'אט הראשי:", error);

      if (error instanceof ChatApiError) {
        alert(error.message);
        if (error.failedModels.length > 0) {
          setDisabledModels(prev => [...new Set([...prev, ...error.failedModels])]);
          setTimeout(() => {
            setDisabledModels(prev => prev.filter(m => !error.failedModels.includes(m)));
          }, 60000);
        }
      } else {
        const errMessage = error instanceof Error ? error.message : "הייתה בעיה בתקשורת עם ה-AI.";
        alert(errMessage);
      }
    } finally {
      setIsWaiting(false);
    }
  };

  // --- רינדור מסכים ---

  // --- רינדור מסך התחברות / הרשמה ---
  if (!user && !isGuest) {
    return (
      <div dir="rtl" className="flex h-[100dvh] items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-teal-50 px-4">
        <div className="p-10 bg-white/70 backdrop-blur-xl rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.08)] w-full max-w-sm border border-white/60 relative overflow-hidden">
          {/* רקע דקורטיבי עדין בפנים */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-teal-100/40 rounded-full blur-3xl -z-10"></div>
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-100/40 rounded-full blur-3xl -z-10"></div>

          <div className="w-20 h-20 bg-gradient-to-tr from-slate-800 to-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-6 text-4xl shadow-lg shadow-slate-800/20 text-white transform rotate-3">👤</div>
          <h1 className="text-2xl font-extrabold text-slate-800 mb-8 text-center tracking-tight">
            {isLoginMode ? 'ברוכים השבים' : 'יצירת חשבון'}
          </h1>

          <div className="space-y-4">
            {!isLoginMode && (
              <>
                <input
                  type="text"
                  placeholder="שם מלא (חובה)"
                  className="w-full p-4 bg-white/50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-right transition-all shadow-sm"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <input
                  type="tel"
                  placeholder="מספר טלפון (חובה)"
                  className="w-full p-4 bg-white/50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-right transition-all shadow-sm"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </>
            )}

            <input
              type="email"
              placeholder="אימייל (אישי)"
              className="w-full p-4 bg-white/50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-right transition-all shadow-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="סיסמה (לפחות 6 תווים)"
              className="w-full p-4 bg-white/50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-right transition-all shadow-sm"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  isLoginMode ? handleLogin() : handleSignUp();
                }
              }}
            />
          </div>

          {isLoginMode && (
            <div className="text-left mt-3 mb-6">
              <a href="/forgot-password" className="text-sm text-slate-500 hover:text-teal-600 transition-colors font-medium">שכחת סיסמה?</a>
            </div>
          )}

          <div className="mt-8">
            {isLoginMode ? (
              <button onClick={handleLogin} disabled={isLoadingAuth} className="w-full bg-gradient-to-r from-teal-400 to-emerald-500 text-white py-4 rounded-2xl font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:transform-none shadow-md">
                התחברות לחשבון
              </button>
            ) : (
              <button onClick={handleSignUp} disabled={isLoadingAuth} className="w-full bg-gradient-to-r from-slate-800 to-slate-700 text-white py-4 rounded-2xl font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:transform-none shadow-md">
                יצירת פרופיל חדש
              </button>
            )}
          </div>

          <div className="text-center mt-6">
            <button
              onClick={() => setIsLoginMode(!isLoginMode)}
              className="text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors"
            >
              {isLoginMode ? 'אין לך חשבון? לחץ כאן להרשמה' : 'יש לך כבר חשבון? התחבר כאן'}
            </button>
          </div>

          <div className="relative flex py-5 items-center mt-2 opacity-60">
            <div className="flex-grow border-t border-slate-300"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 text-sm font-medium">או</span>
            <div className="flex-grow border-t border-slate-300"></div>
          </div>
          
          <button onClick={enterAsGuest} className="w-full bg-white border border-slate-200 text-slate-600 py-3.5 rounded-2xl font-bold hover:bg-slate-50 hover:text-slate-800 hover:shadow-sm transition-all duration-300">
            המשך כאורח (ללא היסטוריה)
          </button>
        </div>
      </div>
    );
  }

  // --- המסך הראשי ---
  return (
    <div dir="rtl" className="flex h-[100dvh] overflow-hidden bg-[#F8FAFC] text-slate-800 relative font-sans">

      {/* תפריט צד (Sidebar) */}
      <Sidebar
        user={user}
        chatHistory={chatHistory}
        currentChatId={currentChatId}
        onSelectChat={loadSingleChat}
        onStartNewChat={startNewChat}
        onLogout={handleLogout}
        onDeleteChat={handleDeleteChat}
        onUpdateTitle={handleUpdateChatTitle}
        mainMessages={mainMessages}
        userApiKey={userApiKey}
      />

      {/* אזור התוכן המרכזי */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden bg-white">
        
        {/* האדר עליון עשיר עם חצי שקיפות */}
        <header className="bg-white/80 backdrop-blur-xl text-slate-800 p-4 z-20 flex justify-between items-center border-b border-slate-200/60 shrink-0 shadow-[0_2px_10px_rgba(0,0,0,0.02)] relative">
          <div>
            <h1 className="text-xl font-extrabold bg-gradient-to-r from-slate-800 to-slate-500 bg-clip-text text-transparent">AI Workspace</h1>
            {user && <span className="text-[11px] font-medium text-slate-500 tracking-wide">{user.email}</span>}
          </div>
          
          <div className="flex gap-2 flex-wrap justify-end max-w-3xl">
            <button
              onClick={() => setIsSupportModalOpen(true)}
              className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-xl hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 font-medium transition-all duration-300 flex items-center gap-1.5 text-xs shadow-sm hover:shadow"
              title="לשלוח שאלה, רעיון או דיווח על בעיה"
            >
              <span>✉️</span> תמיכה
            </button>
            <Link
              href="/about"
              className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-xl hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 font-medium transition-all duration-300 flex items-center gap-1.5 text-xs shadow-sm hover:shadow"
              title="על הפיתוח - למה ומה קיים באתר"
            >
              <span>ℹ️</span> אודות
            </Link>
            <button onClick={() => setIsSettingsModalOpen(true)} className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-xl hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 font-medium transition-all duration-300 flex items-center gap-1.5 text-xs shadow-sm hover:shadow">
              <span>⚙️</span> הגדרות
            </button>
            {user && (
              <button onClick={() => setIsMemoryModalOpen(true)} className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-xl hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 font-medium transition-all duration-300 flex items-center gap-1.5 text-xs shadow-sm hover:shadow">
                <span>🧠</span> כללים
              </button>
            )}
            <button onClick={() => setIsSideModalOpen(true)} className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-xl hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 font-medium transition-all duration-300 flex items-center gap-1.5 text-xs shadow-sm hover:shadow">
              <span>💡</span> התייעצות
            </button>
            {user && currentChatId && (
              <button onClick={() => setIsSummaryOpen(true)} className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-xl hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 font-medium transition-all duration-300 flex items-center gap-1.5 text-xs shadow-sm hover:shadow">
                <span>📄</span> תקציר
              </button>
            )}
          </div>
        </header>

        {toastMessage && (
          <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
            <div className="bg-slate-800/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl text-sm font-medium border border-slate-700/50 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
              {toastMessage}
            </div>
          </div>
        )}

        {/* אזור ההודעות הנגלל - מעבר צבע עדין ברקע */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 chat-surface bg-gradient-to-b from-[#F8FAFC] to-white relative scroll-smooth">
          <div className="max-w-3xl mx-auto w-full">
            {mainMessages.length === 0 ? (
              <div className="text-center mt-32 text-slate-400 animate-fade-in">
                <div className="w-20 h-20 bg-white/50 backdrop-blur-sm border border-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-4xl shadow-xl shadow-slate-200/50 transform -rotate-3 hover:rotate-0 transition-all duration-500">👋</div>
                <p className="text-2xl font-bold text-slate-700 mb-2 tracking-tight">איך אפשר לעזור היום?</p>
                <p className="text-sm text-slate-500">בחרו מודל, הקלידו שאלה, ובואו נתחיל.</p>
              </div>
            ) : (
              mainMessages.map((msg, index) => (
                <div className="animate-fade-in-up" style={{ animationDelay: `${Math.min(index * 50, 300)}ms` }} key={msg.id || index}>
                  <ChatMessage
                    message={msg}
                    onEdit={msg.role === 'user' && index === mainMessages.findLastIndex((item) => item.role === 'user') ? () => editLastPrompt(msg) : undefined}
                  />
                </div>
              ))
            )}

            {isWaiting && (
              <div className="flex w-full mb-6 justify-start animate-fade-in">
                <div className="bg-white border border-slate-100 text-slate-600 rounded-2xl rounded-tr-sm p-4 px-6 text-sm shadow-md flex items-center gap-4 max-w-[80%] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 via-indigo-400 to-teal-400 animate-gradient-x"></div>
                  <div className="animate-spin w-5 h-5 border-2 border-slate-200 border-t-teal-500 rounded-full"></div>
                  <span className="font-medium">ממתין לתשובה... {countdown > 0 ? <span className="text-slate-400">({countdown} שניות)</span> : <span className="text-slate-400">(מעבד...)</span>}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* סרגל הקלדה צף ויוקרתי */}
        <div className="bg-white/90 backdrop-blur-lg border-t border-slate-200 p-4 shrink-0 flex flex-col items-center shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-20 relative">
          <div className="w-full max-w-3xl flex items-end gap-3 mb-3 relative">
            <textarea
              rows={1}
              className="flex-1 min-h-[56px] max-h-40 resize-y p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:bg-white focus:ring-4 focus:ring-teal-500/15 focus:border-teal-400 shadow-inner text-base transition-all duration-300 disabled:opacity-50 disabled:bg-slate-100 leading-relaxed"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleMainSend();
                }
              }}
              placeholder={guestLimitReached ? "הגעת למגבלת השאלות לאורח 🔒" : "מה נרצה לדעת או ליצור היום?..."}
              disabled={isWaiting || guestLimitReached}
            />
            <button
              onClick={handleMainSend}
              disabled={isWaiting || guestLimitReached || !input.trim()}
              className="h-[56px] bg-slate-800 text-white px-8 rounded-2xl hover:bg-slate-700 hover:shadow-lg hover:-translate-y-0.5 font-bold transition-all duration-300 shadow-md disabled:bg-slate-300 disabled:text-slate-500 disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2 group"
            >
              <span>שלח</span>
              <span className="group-hover:translate-x-1 transition-transform rtl:group-hover:-translate-x-1">←</span>
            </button>
          </div>
          
          <div className="w-full max-w-3xl flex items-center justify-between gap-3 text-[11px] text-slate-500 px-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <span className="font-medium group-hover:text-slate-700 transition-colors">מודל פעיל:</span>
              <select
                className="max-w-40 border border-slate-200 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 focus:ring-2 focus:ring-teal-500/30 outline-none transition-all cursor-pointer hover:bg-slate-100"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {AVAILABLE_MODELS.map(model => (
                  <option key={model} value={model} disabled={disabledModels.includes(model)}>
                    {MODEL_DISPLAY_NAMES[model] || model} {disabledModels.includes(model) ? '(עמוס)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline">Enter לשליחה · Shift+Enter לשורה חדשה</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isGuest && guestLimitReached ? 'bg-red-400' : 'bg-green-400'}`}></div>
                <span className="font-medium">
                  {isGuest ? (guestLimitReached ? "נגמרו שאלות האורח" : "אורח: 1/1 שאלות") : getModelDisplayName(currentModelName)}
                </span>
              </div>
            </div>
          </div>
          
          {editingMessageId && (
            <div className="w-full max-w-3xl flex justify-between items-center text-xs text-amber-600 bg-amber-50 rounded-lg px-4 py-2 mt-3 border border-amber-100">
              <span className="flex items-center gap-2"><span>✏️</span> עורכים את השאלה האחרונה</span>
              <button onClick={() => { setEditingMessageId(null); setInput(''); }} className="font-bold hover:underline">ביטול עריכה</button>
            </div>
          )}
        </div>

        {/* מודלים קופצים (Modals) */}
        <SideModal
          isOpen={isSideModalOpen}
          onClose={() => setIsSideModalOpen(false)}
          mainContext={mainMessages}
          selectedModel={selectedModel}
          userApiKey={userApiKey}
          systemInstruction={getCombinedSystemInstructions()}
        />

        {user && currentChatId && (
          <ChatSummaryPanel
            key={currentChatId}
            isOpen={isSummaryOpen}
            onClose={() => setIsSummaryOpen(false)}
            chatId={currentChatId}
            chatTitle={chatHistory.find((chat) => chat.id === currentChatId)?.title || 'שיחה'}
            messages={mainMessages}
            userApiKey={userApiKey}
            savedSummary={savedSummary}
            onSaveSummary={saveSummary}
          />
        )}

        {/* חלון תמיכה */}
        {isSupportModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 animate-fade-in border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                <div className="w-12 h-12 bg-teal-50 rounded-2xl flex items-center justify-center text-2xl text-teal-600 mb-2">✉️</div>
                <button onClick={() => setIsSupportModalOpen(false)} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full w-10 h-10 flex items-center justify-center transition-colors">✕</button>
              </div>
              
              <h2 className="text-2xl font-bold text-slate-800 mb-3">דברו איתנו</h2>
              <p className="text-slate-500 mb-6 leading-relaxed">
                יש לך שאלה, רעיון לשדרוג, או נתקלת בבעיה? נשמח לשמוע ממך בכתובת הבאה:
              </p>

              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 shadow-inner">
                <span dir="ltr" className="flex-1 text-[15px] font-bold text-slate-700 truncate tracking-wide">
                  {SUPPORT_EMAIL}
                </span>
                <button
                  onClick={handleCopySupportEmail}
                  className="shrink-0 text-sm bg-white border border-slate-200 hover:border-teal-300 hover:text-teal-700 text-slate-600 px-4 py-2 rounded-xl font-bold transition-all shadow-sm"
                >
                  {supportCopied ? '✓ הועתק' : 'העתק'}
                </button>
              </div>

              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('פנייה מתוך AI Workspace')}&body=${encodeURIComponent('שלום,\n\nיש לי שאלה / רעיון / בעיה בנוגע לאתר:\n')}`}
                className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white py-4 rounded-2xl font-bold hover:bg-slate-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
              >
                פתיחה באפליקציית מייל
              </a>
            </div>
          </div>
        )}

        {/* חלון הגדרות */}
        {isSettingsModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 animate-fade-in border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl text-indigo-600 mb-2">⚙️</div>
                <button onClick={() => setIsSettingsModalOpen(false)} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full w-10 h-10 flex items-center justify-center transition-colors">✕</button>
              </div>
              
              <h2 className="text-2xl font-bold text-slate-800 mb-6">הגדרות אישיות</h2>

              <div className="space-y-6">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <label className="block text-sm font-bold text-slate-700 mb-3">בחירת מודל ברירת מחדל:</label>
                  <select
                    className="w-full border border-slate-200 rounded-xl p-3.5 bg-white focus:ring-2 focus:ring-indigo-500/30 outline-none font-medium text-slate-700 shadow-sm"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                  >
                    {AVAILABLE_MODELS.map(model => (
                      <option key={model} value={model} disabled={disabledModels.includes(model)}>
                        {MODEL_DISPLAY_NAMES[model] || model} {disabledModels.includes(model) ? '(עמוס כרגע - יתפנה בקרוב)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <label className="block text-sm font-bold text-slate-700 mb-3">מפתח API אישי (BYOK):</label>
                  <div className="flex gap-2">
                    <input
                      type={isApiKeyLocked ? "password" : "text"}
                      placeholder="השאר/י ריק כדי להשתמש במפתח האתר"
                      className="flex-1 border border-slate-200 rounded-xl p-3.5 bg-white focus:ring-2 focus:ring-indigo-500/30 outline-none text-left disabled:bg-slate-100 disabled:text-slate-400 transition-all shadow-sm font-mono text-sm"
                      dir="ltr"
                      value={isApiKeyLocked && userApiKey ? '••••••••••••••••••••••••••••' : userApiKey}
                      onChange={(e) => setUserApiKey(e.target.value)}
                      disabled={isApiKeyLocked}
                    />

                    {isApiKeyLocked && (
                      <button
                        onClick={() => setIsApiKeyLocked(false)}
                        className="bg-white border border-slate-200 text-slate-600 px-5 rounded-xl font-bold hover:border-indigo-300 hover:text-indigo-600 transition-colors shadow-sm"
                      >
                        עריכה
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
                    המפתח נשמר בצורה מאובטחת בחשבון שלך וישמש אותך בכל מחשב שממנו תתחברי. מומלץ למשתמשים כבדים.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSaveUserSettings}
                    className="w-full bg-slate-800 text-white py-4 rounded-2xl font-bold hover:bg-slate-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                  >
                    שמירת שינויים
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* חלון כללים (זיכרון) */}
        {isMemoryModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in border border-slate-100">
              <header className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-xl">🧠</div>
                  <h2 className="text-xl font-bold text-slate-800">ניהול זיכרון וכללים</h2>
                </div>
                <button onClick={() => setIsMemoryModalOpen(false)} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full w-10 h-10 flex items-center justify-center transition-colors">✕</button>
              </header>

              <div className="flex-1 overflow-y-auto p-8 space-y-10 scroll-smooth">
                <section>
                  <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                    <h3 className="font-bold text-slate-800 text-lg">כללים תמידיים</h3>
                    <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">לכל השיחות</span>
                  </div>
                  <div className="space-y-3 mb-5">
                    {globalRules.length === 0 ? (
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center">
                        <p className="text-sm text-slate-400 font-medium">אין כללים קבועים עדיין. אפשר לכתוב למשל "תמיד תענה לי בקצרה ולעניין".</p>
                      </div>
                    ) : (
                      globalRules.map(rule => (
                        <div key={rule.id} className="flex justify-between items-start bg-white border border-purple-100 shadow-sm p-4 rounded-2xl text-sm text-slate-700 group hover:border-purple-200 transition-colors">
                          <span className="whitespace-pre-wrap flex-1 font-medium leading-relaxed">{rule.rule_text}</span>
                          <button onClick={() => deleteGlobalRule(rule.id)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 ml-2 bg-slate-50 px-3 py-1.5 rounded-lg font-medium transition-colors text-xs shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100">מחק</button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-3">
                    <textarea
                      value={newGlobalRule} onChange={(e) => setNewGlobalRule(e.target.value)}
                      placeholder="הגדירי כלל שתקף תמיד לכל צ'אט חדש..."
                      className="flex-1 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-purple-500/30 outline-none text-sm resize-none h-14 transition-all"
                    />
                    <button onClick={addGlobalRule} className="bg-slate-800 hover:bg-slate-700 text-white px-6 rounded-2xl text-sm font-bold shadow-sm transition-colors">הוספה</button>
                  </div>
                </section>

                <section>
                  <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                    <h3 className="font-bold text-slate-800 text-lg">כללים מקומיים</h3>
                    <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">לשיחה הנוכחית בלבד</span>
                  </div>
                  
                  {!currentChatId ? (
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 text-center">
                      <p className="text-sm text-amber-700 font-medium">יש להתחיל שיחה חדשה בחלון הראשי כדי להגדיר לה כללים ספציפיים.</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 mb-5">
                        {chatRules.length === 0 ? (
                          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center">
                            <p className="text-sm text-slate-400 font-medium">אין כללים ספציפיים לשיחה זו.</p>
                          </div>
                        ) : (
                          chatRules.map(rule => (
                            <div key={rule.id} className="flex justify-between items-start bg-white border border-emerald-100 shadow-sm p-4 rounded-2xl text-sm text-slate-700 group hover:border-emerald-200 transition-colors">
                              <span className="whitespace-pre-wrap flex-1 font-medium leading-relaxed">{rule.rule_text}</span>
                              <button onClick={() => deleteChatRule(rule.id)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 ml-2 bg-slate-50 px-3 py-1.5 rounded-lg font-medium transition-colors text-xs shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100">מחק</button>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="flex gap-3">
                        <textarea
                          value={newChatRule} onChange={(e) => setNewChatRule(e.target.value)}
                          placeholder="לדוגמה: בשיחה זו תעזור לי לכתוב קוד בפייתון בלבד..."
                          className="flex-1 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500/30 outline-none text-sm resize-none h-14 transition-all"
                        />
                        <button onClick={addChatRule} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 rounded-2xl text-sm font-bold shadow-sm transition-colors">הוספה</button>
                      </div>
                    </>
                  )}
                </section>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}