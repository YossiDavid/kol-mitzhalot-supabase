import { mergeAttributes, Node } from "@tiptap/react";

/** מחלקות התצוגה של תמונה בתוך העורך (באתר העיצוב נקבע בעמוד המאמר) */
const EDITOR_IMAGE_CLASS = "my-4 h-auto max-w-full rounded-lg";

/**
 * צומת תמונה (בלוק) לעורך. מקבל רק כתובות http(s): תמונות data: ושאר
 * הסכמות נזרקות כבר בהדבקה. הניקוי הסופי לאתר נעשה ב-sanitizeArticleHtml.
 */
export const EditorImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'img[src^="https://"], img[src^="http://"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      mergeAttributes({ class: EDITOR_IMAGE_CLASS }, HTMLAttributes),
    ];
  },
});
