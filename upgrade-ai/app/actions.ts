
// =============================================================================
// app/actions.ts
// Server Actions — קוד שרץ אך ורק בשרת (מסומן ב-"use server").
// כרגע: בדיקת סיסמת כניסה לאתר מול משתנה סביבה APP_PASSWORD.
// DEV NOTE: Server Actions בטוחים — הלקוח לעולם לא רואה את הקוד הזה.
// =============================================================================

"use server";

export async function verifySitePassword(passwordInput: string) {
  // השרת יכול לקרוא סודות מקובץ ה-.env ללא בעיה
  const correctPassword = process.env.APP_PASSWORD;
  
  // השרת בודק אם מה שהמשתמש הקליד תואם לסיסמה הסודית
  return passwordInput === correctPassword;
}
