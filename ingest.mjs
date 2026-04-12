import { Pinecone } from '@pinecone-database/pinecone';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

async function run() {
  try {
    const index = pc.index('catalogo-casa'); 
    const text = fs.readFileSync('conhecimento.txt', 'utf8');
    const chunks = text.split('\n\n').filter(c => c.trim().length > 10);
    
    console.log(`🚀 Enviando ${chunks.length} parágrafos para o Pinecone (Modo Integrado)...`);

    for (let i = 0; i < chunks.length; i++) {
      try {
        // No modo integrado, enviamos apenas o ID e o TEXTO. 
        // O Pinecone gera o vetor sozinho lá dentro!
        await index.upsert([{
          id: `id-${i}`,
          metadata: { text: chunks[i] } 
        }]);
        
        console.log(`✅ [${i}/${chunks.length}] Texto enviado!`);
        
        // Aqui não precisa de delay longo, pode ser rápido!
        await new Promise(res => setTimeout(res, 200)); 

      } catch (err) {
        console.error(`❌ Erro no chunk ${i}:`, err.message);
      }
    }
    console.log("⭐ CATÁLOGO CARREGADO COM SUCESSO!");
  } catch (globalErr) {
    console.error("❌ Erro fatal:", globalErr.message);
  }
}

run();