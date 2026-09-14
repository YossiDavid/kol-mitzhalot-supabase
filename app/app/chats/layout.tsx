import { ChatsPanes } from "./chats-panes";

// חלון שיחה נטען לכל בקשה מחדש ואין לו shell סטטי בעל ערך: רשימת השיחות
// וההודעות נקראות בזמן ריצה, ורשימת השיחות אף מסמנת את השיחה הפעילה לפי
// הנתיב. לכן הסגמנט נשאר חוסם במקום להיכשל ב-prerender.
export const instant = false;

export default function ChatsLayout({
  children,
  chat,
}: {
  children: React.ReactNode;
  chat: React.ReactNode;
}) {
  return <ChatsPanes chat={chat}>{children}</ChatsPanes>;
}
