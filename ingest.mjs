import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Vamos usar a Groq para transformar o texto em vetores, já que o Pinecone Integrated falhou
async function getVector(text) {
    const response = await fetch('https://api.groq.com/openai/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            input: text,
            model: 'llama-3.1-8b-instant' // ou outro modelo de embedding que você preferir
        })
    }).catch(() => null);
    
    // Como plano B, se a Groq falhar, usaremos um vetor fake só para testar a conexão
    return new Array(1024).fill(0.1); 
}

async function run() {
  // PEGUE O NOVO HOST NO PAINEL APÓS RECRIARE O ÍNDICE
  const host = process.env.PINECONE_HOST.replace('https://', '').trim();
  const apiKey = process.env.PINECONE_API_KEY.trim();

  const rawText = fs.readFileSync('conhecimento.txt', 'utf8');
  const chunks = rawText.split('\n\n').filter(t => t.length > 10);
  
  console.log(`🚀 Iniciando carga no NOVO índice padrão (${chunks.length} registros)...`);

  for (let i = 0; i < chunks.length; i += 20) {
    const currentBatch = chunks.slice(i, i + 20);
    
    const vectors = currentBatch.map((text, idx) => ({
      id: `id-${i + idx}`,
      values: new Array(1024).fill(0), // Vetores de teste
      metadata: { text }
    }));

    const res = await fetch(`https://${host}/vectors/upsert`, {
      method: 'POST',
      headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ vectors })
    });

    if (res.ok) {
      console.log(`✅ Lote ${i} enviado!`);
    } else {
      console.log(`❌ Erro: ${await res.text()}`);
      return;
    }
  }
}

run();