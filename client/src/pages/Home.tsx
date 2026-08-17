import { RichTextEditor } from "@/components/RichTextEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { BookOpenText, Check, ChevronLeft, ChevronRight, Download, FileText, ImagePlus, Loader2, MoreHorizontal, Palette, PenLine, Plus, Sparkles, Trash2, WandSparkles } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

type ChapterDraft = { id: number; title: string; summary: string | null; content: string };

const formatLabel = { pdf: "PDF", epub: "EPUB", docx: "DOCX" } as const;
const statusLabel = { draft: "Rascunho", generating: "Criando", ready: "Em edição" } as const;

function dateLabel(date: Date | string | number) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));
}

function Studio() {
  const utils = trpc.useUtils();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [idea, setIdea] = useState("");
  const [genre, setGenre] = useState("Não ficção");
  const [tone, setTone] = useState("Clareza e proximidade");
  const [audience, setAudience] = useState("Leitores em busca de orientação prática");
  const [visualStyle, setVisualStyle] = useState("Minimalismo escandinavo");
  const [chapterDraft, setChapterDraft] = useState<ChapterDraft | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewriteInstruction, setRewriteInstruction] = useState("");

  const libraryQuery = trpc.ebook.list.useQuery();
  const bookQuery = trpc.ebook.get.useQuery({ ebookId: selectedId ?? 0 }, { enabled: selectedId !== null });
  const projects = libraryQuery.data ?? [];
  const book = bookQuery.data;
  const activeChapter = useMemo(() => book?.chapters.find(chapter => chapter.id === activeChapterId) ?? book?.chapters[0] ?? null, [book?.chapters, activeChapterId]);

  useEffect(() => {
    if (!selectedId && projects[0]) setSelectedId(projects[0].id);
  }, [projects, selectedId]);

  useEffect(() => {
    if (activeChapter) setChapterDraft({ id: activeChapter.id, title: activeChapter.title, summary: activeChapter.summary, content: activeChapter.content ?? "" });
  }, [activeChapter?.id, activeChapter?.content, activeChapter?.title, activeChapter?.summary]);

  const refreshBook = async () => {
    await Promise.all([utils.ebook.list.invalidate(), selectedId ? utils.ebook.get.invalidate({ ebookId: selectedId }) : Promise.resolve()]);
  };

  const createMutation = trpc.ebook.create.useMutation({
    onSuccess: async created => {
      setSelectedId(created.id);
      setCreateOpen(false);
      setIdea("");
      await utils.ebook.list.invalidate();
    },
  });
  const outlineMutation = trpc.ebook.generateOutline.useMutation({ onSuccess: refreshBook, onError: error => toast.error(error.message) });
  const chapterMutation = trpc.ebook.generateChapter.useMutation({ onSuccess: refreshBook, onError: error => toast.error(error.message) });
  const rewriteMutation = trpc.ebook.rewriteChapter.useMutation({ onSuccess: async () => { setRewriteOpen(false); setRewriteInstruction(""); await refreshBook(); }, onError: error => toast.error(error.message) });
  const saveChapterMutation = trpc.ebook.updateChapter.useMutation({ onSuccess: refreshBook });
  const updateMutation = trpc.ebook.update.useMutation({ onSuccess: refreshBook });
  const artworkMutation = trpc.ebook.generateArtwork.useMutation({ onSuccess: refreshBook, onError: error => toast.error(error.message) });
  const exportMutation = trpc.ebook.export.useMutation({ onSuccess: refreshBook, onError: error => toast.error(error.message) });
  const deleteMutation = trpc.ebook.remove.useMutation({
    onSuccess: async () => {
      const remaining = projects.filter(project => project.id !== selectedId);
      setSelectedId(remaining[0]?.id ?? null);
      await utils.ebook.list.invalidate();
    },
  });

  const submitCreate = (event: FormEvent) => {
    event.preventDefault();
    if (!idea.trim()) return;
    createMutation.mutate({ idea: idea.trim(), genre, tone, targetAudience: audience, visualStyle });
  };

  const saveChapter = () => {
    if (!selectedId || !chapterDraft) return;
    saveChapterMutation.mutate({ ebookId: selectedId, chapterId: chapterDraft.id, title: chapterDraft.title, summary: chapterDraft.summary, content: chapterDraft.content });
  };

  const saveTitle = () => {
    if (!selectedId || titleDraft.trim().length < 2) {
      setRenaming(false);
      return;
    }
    updateMutation.mutate({ ebookId: selectedId, title: titleDraft.trim() });
    setRenaming(false);
  };

  const isGenerating = outlineMutation.isPending || chapterMutation.isPending || rewriteMutation.isPending || artworkMutation.isPending;
  const chapterIllustrations = book?.assets.filter(asset => asset.type === "illustration" && asset.chapterId === activeChapter?.id) ?? [];

  return (
    <div className="studio-page">
      <header className="studio-header">
        <div>
          <p className="eyebrow">SUA BIBLIOTECA</p>
          <h1>Escreva algo que<br className="hidden sm:block" /> vale a pena abrir.</h1>
        </div>
        <Button id="novo" onClick={() => setCreateOpen(true)} className="new-book-button"><Plus className="h-4 w-4" />Novo e-book</Button>
      </header>

      <section className="project-strip" aria-label="Projetos recentes">
        <div className="project-strip-head">
          <p>Projetos</p>
          <span>{projects.length} {projects.length === 1 ? "livro" : "livros"}</span>
        </div>
        <div className="project-cards">
          {libraryQuery.isLoading ? <div className="project-skeleton" /> : null}
          {projects.map((project, index) => (
            <button key={project.id} onClick={() => { setSelectedId(project.id); setActiveChapterId(null); }} className={cn("project-card", selectedId === project.id && "project-card-active")}>
              <span className={cn("project-card-orb", index % 3 === 1 && "orb-pink", index % 3 === 2 && "orb-mint")} />
              <span className="project-card-meta">{project.genre ?? "E-book"}</span>
              <strong>{project.title}</strong>
              <span className="project-card-date">Atualizado {dateLabel(project.updatedAt)}</span>
            </button>
          ))}
          <button onClick={() => setCreateOpen(true)} className="project-add-card"><Plus className="h-4 w-4" /><span>Criar novo</span></button>
        </div>
      </section>

      {!selectedId || !book ? (
        <section className="empty-studio">
          <div className="empty-visual"><span /><span /><span /></div>
          <p className="eyebrow">SEU PRIMEIRO PROJETO</p>
          <h2>Comece com uma ideia,<br />não com uma página em branco.</h2>
          <p>Conte o assunto, a transformação desejada ou a história que quer compartilhar. A estrutura editorial nasce a partir daí.</p>
          <Button onClick={() => setCreateOpen(true)} className="new-book-button"><Sparkles className="h-4 w-4" />Transformar ideia em livro</Button>
        </section>
      ) : (
        <section className="workspace-grid">
          <aside className="outline-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">ESTRUTURA</p><h2>Seu livro</h2></div>
              <Badge variant="secondary" className="status-badge">{statusLabel[book.ebook.status]}</Badge>
            </div>
            <button onClick={() => { setRenaming(true); setTitleDraft(book.ebook.title); }} className="book-title-button">{book.ebook.title}<PenLine className="h-3.5 w-3.5" /></button>
            {book.ebook.subtitle ? <p className="book-subtitle">{book.ebook.subtitle}</p> : null}
            <div className="idea-chip"><Sparkles className="h-3.5 w-3.5" /><span>{book.ebook.idea}</span></div>
            {book.ebook.positioning ? <div className="positioning-note"><p>POSICIONAMENTO</p><span>{book.ebook.positioning}</span></div> : null}
            <div className="chapter-list">
              {book.chapters.length ? book.chapters.map(chapter => (
                <button key={chapter.id} onClick={() => setActiveChapterId(chapter.id)} className={cn("chapter-row", activeChapter?.id === chapter.id && "chapter-row-active")}>
                  <span>{String(chapter.position).padStart(2, "0")}</span><strong>{chapter.title}</strong>
                  {chapter.content ? <Check className="h-3.5 w-3.5 text-[#4f927f]" /> : <span className="chapter-dash" />}
                </button>
              )) : <div className="outline-empty"><BookOpenText className="h-4 w-4" />Gere o sumário para organizar os capítulos.</div>}
            </div>
            <Button disabled={outlineMutation.isPending} onClick={() => outlineMutation.mutate({ ebookId: book.ebook.id })} variant="outline" className="outline-generate"><WandSparkles className="h-4 w-4" />{book.chapters.length ? "Refazer estrutura" : "Gerar estrutura"}</Button>
          </aside>

          <article className="editor-panel">
            {activeChapter && chapterDraft ? <>
              <div className="editor-topbar">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground"><span>CAPÍTULO {String(activeChapter.position).padStart(2, "0")}</span><span className="h-1 w-1 rounded-full bg-[#9da3a5]" /><span>{chapterDraft.content ? "Em revisão" : "Aguardando rascunho"}</span></div>
                <div className="flex items-center gap-2">
                  <Button onClick={saveChapter} disabled={saveChapterMutation.isPending} variant="ghost" className="h-8 rounded-lg text-[12px] font-semibold">{saveChapterMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Salvar</Button>
                  <Button onClick={() => chapterDraft.content ? setRewriteOpen(true) : chapterMutation.mutate({ ebookId: book.ebook.id, chapterId: activeChapter.id })} disabled={chapterMutation.isPending || rewriteMutation.isPending} className="generate-chapter-button">{chapterMutation.isPending || rewriteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{chapterDraft.content ? "Reescrever com IA" : "Escrever com IA"}</Button>
                </div>
              </div>
              <div className="editor-content-wrap">
                <Input value={chapterDraft.title} onChange={event => setChapterDraft({ ...chapterDraft, title: event.target.value })} className="chapter-title-input" aria-label="Título do capítulo" />
                <p className="chapter-summary">{chapterDraft.summary || "Defina o propósito deste capítulo antes de escrever."}</p>
                <RichTextEditor content={chapterDraft.content} onChange={content => setChapterDraft({ ...chapterDraft, content })} />
              </div>
              <div className="editor-footer"><span>{chapterDraft.content.replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length} palavras</span><span>Salvamento manual</span></div>
            </> : <div className="editor-placeholder"><FileText className="h-7 w-7" /><h3>Estruture seu livro primeiro</h3><p>Aparecerá aqui um editor para cada capítulo criado.</p></div>}
          </article>

          <aside className="creative-panel" id="fluxo">
            <div className="panel-heading"><div><p className="eyebrow">DIREÇÃO CRIATIVA</p><h2>Arte & publicação</h2></div><MoreHorizontal className="h-5 w-5 text-muted-foreground" /></div>
            <div className="cover-canvas">
              {book.ebook.coverUrl ? <img src={book.ebook.coverUrl} alt={`Capa de ${book.ebook.title}`} /> : <><span className="cover-orb cover-orb-one" /><span className="cover-orb cover-orb-two" /><span className="cover-line" /><p>{book.ebook.title}</p><small>Capa pendente</small></>}
            </div>
            <Button onClick={() => artworkMutation.mutate({ ebookId: book.ebook.id, type: "cover" })} disabled={artworkMutation.isPending} variant="outline" className="creative-action"><Palette className="h-4 w-4" />{artworkMutation.isPending ? "Criando arte..." : book.ebook.coverUrl ? "Criar nova capa" : "Gerar capa com IA"}</Button>
            <Button onClick={() => artworkMutation.mutate({ ebookId: book.ebook.id, type: "illustration", chapterId: activeChapter?.id })} disabled={artworkMutation.isPending || !activeChapter} variant="ghost" className="creative-secondary"><ImagePlus className="h-4 w-4" />Ilustrar capítulo atual</Button>
            {activeChapter ? <div className="illustration-gallery"><p>{chapterIllustrations.length ? `Ilustrações — ${activeChapter.title}` : `Ilustração de ${activeChapter.title}`}</p>{chapterIllustrations.length ? <div>{chapterIllustrations.map(asset => <img key={asset.id} src={asset.imageUrl} alt={`Ilustração do capítulo ${activeChapter.title}`} />)}</div> : <span>A imagem criada para este capítulo aparecerá aqui.</span>}</div> : null}
            <div className="style-note"><span className="style-dot" /><div><strong>{book.ebook.visualStyle ?? "Editorial minimalista"}</strong><p>Estilo visual aplicado às imagens geradas.</p></div></div>
            <div className="export-section" id="exportacoes">
              <p className="eyebrow">EXPORTAR</p>
              <p className="export-description">Prepare um arquivo compatível com leitura e publicação.</p>
              <div className="export-grid">
                {(["pdf", "epub", "docx"] as const).map(format => <Button key={format} onClick={() => exportMutation.mutate({ ebookId: book.ebook.id, format })} disabled={exportMutation.isPending || !book.chapters.length} variant="outline" className="export-button"><Download className="h-3.5 w-3.5" />{formatLabel[format]}</Button>)}
              </div>
              {book.exports.length ? <div className="export-history">{book.exports.slice(0, 3).map(file => <a key={file.id} href={file.downloadUrl} className="export-link"><span>{formatLabel[file.format]}</span><span>{dateLabel(file.createdAt)}</span></a>)}</div> : null}
            </div>
            <button onClick={() => deleteMutation.mutate({ ebookId: book.ebook.id })} className="delete-project"><Trash2 className="h-3.5 w-3.5" />Excluir projeto</button>
          </aside>
        </section>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="create-dialog sm:max-w-[600px]">
          <DialogHeader><p className="eyebrow">NOVO E-BOOK</p><DialogTitle>O que você quer transformar em livro?</DialogTitle><DialogDescription>Descreva a ideia em poucas frases. Depois, a IA propõe título, estrutura e capítulos para você editar.</DialogDescription></DialogHeader>
          <form onSubmit={submitCreate} className="create-form">
            <div className="space-y-2"><Label htmlFor="idea">A ideia central</Label><Textarea id="idea" value={idea} onChange={event => setIdea(event.target.value)} placeholder="Ex.: Um guia para pessoas criativas que desejam retomar a escrita com menos pressão e mais consistência." className="min-h-32 resize-none rounded-xl border-[#d9dee0] bg-[#f8f9f9] p-4 text-[14px] shadow-none focus-visible:ring-[#a8c7ee]" /></div>
            <div className="create-form-grid">
              <div className="space-y-2"><Label>Categoria</Label><Select value={genre} onValueChange={setGenre}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Não ficção">Não ficção</SelectItem><SelectItem value="Ficção">Ficção</SelectItem><SelectItem value="Desenvolvimento pessoal">Desenvolvimento pessoal</SelectItem><SelectItem value="Negócios">Negócios</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Tom</Label><Select value={tone} onValueChange={setTone}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Clareza e proximidade">Clareza e proximidade</SelectItem><SelectItem value="Inspirador">Inspirador</SelectItem><SelectItem value="Técnico e objetivo">Técnico e objetivo</SelectItem><SelectItem value="Poético e sensível">Poético e sensível</SelectItem></SelectContent></Select></div>
            </div>
            <div className="create-form-grid"><div className="space-y-2"><Label htmlFor="audience">Para quem</Label><Input id="audience" value={audience} onChange={event => setAudience(event.target.value)} /></div><div className="space-y-2"><Label>Estilo visual</Label><Select value={visualStyle} onValueChange={setVisualStyle}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Minimalismo escandinavo">Minimalismo escandinavo</SelectItem><SelectItem value="Editorial contemporâneo">Editorial contemporâneo</SelectItem><SelectItem value="Ilustração orgânica">Ilustração orgânica</SelectItem></SelectContent></Select></div></div>
            {createMutation.error ? <p className="text-sm text-destructive">{createMutation.error.message}</p> : null}
            <div className="mt-2 flex justify-end"><Button type="submit" disabled={createMutation.isPending || idea.trim().length < 12} className="new-book-button">{createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Criar projeto</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Renomear e-book</DialogTitle><DialogDescription>Use um título claro e memorável para a capa e os arquivos de exportação.</DialogDescription></DialogHeader><div className="flex gap-2"><Input value={titleDraft} onChange={event => setTitleDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter") saveTitle(); }} autoFocus /><Button onClick={saveTitle}>Salvar</Button></div></DialogContent>
      </Dialog>

      <Dialog open={rewriteOpen} onOpenChange={setRewriteOpen}>
        <DialogContent className="create-dialog sm:max-w-[520px]">
          <DialogHeader><p className="eyebrow">REESCRITA ASSISTIDA</p><DialogTitle>Como este capítulo deve melhorar?</DialogTitle><DialogDescription>Descreva a mudança de direção. A nova versão preservará o tema e a intenção do texto atual.</DialogDescription></DialogHeader>
          <div className="mt-4 space-y-3"><Textarea value={rewriteInstruction} onChange={event => setRewriteInstruction(event.target.value)} placeholder="Ex.: deixe o texto mais direto, inclua um exemplo prático e reduza o tom técnico." className="min-h-28 resize-none rounded-xl bg-[#f8f9f9] p-4 text-sm" /><div className="flex justify-end"><Button onClick={() => { if (selectedId && activeChapter && rewriteInstruction.trim()) rewriteMutation.mutate({ ebookId: selectedId, chapterId: activeChapter.id, instruction: rewriteInstruction.trim() }); }} disabled={rewriteMutation.isPending || rewriteInstruction.trim().length < 8} className="new-book-button">{rewriteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}Reescrever capítulo</Button></div></div>
        </DialogContent>
      </Dialog>

      {isGenerating ? <div className="generation-toast"><Loader2 className="h-4 w-4 animate-spin" /><span>A IA está trabalhando no seu livro...</span></div> : null}
    </div>
  );
}

export default function Home() {
  return <DashboardLayout><Studio /></DashboardLayout>;
}
