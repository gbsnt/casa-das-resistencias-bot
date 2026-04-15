// Dentro do seu loop de modelos, garanta que a ordem seja essa:
const models = [
  { id: "llama-3.1-8b-instant", provider: "groq" }, // Groq é a mais rápida de todas
  { id: "gemini-1.5-flash", provider: "google" },  // Gemini é a mais estável (grátis)
  { id: "gpt-4o-mini", provider: "openai" }       // GPT é o seu "seguro de vida" (pago)
];