/**
 * @fileoverview PerfilView - Vista de perfil autenticado en solo lectura.
 *
 * @module views/PerfilView
 */

import AuthModel from '../models/AuthModel.js';
import AuthController from '../controllers/AuthController.js';
import Toast from '../components/Toast.js';
import { i18n } from '../config/i18n.js';
import { ROLES } from '../config/collections.js';

const PerfilView = {
  _passwordModal: null,

  render() {
    const root = document.getElementById('app-root');
    const sesion = AuthModel.getSesion();
    if (!root || !sesion) return;

    root.innerHTML = `
      <div class="page-hero">
        <div class="container">
          <nav aria-label="breadcrumb" class="page-hero-breadcrumb mb-2">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><a href="#/inicio" class="text-white-50">${i18n.nav.inicio}</a></li>
              <li class="breadcrumb-item active">${i18n.nav.perfil}</li>
            </ol>
          </nav>
          <h1><i class="bi bi-person-circle me-2"></i>${i18n.nav.perfil}</h1>
          <p class="page-hero-sub mb-0">${this._esc(sesion.nombre)}</p>
        </div>
      </div>

      <div class="container py-5">
        <div class="row justify-content-center">
          <div class="col-lg-8">
            <div class="form-jal">
              <div class="d-flex align-items-center gap-3 mb-4">
                <div class="stat-icon ${sesion.rol === ROLES.EDIL ? 'stat-icon-success' : 'stat-icon-primary'}">
                  <i class="bi ${sesion.rol === ROLES.EDIL ? 'bi-person-badge' : 'bi-mortarboard'}"></i>
                </div>
                <div>
                  <h2 class="h5 fw-700 mb-1">${this._esc(sesion.nombre)}</h2>
                  <span class="badge ${sesion.rol === ROLES.EDIL ? 'bg-success-subtle text-success-emphasis' : 'bg-primary-subtle text-primary-emphasis'}">
                    ${sesion.rol === ROLES.EDIL ? 'Edil' : 'Estudiante'}
                  </span>
                </div>
              </div>

              <div class="row g-3">
                ${this._buildDato(i18n.admin.usuariosNombre, sesion.nombre_perfil || sesion.nombre, 'bi-person')}
                ${this._buildDato(i18n.admin.usuariosPrimerApellido, sesion.primer_apellido, 'bi-person')}
                ${this._buildDato(i18n.admin.usuariosSegundoApellido, sesion.segundo_apellido, 'bi-person')}
                ${this._buildDato(i18n.admin.usuariosTipoDocumento, sesion.tipo_documento, 'bi-card-heading')}
                ${this._buildDato(i18n.admin.usuariosNumeroDocumento, sesion.numero_documento, 'bi-123')}
                ${this._buildDato(i18n.admin.usuariosCiudadDocumento, sesion.ciudad_documento, 'bi-geo-alt')}
                ${this._buildDato(i18n.admin.usuariosCorreo, sesion.email, 'bi-envelope')}
              </div>

              <div class="border-top mt-4 pt-4 d-flex align-items-center justify-content-between gap-3 flex-wrap">
                <div>
                  <h3 class="h6 fw-700 mb-1">${i18n.auth.seguridadCuenta}</h3>
                  <span class="text-muted small">${this._esc(sesion.email)}</span>
                </div>
                <button type="button" class="btn-jal-secondary d-inline-flex align-items-center gap-2"
                        id="btn-cambiar-password">
                  <i class="bi bi-key" aria-hidden="true"></i>${i18n.auth.cambiarPassword}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      ${this._buildModalPassword()}
    `;

    this._passwordModal = null;
    this._bindEvents();
  },

  _buildModalPassword() {
    return `
      <div class="modal fade modal-jal" id="modal-cambiar-password" tabindex="-1"
           aria-labelledby="modal-cambiar-password-titulo" aria-modal="true" role="dialog">
        <div class="modal-dialog modal-dialog-centered">
          <form class="modal-content" id="form-cambiar-password" novalidate autocomplete="off">
            <div class="modal-header">
              <h2 class="modal-title h5" id="modal-cambiar-password-titulo">
                <i class="bi bi-shield-lock me-2"></i>${i18n.auth.cambiarPassword}
              </h2>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body">
              <div id="cambiar-password-error" class="alert alert-danger d-none" role="alert" tabindex="-1"></div>
              ${this._buildPasswordInput('password-actual', i18n.auth.passwordActual, 'current-password')}
              ${this._buildPasswordInput('password-nueva', i18n.auth.passwordNueva, 'new-password')}
              ${this._buildPasswordInput('password-confirmar', i18n.auth.confirmarPasswordNueva, 'new-password', false)}
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${i18n.app.cancelar}</button>
              <button type="submit" class="btn btn-primary" id="btn-guardar-password">
                <span id="btn-guardar-password-text">
                  <i class="bi bi-check-lg me-1"></i>${i18n.auth.guardarPassword}
                </span>
                <span id="btn-guardar-password-loading" class="d-none">
                  <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${i18n.app.guardando}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  _buildPasswordInput(id, label, autocomplete, margin = true) {
    return `
      <div class="${margin ? 'mb-3' : ''}">
        <label for="${id}" class="form-label">${this._esc(label)}</label>
        <div class="input-group">
          <input type="password" id="${id}" class="form-control" required minlength="6"
                 autocomplete="${autocomplete}" aria-required="true" />
          <button type="button" class="btn btn-outline-secondary btn-toggle-password"
                  data-target="${id}" aria-label="Mostrar u ocultar ${this._esc(label.toLowerCase())}">
            <i class="bi bi-eye" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    `;
  },

  _bindEvents() {
    const modalEl = document.getElementById('modal-cambiar-password');
    const form = document.getElementById('form-cambiar-password');

    document.getElementById('btn-cambiar-password')?.addEventListener('click', () => {
      form?.reset();
      this._ocultarErrorPassword();
      this._restablecerVisibilidadPasswords();
      this._passwordModal = this._passwordModal || new window.bootstrap.Modal(modalEl);
      this._passwordModal.show();
    });

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await this._cambiarPassword();
    });

    form?.addEventListener('input', () => this._ocultarErrorPassword());

    form?.querySelectorAll('.btn-toggle-password').forEach((button) => {
      button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.target);
        const icon = button.querySelector('i');
        if (!input) return;
        const mostrar = input.type === 'password';
        input.type = mostrar ? 'text' : 'password';
        if (icon) icon.className = mostrar ? 'bi bi-eye-slash' : 'bi bi-eye';
      });
    });

    modalEl?.addEventListener('hidden.bs.modal', () => {
      form?.reset();
      this._ocultarErrorPassword();
      this._restablecerVisibilidadPasswords();
    });
  },

  async _cambiarPassword() {
    const errorEl = document.getElementById('cambiar-password-error');
    this._ocultarErrorPassword();

    await AuthController.cambiarPasswordPropia(
      {
        passwordActual: document.getElementById('password-actual')?.value,
        passwordNueva: document.getElementById('password-nueva')?.value,
        confirmarPassword: document.getElementById('password-confirmar')?.value,
      },
      {
        onLoading: (cargando) => this._setPasswordLoading(cargando),
        onSuccess: () => {
          this._passwordModal?.hide();
          Toast.exito(i18n.auth.passwordActualizada);
        },
        onError: (mensaje) => {
          if (!errorEl) return;
          errorEl.textContent = mensaje;
          errorEl.classList.remove('d-none');
          errorEl.focus();
        },
      },
    );
  },

  _setPasswordLoading(cargando) {
    const button = document.getElementById('btn-guardar-password');
    if (button) button.disabled = cargando;
    document.getElementById('btn-guardar-password-text')?.classList.toggle('d-none', cargando);
    document.getElementById('btn-guardar-password-loading')?.classList.toggle('d-none', !cargando);
  },

  _ocultarErrorPassword() {
    document.getElementById('cambiar-password-error')?.classList.add('d-none');
  },

  _restablecerVisibilidadPasswords() {
    ['password-actual', 'password-nueva', 'password-confirmar'].forEach((id) => {
      const input = document.getElementById(id);
      const icon = document.querySelector(`.btn-toggle-password[data-target="${id}"] i`);
      if (input) input.type = 'password';
      if (icon) icon.className = 'bi bi-eye';
    });
  },

  _buildDato(label, value, icon) {
    return `
      <div class="col-md-6">
        <div class="border rounded-2 p-3 h-100">
          <div class="text-muted small mb-1">
            <i class="bi ${icon} me-1"></i>${this._esc(label)}
          </div>
          <div class="fw-600">${this._esc(value || '-')}</div>
        </div>
      </div>
    `;
  },

  _esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
};

export default PerfilView;
