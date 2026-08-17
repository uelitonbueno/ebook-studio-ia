import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useIsMobile } from "@/hooks/useMobile";
import { BookOpenText, Compass, FileDown, LogOut, PanelLeft, Plus } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: BookOpenText, label: "Biblioteca", path: "/" },
  { icon: Compass, label: "Fluxo criativo", href: "#fluxo" },
  { icon: FileDown, label: "Exportações", href: "#exportacoes" },
];

const SIDEBAR_WIDTH_KEY = "ebook-studio-sidebar-width";
const DEFAULT_WIDTH = 252;
const MIN_WIDTH = 220;
const MAX_WIDTH = 360;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <main className="login-screen">
        <div className="login-shape login-shape-blue" />
        <div className="login-shape login-shape-pink" />
        <section className="login-card">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
          <p className="eyebrow">EBOOK STUDIO IA</p>
          <h1>Ideias merecem<br />virar livros.</h1>
          <p className="login-copy">Crie, estruture, ilustre e publique e-books com uma rotina editorial assistida por inteligência artificial.</p>
          <Button onClick={() => startLogin()} size="lg" className="login-cta">
            Entrar no estúdio
            <Plus className="h-4 w-4" />
          </Button>
          <p className="login-note">Seus projetos ficam privados na sua biblioteca.</p>
        </section>
      </main>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (width: number) => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const nextWidth = event.clientX - left;
      if (nextWidth >= MIN_WIDTH && nextWidth <= MAX_WIDTH) setSidebarWidth(nextWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const goTo = (item: (typeof menuItems)[number]) => {
    if (item.path) setLocation(item.path);
    if (item.href) document.querySelector(item.href)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <div ref={sidebarRef} className="relative h-screen">
        <Sidebar collapsible="icon" className="studio-sidebar border-r-0">
          <SidebarHeader className="h-[86px] justify-center px-4">
            <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
              <button className="brand-mark brand-mark-small" onClick={() => setLocation("/")} aria-label="Ir para a biblioteca"><span /><span /><span /></button>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="font-black tracking-[-0.06em] text-[18px] leading-none">Ebook Studio</p>
                <p className="mt-1 text-[9px] font-bold tracking-[0.22em] text-muted-foreground">IA EDITORIAL</p>
              </div>
              <button onClick={() => document.querySelector("#novo")?.scrollIntoView({ behavior: "smooth" })} className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-[#17191a] text-white transition-transform hover:scale-105 active:scale-95 group-data-[collapsible=icon]:hidden" aria-label="Criar e-book">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-3 pt-5">
            <p className="px-3 pb-2 text-[10px] font-bold tracking-[0.18em] text-muted-foreground group-data-[collapsible=icon]:hidden">SEU ESPAÇO</p>
            <SidebarMenu>
              {menuItems.map(item => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton isActive={item.path ? location === item.path : false} onClick={() => goTo(item)} tooltip={item.label} className="h-10 rounded-xl px-3 text-[13px] font-medium transition-all data-[active=true]:bg-white data-[active=true]:text-[#111314] data-[active=true]:shadow-[0_4px_20px_rgba(33,38,42,0.06)]">
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>

            <div className="sidebar-tip group-data-[collapsible=icon]:hidden">
              <span className="sidebar-tip-orb" />
              <p className="font-semibold text-[12px] text-[#303536]">Comece pela ideia.</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">A IA cuida do primeiro rascunho. Você mantém a voz final.</p>
            </div>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/70 group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-8 w-8 shrink-0 border border-white/70">
                    <AvatarFallback className="bg-[#d6e5fb] text-[11px] font-bold text-[#315b85]">{user?.name?.charAt(0).toUpperCase() ?? "U"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <p className="truncate text-[12px] font-semibold leading-none">{user?.name || "Sua biblioteca"}</p>
                    <p className="mt-1 truncate text-[10px] text-muted-foreground">Conta pessoal</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl">
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" />Sair da conta</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <button onMouseDown={() => setIsResizing(true)} aria-label="Redimensionar menu lateral" className="absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize transition-colors hover:bg-[#a6c7ef]" />
      </div>

      <SidebarInset className="bg-[#f2f4f5]">
        {isMobile ? <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-black/[0.05] bg-[#f2f4f5]/90 px-4 backdrop-blur"><SidebarTrigger className="rounded-xl bg-white" /><span className="font-black tracking-[-0.05em]">Ebook Studio</span></header> : null}
        <main className="min-h-screen">{children}</main>
      </SidebarInset>
    </>
  );
}
