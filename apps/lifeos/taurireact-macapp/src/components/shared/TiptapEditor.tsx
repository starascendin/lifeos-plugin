import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Typography from "@tiptap/extension-typography";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
}

/**
 * Rich text editor with inline markdown rendering (Linear-style)
 * - Type **bold** → renders bold
 * - Type *italic* → renders italic
 * - Type `code` → renders code
 * - Type - [ ] → creates checkbox
 * - Type # → creates heading
 */
export function TiptapEditor({
  content,
  onChange,
  placeholder = "Start typing...",
  className,
  editable = true,
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
      }),
      Typography,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[100px]",
          // Headings
          "prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2",
          "prose-h1:text-xl prose-h2:text-lg prose-h3:text-base",
          // Paragraphs
          "prose-p:text-foreground prose-p:my-2",
          // Lists
          "prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5",
          // Code
          "prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none",
          "prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-md",
          // Links
          "prose-a:text-primary prose-a:underline",
          // Blockquotes
          "prose-blockquote:border-l-2 prose-blockquote:border-muted-foreground prose-blockquote:pl-4 prose-blockquote:italic"
        ),
      },
    },
  });

  // Update editor content when prop changes (but not from our own edits)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  return (
    <div
      className={cn(
        "tiptap-editor rounded-md border border-input bg-background px-3 py-2",
        "focus-within:ring-1 focus-within:ring-ring",
        className
      )}
    >
      <EditorContent editor={editor} />
      <style>{`
        .tiptap-editor .ProseMirror {
          outline: none;
        }
        .tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: hsl(var(--muted-foreground));
          pointer-events: none;
          height: 0;
        }
        .tiptap-editor .ProseMirror ul[data-type="taskList"] {
          list-style: none;
          padding: 0;
        }
        .tiptap-editor .ProseMirror ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
        }
        .tiptap-editor .ProseMirror ul[data-type="taskList"] li > label {
          flex-shrink: 0;
          user-select: none;
        }
        .tiptap-editor .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"] {
          appearance: none;
          width: 1rem;
          height: 1rem;
          border: 1.5px solid hsl(var(--muted-foreground) / 0.5);
          border-radius: 0.25rem;
          margin-top: 0.25rem;
          cursor: pointer;
          position: relative;
        }
        .tiptap-editor .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"]:checked {
          background-color: hsl(var(--primary));
          border-color: hsl(var(--primary));
        }
        .tiptap-editor .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"]:checked::after {
          content: '';
          position: absolute;
          left: 4px;
          top: 1px;
          width: 4px;
          height: 8px;
          border: solid hsl(var(--primary-foreground));
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }
        .tiptap-editor .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div > p {
          text-decoration: line-through;
          color: hsl(var(--muted-foreground));
        }
      `}</style>
    </div>
  );
}
