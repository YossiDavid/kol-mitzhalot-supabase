import { createClient } from "@/lib/supabase/server";
import { unstable_noStore as noStore } from "next/cache";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  noStore();
  const { roomId } = await params;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("room_id", roomId);

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  const messages = data;

  return (
    <div>
      <h1>ChatPage</h1>
      <div>
        {messages.map((message) => (
          <div key={message.id}>{message.content}</div>
        ))}
      </div>
    </div>
  );
}
