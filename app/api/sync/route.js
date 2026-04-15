import { NextResponse } from 'next/server';
import { getCatalog } from '@/lib/catalog';

export async function GET() {
  try {
    // Puxa o banco de dados oficial e conta quantos produtos existem
    const dados = await getCatalog(); 
    
    // Retorna o sucesso para o botão do painel ficar verde
    return NextResponse.json({ success: true, count: dados.length });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}