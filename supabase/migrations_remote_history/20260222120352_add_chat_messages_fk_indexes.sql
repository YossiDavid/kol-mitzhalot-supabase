
-- Covering indexes for chat_messages foreign keys (chat_messages_reply_fk, chat_messages_sender_id_fkey)
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id
  ON public.chat_messages (sender_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to_message_id
  ON public.chat_messages (reply_to_message_id);
;
