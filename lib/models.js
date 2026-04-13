// lib/models.js

export const MODEL_HIERARCHY = [
    // TIER 1: O Cérebro Superior (Menos alucinação e segue regras à risca)
    { provider: "openrouter", model: "google/gemini-2.0-flash-exp:free" },
    { provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct:free" },
    
    // TIER 2: O Gigante que você encontrou (Alta capacidade de processamento)
    { provider: "openrouter", model: "openai/gpt-oss-120b:free" },
    
    // TIER 3: Motor Groq (Rápido, mas com Rate Limits agressivos)
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "groq", model: "llama-3.1-8b-instant" },
    
    // TIER 4: Alternativas de Raciocínio (Modelos chineses que estão dominando 2026)
    { provider: "openrouter", model: "deepseek/deepseek-r1:free" },
    { provider: "openrouter", model: "qwen/qwen-2.5-72b-instruct:free" },
  
    // TIER 5: Último Recurso (O que nunca falha, mas é mais simples)
    { provider: "openrouter", model: "meta-llama/llama-3.2-3b-instruct:free" }
  ];