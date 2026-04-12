import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function listarModelos() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log("🔍 Perguntando ao Google quais modelos estão liberados...\n");

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();

    if (data.models) {
      console.log("✅ MODELOS DE EMBEDDING ENCONTRADOS:");
      const embeddings = data.models.filter(m => m.supportedGenerationMethods.includes("embedContent"));
      
      if (embeddings.length === 0) {
        console.log("❌ O Google NÃO liberou nenhum modelo de embedding para essa chave!");
      } else {
        embeddings.forEach(m => console.log(`👉 Nome exato: ${m.name.replace('models/', '')}`));
      }
    } else {
      console.log("Erro ao ler os modelos:", data);
    }
  } catch (error) {
    console.error("Erro na conexão:", error);
  }
}

listarModelos();