import { redirect } from "next/navigation";

export default async function ChatRoomRedirect({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  redirect(`/app/chats?room=${encodeURIComponent(roomId)}`);
}
