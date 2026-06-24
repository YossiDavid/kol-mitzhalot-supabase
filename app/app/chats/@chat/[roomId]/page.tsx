import { ChatView } from "@/features/chats/components/chat-view";

export default async function ChatRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return <ChatView roomId={roomId} />;
}
