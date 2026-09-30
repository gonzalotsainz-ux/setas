import { copyFileSync, chmodSync } from 'node:fs';
copyFileSync('scripts/pre-push', '.git/hooks/pre-push');
chmodSync('.git/hooks/pre-push', 0o755);
console.log('Gancho pre-push instalado.');
