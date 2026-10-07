"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useMemo, useState } from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { EditorImage } from "./rich-text/editor-image";
import { ImageDialog } from "./rich-text/image-dialog";
import { LinkDialog } from "./rich-text/link-dialog";
import { SlashCommandExtension } from "./rich-text/slash-command-extension";
import { SlashMenu } from "./rich-text/slash-menu";
import { useSlashMenu } from "./rich-text/use-slash-menu";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Undo,
  Redo,
} from "lucide-react";

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

const SLASH_HINT_ID = "rich-text-slash-hint";

export function RichTextEditor({
  content,
  onChange,
  placeholder = "התחל לכתוב...",
  className,
}: RichTextEditorProps) {
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [isImageOpen, setIsImageOpen] = useState(false);
  const { menu, render, setActiveIndex } = useSlashMenu();
  // פעולות יציבות: התוסף נוצר פעם אחת עם יצירת העורך
  const slashActions = useMemo(
    () => ({
      requestLink: () => setIsLinkOpen(true),
      requestImage: () => setIsImageOpen(true),
    }),
    [],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
          HTMLAttributes: {
            class: "mt-4 mb-2 first:mt-0",
          },
        },
        bulletList: {
          HTMLAttributes: {
            class: "list-disc list-outside mr-6",
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: "list-decimal list-outside mr-6",
          },
        },
        listItem: {
          HTMLAttributes: {
            class: "ml-0",
          },
        },
        blockquote: {
          HTMLAttributes: {
            class:
              "border-r-4 border-muted-foreground pr-4 mr-4 italic text-muted-foreground",
          },
        },
        paragraph: {
          HTMLAttributes: {
            class: "mb-1",
          },
        },
        horizontalRule: {
          HTMLAttributes: {
            class: "my-6 border-border",
          },
        },
        link: {
          openOnClick: false,
        },
      }),
      EditorImage,
      Placeholder.configure({
        placeholder,
      }),
      SlashCommandExtension.configure({ render, actions: slashActions }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose-km max-w-none min-h-[300px] p-4 focus:outline-none",
        dir: "rtl",
        "aria-label": "עורך תוכן",
        "aria-multiline": "true",
        "aria-describedby": SLASH_HINT_ID,
      },
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-background",
        className,
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 border-b bg-muted/50 p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={
            editor.isActive("bold") ? "bg-primary-muted text-primary" : ""
          }
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={
            editor.isActive("italic") ? "bg-primary-muted text-primary" : ""
          }
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-6 w-px bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className={
            editor.isActive("heading", { level: 1 })
              ? "bg-primary-muted text-primary"
              : ""
          }
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={
            editor.isActive("heading", { level: 2 })
              ? "bg-primary-muted text-primary"
              : ""
          }
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={
            editor.isActive("heading", { level: 3 })
              ? "bg-primary-muted text-primary"
              : ""
          }
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-6 w-px bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBulletList().run();
          }}
          className={
            editor.isActive("bulletList") ? "bg-primary-muted text-primary" : ""
          }
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleOrderedList().run();
          }}
          className={
            editor.isActive("orderedList")
              ? "bg-primary-muted text-primary"
              : ""
          }
          title="Ordered List"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBlockquote().run();
          }}
          className={
            editor.isActive("blockquote") ? "bg-primary-muted text-primary" : ""
          }
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-6 w-px bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          title="Undo (Ctrl+Z)"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          title="Redo (Ctrl+Y)"
        >
          <Redo className="h-4 w-4" />
        </Button>
        <span
          id={SLASH_HINT_ID}
          className="ms-auto self-center px-2 text-caption text-muted-foreground"
        >
          הקלידו / לפקודות
        </span>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
      <SlashMenu editor={editor} menu={menu} onHover={setActiveIndex} />
      <LinkDialog
        editor={editor}
        open={isLinkOpen}
        onOpenChange={setIsLinkOpen}
      />
      <ImageDialog
        editor={editor}
        open={isImageOpen}
        onOpenChange={setIsImageOpen}
      />
    </div>
  );
}
