export const MODEL_HIERARCHY = [
  // 1º TENTATIVA: O modelo leve da Groq (Limite Grátis Gigante)
  { model: "llama-3.1-8b-instant", provider: "groq" }, 
  
  // 2º TENTATIVA: O nome universal do Google (caso o 1º falhe)
  { model: "gemini-pro", provider: "google" },         
  
  // 3º TENTATIVA: A nossa Ferrari sem gasolina
  { model: "gpt-4o-mini", provider: "openai" }         
];