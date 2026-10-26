// Dónde está el checkout del motor: `MOTOR` o, por defecto, la carpeta hermana del PC del autor (`../BronzeAgeFase0`) o la de la nube (`../BronzeAge`).
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const MOTOR = process.env.MOTOR ?? ['../BronzeAgeFase0', '../BronzeAge'].map((p) => resolve(p)).find((p) => existsSync(p)) ?? '';
