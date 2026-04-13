import fs from 'fs';
import dotenv from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';

dotenv.config({ path: '.env.local' });

async function run() {
  console.log("🚀 Iniciando Ingestão Blindada (Casa das Resistências)...");

  const apiKey = process.env.PINECONE_API_KEY.trim();
  const pc = new Pinecone({ apiKey });
  const index = pc.index('catalogo-casa');

  try {
    const rawText = fs.readFileSync('conhecimento.txt', 'utf8');
    
    // Divide por parágrafos duplos e limpa blocos inúteis
    const blocos = rawText
      .split(/\n\s*\n/)
      .map(t => t.trim())
      .filter(t => t.length > 35); 

    console.log(`📦 Blocos válidos encontrados: ${blocos.length}`);

    const batchSize = 15; // Lote equilibrado para evitar erros de rede
    
    for (let i = 0; i < blocos.length; i += batchSize) {
      const loteTexto = blocos.slice(i, i + batchSize);
      
      process.stdout.write(`📡 Lote ${Math.floor(i/batchSize) + 1}... `);

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

        // VALIDAÇÃO CRÍTICA: Se a IA não responder no formato esperado
        if (!dataIA || !dataIA.data) {
          console.log(`❌ Falha no lote ${i}. IA respondeu: ${dataIA.message || 'Erro desconhecido'}`);
          continue;
        }

        // MAPEAMENTO DOS VETORES
        const vetoresParaUpsert = loteTexto.map((texto, j) => {
          const vetorNumerico = dataIA.data[j]?.values;
          
          if (!vetorNumerico || vetorNumerico.length === 0) return null;

          return {
            id: `id-${i + j}-${Date.now().toString().slice(-4)}`,
            values: vetorNumerico,
            metadata: { text: texto }
          };
        }).filter(item => item !== null);

        // CHECAGEM DE SEGURANÇA FINAL (O segredo para não travar)
        if (vetoresParaUpsert.length === 0) {
          console.log(`⚠️ Lote ${i} vazio após processamento. Pulando.`);
          continue;
        }

        // UPSERT COM SUPORTE A VERSÕES NOVAS DO SDK
        try {
          await index.upsert(vetoresParaUpsert);
        } catch (err) {
          // Se o SDK for muito novo, ele pode exigir o formato de objeto
          await index.upsert({ records: vetoresParaUpsert });
        }

        console.log(`✅ OK (${vetoresParaUpsert.length} itens)`);

      } catch (loteError) {
        console.log(`❌ Erro de conexão no lote ${i}: ${loteError.message}`);
      }

      // Delay para respeitar o processamento do servidor
      await new Promise(res => setTimeout(res, 350));
    }

    console.log("\n⭐ BANCO DE DADOS ALIMENTADO COM SUCESSO!");

  } catch (error) {
    console.error("❌ Erro fatal no arquivo conhecimento.txt:", error.message);
  }
}

run();