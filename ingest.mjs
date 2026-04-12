import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  const index = pc.index('catalogo-resistencias');
  const text = fs.readFileSync('conhecimento.txt', 'utf8');
  
  const chunks = text.split('\n\n').filter(c => c.trim().length > 10);
  console.log(`🚀 Processando ${chunks.length} parágrafos...`);

  for (let i = 0; i < chunks.length; i++) {
    try {
      const result = await model.embedContent(chunks[i]);
      
      // Extração correta baseada no seu Raio-X
      const embedding = result.embedding.values;

      if (!embedding || embedding.length === 0) {
        console.log(`⚠️ Chunk ${i} ignorado: Sem vetores.`);
        continue;
      }

      // IMPORTANTE: Garantir que enviamos apenas o array de números puro
      await index.upsert([{
        id: `chunk-${i}`,
        values: Array.from(embedding), 
        metadata: { text: chunks[i] }
      }]);
      
      console.log(`✅ Chunk ${i} enviado!`);
      await delay(1500); // Pausa de segurança

    } catch (err) {
      console.error(`❌ Erro no chunk ${i}:`, err.message);
      if (err.message.includes('429')) await delay(10000);
    }
  }
  console.log("⭐ Catálogo indexado com sucesso!");
}

run();