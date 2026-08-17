import { describe, expect, it } from "vitest";
import { buildChapterPrompt, buildDiscoveryPrompt, buildOutlinePrompt, buildRewritePrompt, discoverySchema, outlineSchema } from "./ebookRules";

const brief = {
  title: "Escrever sem Pressa",
  idea: "Um guia para pessoas criativas construírem uma rotina de escrita sustentável.",
  genre: "Desenvolvimento pessoal",
  tone: "Clareza e proximidade",
  targetAudience: "Pessoas criativas",
  objective: "Ajudar autores iniciantes a construir uma prática de escrita constante.",
  referenceNotes: "Usar exemplos acolhedores e aplicáveis à rotina brasileira.",
  discoveryAnalysis: null,
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

  it("aceita resumos editoriais extensos nos capítulos sugeridos", () => {
    const result = outlineSchema.safeParse({
      title: "Livro de teste",
      subtitle: "Subtítulo de teste",
      positioning: "Uma proposta editorial suficientemente longa para validar o posicionamento do projeto.",
      genre: "Ideias cristãs",
      tone: "Acolhedor",
      targetAudience: "Leitores interessados em fé e prática cotidiana.",
      chapters: [
        { title: "Capítulo 1", summary: "Resumo detalhado. ".repeat(180) },
        { title: "Capítulo 2", summary: "Resumo detalhado. ".repeat(180) },
        { title: "Capítulo 3", summary: "Resumo detalhado. ".repeat(180) },
      ],
    });
    expect(result.success).toBe(true);
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

  it("estrutura a descoberta de uma ideia extensa para texto e imagens", () => {
    const prompt = buildDiscoveryPrompt({ ...brief, visualStyle: "Aquarela delicada" });
    expect(prompt).toContain(brief.referenceNotes);
    expect(prompt).toContain("ESTILO VISUAL DESEJADO");

    const analysis = discoverySchema.safeParse({
      editorialSummary: "Um livro devocional acolhedor para fortalecer a rotina de fé com leituras curtas e práticas.",
      refinedIdea: "Criar um devocional cristão de trinta dias para adultos que desejam estabelecer uma rotina de oração e reflexão bíblica, com linguagem simples e exercícios aplicáveis.",
      suggestedAudience: "Adultos cristãos que buscam constância espiritual no cotidiano.",
      suggestedTone: "Acolhedor, bíblico e prático",
      suggestedVisualStyle: "Aquarela delicada com luz suave e elementos naturais",
      intentions: ["Ajudar o leitor a construir uma rotina de oração possível.", "Apresentar reflexões bíblicas com aplicação cotidiana."],
      themes: ["oração", "constância", "fé no cotidiano"],
      titleSuggestions: [
        { title: "Trinta Dias de Presença", subtitle: "Um devocional para cultivar fé no cotidiano", rationale: "Une prazo claro, promessa espiritual e leitura acessível." },
        { title: "Pausa para a Fé", subtitle: "Reflexões simples para todos os dias", rationale: "É memorável e comunica leveza." },
        { title: "Caminho de Oração", subtitle: "Um encontro diário com Deus", rationale: "Conecta oração, prática e espiritualidade." },
      ],
      structureSuggestions: [
        { title: "Começar com presença", purpose: "Apresentar a proposta e preparar uma rotina breve de leitura." },
        { title: "Cultivar constância", purpose: "Explorar pequenos hábitos de oração e reflexão aplicáveis." },
        { title: "Levar a fé adiante", purpose: "Convidar o leitor a continuar a prática após o livro." },
      ],
      coverDirections: ["Caminho claro ao amanhecer com Bíblia aberta e luz suave.", "Mesa de madeira clara com caderno de oração e ramos discretos."],
      illustrationDirections: ["Mãos segurando uma Bíblia com luz matinal suave.", "Janela iluminada e mesa simples de oração."],
      keywords: ["devocional cristão", "oração diária", "fé no cotidiano"],
    });
    expect(analysis.success).toBe(true);
  });

  it("preserva briefings longos ao preparar a leitura editorial", () => {
    const longIdea = "Contexto pastoral, público, objetivo e referências do projeto. ".repeat(450);
    const prompt = buildDiscoveryPrompt({ ...brief, idea: longIdea, objective: longIdea, referenceNotes: longIdea });
    expect(prompt).toContain(longIdea);
    expect(prompt.length).toBeGreaterThan(20000);
  });
});
