import type { Editor, Range } from "@tiptap/react";
import {
  Heading2,
  Heading3,
  Heading4,
  Image as ImageIcon,
  Link2,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  type LucideIcon,
} from "lucide-react";

/** פעולות שדורשות חלון קלט (קישור, תמונה) ולכן נפתחות מהרכיב שמחזיק את העורך */
export interface SlashCommandActions {
  requestLink: () => void;
  requestImage: () => void;
}

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  /** מילות חיפוש בעברית ובאנגלית, באותיות קטנות */
  keywords: string[];
  icon: LucideIcon;
  run: (ctx: {
    editor: Editor;
    range: Range;
    actions: SlashCommandActions;
  }) => void;
}

/** מוחק את טקסט הפקודה ("/כותרת") ומחזיר שרשרת פעולות ממוקדת */
function clearTrigger(editor: Editor, range: Range) {
  return editor.chain().focus().deleteRange(range);
}

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    id: "heading-2",
    label: "כותרת גדולה",
    description: "כותרת ראשית לפרק במאמר (H2)",
    keywords: ["h2", "heading", "כותרת", "גדולה", "כותרת גדולה"],
    icon: Heading2,
    run: ({ editor, range }) =>
      clearTrigger(editor, range).setNode("heading", { level: 2 }).run(),
  },
  {
    id: "heading-3",
    label: "כותרת בינונית",
    description: "כותרת משנה (H3)",
    keywords: ["h3", "heading", "כותרת", "בינונית", "כותרת בינונית"],
    icon: Heading3,
    run: ({ editor, range }) =>
      clearTrigger(editor, range).setNode("heading", { level: 3 }).run(),
  },
  {
    id: "heading-4",
    label: "כותרת קטנה",
    description: "כותרת קטנה בתוך פרק (H4)",
    keywords: ["h4", "heading", "כותרת", "קטנה", "כותרת קטנה"],
    icon: Heading4,
    run: ({ editor, range }) =>
      clearTrigger(editor, range).setNode("heading", { level: 4 }).run(),
  },
  {
    id: "paragraph",
    label: "פסקה",
    description: "טקסט רגיל",
    keywords: ["p", "paragraph", "text", "פסקה", "טקסט", "רגיל"],
    icon: Pilcrow,
    run: ({ editor, range }) =>
      clearTrigger(editor, range).setParagraph().run(),
  },
  {
    id: "bullet-list",
    label: "רשימת תבליטים",
    description: "רשימה עם נקודות",
    keywords: ["ul", "list", "bullet", "רשימה", "תבליטים", "נקודות"],
    icon: List,
    run: ({ editor, range }) =>
      clearTrigger(editor, range).toggleBulletList().run(),
  },
  {
    id: "ordered-list",
    label: "רשימה ממוספרת",
    description: "רשימה עם מספרים",
    keywords: [
      "ol",
      "list",
      "numbered",
      "number",
      "רשימה",
      "ממוספרת",
      "מספרים",
    ],
    icon: ListOrdered,
    run: ({ editor, range }) =>
      clearTrigger(editor, range).toggleOrderedList().run(),
  },
  {
    id: "quote",
    label: "ציטוט",
    description: "הדגשת קטע או ציטוט",
    keywords: ["quote", "blockquote", "ציטוט", "הדגשה"],
    icon: Quote,
    run: ({ editor, range }) =>
      clearTrigger(editor, range).toggleBlockquote().run(),
  },
  {
    id: "divider",
    label: "קו מפריד",
    description: "קו אופקי בין חלקי המאמר",
    keywords: ["hr", "divider", "line", "separator", "קו", "מפריד", "הפרדה"],
    icon: Minus,
    run: ({ editor, range }) =>
      clearTrigger(editor, range).setHorizontalRule().run(),
  },
  {
    id: "link",
    label: "קישור",
    description: "הוספת קישור לכתובת",
    keywords: ["link", "url", "קישור", "לינק", "כתובת"],
    icon: Link2,
    run: ({ editor, range, actions }) => {
      clearTrigger(editor, range).run();
      actions.requestLink();
    },
  },
  {
    id: "image",
    label: "תמונה",
    description: "העלאת תמונה למאמר",
    keywords: ["image", "img", "photo", "picture", "תמונה", "תמונות", "העלאה"],
    icon: ImageIcon,
    run: ({ editor, range, actions }) => {
      clearTrigger(editor, range).run();
      actions.requestImage();
    },
  },
];

/** האם אחת המילים בטקסט מתחילה במה שהוקלד (אחרת "קו" יתאים גם ל"נקודות") */
function hasWordStartingWith(text: string, needle: string): boolean {
  return text.split(/\s+/).some((word) => word.startsWith(needle));
}

/** סינון לפי מה שהוקלד אחרי ה"/": תחילת מילה בתווית או במילת חיפוש */
export function filterSlashCommands(query: string): SlashCommand[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...SLASH_COMMANDS];
  return SLASH_COMMANDS.filter(
    (command) =>
      hasWordStartingWith(command.label, needle) ||
      command.keywords.some((keyword) => hasWordStartingWith(keyword, needle)),
  );
}
