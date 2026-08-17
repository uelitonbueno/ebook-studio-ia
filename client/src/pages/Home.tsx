import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
import { BookHeart, Check, CheckCircle2, ChevronRight, Download, FileImage, ImagePlus, Loader2, Palette, PenLine, Plus, RotateCcw, Sparkles, Trash2, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { RichTextEditor } from "../components/RichTextEditor";

type BookType = "historybook" | "coloring";
type PageDraft = { id: number; title: string; content: string; imagePrompt: string; status: "draft" | "generating" | "ready" | "reviewed" };
type WorkbenchTab = "overview" | "pages" | "illustrations" | "review";

const bookTypeCopy: Record<BookType, { label: string; eyebrow: string; description: string; action: string }> = {
  coloring: { label: "Livro para Colorir", eyebrow: "CRIAÇÃO VISUAL", description: "Um tema, cenas para pintar e apenas o nome de cada página. Sem narrativa.", action: "Criar páginas para colorir" },
  historybook: { label: "Historybook", eyebrow: "HISTÓRIA ILUSTRADA", description: "História, texto e imagens de todas as páginas gerados de uma só vez para sua revisão.", action: "Criar história completa" },
};

function formatDate(value: Date | string | number) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function Studio() {
  const utils = trpc.useUtils();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [bookType, setBookType] = useState<BookType>("historybook");
  const [idea, setIdea] = useState("");
  const [pageCount, setPageCount] = useState("10");
  const [audience, setAudience] = useState("Crianças de 5 a 10 anos e suas famílias");
  const [tone, setTone] = useState("Acolhedor, simples e cristão");
  const [visualStyle, setVisualStyle] = useState("Ilustração infantil suave, calorosa e editorial");
  const [pageDraft, setPageDraft] = useState<PageDraft | null>(null);
  const [autoGenerationEnabled, setAutoGenerationEnabled] = useState(true);
  const [failedImagePageIds, setFailedImagePageIds] = useState<number[]>([]);
  const [pageImageError, setPageImageError] = useState<{ pageId: number; message: string } | null>(null);
  const [activeWorkbenchTab, setActiveWorkbenchTab] = useState<WorkbenchTab>("overview");

  const libraryQuery = trpc.ebook.list.useQuery();
  const projects = libraryQuery.data ?? [];
  const bookQuery = trpc.ebook.get.useQuery({ ebookId: selectedId ?? 0 }, { enabled: selectedId !== null });
  const book = bookQuery.data;
  const activePage = useMemo(() => book?.pages.find(page => page.id === selectedPageId) ?? book?.pages[0] ?? null, [book?.pages, selectedPageId]);
  const pendingDelete = useMemo(() => projects.find(project => project.id === pendingDeleteId) ?? null, [projects, pendingDeleteId]);

  useEffect(() => {
    if (!selectedId && projects[0]) setSelectedId(projects[0].id);
  }, [projects, selectedId]);

  useEffect(() => {
    if (activePage) setPageDraft({ id: activePage.id, title: activePage.title, content: activePage.content ?? "", imagePrompt: activePage.imagePrompt, status: activePage.status });
  }, [activePage?.id, activePage?.title, activePage?.content, activePage?.imagePrompt, activePage?.status]);

  const refreshBook = async () => {
    await Promise.all([utils.ebook.list.invalidate(), selectedId ? utils.ebook.get.invalidate({ ebookId: selectedId }) : Promise.resolve()]);
  };

  const pageImageMutation = trpc.ebook.generatePageImage.useMutation({
    onMutate: () => {
      setPageImageError(null);
      toast.loading("Gerando uma nova versão da figura...", { id: "page-image-generation" });
    },
    onSuccess: async (updatedPage, variables) => {
      setFailedImagePageIds(ids => ids.filter(id => id !== variables.pageId));
      setPageImageError(current => current?.pageId === variables.pageId ? null : current);
      if (updatedPage) {
        utils.ebook.get.setData({ ebookId: variables.ebookId }, existing => existing ? { ...existing, pages: existing.pages.map(page => page.id === updatedPage.id ? { ...page, ...updatedPage } : page) } : existing);
      }
      toast.success("A nova versão da figura está pronta.", { id: "page-image-generation" });
      await refreshBook();
    },
    onError: async (error, variables) => {
      setFailedImagePageIds(ids => ids.includes(variables.pageId) ? ids : [...ids, variables.pageId]);
      setPageImageError({ pageId: variables.pageId, message: error.message });
      toast.error(`${error.message} A fila continuará nas demais páginas.`, { id: "page-image-generation" });
      await refreshBook();
    },
  });

  const generateBookMutation = trpc.ebook.generateBookPages.useMutation({
    onMutate: () => toast.loading("Criando as páginas do livro...", { id: "book-pages-generation" }),
    onSuccess: async project => {
      setSelectedId(project.ebook.id);
      setSelectedPageId(project.pages[0]?.id ?? null);
      setAutoGenerationEnabled(true);
      setFailedImagePageIds([]);
      toast.success("As páginas foram criadas. Agora estamos ilustrando cada uma delas.", { id: "book-pages-generation" });
      await utils.ebook.list.invalidate();
      await utils.ebook.get.invalidate({ ebookId: project.ebook.id });
    },
    onError: error => toast.error(error.message, { id: "book-pages-generation" }),
  });

  const createMutation = trpc.ebook.create.useMutation({
    onMutate: () => toast.loading("Criando o projeto do livro...", { id: "book-creation" }),
    onSuccess: created => {
      setSelectedId(created.id);
      setCreateOpen(false);
      generateBookMutation.mutate({ ebookId: created.id });
      setIdea("");
      void utils.ebook.list.invalidate();
      toast.success("Projeto criado. A estrutura está sendo preparada.", { id: "book-creation" });
    },
    onError: error => toast.error(error.message, { id: "book-creation" }),
  });

  const updatePageMutation = trpc.ebook.updateBookPage.useMutation({ onMutate: () => toast.loading("Salvando a revisão da página...", { id: "page-save" }), onSuccess: async () => { toast.success("Página marcada como revisada.", { id: "page-save" }); await refreshBook(); }, onError: error => toast.error(error.message, { id: "page-save" }) });
  const exportMutation = trpc.ebook.export.useMutation({ onMutate: variables => toast.loading(`Preparando ${variables.format.toUpperCase()}...`, { id: "ebook-export" }), onSuccess: async () => { toast.success("Arquivo de exportação preparado.", { id: "ebook-export" }); await refreshBook(); }, onError: error => toast.error(error.message, { id: "ebook-export" }) });
  const deleteMutation = trpc.ebook.remove.useMutation({
    onMutate: () => toast.loading("Excluindo o projeto...", { id: "book-delete" }),
    onSuccess: async (_, input) => {
      const remaining = projects.filter(project => project.id !== input.ebookId);
      if (selectedId === input.ebookId) setSelectedId(remaining[0]?.id ?? null);
      setPendingDeleteId(null);
      toast.success("Projeto excluído da biblioteca.", { id: "book-delete" });
      await utils.ebook.list.invalidate();
    },
    onError: error => toast.error(error.message, { id: "book-delete" }),
  });

  const pendingImagePage = useMemo(() => {
    const now = Date.now();
    return book?.pages.find(page => {
      if (page.imageUrl || failedImagePageIds.includes(page.id)) return false;
      if (page.status !== "generating") return true;
      return now - new Date(page.updatedAt).getTime() > 45_000;
    }) ?? null;
  }, [book?.pages, failedImagePageIds]);

  useEffect(() => {
    if (!autoGenerationEnabled || !selectedId || !pendingImagePage || pageImageMutation.isPending) return;
    pageImageMutation.mutate({ ebookId: selectedId, pageId: pendingImagePage.id });
  }, [autoGenerationEnabled, selectedId, pendingImagePage?.id, pageImageMutation.isPending]);

  const continuePendingImages = () => {
    if (!selectedId || !book?.pages.length) return;
    setAutoGenerationEnabled(true);
    setFailedImagePageIds([]);
    const next = book.pages.find(page => !page.imageUrl);
    if (next && !pageImageMutation.isPending) pageImageMutation.mutate({ ebookId: selectedId, pageId: next.id });
  };

  const makeBook = () => {
    if (idea.trim().length < 12) return;
    createMutation.mutate({
      idea: idea.trim(),
      genre: bookType === "coloring" ? "Livro de colorir cristão" : "Historybook cristão",
      bookType,
      pageCount: Number(pageCount),
      targetAudience: audience.trim() || undefined,
      tone,
      visualStyle,
      objective: bookType === "coloring" ? "Criar páginas cristãs adequadas para colorir." : "Criar uma história infantil cristã completa, pronta para revisão.",
    });
  };

  const savePage = () => {
    if (!selectedId || !pageDraft) return;
    updatePageMutation.mutate({ ebookId: selectedId, pageId: pageDraft.id, title: pageDraft.title, content: pageDraft.content, imagePrompt: pageDraft.imagePrompt, status: "reviewed" });
  };

  const regenerateActivePageImage = () => {
    if (!selectedId || !pageDraft) return;
    pageImageMutation.mutate({ ebookId: selectedId, pageId: pageDraft.id, direction: pageDraft.imagePrompt, variation: `versão-${Date.now()}` });
  };

  const switchWorkbenchTab = (tab: WorkbenchTab) => {
    setActiveWorkbenchTab(tab);
    const target = tab === "overview" ? document.querySelector(".progress-layout") : document.querySelector(".pages-workspace");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const illustratedPages = book?.pages.filter(page => Boolean(page.imageUrl)).length ?? 0;
  const remainingImages = book?.pages.filter(page => !page.imageUrl).length ?? 0;
  const reviewedPages = book?.pages.filter(page => page.status === "reviewed").length ?? 0;
  const progress = book?.pages.length ? Math.round(((illustratedPages + reviewedPages) / (book.pages.length * 2)) * 100) : 0;
  const currentType = (book?.ebook.bookType ?? "historybook") as BookType;

  return (
    <div className="story-studio-page">
      <header className="story-hero">
        <div>
          <p className="studio-kicker">ESTÚDIO CRISTÃO DE HISTÓRIAS</p>
          <h1>Olá! Vamos cultivar uma nova história?</h1>
          <p>Crie livros que unem imaginação, cuidado editorial e princípios cristãos vividos com naturalidade.</p>
        </div>
        <Button id="novo" onClick={() => setCreateOpen(true)} className="forest-button"><Plus className="h-4 w-4" />Novo livro</Button>
      </header>

      {!book ? (
        <section className="studio-overview">
          <div className="welcome-bar"><span className="welcome-spinner" />Preparando seu estúdio...</div>
          <p className="studio-kicker">COMEÇAR</p>
          <h2>Atalhos do estúdio</h2>
          <div className="shortcut-grid">
            <button onClick={() => { setBookType("historybook"); setCreateOpen(true); }} className="shortcut-card"><span className="shortcut-icon sage"><BookHeart className="h-5 w-5" /></span><div><strong>Criar Historybook</strong><p>Uma história completa com imagens em todas as páginas.</p></div><ChevronRight /></button>
            <button onClick={() => { setBookType("coloring"); setCreateOpen(true); }} className="shortcut-card"><span className="shortcut-icon peach"><Palette className="h-5 w-5" /></span><div><strong>Criar livro para colorir</strong><p>Escolha o tema e receba páginas prontas para pintar.</p></div><ChevronRight /></button>
            <button onClick={() => setCreateOpen(true)} className="shortcut-card"><span className="shortcut-icon blue"><Sparkles className="h-5 w-5" /></span><div><strong>Descobrir uma ideia</strong><p>Transforme um tema cristão em um novo projeto.</p></div><ChevronRight /></button>
          </div>
          <div className="library-heading"><div><p className="studio-kicker">SEUS LIVROS</p><h2>Biblioteca recente</h2></div><span>{projects.length} projetos</span></div>
          <div className="book-library-grid">{projects.map(project => <article key={project.id} className="library-book-card"><div className={cn("library-book-visual", project.bookType === "coloring" && "coloring-visual")}><span>{project.bookType === "coloring" ? <Palette /> : <BookHeart />}</span></div><div className="library-book-info"><Badge>{project.bookType === "coloring" ? "Colorir" : "Historybook"}</Badge><h3>{project.title}</h3><p>{project.pageCount} páginas · Atualizado {formatDate(project.updatedAt)}</p><div><Button variant="outline" size="sm" onClick={() => setSelectedId(project.id)}>Abrir</Button><button onClick={() => setPendingDeleteId(project.id)} aria-label={`Excluir ${project.title}`} className="library-delete"><Trash2 className="h-4 w-4" /></button></div></div></article>)}</div>
        </section>
      ) : (
        <section className="book-workbench">
          <div className="book-heading"><div><p className="studio-kicker">LIVROS / {currentType === "coloring" ? "COLORIR" : "HISTORYBOOK"}</p><h2>{book.ebook.title}</h2><span>{book.ebook.targetAudience ?? "Público a definir"} · {book.ebook.pageCount} páginas</span></div><div className="book-heading-actions"><div className="export-actions"><Button variant="outline" onClick={() => exportMutation.mutate({ ebookId: book.ebook.id, format: "pdf" })} disabled={exportMutation.isPending || !book.pages.length}><Download className="h-4 w-4" />PDF</Button><Button variant="outline" onClick={() => exportMutation.mutate({ ebookId: book.ebook.id, format: "epub" })} disabled={exportMutation.isPending || !book.pages.length}>EPUB</Button><Button variant="outline" onClick={() => exportMutation.mutate({ ebookId: book.ebook.id, format: "docx" })} disabled={exportMutation.isPending || !book.pages.length}>DOCX</Button></div><Button variant="outline" onClick={() => setPendingDeleteId(book.ebook.id)}><Trash2 className="h-4 w-4" />Excluir</Button><Button className="forest-button" onClick={() => generateBookMutation.mutate({ ebookId: book.ebook.id })} disabled={generateBookMutation.isPending}><WandSparkles className="h-4 w-4" />Refazer livro</Button></div></div>
          <nav className="book-tabs" aria-label="Seções do livro"><button type="button" className={cn(activeWorkbenchTab === "overview" && "active")} onClick={() => switchWorkbenchTab("overview")}>Visão geral</button><button type="button" className={cn(activeWorkbenchTab === "pages" && "active")} onClick={() => switchWorkbenchTab("pages")}>Páginas</button><button type="button" className={cn(activeWorkbenchTab === "illustrations" && "active")} onClick={() => switchWorkbenchTab("illustrations")}>Ilustrações</button><button type="button" className={cn(activeWorkbenchTab === "review" && "active")} onClick={() => switchWorkbenchTab("review")}>Revisão final</button></nav>
          {book.exports.length ? <div className="recent-exports"><span>ARQUIVOS PRONTOS</span>{book.exports.slice(0, 3).map(file => <a key={file.id} href={file.downloadUrl}><Download className="h-3.5 w-3.5" />Baixar {file.format.toUpperCase()}</a>)}</div> : null}
          {pageImageError && activePage?.id === pageImageError.pageId ? <div className="page-image-error" role="alert"><div><strong>Não foi possível atualizar esta figura.</strong><span>{pageImageError.message}</span></div><Button variant="outline" onClick={regenerateActivePageImage} disabled={pageImageMutation.isPending}><RotateCcw className="h-3.5 w-3.5" />Tentar novamente</Button></div> : null}
          <div className="progress-layout"><section className="journey-card"><div className="journey-card-title"><div><p className="studio-kicker">JORNADA DO LIVRO</p><h3>Progresso editorial</h3></div><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><div className="journey-rows"><div><CheckCircle2 className="text-[#3d7860]" /><span><strong>Ideia e estrutura</strong><small>{book.pages.length ? "Etapa preparada" : "Aguardando geração"}</small></span><ChevronRight /></div><div><CheckCircle2 className={illustratedPages === book.pages.length && book.pages.length ? "text-[#3d7860]" : "text-[#c7cfca]"} /><span><strong>Imagens por página</strong><small>{illustratedPages} de {book.pages.length} ilustrações prontas {remainingImages ? `· ${remainingImages} pendentes` : ""}</small>{remainingImages ? <Button variant="outline" className="resume-images-button" onClick={continuePendingImages} disabled={pageImageMutation.isPending}><RotateCcw className="h-3.5 w-3.5" />{pageImageMutation.isPending ? "Gerando..." : failedImagePageIds.length ? `Tentar ${failedImagePageIds.length} pendente${failedImagePageIds.length > 1 ? "s" : ""}` : "Continuar imagens"}</Button> : null}</span><ChevronRight /></div><div><CheckCircle2 className={reviewedPages === book.pages.length && book.pages.length ? "text-[#3d7860]" : "text-[#c7cfca]"} /><span><strong>Revisão final</strong><small>{reviewedPages} páginas revisadas manualmente</small></span><ChevronRight /></div></div></section><aside className="content-summary"><p className="studio-kicker">CONTEÚDO</p><h3>Resumo</h3><div><span><strong>{book.pages.length}</strong><small>páginas</small></span><span><strong>{currentType === "coloring" ? illustratedPages : book.pages.filter(page => Boolean(page.content)).length}</strong><small>{currentType === "coloring" ? "desenhos prontos" : "textos gerados"}</small></span><span><strong>{illustratedPages}</strong><small>imagens geradas</small></span><span><strong>{reviewedPages}</strong><small>páginas revisadas</small></span></div></aside></div>
          {!book.pages.length ? <div className="generation-empty"><FileImage className="h-8 w-8" /><h3>Seu livro está pronto para nascer.</h3><p>A IA criará todas as páginas e iniciará as ilustrações automaticamente.</p><Button className="forest-button" onClick={() => generateBookMutation.mutate({ ebookId: book.ebook.id })}><Sparkles className="h-4 w-4" />{bookTypeCopy[currentType].action}</Button></div> : <div className="pages-workspace"><aside className="page-rail"><div className="page-rail-head"><span>PÁGINAS</span><strong>{book.pages.length}</strong></div>{book.pages.map(page => <button key={page.id} onClick={() => setSelectedPageId(page.id)} className={cn("page-thumb", activePage?.id === page.id && "selected")}><span>{String(page.position).padStart(2, "0")}</span>{page.imageUrl ? <img src={page.imageUrl} alt={`Página ${page.position}`} /> : <div className="page-thumb-empty">{page.status === "generating" ? <Loader2 className="animate-spin" /> : <ImagePlus />}</div>}<small>{page.title}</small></button>)}</aside><article className="page-review-panel">{activePage && pageDraft ? <><div className="page-review-top"><div><p className="studio-kicker">PÁGINA {String(activePage.position).padStart(2, "0")}</p><Input value={pageDraft.title} onChange={event => setPageDraft({ ...pageDraft, title: event.target.value })} className="page-title-input" /></div><Button variant="outline" onClick={savePage} disabled={updatePageMutation.isPending}><Check className="h-4 w-4" />Marcar revisada</Button></div><div className="page-canvas">{activePage.imageUrl ? <img src={activePage.imageUrl} alt={activePage.title} /> : <div className="image-waiting">{activePage.status === "generating" ? <Loader2 className="h-7 w-7 animate-spin" /> : <ImagePlus className="h-7 w-7" />}<strong>{activePage.status === "generating" ? "Criando ilustração..." : "Ilustração aguardando geração"}</strong><span>A imagem será criada automaticamente ou você pode iniciar agora.</span></div>}</div><div className="image-controls"><Textarea value={pageDraft.imagePrompt} onChange={event => setPageDraft({ ...pageDraft, imagePrompt: event.target.value })} className="image-prompt-input" placeholder="Direção da imagem" /><Button className="forest-button" disabled={pageImageMutation.isPending} onClick={() => { savePage(); pageImageMutation.mutate({ ebookId: book.ebook.id, pageId: pageDraft.id, direction: pageDraft.imagePrompt }); }}><RotateCcw className="h-4 w-4" />{activePage.imageUrl ? "Regenerar figura" : "Gerar figura"}</Button></div>{currentType === "historybook" ? <div className="story-text-editor"><p className="studio-kicker">TEXTO DA PÁGINA</p><RichTextEditor content={pageDraft.content} onChange={content => setPageDraft({ ...pageDraft, content })} placeholder="Escreva ou ajuste o texto desta página..." /></div> : <div className="coloring-note"><Palette className="h-5 w-5" /><div><strong>Página para colorir</strong><p>Esta página exibirá somente o título curto e o desenho preto e branco. Não há narrativa.</p></div></div>}</> : null}</article></div>}
        </section>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="new-book-dialog max-h-[calc(100dvh-28px)] overflow-y-auto sm:max-w-[760px]"><DialogHeader><p className="studio-kicker">NOVO LIVRO</p><DialogTitle>Que tipo de experiência você quer criar?</DialogTitle><DialogDescription>O estúdio prepara o livro todo automaticamente. Sua revisão acontece no final, página por página.</DialogDescription></DialogHeader><div className="book-type-choice"><button type="button" onClick={() => setBookType("historybook")} className={cn(bookType === "historybook" && "chosen")}><BookHeart /><div><strong>Historybook</strong><p>História cristã com texto e imagens gerados para todas as páginas.</p></div><Check /></button><button type="button" onClick={() => setBookType("coloring")} className={cn(bookType === "coloring" && "chosen")}><Palette /><div><strong>Livro para Colorir</strong><p>Tema e páginas ilustradas para pintar, sem narrativa.</p></div><Check /></button></div><div className="new-book-fields"><div className="field-span"><Label htmlFor="book-idea">Tema e direção do livro</Label><Textarea id="book-idea" value={idea} onChange={event => setIdea(event.target.value)} placeholder={bookType === "coloring" ? "Ex.: Histórias bíblicas para colorir, com Adão e Eva, Arca de Noé, Davi e Golias..." : "Ex.: Uma criança encontra coragem para ajudar um novo colega na escola e aprende sobre amizade e fé..."} className="new-book-idea" /></div><div><Label>Quantidade de páginas</Label><Select value={pageCount} onValueChange={setPageCount}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[4, 6, 8, 10, 12, 16, 20, 24].map(amount => <SelectItem key={amount} value={String(amount)}>{amount} páginas</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="book-audience">Faixa etária / público</Label><Input id="book-audience" value={audience} onChange={event => setAudience(event.target.value)} /></div><div><Label htmlFor="book-tone">Tom</Label><Input id="book-tone" value={tone} onChange={event => setTone(event.target.value)} /></div><div><Label htmlFor="book-visual">Estilo visual</Label><Input id="book-visual" value={visualStyle} onChange={event => setVisualStyle(event.target.value)} /></div></div><div className="new-book-footer"><span>{bookTypeCopy[bookType].description}</span><Button className="forest-button" onClick={makeBook} disabled={createMutation.isPending || idea.trim().length < 12}>{createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{bookTypeCopy[bookType].action}</Button></div></DialogContent></Dialog>

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={open => { if (!open) setPendingDeleteId(null); }}><AlertDialogContent className="rounded-2xl"><AlertDialogHeader><AlertDialogTitle>Excluir “{pendingDelete?.title ?? "este livro"}”?</AlertDialogTitle><AlertDialogDescription>O livro e todas as páginas criadas serão removidos permanentemente.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => pendingDelete && deleteMutation.mutate({ ebookId: pendingDelete.id })}><Trash2 className="h-4 w-4" />Excluir livro</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}

export default function Home() {
  return <DashboardLayout><Studio /></DashboardLayout>;
}
