export type Room = {
  room_id: string;
  title: string;
  lastMessage: string | null;
  lastAt: string | null;
  other_user_id: string;
  other_user_name: string;
};

export type Message = {
  message_id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  reply_to_message_id: string | null;
};
