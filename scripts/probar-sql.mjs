// Pruebas de la base de datos en un Postgres desechable (Docker) que imita a Supabase.
// Uso: npm run probar:sql [-- filtro]   (filtro: parte del nombre del fichero de prueba)
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { setTimeout as espera } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONT = 'setas-sql-test';
const IMAGEN = 'postgres:17-alpine';

const docker = (args, input) => spawnSync('docker', args, { input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const psql = (bd, sql) => docker(['exec', '-i', CONT, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', bd], sql);
const leer = (ruta) => readFileSync(path.join(RAIZ, ruta), 'utf8');
const lista = (dir) => (existsSync(path.join(RAIZ, dir)) ? readdirSync(path.join(RAIZ, dir)).sort().map((f) => `${dir}/${f}`) : []);

// La migración original (con las políticas abiertas), las de cuentas/grupos/compartir y las pendientes. (Las demás migraciones del proyecto necesitan extensiones de Supabase que este entorno no tiene.)
const migraciones = () => [
  'supabase/migrations/20261001000000_setas.sql',
  ...lista('supabase/migrations').filter((f) => /_(cuentas|grupos|compartir)\.sql$/.test(f)),
  ...lista('supabase/pendientes'),
];

const filtro = process.argv[2];
if (docker(['info']).status !== 0) {
  console.error('Docker no está en marcha: abre Docker Desktop y vuelve a probar.');
  process.exit(2);
}
docker(['rm', '-f', CONT]);
const arranque = docker(['run', '-d', '--rm', '--name', CONT, '-e', 'POSTGRES_PASSWORD=x', IMAGEN]);
if (arranque.status !== 0) { console.error(arranque.stderr); process.exit(2); }

try {
  for (let i = 0; i < 90; i++) {   // la imagen reinicia el servidor tras inicializarse: hay que esperar dos «ready»
    const log = docker(['logs', CONT]);
    if (((`${log.stdout}${log.stderr}`).match(/ready to accept connections/g) ?? []).length >= 2) break;
    await espera(1000);
  }
  const crear = psql('postgres', 'create database plantilla');
  if (crear.status !== 0) throw new Error(`No se pudo crear la plantilla: ${crear.stderr}`);
  for (const f of ['tests/sql/arranque.sql', ...migraciones()]) {
    const p = psql('plantilla', leer(f));
    if (p.status !== 0) throw new Error(`${f}:\n${p.stderr}`);
  }
  let fallos = 0, total = 0;
  const pruebas = readdirSync(path.join(RAIZ, 'tests/sql')).filter((n) => n.endsWith('.test.sql') && (!filtro || n.includes(filtro))).sort();
  for (const f of pruebas) {
    total++;
    const bd = `t_${f.replace(/\W/g, '_')}`;
    const c = psql('postgres', `create database ${bd} template plantilla`);
    if (c.status !== 0) throw new Error(`No se pudo crear ${bd}: ${c.stderr}`);
    const p = psql(bd, leer(`tests/sql/${f}`));
    if (p.status === 0) console.log(`✔ ${f}`);
    else { fallos++; console.log(`✘ ${f}\n${p.stderr}`); }
  }
  console.log(`\n${total - fallos}/${total} ficheros de prueba SQL correctos`);
  process.exitCode = fallos || !total ? 1 : 0;
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  docker(['rm', '-f', CONT]);
}
