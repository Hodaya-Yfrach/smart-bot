// =============================================================================
// app/page.tsx — דף הבית הראשי (Client Component)
//
// אחראי על:
//   - מסך התחברות / הרשמה / אורח
//   - ממשק הצ'אט: שליחת הודעות, היסטוריה, עריכת הודעה אחרונה
//   - ניהול כללים (גלובליים + לשיחה), הגדרות BYOK, תקציר שיחה
//
// =============================================================================

"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import ChatMessage from '@/components/ChatMessage';
import SideModal from '@/components/SideModal';
import ChatSummaryPanel from '@/components/sideBar/ChatSummaryPanel';
import Sidebar from '@/components/sideBar/sidBar';
import { ChatMessage as ChatMessageType, GeminiResponse } from '@/types/chat';
import { ChatSummary } from '@/types/chatSummary';
import { ModelInfo } from '@/types/models';
import { askGemini, ChatApiError } from '@/services/gemini';
import { supabase } from '@/services/supabase';
import OnboardingTour, { TOUR_DONE_KEY } from '@/components/OnboardingTour';
import ApiKeyGuide from '@/components/ApiKeyGuide';
import type { TourStep } from '@/components/OnboardingTour';
import { User } from '@supabase/supabase-js';

// ─── טיפוסים מקומיים ─────────────────────────────────────────────────────────
interface RuleRecord { id: string; rule_text: string; }
interface ChatRecord  { id: string; title: string; created_at: string; }
interface DbMessage   { id: string; role: 'user' | 'model'; content: string; image_path?: string | null; image_mime_type?: string | null; }

interface PendingImage {
  base64: string;
  mimeType: string;
  previewUrl: string;
  file: File;
}

const DEFAULT_MODEL_ID = "gemini-3.7-flash";

// ─── שלבי מדריך ההיכרות ────────────────────────────────────────────────────
const TOUR_STEPS: TourStep[] = [
  { targetId: 'tour-model-select',  title: 'בחירת מודל AI',        text: 'בחרי כאן את המודל שתרצי לשוחח איתו — Flash מהיר, Pro חכם יותר, ומודל התמונות יוצר תמונות מטקסט.',       position: 'top' },
  { targetId: 'tour-send-btn',      title: 'שליחת הודעה',          text: 'Enter לשליחה מהירה, Shift+Enter לשורה חדשה.',               position: 'top' },
  { targetId: 'tour-btn-settings',  title: 'הגדרות',               text: 'כאן מגדירים מפתח API אישי (BYOK) ומודל ברירת מחדל. המפתח נשמר מאובטח בחשבון.',                       position: 'bottom' },
  { targetId: 'tour-btn-rules',     title: 'כללים וזיכרון',        text: 'הגדירי כללים קבועים לכל השיחות ("תמיד תענה בקצרה") או כללים ספציפיים לשיחה הנוכחית.',               position: 'bottom' },
  { targetId: 'tour-btn-consult',   title: 'חלון התייעצות',        text: 'פאנל צדדי שמאפשר לשאול שאלות על השיחה הראשית מבלי להפריע לה — שימושי לניתוח ולהבהרות.',            position: 'bottom' },
  { targetId: 'tour-btn-summary',   title: 'תקציר שיחה',           text: 'לאחר שיחה — לחצי כאן לקבלת תקציר חכם עם נקודות מרכזיות ומושגים חדשים. נשמר ב-DB אוטומטית.',        position: 'bottom' },
  { targetId: 'tour-study-mode',    title: 'מצב לימודים',           text: 'הפעילי את המתג כדי להפוך את השיחה לתרגול. “רק מתשובת AI” שואל רק על מה שה-AI כתב בתשובה הנוכחית. “לפי הנושא שלי” שואל לפי שאלתך ויכול להוסיף ידע כללי, אבל רק אם הוא קשור ישירות לנושא שביקשת. המצב זמני לשיחה הנוכחית בלבד.', position: 'top' },
  { targetId: 'tour-sidebar',       title: 'היסטוריית שיחות',      text: 'כאן מוצגות כל השיחות הקודמות שלך. ניתן ללחוץ לפתיחה, לערוך כותרת, או למחוק.',                       position: 'right' },
];

const getModelDisplayName = (models: ModelInfo[], name: string): string => {
  const baseName = name.replace(' (גיבוי)', '');
  const found = models.find(m => m.id === baseName);
  const displayName = found?.displayName || baseName;
  return name.includes(' (גיבוי)') ? `${displayName} (גיבוי)` : displayName;
};

// DEV NOTE: החלף למייל שלך
const SUPPORT_EMAIL = '8564417@gmail.com';

// תרגום שגיאות Supabase לעברית
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
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const [studyScores, setStudyScores] = useState<number[]>([]);
  const [studyQuestionMode, setStudyQuestionMode] = useState<'ai' | 'user'>('ai');

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

  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);
  const [disabledModels, setDisabledModels] = useState<string[]>([]);

  // 5. ניהול מפתח API נעילה/עריכה ב-DB
  const [userApiKey, setUserApiKey] = useState('');
  const [isApiKeyLocked, setIsApiKeyLocked] = useState(false);
  const [currentModelName, setCurrentModelName] = useState(DEFAULT_MODEL_ID);

  // 7. מדריך היכרות
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isApiGuideOpen, setIsApiGuideOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);


  const guestLimitReached = isGuest && mainMessages.some(msg => msg.role === 'user');

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) return;
    const previewUrl = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPendingImage({ base64: dataUrl.split(',')[1], mimeType: file.type, previewUrl, file });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  // פונקציית עזר לבניית הוראות המערכת המאוחדות
  const getCombinedSystemInstructions = () => {
    const currentDate = new Date().toLocaleDateString('he-IL');
    let combined = `התאריך היום הוא ${currentDate}.
הנחיות תשובה קבועות:
- הצג מידע ברור, מדויק ומסודר, והפרד בין עובדות, הסבר ודוגמה כשזה עוזר להבנה.
- השתמש בכותרות קצרות, רשימות או סמלים רק כאשר הם משפרים את ההבנה.
- אל תשתמש בסימני # או * או בסמלים דקורטיביים מיותרים. השתמש בהם רק אם המשתמש ביקש אותם או אם הם חלק מהתוכן המבוקש, כגון קוד, מספר טלפון או סימון טכני.
- אם המשתמש ביקש מכתב, קוד או טקסט להעתקה, הצג אותו נקי ומוכן להעתקה.
`;
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

  // פתיחת tour אוטומטית בפעם הראשונה (אחרי שהמשתמש מחובר/אורח)
  useEffect(() => {
    if ((user || isGuest) && !localStorage.getItem(TOUR_DONE_KEY)) {
      // ממתינים frame אחד כדי שה-DOM יהיה מוכן
      setTimeout(() => setIsTourOpen(true), 400);
    }
  }, [user, isGuest]);

  // טעינת רשימת המודלים מה-API
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch('/api/models');
        if (!res.ok) throw new Error('Failed to fetch models');
        const data = await res.json();
        const models: ModelInfo[] = data.models ?? [];
        setAvailableModels(models);
        // אם המודל שנבחר לא קיים ברשימה, נאפס לברירת מחדל
        if (models.length > 0 && !models.find(m => m.id === selectedModel)) {
          setSelectedModel(models[0].id);
          setCurrentModelName(models[0].id);
        }
      } catch (err) {
        console.error('שגיאה בטעינת מודלים:', err);
      } finally {
        setModelsLoading(false);
      }
    };
    fetchModels();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const { data } = await supabase
      .from('messages')
      .select('id, role, content, image_path, image_mime_type')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    if (data) {
      const messages = await Promise.all((data as DbMessage[]).map(async (msg) => {
        let imageUrl: string | undefined;
        if (msg.image_path) {
          const { data: signed } = await supabase.storage.from('chat-images').createSignedUrl(msg.image_path, 60 * 60);
          imageUrl = signed?.signedUrl;
        }
        return {
          id: msg.id,
          role: msg.role,
          parts: [{ ...(imageUrl ? { imageUrl } : {}), text: msg.content }],
        } as ChatMessageType;
      }));
      setMainMessages(messages);
      setCurrentModelName(selectedModel);
    }
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
    const { data: imageMessages } = await supabase.from('messages').select('image_path').eq('chat_id', chatId).not('image_path', 'is', null);
    const { error } = await supabase.from('chats').delete().eq('id', chatId);
    // CASCADE ב-DB מוחק messages + chat_summaries אוטומטית
    if (!error) {
      const imagePaths = (imageMessages ?? []).map((message) => message.image_path).filter((path): path is string => Boolean(path));
      if (imagePaths.length > 0) await supabase.storage.from('chat-images').remove(imagePaths);
      setChatHistory(prev => prev.filter(c => c.id !== chatId));
      if (currentChatId === chatId) startNewChat();
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
    setCurrentModelName(availableModels[0]?.id ?? DEFAULT_MODEL_ID);
    setStudyMode(false);
    setStudyScores([]);
    setStudyQuestionMode('ai');
  };

  const startNewChat = () => {
    setMainMessages([]);
    setCurrentChatId(null);
    setChatRules([]);
    setCurrentModelName(selectedModel);
    setIsSummaryOpen(false);
    setEditingMessageId(null);
    setStudyMode(false);
    setStudyScores([]);
    setStudyQuestionMode('ai');
  };

  const editLastPrompt = async (message: ChatMessageType) => {
    if (message.role !== 'user' || !message.id || !currentChatId) return;
    const messageIndex = mainMessages.findIndex((item) => item.id === message.id);
    if (messageIndex < 0) return;

    const idsToRemove = mainMessages.slice(messageIndex).map((item) => item.id).filter(Boolean) as string[];
    const { error } = await supabase.from('messages').delete().in('id', idsToRemove);
    if (error) { alert('לא ניתן לערוך את ההודעה כרגע.'); return; }

    setMainMessages(mainMessages.slice(0, messageIndex));
    setInput(message.parts.find(p => p.text !== undefined)?.text ?? '');
    setEditingMessageId(message.id);
    // מוחקים תקציר ישן כי השיחה השתנתה
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
    try {
      const response = await fetch('/api/guest', { method: 'POST', credentials: 'include' });
      const data = await response.json().catch(() => null);
      if (response.ok) {
        setIsGuest(true);
        return;
      }
      alert(data?.error || 'לא ניתן להפעיל מצב אורח כרגע. נסו שוב מאוחר יותר.');
    } catch {
      alert('לא ניתן להפעיל מצב אורח כרגע. נסו שוב מאוחר יותר.');
    }
  };

  // --- Chat ---
  const handleMainSend = async () => {
    if (guestLimitReached) {
      alert("אורחים יכולים לשאול רק שאלה אחת. כדי להמשיך, אנא התחברו או צרו פרופיל חדש 💙");
      return;
    }

    if (!input.trim()) return;
    if (isWaiting) return;
    if (!userApiKey.trim()) {
      setIsApiGuideOpen(true);
    }

    const userText = input;
    const imageSnapshot = pendingImage;

    const userMessage: ChatMessageType = {
      role: 'user',
      parts: [
        ...(imageSnapshot ? [{ imageUrl: imageSnapshot.previewUrl, inlineData: { mimeType: imageSnapshot.mimeType, data: imageSnapshot.base64 } }] : []),
        { text: userText },
      ],
    };

    setMainMessages(prev => [...prev, userMessage]);
    setInput('');
    setPendingImage(null);
    setIsWaiting(true);
    setCountdown(15);

    try {
      let activeChatId = currentChatId;
      if (user) {
        activeChatId = await ensureChatExists(userText);
        if (activeChatId) {
          let imagePath: string | null = null;
          if (imageSnapshot) {
            const extension = imageSnapshot.file.name.split('.').pop()?.toLowerCase() || 'jpg';
            imagePath = `${user.id}/${activeChatId}/${crypto.randomUUID()}.${extension}`;
            const { error: uploadError } = await supabase.storage
              .from('chat-images')
              .upload(imagePath, imageSnapshot.file, { contentType: imageSnapshot.mimeType, upsert: false });
            if (uploadError) throw new Error('לא הצלחנו לשמור את התמונה. נסו שוב.');
          }
          const { data: savedUserMessage } = await supabase
            .from('messages')
            .insert([{ chat_id: activeChatId, role: 'user', content: userText, image_path: imagePath, image_mime_type: imageSnapshot?.mimeType ?? null }])
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
      const fallbackModels = availableModels
        .map(m => m.id)
        .filter(m => m !== selectedModel && !disabledModels.includes(m));

      const response: GeminiResponse = await askGemini(
        userText,
        mainMessages,
        combinedSystemInstructions,
        selectedModel,
        fallbackModels,
        userApiKey,
        isGuest,
        imageSnapshot?.base64,
        imageSnapshot?.mimeType,
        studyMode,
        studyQuestionMode,
      );

      // בניית חלקי התשובה הטקסטואליים
      const modelParts: ChatMessageType['parts'] = [];
      if (response.text?.trim()) modelParts.push({ text: response.text });

      const modelMessage: ChatMessageType = {
        role: 'model',
        parts: modelParts.length > 0 ? modelParts : [{ text: response.text }],
        studyScore: studyMode ? response.studyScore : undefined,
      };
      setMainMessages(prev => [...prev, modelMessage]);
      setEditingMessageId(null);
      if (studyMode && typeof response.studyScore === 'number') {
        setStudyScores(prev => [...prev, response.studyScore as number]);
      }

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
        setToastMessage(`עקב עומס, הועברת אוטומטית למודל ${getModelDisplayName(availableModels, response.modelUsed)}`);
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
      <div dir="rtl" className="flex h-[100dvh] items-center justify-center px-4 bg-gradient-to-br from-slate-50 via-violet-50/40 to-blue-50/40">

        <div className="w-full max-w-sm">
          {/* לוגו + כותרת */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-3xl shadow-lg shadow-violet-200 rotate-3"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
              🤖
            </div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              {isLoginMode ? 'ברוכים השבים' : 'הצטרפות'}
            </h1>
            <p className="text-sm text-slate-400 mt-1">AI Workspace · Gemini</p>
          </div>

          {/* כרטיס */}
          <div className="bg-white rounded-3xl shadow-xl shadow-violet-100/50 border border-slate-100 p-8">
            <div className="space-y-3">
              {!isLoginMode && (
                <>
                  <input type="text" placeholder="שם מלא"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-right focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400 focus:bg-white transition-all"
                    value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  <input type="tel" placeholder="טלפון"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-right focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400 focus:bg-white transition-all"
                    value={phone} onChange={(e) => setPhone(e.target.value)} />
                </>
              )}
              <input type="email" placeholder="אימייל"
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-right focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400 focus:bg-white transition-all"
                value={email} onChange={(e) => setEmail(e.target.value)} />
              <input type="password" placeholder="סיסמה (6+ תווים)"
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-right focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400 focus:bg-white transition-all"
                value={authPassword} onChange={(e) => setAuthPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { isLoginMode ? handleLogin() : handleSignUp(); } }} />
            </div>

            {isLoginMode && (
              <div className="text-left mt-2">
                <a href="/forgot-password" className="text-xs text-violet-500 hover:text-violet-700 transition-colors">שכחת סיסמה?</a>
              </div>
            )}

            <button
              onClick={isLoginMode ? handleLogin : handleSignUp}
              disabled={isLoadingAuth}
              className="w-full mt-6 py-4 rounded-2xl font-bold text-white text-sm transition-all duration-300 disabled:opacity-40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-300/50"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}
            >
              {isLoadingAuth ? '...' : isLoginMode ? 'כניסה לחשבון' : 'יצירת חשבון'}
            </button>

            <div className="text-center mt-4">
              <button onClick={() => setIsLoginMode(!isLoginMode)}
                className="text-xs text-slate-400 hover:text-slate-700 transition-colors">
                {isLoginMode ? 'אין חשבון? הירשמי כאן' : 'יש חשבון? התחברי'}
              </button>
            </div>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-slate-300 text-xs">או</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <button onClick={enterAsGuest}
              className="w-full py-3.5 rounded-2xl font-semibold text-slate-500 border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:text-slate-800 transition-all duration-200 text-sm">
              המשך כאורח — שאלה אחת
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- המסך הראשי ---
  return (
    <div dir="rtl" className="flex h-[100dvh] overflow-hidden text-slate-800 relative font-sans"
      style={{ background: 'linear-gradient(160deg, #f0f4ff 0%, #faf5ff 50%, #eff6ff 100%)' }}>

      {/* תפריט צד (Sidebar) */}
      <div data-tour-id="tour-sidebar">
        <Sidebar
          user={user}
          chatHistory={chatHistory}
          currentChatId={currentChatId}
          onSelectChat={loadSingleChat}
          onStartNewChat={startNewChat}
          onLogout={handleLogout}
          onDeleteChat={handleDeleteChat}
          onUpdateTitle={handleUpdateChatTitle}
          onOpenSummary={() => setIsSummaryOpen(true)}
          mainMessages={mainMessages}
          userApiKey={userApiKey}
        />
      </div>

      {/* אזור התוכן המרכזי */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden bg-white/70 backdrop-blur-sm">

        {/* האדר */}
        <header className="bg-white/80 backdrop-blur-xl text-slate-800 p-4 z-20 flex justify-between items-center border-b border-violet-100/60 shrink-0 shadow-[0_2px_20px_rgba(124,58,237,0.06)] relative">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight"
              style={{ background: 'linear-gradient(90deg, #7c3aed, #2563eb)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              AI Workspace
            </h1>
            {user && <span className="text-[11px] font-medium text-slate-400 tracking-wide">{user.email}</span>}
          </div>
          
          <div className="flex gap-2 flex-wrap justify-end max-w-3xl">
            {/* כפתור תדריך — תמיד גלוי, מאפשר הפעלה מחדש */}
            <button
              onClick={() => { localStorage.removeItem(TOUR_DONE_KEY); setIsTourOpen(true); }}
              className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-xl hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 font-medium transition-all duration-300 flex items-center gap-1.5 text-xs shadow-sm hover:shadow"
              title="הצגת מדריך היכרות"
            >
              <span>🗺️</span> תדריך
            </button>
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
            <button data-tour-id="tour-btn-settings" onClick={() => setIsSettingsModalOpen(true)} className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-xl hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 font-medium transition-all duration-300 flex items-center gap-1.5 text-xs shadow-sm hover:shadow">
              <span>⚙️</span> הגדרות
            </button>
            {user && (
              <button data-tour-id="tour-btn-rules" onClick={() => setIsMemoryModalOpen(true)} className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-xl hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 font-medium transition-all duration-300 flex items-center gap-1.5 text-xs shadow-sm hover:shadow">
                <span>🧠</span> כללים
              </button>
            )}
            <button data-tour-id="tour-btn-consult" onClick={() => setIsSideModalOpen(true)} className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-xl hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 font-medium transition-all duration-300 flex items-center gap-1.5 text-xs shadow-sm hover:shadow">
              <span>💡</span> התייעצות
            </button>
          </div>
        </header>

        {toastMessage && (
          <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
            <div className="bg-gradient-to-r from-violet-700 to-blue-700 text-white px-6 py-3 rounded-full shadow-2xl text-sm font-medium border border-violet-500/30 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-300 animate-pulse"></span>
              {toastMessage}
            </div>
          </div>
        )}

        {/* אזור ההודעות הנגלל - מעבר צבע עדין ברקע */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gradient-to-b from-violet-50/30 via-white/60 to-blue-50/20 relative scroll-smooth">
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
                <div className="relative rounded-2xl rounded-tr-sm p-[2px] overflow-hidden max-w-[80%] shadow-lg shadow-violet-200/50">
                  {/* פס גרדיאנט מונפש סביב הבועה */}
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-blue-500 via-teal-400 to-violet-500 animate-thinking-flow rounded-2xl rounded-tr-sm" />
                  <div className="relative bg-white rounded-[calc(1rem-2px)] rounded-tr-[calc(0.125rem-2px)] px-6 py-4 flex items-center gap-4 text-sm">
                    {/* נקודות קפיצה */}
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-violet-500 dot-1 inline-block" />
                      <span className="w-2 h-2 rounded-full bg-blue-500  dot-2 inline-block" />
                      <span className="w-2 h-2 rounded-full bg-teal-500  dot-3 inline-block" />
                    </div>
                    <span className="font-medium text-slate-600">
                      חושב... {countdown > 0 ? <span className="text-slate-400 text-xs">({countdown}ש׳)</span> : null}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* סרגל הקלדה */}
        <div className="bg-white/90 backdrop-blur-lg border-t border-slate-200 p-4 shrink-0 flex flex-col items-center shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-20 relative">
          
          <div className="w-full max-w-3xl flex items-end gap-3 mb-3 relative">
            {pendingImage && (
              <div className="absolute bottom-full right-0 mb-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pendingImage.previewUrl} alt="תמונה שנבחרה" className="h-12 w-12 rounded-lg object-cover" />
                <button onClick={() => { URL.revokeObjectURL(pendingImage.previewUrl); setPendingImage(null); }} className="text-xs font-bold text-slate-400 hover:text-red-500" aria-label="הסרת תמונה">✕</button>
              </div>
            )}
            <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleImageSelect} />
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={isWaiting || guestLimitReached}
              title="העלאת תמונה לניתוח ב-Gemini"
              aria-label="העלאת תמונה לניתוח ב-Gemini"
              className="h-[56px] w-[56px] shrink-0 rounded-2xl border border-slate-200 bg-slate-50 text-xl text-slate-500 transition-all hover:border-teal-300 hover:bg-teal-50 hover:text-teal-600 disabled:opacity-40"
            >
              🖼️
            </button>
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
              placeholder={
                guestLimitReached ? "הגעת למגבלת השאלות לאורח 🔒"
                : "מה נרצה לדעת היום?..."
              }
              disabled={isWaiting || guestLimitReached}
            />
            <button
              onClick={handleMainSend}
              disabled={isWaiting || guestLimitReached || !input.trim()}
              data-tour-id="tour-send-btn"
              className="h-[56px] bg-slate-800 text-white px-8 rounded-2xl hover:bg-slate-700 hover:shadow-lg hover:-translate-y-0.5 font-bold transition-all duration-300 shadow-md disabled:bg-slate-300 disabled:text-slate-500 disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2 group"
            >
              <span>שלח</span>
              <span className="group-hover:translate-x-1 transition-transform rtl:group-hover:-translate-x-1">←</span>
            </button>
          </div>
          
          <div className="w-full max-w-3xl flex items-center justify-between gap-3 text-[11px] text-slate-500 px-2">
            <label className="flex items-center gap-2 rounded-xl border border-teal-100 bg-teal-50/60 px-2.5 py-1.5 font-bold text-teal-800" data-tour-id="tour-study-mode">
              <span>🎓 מצב לימודים</span>
              <input type="checkbox" checked={studyMode} onChange={(event) => setStudyMode(event.target.checked)} className="h-4 w-4 accent-teal-600" />
            </label>
            {studyMode && (
              <div className="flex items-center gap-1 rounded-xl border border-teal-100 bg-white p-1 text-[10px] font-bold text-teal-800">
                <button
                  onClick={() => setStudyQuestionMode('ai')}
                  className={`rounded-lg px-2 py-1 transition-colors ${studyQuestionMode === 'ai' ? 'bg-teal-600 text-white' : 'hover:bg-teal-50'}`}
                  title="השאלה תהיה רק על תוכן תשובת ה-AI הנוכחית"
                >
                  רק מתשובת AI
                </button>
                <button
                  onClick={() => setStudyQuestionMode('user')}
                  className={`rounded-lg px-2 py-1 transition-colors ${studyQuestionMode === 'user' ? 'bg-teal-600 text-white' : 'hover:bg-teal-50'}`}
                  title="השאלה תהיה לפי שאלת המשתמש והנושא שביקש, עם ידע כללי קשור בלבד"
                >
                  לפי הנושא שלי
                </button>
              </div>
            )}
            {studyMode && studyScores.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50 to-blue-50 px-2.5 py-1.5 font-bold text-teal-800 shadow-sm">
                <span>📊 דיוק: {Math.round(studyScores.reduce((sum, score) => sum + score, 0) / studyScores.length)}%</span>
                <span className="text-[10px] font-medium text-blue-700">({studyScores.length} שאלות)</span>
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer group">
              <span className="font-medium group-hover:text-slate-700 transition-colors">מודל פעיל:</span>
              <select
                className="w-60 border border-slate-200 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 focus:ring-2 focus:ring-teal-500/30 outline-none transition-all cursor-pointer hover:bg-slate-100"
                data-tour-id="tour-model-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={modelsLoading}
              >
                {modelsLoading ? (
                  <option>טוען מודלים...</option>
                ) : (
                  availableModels.map(model => (
                    <option key={model.id} value={model.id} disabled={disabledModels.includes(model.id)}>
                      {model.displayName} {disabledModels.includes(model.id) ? '(עמוס)' : ''}
                    </option>
                  ))
                )}
              </select>
            </label>
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline">Enter לשליחה · Shift+Enter לשורה חדשה</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isGuest && guestLimitReached ? 'bg-red-400' : 'bg-green-400'}`}></div>
                <span className="font-medium">
                  {isGuest ? (guestLimitReached ? "נגמרו שאלות האורח" : "אורח: 1/1 שאלות") : getModelDisplayName(availableModels, currentModelName)}
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
        <ApiKeyGuide
          isOpen={isApiGuideOpen}
          onClose={() => setIsApiGuideOpen(false)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
        />
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
                    disabled={modelsLoading}
                  >
                    {modelsLoading ? (
                      <option>טוען מודלים...</option>
                    ) : (
                      availableModels.map(model => (
                        <option key={model.id} value={model.id} disabled={disabledModels.includes(model.id)}>
                          {model.displayName} {disabledModels.includes(model.id) ? '(עמוס כרגע - יתפנה בקרוב)' : ''}
                        </option>
                      ))
                    )}
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
                  <button
                    onClick={() => setIsApiGuideOpen(true)}
                    className="mt-3 text-xs font-bold text-teal-700 hover:text-teal-800 hover:underline"
                  >
                    איך משיגים מפתח מ־Google AI Studio?
                  </button>
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
      {/* מדריך היכרות */}
      {isTourOpen && (
        <OnboardingTour
          steps={TOUR_STEPS}
          onDone={() => setIsTourOpen(false)}
        />
      )}
    </div>
  );
}