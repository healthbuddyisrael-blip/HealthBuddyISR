export const AUTH_MESSAGES = {
  invitation: "ההזמנה אינה תקפה או שפג תוקפה.",
  membership: "לא נמצאה הרשאה מתאימה לחשבון הזה.",
  credentials: "האימייל או הסיסמה אינם נכונים.",
  oauth: "הכניסה עם Google לא הושלמה. אפשר לנסות שוב.",
  mismatch: "חשבון Google שנבחר אינו תואם לכתובת שאליה נשלחה ההזמנה.",
  existing:
    "כבר קיים חשבון עם כתובת האימייל הזו. יש להתחבר כדי להשלים את ההזמנה.",
  recovery: "הקישור לאיפוס הסיסמה אינו תקף או שפג תוקפו.",
  unavailable: "לא ניתן להשלים את הפעולה כרגע. אפשר לנסות שוב.",
} as const;

export function publicAuthMessage(code: string | undefined) {
  return code && Object.hasOwn(AUTH_MESSAGES, code)
    ? AUTH_MESSAGES[code as keyof typeof AUTH_MESSAGES]
    : undefined;
}
