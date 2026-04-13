// Arquivo: lib/models.js (ou utils/models.js)

// Modelos gratuitos e rápidos da Groq (Motor Principal)
export const GROQ_MODELS = [
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile", // Um modelo maior da Groq caso o de 8B falhe
  ];
  
  // Modelos gratuitos do OpenRouter (Nossa Cascata de Sobrevivência)
  // Organizados do mais rápido/inteligente para o mais básico.
  export const OPENROUTER_MODELS = [
    "google/gemini-2.0-flash-lite-preview-02-05:free", // Muito rápido e estável
    "arcee-ai/trinity-large-preview:free",             // Ótimo raciocínio técnico
    "openai/gpt-oss-120b:free",                        // Gigante e confiável
    "meta-llama/llama-3.2-3b-instruct:free"            // O "tratorzinho" que nunca cai
  ];