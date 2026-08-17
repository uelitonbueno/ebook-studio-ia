import { z } from "zod";

export type EditorialBrief = {
  title: string;
  idea: string;
  objective: string | null;
  referenceNotes: string | null;
  discoveryAnalysis: string | null;
  genre: string | null;
  tone: string | null;
  targetAudience: string | null;
};

export const outlineSchema = z.object({
  title: z.string().min(2).max(255),
  subtitle: z.string().max(500),
  positioning: z.string().min(20).max(1000),
  genre: z.string().max(120),
  tone: z.string().max(120),
  targetAudience: z.string().max(255),
  chapters: z.array(z.object({ title: z.string().min(2).max(255), summary: z.string().min(20).max(6000) })).min(3).max(10),
});

export const discoverySchema = z.object({
  editorialSummary: z.string().min(40).max(2400),
  refinedIdea: z.string().min(40).max(6000),
  suggestedAudience: z.string().min(10).max(1200),
  suggestedTone: z.string().min(3).max(160),
  suggestedVisualStyle: z.string().min(3).max(500),
  intentions: z.array(z.string().min(8).max(500)).min(2).max(6),
  themes: z.array(z.string().min(2).max(160)).min(3).max(10),
  titleSuggestions: z.array(z.object({
    title: z.string().min(2).max(255),
    subtitle: z.string().max(500),
    rationale: z.string().min(12).max(600),
  })).min(3).max(5),
  structureSuggestions: z.array(z.object({
    title: z.string().min(2).max(255),
    purpose: z.string().min(12).max(900),
  })).min(3).max(8),
  coverDirections: z.array(z.string().min(12).max(800)).min(2).max(4),
  illustrationDirections: z.array(z.string().min(12).max(800)).min(2).max(5),
  keywords: z.array(z.string().min(2).max(100)).min(3).max(10),
});

export type DiscoveryInput = {
  idea: string;
  objective?: string | null;
  referenceNotes?: string | null;
  genre?: string | null;
  tone?: string | null;
  targetAudience?: string | null;
  visualStyle?: string | null;
};

export function buildDiscoveryPrompt(input: DiscoveryInput) {
  return `Leia cuidadosamente todo o briefing abaixo antes de sugerir qualquer coisa. Você é uma editora brasileira especializada em livros cristãos, devocionais, infantis e de não ficção. Organize a informação sem inventar fatos bíblicos, sem copiar obras e sem atribuir versículos inexistentes. Escreva em português brasileiro e retorne apenas o JSON solicitado.

IDEIA BRUTA:
${input.idea}

OBJETIVO DO LIVRO:
${input.objective ?? "Não informado"}

PÚBLICO INFORMADO:
${input.targetAudience ?? "Não informado"}

CATEGORIA:
${input.genre ?? "Ideias cristãs"}

TOM:
${input.tone ?? "Acolhedor e claro"}

ESTILO VISUAL DESEJADO:
${input.visualStyle ?? "A definir"}

REFERÊNCIAS E OBSERVAÇÕES:
${input.referenceNotes ?? "Não informado"}

Extraia as intenções explícitas e implícitas do autor, os temas centrais e proponha um projeto de livro coerente. Crie títulos publicáveis, uma estrutura progressiva e direções visuais de capa e ilustrações sem texto ou logotipos. Preserve o contexto e as preferências declaradas pelo autor.`;
}

export function buildOutlinePrompt(brief: EditorialBrief) {
  return `Transforme esta ideia em um plano editorial completo. Ideia: ${brief.idea}
Preferências: gênero ${brief.genre ?? "a definir"}; tom ${brief.tone ?? "claro e envolvente"}; público ${brief.targetAudience ?? "leitores gerais"}.
Objetivo: ${brief.objective ?? "Criar um e-book útil e publicável."}
Referências e regras do autor: ${brief.referenceNotes ?? "Nenhuma informação adicional."}
Crie de 5 a 7 capítulos progressivos. Cada resumo deve orientar um capítulo substancial, em no máximo três parágrafos curtos. O título deve ser específico e publicável. Explique o posicionamento editorial em 2 ou 3 frases: promessa ao leitor, recorte único e diferenciação da obra.`;
}

export function buildChapterPrompt(brief: EditorialBrief, chapter: { position: number; title: string; summary: string | null }) {
  return `Escreva o capítulo ${chapter.position}, intitulado "${chapter.title}", para o e-book "${brief.title}". Premissa: ${brief.idea}
Resumo editorial do capítulo: ${chapter.summary ?? "Desenvolva o tema central."}
Tom: ${brief.tone ?? "acolhedor e direto"}. Público: ${brief.targetAudience ?? "leitores gerais"}.
Objetivo da obra: ${brief.objective ?? "Ajudar o leitor com conteúdo claro e original."}
Observações do autor: ${brief.referenceNotes ?? "Nenhuma observação adicional."}
Entregue entre 700 e 1.000 palavras, em parágrafos bem estruturados. Retorne apenas o texto do capítulo.`;
}

export function buildRewritePrompt(brief: EditorialBrief, chapter: { title: string; content: string }, instruction: string) {
  return `E-book: ${brief.title}
Capítulo: ${chapter.title}
Pedido de revisão: ${instruction}

Texto atual:
${chapter.content}`;
}
