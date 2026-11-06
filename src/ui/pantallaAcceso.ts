// Pantalla de acceso (Víctor, 2026-11-06): dos formularios de verdad, «Entrar» y «Crear cuenta», en vez de una casilla «No tengo cuenta» en el
// de login. El de registro comprueba antes de mandar lo mismo que el motor (`crates/acceso`, `validar`): nick de 3 a 32 caracteres (letras,
// cifras, «_», «-» o «.»), contraseña de 8 a 128 y repetida igual. Lo que rechaza el servidor va junto al campo que toca (nick repetido →
// nick; código que no coincide → código) y lo escrito no se pierde. Si la cuenta se crea pero el login de después falla, se pasa a «Entrar»
// con el nick puesto y un aviso, no se vuelve al principio.
/** El estado HTTP de un `ApiError` de `apiCliente.ts` (sin importarlo: esta pantalla no arrastra la sesión). */
const estadoDe = (err: unknown): number | undefined => {
  const s = err instanceof Error ? (err as Error & { status?: unknown }).status : undefined;
  return typeof s === 'number' ? s : undefined;
};

export interface AccionesAcceso {
  /** `POST /v1/registro`. */
  registrar: (nick: string, clave: string, codigo?: string) => Promise<void>;
  /** `POST /v1/sesiones` y lo que haga falta para seguir (guardar la sesión, enrutar). */
  entrar: (nick: string, clave: string) => Promise<void>;
  mensajeError: (err: unknown) => string;
  escapar: (s: string) => string;
}

type Modo = 'entrar' | 'registro';
type Campo = 'nick' | 'clave' | 'repetir' | 'codigo';

interface Estado {
  modo: Modo;
  nick: string;
  codigo: string;
  /** Pedir el código de invitación: se abre solo si el servidor dice que no coincide (o si lo abre el jugador). */
  conCodigo: boolean;
  enviando: boolean;
  aviso: string;
  error: string;
  errores: Partial<Record<Campo, string>>;
}

const NICK = /^[\p{L}\p{N}_.-]{3,32}$/u;

/** Las comprobaciones del motor, en el cliente. */
export function validarRegistro(nick: string, clave: string, repetir: string): Partial<Record<Campo, string>> {
  const e: Partial<Record<Campo, string>> = {};
  const n = nick.trim();
  if (!n) e.nick = 'Escribe un nick.';
  else if ([...n].length < 3 || [...n].length > 32) e.nick = 'El nick tiene de 3 a 32 caracteres.';
  else if (!NICK.test(n)) e.nick = 'Solo letras, cifras, «_», «-» o «.» (sin espacios).';
  const largo = [...clave].length;
  if (!clave) e.clave = 'Escribe una contraseña.';
  else if (largo < 8) e.clave = `Al menos 8 caracteres (llevas ${largo}).`;
  else if (largo > 128) e.clave = 'Como mucho 128 caracteres.';
  if (!e.clave && repetir !== clave) e.repetir = 'No coincide con la contraseña.';
  return e;
}

const primeraMayuscula = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

export function montarAcceso(app: HTMLElement, a: AccionesAcceso, inicial: { nick?: string; error?: string } = {}): void {
  const e = a.escapar;
  const st: Estado = { modo: 'entrar', nick: inicial.nick ?? '', codigo: '', conCodigo: false, enviando: false, aviso: '', error: inicial.error ?? '', errores: {} };

  const campo = (id: string, c: Campo, etiqueta: string, input: string, ayuda = ''): string => `
    <div class="form-group${st.errores[c] ? ' con-error' : ''}">
      <label class="form-label" for="${id}">${etiqueta}</label>${input}
      ${st.errores[c] ? `<small class="form-error" id="${id}-error">${e(st.errores[c]!)}</small>` : ayuda ? `<small class="form-ayuda">${ayuda}</small>` : ''}
    </div>`;

  const pintar = (foco?: string): void => {
    const registro = st.modo === 'registro';
    const pestana = (m: Modo, texto: string): string =>
      `<button type="button" class="acceso-pestana${st.modo === m ? ' activa' : ''}" data-acceso-modo="${m}" aria-pressed="${st.modo === m}">${texto}</button>`;
    const formulario = registro
      ? `<form id="form-registro" novalidate>
          ${campo('reg-nick', 'nick', 'Nick', `<input type="text" id="reg-nick" class="form-input" value="${e(st.nick)}" autocomplete="username" maxlength="32" spellcheck="false" />`, 'De 3 a 32 caracteres: letras, cifras, «_», «-» o «.». Es el nombre de tu cuenta, no el de tu héroe.')}
          ${campo('reg-clave', 'clave', 'Contraseña', '<input type="password" id="reg-clave" class="form-input" autocomplete="new-password" maxlength="128" />', 'Al menos 8 caracteres.')}
          ${campo('reg-repetir', 'repetir', 'Repite la contraseña', '<input type="password" id="reg-repetir" class="form-input" autocomplete="new-password" maxlength="128" />')}
          ${st.conCodigo
            ? campo('reg-codigo', 'codigo', 'Código de invitación', `<input type="text" id="reg-codigo" class="form-input" value="${e(st.codigo)}" autocomplete="off" spellcheck="false" />`, 'Te lo da quien lleva el servidor.')
            : '<button type="button" class="text-link acceso-con-codigo" data-acceso-codigo>Tengo un código de invitación</button>'}
          <button type="submit" class="btn-primary"${st.enviando ? ' disabled' : ''}>${st.enviando ? 'Creando la cuenta…' : 'Crear cuenta'}</button>
        </form>`
      : `<form id="form-entrar" novalidate>
          ${campo('input-usuario', 'nick', 'Nick', `<input type="text" id="input-usuario" class="form-input" value="${e(st.nick)}" autocomplete="username" spellcheck="false" />`)}
          ${campo('input-clave', 'clave', 'Contraseña', '<input type="password" id="input-clave" class="form-input" autocomplete="current-password" />')}
          <button type="submit" id="btn-login-submit" class="btn-primary"${st.enviando ? ' disabled' : ''}>${st.enviando ? 'Entrando…' : 'Entrar'}</button>
        </form>`;
    // Las contraseñas no van en el HTML: se guardan del formulario de antes y se vuelven a poner, salvo la del campo que tiene el error.
    const claves = new Map<string, string>();
    app.querySelectorAll<HTMLInputElement>('.acceso-card input[type=password]').forEach((i) => claves.set(i.id, i.value));
    app.innerHTML = `<div class="login-container"><div class="login-card acceso-card">
      <div class="login-header"><h1 class="login-title">Bronze Age Collapse</h1><p class="login-subtitle">${registro ? 'Crea tu cuenta para jugar' : 'Entra con tu cuenta'}</p></div>
      <div class="acceso-pestanas" role="group">${pestana('entrar', 'Entrar')}${pestana('registro', 'Crear cuenta')}</div>
      ${st.aviso ? `<div class="acceso-aviso">${e(st.aviso)}</div>` : ''}
      ${st.error ? `<div class="error-banner" role="alert">⚠️ ${e(st.error)}</div>` : ''}
      ${formulario}
    </div></div>`;
    const campoDe: Record<string, Campo> = { 'reg-clave': 'clave', 'reg-repetir': 'repetir', 'input-clave': 'clave' };
    app.querySelectorAll<HTMLInputElement>('.acceso-card input[type=password]').forEach((i) => {
      if (claves.has(i.id) && !st.errores[campoDe[i.id]!]) i.value = claves.get(i.id)!;
    });
    cablear();
    const objetivo = foco ? app.querySelector<HTMLInputElement>(`#${foco}`) : app.querySelector<HTMLInputElement>('.con-error input, form input');
    objetivo?.focus();
    if (foco && objetivo && st.errores.nick && foco.endsWith('nick')) objetivo.select();
  };

  /** Lo escrito en el formulario que está en pantalla (para no perderlo al repintar). */
  const leer = (): { nick: string; clave: string; repetir: string; codigo: string } => {
    const v = (id: string): string => app.querySelector<HTMLInputElement>(`#${id}`)?.value ?? '';
    return st.modo === 'registro'
      ? { nick: v('reg-nick'), clave: v('reg-clave'), repetir: v('reg-repetir'), codigo: st.conCodigo ? v('reg-codigo') : st.codigo }
      : { nick: v('input-usuario'), clave: v('input-clave'), repetir: '', codigo: st.codigo };
  };

  const cablear = (): void => {
    // Al corregir un campo con error, el aviso de ese campo se va (el resto sigue hasta el próximo envío).
    app.querySelectorAll<HTMLInputElement>('.acceso-card .con-error input').forEach((i) => i.addEventListener('input', () => {
      const g = i.closest('.form-group');
      g?.classList.remove('con-error');
      g?.querySelector('.form-error')?.remove();
    }, { once: true }));
    app.querySelectorAll<HTMLButtonElement>('[data-acceso-modo]').forEach((b) => b.addEventListener('click', () => {
      const modo = b.dataset.accesoModo as Modo;
      if (modo === st.modo || st.enviando) return;
      st.nick = leer().nick.trim() || st.nick;
      st.modo = modo; st.error = ''; st.aviso = ''; st.errores = {};
      pintar();
    }));
    app.querySelector('[data-acceso-codigo]')?.addEventListener('click', () => {
      const l = leer();
      st.nick = l.nick; st.conCodigo = true;
      pintar('reg-codigo');
    });

    app.querySelector<HTMLFormElement>('#form-entrar')?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (st.enviando) return;
      const l = leer();
      st.nick = l.nick.trim(); st.error = ''; st.errores = {};
      if (!st.nick) st.errores.nick = 'Escribe tu nick.';
      if (!l.clave) st.errores.clave = 'Escribe tu contraseña.';
      if (st.errores.nick || st.errores.clave) { pintar(); return; }
      st.enviando = true; pintar();
      try {
        await a.entrar(st.nick, l.clave);
      } catch (err) {
        st.enviando = false;
        if (estadoDe(err) === 401) { st.errores.clave = 'Nick o contraseña incorrectos.'; pintar('input-clave'); return; }
        st.error = a.mensajeError(err);
        pintar();
      }
    });

    app.querySelector<HTMLFormElement>('#form-registro')?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (st.enviando) return;
      const l = leer();
      st.nick = l.nick.trim(); st.codigo = l.codigo.trim(); st.error = ''; st.aviso = '';
      st.errores = validarRegistro(l.nick, l.clave, l.repetir);
      if (Object.keys(st.errores).length) {
        pintar(st.errores.nick ? 'reg-nick' : st.errores.clave ? 'reg-clave' : 'reg-repetir');
        return;
      }
      st.enviando = true; pintar();
      try {
        await a.registrar(st.nick, l.clave, st.codigo || undefined);
      } catch (err) {
        st.enviando = false;
        const status = estadoDe(err);
        const msg = status !== undefined ? primeraMayuscula((err as Error).message) : a.mensajeError(err);
        if (status === 409) { st.errores.nick = 'Ese nick ya existe: elige otro.'; pintar('reg-nick'); return; }
        if (status === 403) {
          st.conCodigo = true;
          st.errores.codigo = st.codigo ? 'El código de invitación no coincide.' : 'Este servidor pide un código de invitación.';
          pintar('reg-codigo');
          return;
        }
        if (status === 400) {
          if (/nick/i.test(msg)) st.errores.nick = `${msg}.`;
          else if (/clave/i.test(msg)) st.errores.clave = `${msg.replace(/^La clave/, 'La contraseña')}.`;
          else st.error = msg;
          pintar();
          return;
        }
        st.error = a.mensajeError(err);
        pintar();
        return;
      }
      // La cuenta ya existe: entrar con ella. Si el login falla, no se vuelve a crear: se pasa a «Entrar» con el nick puesto.
      try {
        await a.entrar(st.nick, l.clave);
      } catch (err) {
        st.enviando = false;
        st.modo = 'entrar';
        st.aviso = `Cuenta «${st.nick}» creada. Entra con tu contraseña.`;
        st.error = a.mensajeError(err);
        pintar('input-clave');
      }
    });
  };

  pintar();
}
