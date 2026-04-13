// Arquivo: lib/models.js

// Esta é a lista unificada que o seu route.js está tentando importar
export const MODEL_HIERARCHY = [
    // TIER 1: O Cérebro Superior (Menos alucinação)
    { provider: "openrouter", model: "google/gemini-2.0-flash-lite-preview-02-05:free" },
    
    // TIER 2: Os Inteligentes Rápidos
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "openrouter", model: "arcee-ai/trinity-large-preview:free" },
    
    // TIER 3: Velocidade Pura
    { provider: "groq", model: "llama-3.1-8b-instant" },
    { provider: "openrouter", model: "openai/gpt-oss-120b:free" },
  
    // TIER 4: Sobrevivência
    { provider: "openrouter", model: "meta-llama/llama-3.2-3b-instruct:free" }
  ];