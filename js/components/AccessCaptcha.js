import { readApiResponse } from '../utils/apiResponse.js';

let scriptPromise;
function loadScript() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => fail(), 15000);
    const fail = () => { clearTimeout(timer); script.remove(); scriptPromise = null; reject(new Error('No se pudo cargar la verificacion. Recarga la pagina.')); };
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => { clearTimeout(timer); resolve(window.turnstile); };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return scriptPromise;
}
export default class AccessCaptcha {
  constructor(element, onChange, onError) {
    this.element = element; this.onChange = onChange; this.onError = onError;
    this.token = ''; this.destroyed = false; this.widget = null;
  }
  async mount() {
    try {
      const response = await fetch('/api/access-requests');
      const settings = await readApiResponse(response,
        data => typeof data.siteKey === 'string' && Boolean(data.siteKey.trim()));
      const turnstile = await loadScript();
      if (this.destroyed || !this.element.isConnected) return;
      this.widget = turnstile.render(this.element, {
        sitekey: settings.siteKey, action: 'solicitar-acceso', size: 'flexible',
        callback: token => this.setToken(token),
        'expired-callback': () => this.setToken(''),
        'error-callback': () => { this.setToken(''); this.onError('No se pudo verificar la conexion. Intenta nuevamente.'); },
      });
    } catch (error) {
      if (!this.destroyed && this.element.isConnected) this.onError(error instanceof TypeError
        ? 'No se pudo conectar con el servicio. Revisa tu conexión e intenta nuevamente.' : error.message);
    }
  }
  setToken(token) { if (!this.destroyed) { this.token = token; this.onChange(); } }
  reset() { this.setToken(''); if (this.widget !== null) window.turnstile?.reset(this.widget); }
  destroy() { this.destroyed = true; this.token = ''; if (this.widget !== null) window.turnstile?.remove(this.widget); }
}
