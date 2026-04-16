import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';
import { getCatalog } from '@/lib/catalog';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req) {
  try {
    const { messages, productName } = await req.json();

    // --------------------------------------------------------
    // 🕵️‍♂️ MONITORAMENTO DE TERMINAL (LOGS VISUAIS)
    // --------------------------------------------------------
    console.log("\n==================================================");
    console.log(`💬 CHAT ATIVO | PRODUTO: ${productName || 'Não especificado'}`);
    console.log("--------------------------------------------------");
    
    // Imprime o histórico atual recebido do cliente
    messages.forEach((msg) => {
      const roleName = msg.role === 'user' ? '🧑 CLIENTE' : '🤖 IA VENDEDOR';
      console.log(`${roleName}: ${msg.content}`);
    });
    console.log("⏳ Aguardando resposta da IA...");
    // --------------------------------------------------------

    // Buscamos a ficha técnica do produto para dar contexto à IA
    const catalog = await getCatalog();
    const productInfo = catalog.find(p => p.metadata?.nome === productName);
    const fichaTecnica = productInfo ? productInfo.content : "Ficha não encontrada.";

    // O "Cérebro" do Vendedor (ATUALIZADO COM LEITURA DINÂMICA E BOTÕES)
    const systemPrompt = `
      Você é o Engenheiro de Vendas Sênior da Casa das Resistências.
      Você está atendendo um cliente interessado em: "${productName}".

      FICHA TÉCNICA DO PRODUTO:
      ${fichaTecnica}

      SUA MISSÃO - LEITURA DINÂMICA DE PROJETO:
      1. ANALISE A GEOMETRIA: Leia a Ficha Técnica acima e descubra quais são as medidas estruturais OBRIGATÓRIAS para fabricar este modelo (Ex: Flange precisa do tamanho ANSI; Coleira precisa de Diâmetro e Largura; Imersão precisa do Comprimento Útil; Cartucho precisa de Diâmetro exato).
      2. VARIÁVEIS ELÉTRICAS: Todo orçamento também exige Potência (W), Tensão (V) e Quantidade.
      3. CONDUZA PASSO A PASSO: Não faça um questionário gigante. Faça 1 ou no máximo 2 perguntas por vez para guiar o cliente.
      4. BOTÕES INTELIGENTES: Sempre termine sua resposta oferecendo opções clicáveis baseadas nas medidas/tensões mais comuns encontradas na ficha técnica, para facilitar a vida do cliente.

      FORMATO OBRIGATÓRIO DOS BOTÕES (Use colchetes ao final do texto):
      [OPCOES: Opção 1, Opção 2, Opção 3, Falar com Atendente]

      EXEMPLOS DE ATUAÇÃO DINÂMICA:
      - Se for Coleira: "Para dimensionarmos sua coleira, qual é o Diâmetro Interno e a Largura em milímetros?" [OPCOES: 50x50mm, 100x80mm, Outra medida]
      - Se for Tensão: "Perfeito. E qual será a tensão de ligação na máquina?" [OPCOES: 220V, 380V, 440V]

      REGRAS EXTRAS:
      - Seja um consultor técnico, educado e direto.
      - Nunca invente preços. O preço depende do projeto e será enviado pelo setor de orçamentos no WhatsApp.
    `;

    // Monta a conversa completa para enviar à Groq
    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    // Chama o Llama 3
    const chatCompletion = await groq.chat.completions.create({
      messages: groqMessages,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3, // Temperatura baixa para o vendedor focar nas especificações e não inventar
      max_tokens: 500,
    });

    const responseContent = chatCompletion.choices[0].message.content;

    // --------------------------------------------------------
    // 🕵️‍♂️ MONITORAMENTO: IMPRIME A RESPOSTA DA IA NO TERMINAL
    // --------------------------------------------------------
    console.log(`🤖 IA VENDEDOR: ${responseContent}`);
    console.log("==================================================\n");
    // --------------------------------------------------------

    return NextResponse.json({ content: responseContent });

  } catch (error) {
    console.error("\n❌ ERRO CRÍTICO NO CHAT:", error.message, "\n");
    return NextResponse.json(
      { content: "Desculpe, nosso sistema de atendimento está reiniciando. Por favor, tente novamente em alguns segundos." }, 
      { status: 500 }
    );
  }
}