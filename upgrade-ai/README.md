# smart bot
A branching AI chat with unique capabilities that provide solutions to the limitations of other chat platforms.

## Smart Bot Description
Smart Bot is an advanced AI chat platform that allows users to split conversations according to their needs. The system provides a comprehensive summary for every response, a dedicated concepts window derived from the interaction, and a general summary of the entire conversation.
The site was built using React, Next.js, TypeScript, and Tailwind CSS, featuring clean, high-quality, and well-organized code.
The system utilizes a Supabase database and is hosted on Vercel, incorporating medium-level security features.

### Required server secrets

Set `GUEST_COOKIE_SECRET` to a long random value in every server environment. Guest access uses a signed, HttpOnly, SameSite cookie and is enforced by the chat API. Supabase Auth and database RLS protect registered users; production rate limiting should use a shared store such as Redis when deploying multiple instances.

### Key Features:
- Every user has a private memory area accessible via username and password login. In case of a forgotten password, a reset option is available by sending an email to the user's address.
- Model selection capability: if the chosen model is unavailable, the system automatically switches to the next one. The frontend updates to reflect the change, ensuring no delay in the response.
- Split Conversations: Ability to branch or divide the chat as required.
- Structured Summaries: Includes a summary for each response, a key concepts section, and a full conversation overview.
- Customizable Rules: Option to define specific rules for individual chats or general rules for the entire bot.
- Security: Support for private key integration.
- Memory and Management: Retains a history of the last 10 conversations with options to delete chats or edit titles.
- Includes a detailed software overview page on the frontend and a communication button for inquiries, questions, or ideas.

#### בפיתוח
- אפשרות עריכת פרומפט שכבר נשלח
- לסדר את תקציר ה AI ב DB 
 וכל פעם שהוא רושם שישאר קטקסט ולחשוב איך לגרום לו לא לרנדר מחדש (יש שם באג) יש שם כמה בעיות הוא לא נשמר ב DB 
  הוא כל פעם יוצר את השיחה האחרונה כשפותחים את השיחה והוא מריץ כל פעם מחדש את הסיכום כללי לסדר תא זה
  נקודת קצה כשמוחקים את השיחה גם הפרומפטים שלו אמורים להמחק מה DB
  - תקציר השיחה ארוך מדי 
  לקצר לעד 20 מילים
  צריך שיהיה יותר אמין התקציר AI משתי סיבות
  כי בשיחות ארוכות אם באותו רגע הוא ממציא תקציר לא הועלנו המטרה היא שכל פרומט הוא יוציא תקציר ואז זה יהיה הרבה יותר אמין
  - בעיה נוספת כשעושים אחורה באודות הוא יוצא לגמרי (קשור לראוט )
  אותה בעיה בפרטי משתמש
  - להחליט סופית איזה צבע לשים באתר ירוק או וורוד אם וורוד לזכור להוציא את צבע הכפתור בצאט משני שהוא כרגע ירוק
  - להוציא את הסיסמה מהאתר הוא כבר לא נצרך
  - לעשות שכשלוחצים על קונטרול + אינטר הוא יורד שורה
  - לסדר את הכוכביות והסולמיות המיותרות (בהגדרות של ASSENS להגדיר באופן קשיח על כך)
- לעצב את הכפתורים יותר יפה זה נראה כמו בלוק
