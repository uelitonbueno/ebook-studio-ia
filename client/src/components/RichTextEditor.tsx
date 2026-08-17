import { Button } from "@/components/ui/button";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered, Quote, Redo2, Undo2 } from "lucide-react";
import { useEffect } from "react";

type RichTextEditorProps = {
  content: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

const toolButton = "h-8 w-8 rounded-lg border-0 bg-transparent p-0 text-muted-foreground hover:bg-[#eef2f3] hover:text-[#17191a] data-[active=true]:bg-[#17191a] data-[active=true]:text-white";

export function RichTextEditor({ content, onChange, placeholder = "Escreva ou gere o texto deste capítulo..." }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } })],
    content,
    editorProps: {
      attributes: {
        class: "chapter-editor prose prose-neutral max-w-none focus:outline-none",
        "data-placeholder": placeholder,
      },
    },
    onUpdate: ({ editor: activeEditor }) => onChange(activeEditor.getHTML()),
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) editor.commands.setContent(content, { emitUpdate: false });
  }, [content, editor]);

  if (!editor) return <div className="editor-loading" />;

  return (
    <div className="rich-editor-shell">
      <div className="editor-toolbar" role="toolbar" aria-label="Formatação de texto">
        <Button type="button" variant="ghost" size="icon" className={toolButton} data-active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Negrito"><Bold className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon" className={toolButton} data-active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Itálico"><Italic className="h-4 w-4" /></Button>
        <span className="toolbar-divider" />
        <Button type="button" variant="ghost" size="icon" className={toolButton} data-active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} aria-label="Lista"><List className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon" className={toolButton} data-active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Lista numerada"><ListOrdered className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon" className={toolButton} data-active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} aria-label="Citação"><Quote className="h-4 w-4" /></Button>
        <span className="toolbar-divider" />
        <Button type="button" variant="ghost" size="icon" className={toolButton} onClick={() => editor.chain().focus().undo().run()} aria-label="Desfazer"><Undo2 className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon" className={toolButton} onClick={() => editor.chain().focus().redo().run()} aria-label="Refazer"><Redo2 className="h-4 w-4" /></Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
