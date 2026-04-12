import fs from 'fs';
import dotenv from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';

dotenv.config({ path: '.env.local' });

async function run() {
  console.log("🚀 Iniciando a Indexação (Blindagem Tripla de Upsert)...");

  const apiKey = process.env.PINECONE_API_KEY.trim();
  const pc = new Pinecone({ apiKey });
  const index = pc.index('catalogo-casa');

  try {
    const rawText = fs.readFileSync('conhecimento.txt', 'utf8');
    const blocos = rawText.split('\n\n').map(t => t.trim()).filter(t => t.length > 10);
    console.log(`📦 Catálogo lido com sucesso: ${blocos.length} parágrafos.`);

    const batchSize = 10; 
    
    for (let i = 0; i < blocos.length; i += batchSize) {
      const loteAtual = blocos.slice(i, i + batchSize);

      const resIA = await fetch('https://api.pinecone.io/embed', {
        method: 'POST',
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json',
          'X-Pinecone-API-Version': '2024-07'
        },
        body: JSON.stringify({
          model: 'multilingual-e5-large',
          parameters: { input_type: 'passage', truncate: 'END' },
          inputs: loteAtual.map(t => ({ text: t }))
        })
      });

      const dataIA = await resIA.json();

      if (!dataIA.data) {
        console.error(`❌ Erro no servidor da IA (Lote ${i}):`, dataIA);
        return;
      }

      const vetoresParaPinecone = loteAtual.map((texto, j) => {
        const itemRetornado = dataIA.data[j];
        const vetorNumerico = itemRetornado.values || itemRetornado.embedding || (Array.isArray(itemRetornado) ? itemRetornado : []);

        return {
          id: `item-${i + j}`,
          values: vetorNumerico,
          metadata: { text: texto }
        };
      }).filter(item => Array.isArray(item.values) && item.values.length > 0);

      if (vetoresParaPinecone.length === 0) {
        console.error("\n❌ ERRO: A IA processou, mas não achamos os números.");
        return;
      }

      // A MÁGICA: O código agora força a barra testando os 3 formatos que a Pinecone aceita
      try {
        await index.upsert(vetoresParaPinecone);
      } catch (err) {
        if (err.message && err.message.includes('1 record to upsert')) {
          try {
            await index.upsert({ records: vetoresParaPinecone }); // Formato V4+
          } catch (err2) {
            await index.upsert({ vectors: vetoresParaPinecone }); // Formato V1/V2
          }
        } else {
          throw err;
        }
      }

      console.log(`✅ Lote enviado: ${i} a ${i + loteAtual.length - 1}`);
      
      await new Promise(res => setTimeout(res, 500));
    }

    console.log("\n⭐ INDEXAÇÃO CONCLUÍDA! O CÉREBRO RAG ESTÁ 100% PRONTO!");

  } catch (error) {
    console.error("❌ Erro fatal:", error.message || error);
  }
}

run();