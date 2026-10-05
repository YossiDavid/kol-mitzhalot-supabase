export type RoomContextKind = "general" | "student" | "shidduch";

export type Room = {
  room_id: string;
  /** שם הצד השני — משותף לכל החדרים של אותו אדם */
  title: string;
  lastMessage: string | null;
  /** זמן ההודעה האחרונה כ-ISO — פורמט התצוגה נעשה ברינדור, כדי שאפשר יהיה למיין לפיו. */
  lastAt: string | null;
  avatarUrl: string | null;
  other_user_id: string;
  other_user_name: string;
  /** על מה השיחה: כללית, כרטיס או הצעת שידוך */
  contextKind: RoomContextKind;
  /** נמחק (או שאין) -> null; החדר נשאר וה-contextLabel הוא הכותרת */
  studentId: string | null;
  shidduchId: string | null;
  /** צילום שם ההקשר מרגע היצירה (שם המיועד/ת או "X ו-Y") */
  contextLabel: string | null;
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
