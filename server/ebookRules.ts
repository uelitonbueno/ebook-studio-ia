import { z } from "zod";

export type EditorialBrief = {
  title: string;
  idea: string;
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
  chapters: z.array(z.object({ title: z.string().min(2).max(255), summary: z.string().min(20).max(1000) })).min(3).max(10),
});

export function buildOutlinePrompt(brief: EditorialBrief) {
  return `Transforme esta ideia em um plano editorial completo. Ideia: ${brief.idea}
Preferências: gênero ${brief.genre ?? "a definir"}; tom ${brief.tone ?? "claro e envolvente"}; público ${brief.targetAudience ?? "leitores gerais"}.
Crie de 5 a 7 capítulos progressivos. Cada resumo deve orientar um capítulo substancial. O título deve ser específico e publicável. Explique o posicionamento editorial em 2 ou 3 frases: promessa ao leitor, recorte único e diferenciação da obra.`;
}

export function buildChapterPrompt(brief: EditorialBrief, chapter: { position: number; title: string; summary: string | null }) {
  return `Escreva o capítulo ${chapter.position}, intitulado "${chapter.title}", para o e-book "${brief.title}". Premissa: ${brief.idea}
Resumo editorial do capítulo: ${chapter.summary ?? "Desenvolva o tema central."}
Tom: ${brief.tone ?? "acolhedor e direto"}. Público: ${brief.targetAudience ?? "leitores gerais"}.
Entregue entre 700 e 1.000 palavras, em parágrafos bem estruturados. Retorne apenas o texto do capítulo.`;
}

export function buildRewritePrompt(brief: EditorialBrief, chapter: { title: string; content: string }, instruction: string) {
  return `E-book: ${brief.title}
Capítulo: ${chapter.title}
Pedido de revisão: ${instruction}

Texto atual:
${chapter.content}`;
}
