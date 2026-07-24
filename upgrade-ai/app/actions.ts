
"use server"; // מילת הקסם שאומרת: הקוד הזה רץ אך ורק בשרת המאובטח!

export async function verifySitePassword(passwordInput: string) {
  // השרת יכול לקרוא סודות מקובץ ה-.env ללא בעיה
  const correctPassword = process.env.APP_PASSWORD;
  
  // השרת בודק אם מה שהמשתמש הקליד תואם לסיסמה הסודית
  return passwordInput === correctPassword;
}
