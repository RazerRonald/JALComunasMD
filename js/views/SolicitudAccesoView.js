/**
 * @fileoverview Formulario publico para solicitar un acceso estudiantil.
 *
 * @module views/SolicitudAccesoView
 */

import SolicitudAccesoController from '../controllers/SolicitudAccesoController.js';
import AccessCaptcha from '../components/AccessCaptcha.js';
import Toast from '../components/Toast.js';
import { i18n } from '../config/i18n.js';
import { TIPOS_DOCUMENTO } from '../config/collections.js';

const SolicitudAccesoView = {
  _captcha: null,
  _loading: false,

  render() {
    this.destruir();
    const root = document.getElementById('app-root');
    if (!root) return;

    root.innerHTML = `
      <div class="page-hero">
        <div class="container">
          <nav aria-label="breadcrumb" class="page-hero-breadcrumb mb-2">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><a href="#/login" class="text-white-50">${i18n.auth.iniciarSesion}</a></li>
              <li class="breadcrumb-item active">${i18n.solicitudAcceso.titulo}</li>
            </ol>
          </nav>
          <h1><i class="bi bi-person-plus me-2"></i>${i18n.solicitudAcceso.titulo}</h1>
          <p class="page-hero-sub">${i18n.solicitudAcceso.subtitulo}</p>
        </div>
      </div>

      <div class="container py-5 solicitud-acceso-publica">
        <div class="mb-4">
          <a href="#/login" class="btn-jal-secondary d-inline-flex align-items-center gap-2">
            <i class="bi bi-arrow-left" aria-hidden="true"></i>${i18n.solicitudAcceso.volverLogin}
          </a>
        </div>

        <section class="form-jal solicitud-acceso-form" aria-labelledby="solicitud-acceso-form-titulo">
          <div class="mb-4">
            <h2 class="h5 fw-700 mb-2" id="solicitud-acceso-form-titulo">
              <i class="bi bi-person-vcard text-primary me-2"></i>${i18n.solicitudAcceso.datosTitulo}
            </h2>
            <p class="text-muted small mb-0">${i18n.solicitudAcceso.datosAyuda}</p>
          </div>

          <div id="solicitud-acceso-exito" class="alert alert-success d-none" role="status" tabindex="-1">
            <i class="bi bi-check-circle me-2"></i>${i18n.solicitudAcceso.enviadaOk}
          </div>
          <div id="solicitud-acceso-error" class="alert alert-danger d-none" role="alert" tabindex="-1"></div>

          <form id="form-solicitud-acceso" novalidate autocomplete="on">
            <div class="row g-3">
              <div class="col-md-4">
                <label for="solicitud-nombre" class="form-label">${i18n.admin.usuariosNombre}</label>
                <input type="text" id="solicitud-nombre" name="nombre" class="form-control"
                       maxlength="80" required autocomplete="given-name" />
              </div>
              <div class="col-md-4">
                <label for="solicitud-primer-apellido" class="form-label">${i18n.admin.usuariosPrimerApellido}</label>
                <input type="text" id="solicitud-primer-apellido" name="primer_apellido" class="form-control"
                       maxlength="80" required autocomplete="family-name" />
              </div>
              <div class="col-md-4">
                <label for="solicitud-segundo-apellido" class="form-label">${i18n.admin.usuariosSegundoApellido}</label>
                <input type="text" id="solicitud-segundo-apellido" name="segundo_apellido" class="form-control"
                       maxlength="80" required />
              </div>

              <div class="col-md-4">
                <label for="solicitud-tipo-documento" class="form-label">${i18n.admin.usuariosTipoDocumento}</label>
                <select id="solicitud-tipo-documento" name="tipo_documento" class="form-select" required>
                  <option value="">${i18n.solicitudAcceso.seleccionarTipo}</option>
                  ${TIPOS_DOCUMENTO.map((tipo) => `<option value="${tipo}">${tipo}</option>`).join('')}
                </select>
              </div>
              <div class="col-md-4">
                <label for="solicitud-numero-documento" class="form-label">${i18n.admin.usuariosNumeroDocumento}</label>
                <input type="text" id="solicitud-numero-documento" name="numero_documento" class="form-control"
                       minlength="6" maxlength="30" required inputmode="text" autocomplete="off" />
                <div class="form-text">${i18n.solicitudAcceso.numeroDocumentoAyuda}</div>
              </div>
              <div class="col-md-4">
                <label for="solicitud-ciudad-documento" class="form-label">${i18n.admin.usuariosCiudadDocumento}</label>
                <input type="text" id="solicitud-ciudad-documento" name="ciudad_documento" class="form-control"
                       maxlength="80" required autocomplete="address-level2" />
              </div>

              <div class="col-12">
                <label for="solicitud-email" class="form-label">${i18n.admin.usuariosCorreo}</label>
                <input type="email" id="solicitud-email" name="email" class="form-control"
                       maxlength="180" required autocomplete="email" />
                <div class="form-text">${i18n.solicitudAcceso.emailAyuda}</div>
              </div>
            </div>

            <div id="access-captcha" class="mt-4"></div>
            <div class="d-flex gap-2 mt-4 flex-wrap">
              <button type="submit" class="btn-jal-primary" id="btn-enviar-solicitud-acceso" disabled>
                <span id="btn-enviar-solicitud-text">
                  <i class="bi bi-send me-2"></i>${i18n.solicitudAcceso.enviar}
                </span>
                <span id="btn-enviar-solicitud-loading" class="d-none">
                  <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${i18n.app.guardando}
                </span>
              </button>
              <button type="reset" class="btn-jal-secondary">${i18n.app.limpiar}</button>
            </div>
          </form>
        </section>
      </div>
    `;

    this._bindEvents();
    this._captcha = new AccessCaptcha(document.getElementById('access-captcha'),
      () => this._setLoading(this._loading),
      message => {
        const error = document.getElementById('solicitud-acceso-error');
        if (error) { error.textContent = message; error.classList.remove('d-none'); }
      });
    this._captcha.mount();
  },

  destruir() { this._captcha?.destroy(); this._captcha = null; this._loading = false; },

  _bindEvents() {
    document.getElementById('form-solicitud-acceso')?.addEventListener('reset', () => this._captcha?.reset());
    document.getElementById('form-solicitud-acceso')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await this._enviar();
    });

    document.getElementById('form-solicitud-acceso')?.addEventListener('input', () => {
      document.getElementById('solicitud-acceso-error')?.classList.add('d-none');
      document.getElementById('solicitud-acceso-exito')?.classList.add('d-none');
    });
  },

  async _enviar() {
    const form = document.getElementById('form-solicitud-acceso');
    const errorEl = document.getElementById('solicitud-acceso-error');
    const exitoEl = document.getElementById('solicitud-acceso-exito');
    if (!form || this._loading) return;
    if (!this._captcha?.token) { Toast.error("Completa la verificacion de seguridad."); return; }
    const captchaToken = this._captcha.token;

    errorEl?.classList.add('d-none');
    exitoEl?.classList.add('d-none');
    const datos = Object.fromEntries(new FormData(form).entries());

    await SolicitudAccesoController.crear(datos, {
      onLoading: (cargando) => this._setLoading(cargando),
      onSuccess: () => {
        form.reset();
        exitoEl?.classList.remove('d-none');
        exitoEl?.focus();
        Toast.exito(i18n.solicitudAcceso.enviadaOk);
      },
      onError: (mensaje) => {
        if (errorEl) {
          errorEl.textContent = mensaje;
          errorEl.classList.remove('d-none');
          errorEl.focus();
        }
      },
    }, captchaToken);
    this._captcha?.reset();
  },

  _setLoading(cargando) {
    this._loading = cargando;
    const button = document.getElementById('btn-enviar-solicitud-acceso');
    const text = document.getElementById('btn-enviar-solicitud-text');
    const loading = document.getElementById('btn-enviar-solicitud-loading');
    if (button) button.disabled = cargando || !this._captcha?.token;
    text?.classList.toggle('d-none', cargando);
    loading?.classList.toggle('d-none', !cargando);
  },
};

export default SolicitudAccesoView;
