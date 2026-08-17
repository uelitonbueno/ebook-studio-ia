import { describe, expect, it } from "vitest";
import { buildChapterPrompt, buildOutlinePrompt, buildRewritePrompt, outlineSchema } from "./ebookRules";

const brief = {
  title: "Escrever sem Pressa",
  idea: "Um guia para pessoas criativas construírem uma rotina de escrita sustentável.",
  genre: "Desenvolvimento pessoal",
  tone: "Clareza e proximidade",
  targetAudience: "Pessoas criativas",
};

describe("regras editoriais", () => {
  it("aceita uma estrutura de livro completa e rejeita estruturas insuficientes", () => {
    const valid = outlineSchema.safeParse({
      ...brief,
      subtitle: "Uma prática possível para todos os dias",
      positioning: "Um guia curto e prático para retirar a pressão da escrita. Combina rotina, exemplos e exercícios simples para leitores que desejam produzir com constância.",
      chapters: [
        { title: "Começar pequeno", summary: "Apresenta uma forma sustentável de reduzir a barreira de entrada e encontrar tempo para escrever." },
        { title: "Fazer espaço", summary: "Explica como preparar uma rotina e um ambiente que respeitem a energia disponível no dia." },
        { title: "Continuar", summary: "Transforma os primeiros avanços em um sistema leve de revisão e continuidade criativa." },
      ],
    });
    expect(valid.success).toBe(true);

    const invalid = outlineSchema.safeParse({ ...brief, subtitle: "x", positioning: "curto", chapters: [] });
    expect(invalid.success).toBe(false);
  });

  it("preserva as preferências editoriais nos prompts de criação", () => {
    const outline = buildOutlinePrompt(brief);
    const chapter = buildChapterPrompt(brief, { position: 2, title: "Fazer espaço", summary: "Criar uma rotina gentil." });

    expect(outline).toContain(brief.idea);
    expect(outline).toContain("posicionamento editorial");
    expect(chapter).toContain("Fazer espaço");
    expect(chapter).toContain(brief.targetAudience);
  });

  it("inclui a instrução e o texto existente em uma reescrita", () => {
    const prompt = buildRewritePrompt(brief, { title: "Continuar", content: "Texto original do capítulo." }, "Deixe o exemplo mais prático.");
    expect(prompt).toContain("Deixe o exemplo mais prático.");
    expect(prompt).toContain("Texto original do capítulo.");
  });
});
