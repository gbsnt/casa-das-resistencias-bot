import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function setup() {
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

  try {
    console.log("🗑️ Apagando o banco antigo de 768 dimensões...");
    await pc.deleteIndex('catalogo-casa');
    console.log("⏳ Aguardando 10 segundos para a nuvem processar a exclusão...");
    await new Promise(res => setTimeout(res, 10000));
  } catch (error) {
    // Ignora se o índice não existir
  }

  console.log("🔨 Construindo banco de 1024 dimensões (Padrão Multilingual E5)...");
  await pc.createIndex({
    name: 'catalogo-casa',
    dimension: 1024,
    metric: 'cosine',
    spec: {
      serverless: { cloud: 'aws', region: 'us-east-1' }
    }
  });

  console.log("✅ SUCESSO! Gaveteiro novo criado.");
}

setup();