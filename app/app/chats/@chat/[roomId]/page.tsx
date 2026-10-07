import { Suspense } from "react";

import { ChatView } from "@/features/chats/components/chat-view";

type ChatRoomPageProps = {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ compose?: string }>;
};

/** קריאת params/searchParams היא נתוני ריצה, ולכן מחוץ ל-Suspense היא חוסמת את ה-prerender */
async function ChatRoomContent({ params, searchParams }: ChatRoomPageProps) {
  const { roomId } = await params;
  // ?compose=1 - הגיעו מכפתור "צ'אט" (כרטיס/הצעה): הפוקוס על שדה הכתיבה
  const { compose } = await searchParams;
  return <ChatView roomId={roomId} shouldFocusComposer={compose === "1"} />;
}

export default function ChatRoomPage(props: ChatRoomPageProps) {
  return (
    <Suspense fallback={null}>
      <ChatRoomContent {...props} />
    </Suspense>
  );
}
