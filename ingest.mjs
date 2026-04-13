import fs from 'fs';
import dotenv from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';

dotenv.config({ path: '.env.local' });

// Função profissional para criar "Chunks" (pedaços) perfeitos para a IA
function criarChunks(texto, maxCaracteres = 1200) {
  // Normaliza qualquer tipo de quebra de linha (Mac, Windows, Linux)
  const textoLimpo = texto.replace(/\r\n|\r/g, '\n');
  const paragrafos = textoLimpo.split(/\n+/).map(p => p.trim()).filter(p => p.length > 20);
  
  const chunks = [];
  let chunkAtual = "";

  for (const paragrafo of paragrafos) {
    // Se adicionar o próximo parágrafo estourar o limite, salva o atual e começa um novo
    if ((chunkAtual.length + paragrafo.length) > maxCaracteres) {
      if (chunkAtual.length > 0) {
        chunks.push(chunkAtual);
        chunkAtual = "";
      }
    }
    chunkAtual += (chunkAtual ? "\n" : "") + paragrafo;
  }
  if (chunkAtual.length > 0) chunks.push(chunkAtual);
  
  return chunks;
}

async function run() {
  console.log("🚀 Iniciando Ingestão com Chunker Profissional (Casa das Resistências)...");

  const apiKey = process.env.PINECONE_API_KEY.trim();
  const pc = new Pinecone({ apiKey });
  const index = pc.index('catalogo-casa');

  try {
    const rawText = fs.readFileSync('conhecimento.txt', 'utf8');
    
    // Passa o texto pelo nosso novo fatiador
    const blocosSeguros = criarChunks(rawText, 1200);

    console.log(`📦 Blocos perfeitos gerados: ${blocosSeguros.length}`);

    const batchSize = 10; // Reduzido para 10 para garantir estabilidade máxima
    
    for (let i = 0; i < blocosSeguros.length; i += batchSize) {
      const loteTexto = blocosSeguros.slice(i, i + batchSize);
      
      process.stdout.write(`📡 Lote ${Math.floor(i/batchSize) + 1} de ${Math.ceil(blocosSeguros.length/batchSize)}... `);

      try {
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
            inputs: loteTexto.map(t => ({ text: t }))
          })
        });

        const dataIA = await resIA.json();

        if (!dataIA || !dataIA.data) {
          console.log(`❌ Falha no lote. IA respondeu: ${dataIA.message || 'Erro desconhecido'}`);
          continue;
        }

        const vetoresParaUpsert = loteTexto.map((texto, j) => {
          const vetorNumerico = dataIA.data[j]?.values;
          if (!vetorNumerico || vetorNumerico.length === 0) return null;

          return {
            id: `cr-${i + j}-${Date.now().toString().slice(-4)}`,
            values: vetorNumerico,
            metadata: { text: texto }
          };
        }).filter(item => item !== null);

        if (vetoresParaUpsert.length === 0) {
          console.log(`⚠️ Lote vazio após processamento. Pulando.`);
          continue;
        }

        try {
          await index.upsert(vetoresParaUpsert);
        } catch (err) {
          await index.upsert({ records: vetoresParaUpsert });
        }

        console.log(`✅ OK (${vetoresParaUpsert.length} itens)`);

      } catch (loteError) {
        console.log(`❌ Erro de conexão: ${loteError.message}`);
      }

      await new Promise(res => setTimeout(res, 350));
    }

    console.log("\n⭐ BANCO DE DADOS ALIMENTADO COM SUCESSO! O RAG ESTÁ PERFEITO!");

  } catch (error) {
    console.error("❌ Erro fatal no arquivo conhecimento.txt:", error.message);
  }
}

run();