import { NextResponse } from 'next/server';
import os from 'os';

// O nome da função DEVE ser GET em maiúsculo para o Next.js aceitar
export async function GET() {
  try {
    // Cálculo de CPU para Mac (Apple Silicon)
    const cpus = os.cpus();
    const load = os.loadavg(); // Média de carga
    const cpuUsage = Math.min((load[0] * 100) / cpus.length, 100).toFixed(1);
    
    // Cálculo de RAM
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = (((totalMem - freeMem) / totalMem) * 100).toFixed(1);

    return NextResponse.json({ 
      cpu: parseFloat(cpuUsage), 
      ram: parseFloat(usedMem) 
    });
  } catch (error) {
    console.error("Erro no sensor de hardware:", error);
    return NextResponse.json({ cpu: 0, ram: 0 }, { status: 500 });
  }
}