import { NextResponse } from 'next/server';
import { getCatalog } from '@/lib/catalog'; 
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export async function GET() {
  try {
    const databaseId = process.env.NOTION_DATABASE_ID;
    
    // Tenta ler o Notion
    try {
      const response = await notion.databases.query({
        database_id: databaseId,
      });
      
      if (response.results.length > 0) {
        // Se encontrar dados, aqui processaríamos a tabela
        return NextResponse.json({ 
          success: true, 
          source: 'Notion', 
          count: response.results.length 
        });
      }
    } catch (notionError) {
      console.log("Notion ainda não configurado ou sem tabela. Usando banco local.");
    }

    // Se o Notion falhar ou estiver vazio, usa o catálogo local (PDF estruturado)
    const localData = await getCatalog();
    
    return NextResponse.json({ 
      success: true, 
      source: 'Local (Blindado)', 
      count: localData.length,
      message: "Aguardando estrutura de tabela no Notion para migração total."
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}