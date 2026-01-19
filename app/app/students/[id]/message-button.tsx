"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageSquare } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import router from "next/router";
import { redirect } from "next/navigation";

export async function getOrCreateDmRoom(otherUserId: string) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_or_create_dm_room", {
    other_user_id: otherUserId,
  });

  if (error) throw error;
  // data is the uuid room_id
  return data as string;
}

export async function sendChatMessage(roomId: string, content: string) {
  const supabase = createClient();

  // you can omit sender_id by fetching auth.uid() first,
  // but easiest is to read it and set it explicitly.
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr) throw userErr;
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("chat_messages").insert({
    room_id: roomId,
    sender_id: user.id,
    content,
  });

  if (error) throw error;
}

export async function messageCardAuthor(params: {
  authorId: string;
  content: string;
}) {
  const roomId = await getOrCreateDmRoom(params.authorId);
  await sendChatMessage(roomId, params.content);
  return roomId;
}

export default function MessageButton({ authorId }: { authorId: string }) {
  const handleMessageSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const message = formData.get("message") as string;
    const roomId = await messageCardAuthor({
      authorId: authorId,
      content: message,
    });

    console.log(roomId);
    redirect(`/app/chats/${roomId}`);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          onClick={() => {
            console.log("Clicked message button");
          }}
        >
          פניה למנהל הכרטיס
          <MessageSquare />
        </Button>
        {/* <Button variant="outline">Open Dialog</Button> */}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleMessageSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>שליחת פנייה</DialogTitle>
            <DialogDescription>שליחת פנייה למנהל הכרטיס.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="message-1">הודעה</Label>
            <Textarea id="message-1" name="message" placeholder="הודעה" />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">ביטול</Button>
            </DialogClose>
            <Button type="submit">שליחה</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
