/**
 * @fileoverview LoginView — Vista del formulario de inicio de sesión.
 * Solo renderiza HTML y gestiona eventos del formulario.
 * Nunca llama a Firebase directamente; delega al AuthController.
 *
 * @module views/LoginView
 */

import AuthController from '../controllers/AuthController.js';
import Toast          from '../components/Toast.js';
import { i18n }       from '../config/i18n.js';

const LoginView = {
  /**
   * Renderiza la vista de login en el contenedor #app-root.
   * Adjunta los listeners del formulario.
   *
   * @returns {void}
   */
  render() {
    const root = document.getElementById('app-root');
    if (!root) return;

    root.innerHTML = this._buildHTML();
    this._bindEvents();
  },

  /**
   * Construye el HTML del formulario de login.
   *
   * @private
   * @returns {string}
   */
  _buildHTML() {
    return `
      <div class="login-wrapper animate-fade-in">
        <div class="login-card">
          <!-- Logo / Icono -->
          <div class="login-logo" aria-hidden="true">🏛️</div>
          <h1 class="login-title">${i18n.app.nombre}</h1>
          <p class="login-subtitle">${i18n.auth.subtitle}</p>

          <!-- Alerta de error (oculta por defecto) -->
          <div id="login-error"
               class="alert alert-danger d-none mb-3"
               role="alert"
               aria-live="polite">
            <i class="bi bi-exclamation-triangle me-2"></i>
            <span id="login-error-msg"></span>
          </div>

          <!-- Formulario -->
          <form id="login-form" novalidate autocomplete="off">
            <!-- Email -->
            <div class="mb-3">
              <label for="login-email" class="form-label">
                ${i18n.auth.correo}
              </label>
              <div class="input-group">
                <span class="input-group-text" aria-hidden="true">
                  <i class="bi bi-envelope"></i>
                </span>
                <input type="email"
                       id="login-email"
                       name="email"
                       class="form-control"
                       placeholder="${i18n.auth.placeholderEmail}"
                       required
                       autocomplete="email"
                       aria-required="true"
                       aria-label="${i18n.auth.correo}" />
              </div>
            </div>

            <!-- Contraseña -->
            <div class="mb-4">
              <label for="login-password" class="form-label">
                ${i18n.auth.contrasena}
              </label>
              <div class="input-group">
                <span class="input-group-text" aria-hidden="true">
                  <i class="bi bi-lock"></i>
                </span>
                <input type="password"
                       id="login-password"
                       name="password"
                       class="form-control"
                       placeholder="${i18n.auth.placeholderPass}"
                       required
                       autocomplete="current-password"
                       aria-required="true"
                       aria-label="${i18n.auth.contrasena}" />
                <button class="btn btn-outline-secondary"
                        type="button"
                        id="toggle-password"
                        aria-label="Mostrar / ocultar contraseña">
                  <i class="bi bi-eye" id="eye-icon"></i>
                </button>
              </div>
            </div>

            <!-- Botón de submit -->
            <button type="submit"
                    id="btn-login"
                    class="btn-jal-primary w-100 py-2"
                    aria-label="${i18n.auth.btnLogin}">
              <span id="btn-login-text">
                <i class="bi bi-box-arrow-in-right me-2"></i>${i18n.auth.btnLogin}
              </span>
              <span id="btn-login-loading" class="d-none">
                <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                ${i18n.auth.cargando}
              </span>
            </button>
          </form>

          <div class="text-center mt-3">
            <button type="button"
                    id="btn-forgot-password"
                    class="btn btn-link btn-sm p-0 text-decoration-none"
                    aria-label="${i18n.auth.olvidastePassword}">
              ${i18n.auth.olvidastePassword}
            </button>
          </div>

          <div class="login-access-request mt-3 pt-3">
            <a href="#/solicitar-acceso"
               class="btn-jal-secondary w-100 d-flex align-items-center justify-content-center gap-2"
               aria-label="${i18n.solicitudAcceso.btnSolicitar}">
              <i class="bi bi-person-plus" aria-hidden="true"></i>${i18n.solicitudAcceso.btnSolicitar}
            </a>
          </div>

          <!-- Footer de la card -->
          <div class="mt-4 text-center">
            <p style="color:rgba(255,255,255,.35);font-size:0.75rem;">
              <i class="bi bi-shield-lock me-1"></i>
              Acceso exclusivo para personal autorizado de la JAL
            </p>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Registra todos los event listeners del formulario de login.
   *
   * @private
   */
  _bindEvents() {
    const form           = document.getElementById('login-form');
    const togglePassword = document.getElementById('toggle-password');
    const eyeIcon        = document.getElementById('eye-icon');
    const passwordInput  = document.getElementById('login-password');

    // Submit del formulario
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this._handleSubmit();
    });

    // Alternar visibilidad de contraseña
    togglePassword?.addEventListener('click', () => {
      const esPassword = passwordInput.type === 'password';
      passwordInput.type = esPassword ? 'text' : 'password';
      eyeIcon.className  = esPassword ? 'bi bi-eye-slash' : 'bi bi-eye';
    });

    // Limpiar error al escribir
    document.getElementById('login-email')?.addEventListener('input', () => this._ocultarError());
    document.getElementById('login-password')?.addEventListener('input', () => this._ocultarError());

    // Restablecer contraseña (autoservicio)
    document.getElementById('btn-forgot-password')?.addEventListener('click', () => this._handleForgotPassword());
  },

  /**
   * Envía el correo de restablecimiento de contraseña usando el correo escrito
   * en el formulario. No revela si la cuenta existe (privacidad).
   *
   * @private
   */
  async _handleForgotPassword() {
    const email = document.getElementById('login-email')?.value;

    await AuthController.enviarCorreoRestablecerPassword(email, {
      onLoading: (cargando) => this._setLoading(cargando),
      onSuccess: () => Toast.info(i18n.auth.resetEnviado),
      onError: (mensaje) => this._mostrarError(mensaje),
    });
  },

  /**
   * Maneja el submit del formulario: extrae datos y llama al AuthController.
   *
   * @private
   */
  async _handleSubmit() {
    const email    = document.getElementById('login-email')?.value;
    const password = document.getElementById('login-password')?.value;

    await AuthController.login(email, password, {
      onLoading: (cargando) => this._setLoading(cargando),

      onSuccess: (sesion) => {
        const ruta = AuthController.getRutaPorRol(sesion.rol);
        Toast.exito(`¡Bienvenido, ${sesion.nombre}!`);
        window.location.hash = ruta;
      },

      onError: (mensaje) => {
        this._mostrarError(mensaje);
      },
    });
  },

  /**
   * Muestra u oculta el indicador de carga en el botón.
   *
   * @private
   * @param {boolean} cargando
   */
  _setLoading(cargando) {
    const btnText    = document.getElementById('btn-login-text');
    const btnLoading = document.getElementById('btn-login-loading');
    const btnLogin   = document.getElementById('btn-login');

    if (cargando) {
      btnText?.classList.add('d-none');
      btnLoading?.classList.remove('d-none');
      if (btnLogin) btnLogin.disabled = true;
    } else {
      btnText?.classList.remove('d-none');
      btnLoading?.classList.add('d-none');
      if (btnLogin) btnLogin.disabled = false;
    }
  },

  /**
   * Muestra el mensaje de error en el alerta del formulario.
   *
   * @private
   * @param {string} mensaje
   */
  _mostrarError(mensaje) {
    const alertEl = document.getElementById('login-error');
    const msgEl   = document.getElementById('login-error-msg');
    if (alertEl && msgEl) {
      msgEl.textContent = mensaje;
      alertEl.classList.remove('d-none');
    }
  },

  /**
   * Oculta el alerta de error.
   *
   * @private
   */
  _ocultarError() {
    document.getElementById('login-error')?.classList.add('d-none');
  },
};

export default LoginView;
