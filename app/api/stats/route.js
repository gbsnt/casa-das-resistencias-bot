import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
  try {
    const cpus = os.cpus();
    const load = os.loadavg();
    // Cálculo de CPU otimizado para o Node no Mac
    const cpuLoad = Math.min((load[0] * 100) / cpus.length, 100).toFixed(1);
    
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = (((totalMem - freeMem) / totalMem) * 100).toFixed(1);

    return NextResponse.json({ 
      cpu: parseFloat(cpuLoad), 
      ram: parseFloat(usedMem) 
    });
  } catch (error) {
    return NextResponse.json({ cpu: 0, ram: 0 }, { status: 500 });
  }
}