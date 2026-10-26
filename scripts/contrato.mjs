// Regenera `src/contrato/gen/` con `buf generate` desde el `proto/` del motor. Por defecto, desde el checkout hermano (`../BronzeAgeFase0` en el PC
// del autor, `../BronzeAge` en la nube); con `MOTOR_REV=<hash>`, desde GitHub a esa revisión (necesita las credenciales de git de la máquina).
// La revisión con la que se generó lo que hay en el repositorio está en `src/contrato/REVISION`.
import { execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rev = process.env.MOTOR_REV;
let origen, revision;
if (rev) {
  origen = `https://github.com/VRhino/BronzeAge.git#ref=${rev},subdir=proto`;
  revision = rev;
} else {
  const motor = process.env.MOTOR ?? ['../BronzeAgeFase0', '../BronzeAge'].map((p) => resolve(p)).find((p) => existsSync(p));
  if (!motor) throw new Error('no encuentro el motor: pon MOTOR=<carpeta> o MOTOR_REV=<hash>');
  origen = resolve(motor, 'proto');
  revision = execSync('git rev-parse --short HEAD', { cwd: motor }).toString().trim();
}
execSync(`npx buf generate "${origen}" --template buf.gen.yaml`, { stdio: 'inherit' });
writeFileSync('src/contrato/REVISION', `${revision}\n`);
console.log(`contrato generado desde ${revision}`);
