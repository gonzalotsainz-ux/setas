// Compara la lluvia prevista por varios modelos (Previous Runs API de Open-Meteo, previsiones hechas 1–4 días antes)
// con la medida en las estaciones AEMET de data/zonas.json. Uso: node scripts/comparar-modelos.mjs ecmwf_ifs,icon_seamless,gfs_seamless
// Cambia desde/hasta abajo; AEMET publica con ~3 días de retraso y la función aemet admite ≤30 días hacia atrás.
import { readFileSync } from 'node:fs';
const ANON = readFileSync('js/config.js','utf8').match(/SUPABASE_ANON = '([^']+)'/)[1];
const zonas = JSON.parse(readFileSync('data/zonas.json','utf8')).zonas;
const est = new Map(); for (const z of zonas) for (const e of z.estacionesAemet) est.set(e.id, e);
const ids=[...est.keys()]; const desde='2026-09-05', hasta='2026-09-27';
const obs={};
for (let i=0;i<ids.length;i+=6){ const q=new URLSearchParams({estaciones:ids.slice(i,i+6).join(','),desde,hasta});
  const r=await fetch('https://ctgedeunquvmcfqsufjj.supabase.co/functions/v1/aemet?'+q,{headers:{apikey:ANON}}); Object.assign(obs, await r.json()); }
const MOD=process.argv[2].split(','), LEADS=[1,2,3,4];
const lat=ids.map(i=>est.get(i).lat).join(','), lon=ids.map(i=>est.get(i).lon).join(','), elev=ids.map(i=>est.get(i).altitud).join(',');
const vars=LEADS.map(l=>'precipitation_previous_day'+l).join(',');
const u=`https://previous-runs-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&elevation=${elev}&hourly=${vars}&models=${MOD.join(',')}&start_date=${desde}&end_date=${hasta}&timezone=Europe%2FMadrid`;
const j=await (await fetch(u)).json(); if(!Array.isArray(j)){console.log(JSON.stringify(j).slice(0,300));process.exit(1);}
let totObs=0;
const st={}; for(const m of MOD) for(const l of LEADS) st[m+'|'+l]={ae:0,n:0,so:0,sm:0,fa:0,mi:0};
j.forEach((loc,k)=>{const o=obs[ids[k]]||{}; const dia={};
 loc.hourly.time.forEach((t,h)=>{const d=t.slice(0,10); for(const m of MOD) for(const l of LEADS){const v=loc.hourly[`precipitation_previous_day${l}_${m}`]?.[h]; const key=m+'|'+l+'|'+d; if(v==null){dia[key]=dia[key]??NaN; dia[key]=NaN; } else if(!Number.isNaN(dia[key])) dia[key]=(dia[key]??0)+v;}});
 for(const [key,v] of Object.entries(dia)){ if(Number.isNaN(v)) continue; const [m,l,d]=key.split('|'); const ob=o[d]; if(ob==null) continue; const s=st[m+'|'+l]; s.ae+=Math.abs(v-ob); s.n++; s.so+=ob; s.sm+=v; if(v>=1&&ob<1) s.fa++; if(v<1&&ob>=1) s.mi++; }
});
console.log('modelo'.padEnd(24),'antelación  n   MAE   modelo/real  falsas alarmas  lluvias no vistas');
for(const m of MOD) for(const l of LEADS){const s=st[m+'|'+l]; if(!s.n){console.log(m.padEnd(24),`+${l}d   sin datos`);continue;} console.log(m.padEnd(24),`+${l}d`.padEnd(10),String(s.n).padEnd(4),(s.ae/s.n).toFixed(2).padEnd(6),(s.sm/s.so).toFixed(2).padEnd(13),String(s.fa).padEnd(15),s.mi);}
