/**
 * כתובות השרתים של נדרים פלוס (הרשימה הציבורית: matara.pro/nedarimplus/webhook-ips.txt).
 * הרשימה עשויה להשתנות ללא הודעה, ולכן זו שכבה משלימה בלבד: כתובת לא מוכרת עם חתימה
 * תקינה מתקבלת ונרשמת כאזהרה. החתימה היא ההוכחה הקריפטוגרפית.
 */
export const NEDARIM_WEBHOOK_IPS: ReadonlySet<string> = new Set([
  "18.196.146.117",
  "18.194.219.73",
]);

export const isKnownNedarimIp = (ip: string) => NEDARIM_WEBHOOK_IPS.has(ip);
