/**
 * @fileoverview AdminUsuariosView - Gestion de perfiles y accesos.
 *
 * Permite a un Edil crear estudiantes/ediles, listar usuarios y editar sus
 * datos de perfil. Los cambios de correo/contrasena se delegan al endpoint
 * serverless /api/admin-users.
 *
 * @module views/AdminUsuariosView
 */

import AuthController from '../controllers/AuthController.js';
import AuthModel from '../models/AuthModel.js';
import Toast from '../components/Toast.js';
import { i18n } from '../config/i18n.js';
import { ROLES, TIPOS_DOCUMENTO } from '../config/collections.js';

const AdminUsuariosView = {
  _unsub: null,
  _usuariosCache: [],
  _onVolverDashboard: null,

  render({ onVolverDashboard } = {}) {
    const root = document.getElementById('app-root');
    if (!root) return;

    this.destruir();
    this._onVolverDashboard = onVolverDashboard || null;

    root.innerHTML = `
      <div class="page-hero">
        <div class="container">
          <nav aria-label="breadcrumb" class="page-hero-breadcrumb mb-2">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><a href="#/admin" class="text-white-50">Admin</a></li>
              <li class="breadcrumb-item active">${i18n.admin.gestionUsuarios}</li>
            </ol>
          </nav>
          <h1><i class="bi bi-people me-2"></i>${i18n.admin.usuariosTitulo}</h1>
          <p class="page-hero-sub">${i18n.admin.usuariosSub}</p>
        </div>
      </div>

      <div class="container py-5">
        <div class="mb-4">
          <button class="btn-jal-secondary" id="btn-volver-dashboard-usuarios" aria-label="Volver al dashboard">
            <i class="bi bi-arrow-left me-1"></i> Panel Admin
          </button>
        </div>

        <section id="usuarios-listado-view">
          <div class="usuarios-toolbar mb-4">
            <div class="usuarios-stats">
              <div class="usuarios-stat">
                <div class="usuarios-stat-icon stat-icon-primary"><i class="bi bi-mortarboard"></i></div>
                <div>
                  <div class="usuarios-stat-number" id="stat-usuarios-estudiantes">0</div>
                  <div class="usuarios-stat-label">${i18n.admin.usuariosEstudiantesRegistrados}</div>
                </div>
              </div>
              <div class="usuarios-stat">
                <div class="usuarios-stat-icon stat-icon-success"><i class="bi bi-person-badge"></i></div>
                <div>
                  <div class="usuarios-stat-number" id="stat-usuarios-ediles">0</div>
                  <div class="usuarios-stat-label">${i18n.admin.usuariosEdilesRegistrados}</div>
                </div>
              </div>
            </div>
            <button type="button" class="btn-jal-primary d-inline-flex align-items-center gap-2" id="btn-mostrar-crear-usuario">
              <i class="bi bi-person-plus" aria-hidden="true"></i>
              ${i18n.admin.usuariosCrearTitulo}
            </button>
          </div>

          <div class="form-jal p-0 overflow-hidden mb-4">
            <div class="p-4 border-bottom">
              <div class="d-flex justify-content-between align-items-center gap-3 flex-wrap">
                <h2 class="h6 fw-700 mb-0">
                  <i class="bi bi-list-ul text-primary me-2"></i>${i18n.admin.usuariosListado}
                </h2>
                ${this._buildSearchBox({
                  id: 'buscador-admin-usuarios',
                  label: i18n.app.buscar,
                  placeholder: i18n.admin.usuariosBuscarPlaceholder,
                })}
              </div>
            </div>
            <div class="table-responsive">
              <table class="table table-jal mb-0" aria-label="Lista de usuarios">
                <thead>
                  <tr>
                    <th scope="col">${i18n.admin.colNombre}</th>
                    <th scope="col">${i18n.admin.usuariosRol}</th>
                    <th scope="col">${i18n.admin.usuariosCorreo}</th>
                    <th scope="col">${i18n.admin.usuariosNumeroDocumento}</th>
                    <th scope="col" class="text-end">${i18n.admin.colAcciones}</th>
                  </tr>
                </thead>
                <tbody id="tabla-usuarios-body">
                  <tr><td colspan="5" class="text-center py-4 text-muted">
                    <div class="spinner-border spinner-border-sm text-primary me-2" role="status" aria-hidden="true"></div>
                    ${i18n.app.cargando}
                  </td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="usuarios-crear-view" class="d-none">
          <div class="mb-4">
            <button type="button" class="btn-jal-secondary" id="btn-volver-listado-usuarios">
              <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>${i18n.app.volver} ${i18n.admin.usuariosListado.toLowerCase()}
            </button>
          </div>

          <div class="form-jal mb-4">
            <h2 class="h5 fw-700 mb-4">
              <i class="bi bi-person-plus text-primary me-2"></i>${i18n.admin.usuariosCrearTitulo}
            </h2>
            <form id="form-crear-usuario" novalidate autocomplete="off">
              ${this._buildCamposUsuario('usuario')}
              <div id="form-usuario-error" class="alert alert-danger d-none mt-3" role="alert"></div>
              <div class="d-flex gap-2 mt-4 flex-wrap">
                <button type="submit" class="btn-jal-primary" id="btn-crear-usuario">
                  <span id="btn-crear-usuario-text">
                    <i class="bi bi-person-plus me-1"></i>${i18n.admin.usuariosCrear}
                  </span>
                  <span id="btn-crear-usuario-loading" class="d-none">
                    <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>${i18n.app.guardando}
                  </span>
                </button>
                <button type="button" class="btn-jal-secondary" id="btn-limpiar-usuario">${i18n.app.limpiar}</button>
              </div>
            </form>
          </div>
        </section>
      </div>

      ${this._buildModalUsuario()}
      ${this._buildModalEliminarUsuario()}
    `;

    this._bindEventos();
    this._cargarUsuarios();
  },

  destruir() {
    if (typeof this._unsub === 'function') {
      this._unsub();
    }
    this._unsub = null;
  },

  _bindEventos() {
    document.getElementById('btn-volver-dashboard-usuarios')?.addEventListener('click', () => {
      if (this._onVolverDashboard) {
        this.destruir();
        this._onVolverDashboard();
      } else {
        window.location.hash = '#/admin';
      }
    });

    document.getElementById('btn-limpiar-usuario')?.addEventListener('click', () => {
      document.getElementById('form-crear-usuario')?.reset();
      document.getElementById('form-usuario-error')?.classList.add('d-none');
    });

    document.getElementById('btn-mostrar-crear-usuario')?.addEventListener('click', () => {
      this._mostrarVistaCrearUsuario();
    });

    document.getElementById('btn-volver-listado-usuarios')?.addEventListener('click', () => {
      this._mostrarVistaListadoUsuarios();
    });

    document.getElementById('form-crear-usuario')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await this._crearUsuario();
    });

    this._bindSearchInput('buscador-admin-usuarios', (termino) => {
      this._renderTablaUsuariosBody(
        this._filtrarUsuarios(this._usuariosCache, termino),
        Boolean(this._normalizarBusqueda(termino)),
      );
    });
  },

  _cargarUsuarios() {
    this._unsub = AuthController.suscribirUsuarios(
      (usuarios) => {
        this._usuariosCache = usuarios;
        this._renderResumen(usuarios);
        this._renderTablaUsuariosBody(usuarios);
      },
      (msg) => {
        this._renderTablaError(msg);
        Toast.error(msg);
      },
    );
  },

  async _crearUsuario() {
    const errorEl = document.getElementById('form-usuario-error');
    errorEl?.classList.add('d-none');

    await AuthController.crearUsuario(this._leerDatosFormulario('usuario'), {
      onLoading: (v) => this._setFormLoading('btn-crear-usuario', v),
      onSuccess: () => {
        Toast.exito(i18n.admin.usuariosCreadoOk);
        document.getElementById('form-crear-usuario')?.reset();
        this._mostrarVistaListadoUsuarios();
      },
      onError: (msg) => this._mostrarError(errorEl, msg),
    });
  },

  _mostrarVistaCrearUsuario() {
    document.getElementById('usuarios-listado-view')?.classList.add('d-none');
    document.getElementById('usuarios-crear-view')?.classList.remove('d-none');
    document.getElementById('form-usuario-error')?.classList.add('d-none');
    document.getElementById('usuario-rol')?.focus();
  },

  _mostrarVistaListadoUsuarios() {
    document.getElementById('usuarios-crear-view')?.classList.add('d-none');
    document.getElementById('usuarios-listado-view')?.classList.remove('d-none');
    document.getElementById('btn-mostrar-crear-usuario')?.focus();
  },

  _renderResumen(usuarios) {
    const estudiantes = usuarios.filter((u) => u.rol === ROLES.ESTUDIANTE).length;
    const ediles = usuarios.filter((u) => u.rol === ROLES.EDIL).length;

    const estudiantesEl = document.getElementById('stat-usuarios-estudiantes');
    const edilesEl = document.getElementById('stat-usuarios-ediles');
    if (estudiantesEl) estudiantesEl.textContent = String(estudiantes);
    if (edilesEl) edilesEl.textContent = String(ediles);
  },

  _renderTablaUsuariosBody(usuarios, esBusqueda = false) {
    const tbody = document.getElementById('tabla-usuarios-body');
    if (!tbody) return;

    if (!usuarios.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-5 text-muted">
            <i class="bi bi-people opacity-50 d-block mb-2" style="font-size:2rem;"></i>
            ${esBusqueda ? i18n.admin.usuariosSinResultados : i18n.admin.usuariosSinUsuarios}
          </td>
        </tr>
      `;
      return;
    }

    const sesion = AuthModel.getSesion();

    tbody.innerHTML = usuarios.map((usuario) => {
      const id = this._esc(usuario.uid);
      const rolLabel = usuario.rol === ROLES.EDIL ? 'Edil' : 'Estudiante';
      const rolClass = usuario.rol === ROLES.EDIL ? 'bg-success-subtle text-success-emphasis' : 'bg-primary-subtle text-primary-emphasis';
      const esPropioUsuario = sesion?.uid === usuario.uid;
      return `
        <tr data-id="${id}">
          <td>
            <div class="fw-600">${this._esc(usuario.nombre_completo)}</div>
            <small class="text-muted">
              ${this._esc(usuario.tipo_documento || '-')} ${this._esc(usuario.numero_documento || '')}
              ${usuario.ciudad_documento ? `- ${this._esc(usuario.ciudad_documento)}` : ''}
            </small>
          </td>
          <td><span class="badge ${rolClass}">${rolLabel}</span></td>
          <td class="text-muted small">${this._esc(usuario.email)}</td>
          <td class="text-muted small">${this._esc(usuario.numero_documento || '-')}</td>
          <td class="text-end">
            <div class="d-flex justify-content-end gap-2 flex-wrap">
              <button type="button"
                      class="btn btn-sm btn-outline-primary btn-editar-usuario"
                      data-id="${id}"
                      aria-label="${i18n.admin.usuariosEditar}">
                <i class="bi bi-pencil"></i> ${i18n.app.editar}
              </button>
              <button type="button"
                      class="btn btn-sm btn-outline-danger btn-eliminar-usuario"
                      data-id="${id}"
                      aria-label="${i18n.app.eliminar}"
                      ${esPropioUsuario ? 'disabled' : ''}>
                <i class="bi bi-trash"></i> ${i18n.app.eliminar}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-editar-usuario').forEach((btn) => {
      btn.addEventListener('click', () => this._mostrarModalEditar(btn.dataset.id));
    });

    tbody.querySelectorAll('.btn-eliminar-usuario').forEach((btn) => {
      btn.addEventListener('click', () => this._confirmarEliminarUsuario(btn.dataset.id));
    });
  },

  _mostrarModalEditar(uid) {
    const usuario = this._usuariosCache.find((item) => item.uid === uid);
    const modalEl = document.getElementById('modal-editar-usuario');
    const bodyEl = document.getElementById('modal-editar-usuario-body');
    const titleEl = document.getElementById('modal-editar-usuario-title');
    if (!usuario || !modalEl || !bodyEl) return;

    if (titleEl) {
      titleEl.textContent = `${i18n.admin.usuariosEditarTitulo}: ${usuario.nombre_completo}`;
    }

    bodyEl.innerHTML = `
      <form id="form-editar-usuario" novalidate autocomplete="off">
        ${this._buildCamposUsuario('modal-usuario', usuario, { edicion: true })}
        <button type="button" class="btn btn-outline-secondary mt-3" id="btn-recuperar-usuario">Recuperar actualizacion</button>
        <div id="modal-usuario-error" class="alert alert-danger d-none mt-3" role="alert"></div>
      </form>
    `;

    const bsModal = new window.bootstrap.Modal(modalEl);
    const btnGuardar = document.getElementById('btn-guardar-usuario');
    const nuevoBtnGuardar = btnGuardar?.cloneNode(true);
    if (btnGuardar && nuevoBtnGuardar) {
      btnGuardar.parentNode.replaceChild(nuevoBtnGuardar, btnGuardar);
      nuevoBtnGuardar.addEventListener('click', async () => {
        await this._actualizarUsuario(usuario, bsModal);
      });
    }

    document.getElementById('btn-recuperar-usuario')?.addEventListener('click', async (event) => {
      event.currentTarget.disabled = true;
      try {
        const result = await AuthModel.recuperarActualizacion(uid);
        if (result.passwordActualizada === false) Toast.advertencia('Perfil recuperado. Vuelve a ingresar la nueva contrasena para cambiarla.');
        else Toast.exito('Perfil sincronizado.');
        bsModal.hide();
      } catch (error) { this._mostrarError(document.getElementById('modal-usuario-error'), error.message); }
      finally { document.getElementById('btn-recuperar-usuario')?.removeAttribute('disabled'); }
    });
    bsModal.show();
  },

  async _actualizarUsuario(usuario, bsModal) {
    const errorEl = document.getElementById('modal-usuario-error');
    errorEl?.classList.add('d-none');

    await AuthController.actualizarUsuario(
      usuario.uid,
      this._leerDatosFormulario('modal-usuario'),
      usuario,
      {
        onLoading: (v) => this._setFormLoading('btn-guardar-usuario', v),
        onSuccess: (resultado) => {
          if (resultado.passwordActualizada === false) Toast.advertencia('Perfil actualizado. No se pudo confirmar el cambio de contrasena; vuelve a intentarlo.');
          else Toast.exito(i18n.admin.usuariosActualizadoOk);
          bsModal.hide();
        },
        onError: (msg) => this._mostrarError(errorEl, msg),
      },
    );
  },

  _confirmarEliminarUsuario(uid) {
    const usuario = this._usuariosCache.find((item) => item.uid === uid);
    const sesion = AuthModel.getSesion();
    const modalEl = document.getElementById('modal-eliminar-usuario');
    const bodyEl = document.getElementById('modal-eliminar-usuario-body');
    const btnConfirmar = document.getElementById('btn-confirmar-eliminar-usuario');
    if (!usuario || !modalEl || !bodyEl || !btnConfirmar) return;

    if (sesion?.uid === uid) {
      Toast.error(i18n.admin.usuariosNoAutoEliminar);
      return;
    }

    bodyEl.innerHTML = i18n.admin.usuariosConfirmarEliminar
      .replace('{nombre}', `<strong>${this._esc(usuario.nombre_completo)}</strong>`);

    const bsModal = new window.bootstrap.Modal(modalEl);
    const nuevoBtn = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(nuevoBtn, btnConfirmar);
    nuevoBtn.addEventListener('click', async () => {
      await this._eliminarUsuario(usuario, bsModal);
    });

    bsModal.show();
  },

  async _eliminarUsuario(usuario, bsModal) {
    await AuthController.eliminarUsuario(usuario.uid, {
      onLoading: (v) => this._setFormLoading('btn-confirmar-eliminar-usuario', v),
      onSuccess: () => {
        Toast.exito(i18n.admin.usuariosEliminadoOk);
        bsModal.hide();
      },
      onError: (msg) => Toast.error(msg),
    });
  },

  _buildCamposUsuario(prefix, usuario = {}, { edicion = false } = {}) {
    const sesion = AuthModel.getSesion();
    const esPropioPerfil = edicion && sesion?.uid === usuario.uid;
    return `
      <div class="row g-3">
        <div class="col-md-6">
          <label for="${prefix}-rol" class="form-label">${i18n.admin.usuariosRol} *</label>
          <select id="${prefix}-rol" class="form-select" required ${esPropioPerfil ? 'disabled' : ''}>
            <option value="${ROLES.ESTUDIANTE}" ${usuario.rol === ROLES.ESTUDIANTE ? 'selected' : ''}>Estudiante</option>
            <option value="${ROLES.EDIL}" ${usuario.rol === ROLES.EDIL ? 'selected' : ''}>Edil</option>
          </select>
          ${esPropioPerfil ? `<div class="form-text">${i18n.admin.usuariosNoAutoCambioRol}</div>` : ''}
        </div>
        <div class="col-md-6">
          <label for="${prefix}-email" class="form-label">${i18n.admin.usuariosCorreo} *</label>
          <input type="email"
                 id="${prefix}-email"
                 class="form-control"
                 placeholder="${i18n.admin.usuariosPlaceholderCorreo}"
                 value="${this._esc(usuario.email || '')}"
                 autocomplete="off"
                 maxlength="180"
                 required />
        </div>
        <div class="col-md-4">
          <label for="${prefix}-nombre" class="form-label">${i18n.admin.usuariosNombre} *</label>
          <input type="text"
                 id="${prefix}-nombre"
                 class="form-control"
                 placeholder="${i18n.admin.usuariosPlaceholderNombre}"
                 value="${this._esc(usuario.nombre || '')}"
                 maxlength="80"
                 required />
        </div>
        <div class="col-md-4">
          <label for="${prefix}-primer-apellido" class="form-label">${i18n.admin.usuariosPrimerApellido} *</label>
          <input type="text"
                 id="${prefix}-primer-apellido"
                 class="form-control"
                 placeholder="${i18n.admin.usuariosPlaceholderPrimerApellido}"
                 value="${this._esc(usuario.primer_apellido || '')}"
                 maxlength="80"
                 required />
        </div>
        <div class="col-md-4">
          <label for="${prefix}-segundo-apellido" class="form-label">${i18n.admin.usuariosSegundoApellido} *</label>
          <input type="text"
                 id="${prefix}-segundo-apellido"
                 class="form-control"
                 placeholder="${i18n.admin.usuariosPlaceholderSegundoApellido}"
                 value="${this._esc(usuario.segundo_apellido || '')}"
                 maxlength="80"
                 required />
        </div>
        <div class="col-md-4">
          <label for="${prefix}-tipo-doc" class="form-label">${i18n.admin.usuariosTipoDocumento} *</label>
          <select id="${prefix}-tipo-doc" class="form-select" required>
            <option value="">Seleccionar...</option>
            ${TIPOS_DOCUMENTO.map((tipo) => `
              <option value="${tipo}" ${usuario.tipo_documento === tipo ? 'selected' : ''}>${tipo}</option>
            `).join('')}
          </select>
        </div>
        <div class="col-md-8">
          <label for="${prefix}-numero-doc" class="form-label">${i18n.admin.usuariosNumeroDocumento} *</label>
          <input type="text"
                 id="${prefix}-numero-doc"
                 class="form-control"
                 placeholder="${i18n.admin.usuariosPlaceholderNumeroDoc}"
                 value="${this._esc(usuario.numero_documento || '')}"
                 maxlength="30"
                 required />
        </div>
        <div class="col-md-6">
          <label for="${prefix}-ciudad-doc" class="form-label">${i18n.admin.usuariosCiudadDocumento} *</label>
          <input type="text"
                 id="${prefix}-ciudad-doc"
                 class="form-control"
                 placeholder="${i18n.admin.usuariosPlaceholderCiudadDoc}"
                 value="${this._esc(usuario.ciudad_documento || '')}"
                 maxlength="80"
                 required />
        </div>
        <div class="col-md-6">
          <label for="${prefix}-password" class="form-label">${edicion ? i18n.admin.usuariosPasswordNueva : i18n.admin.usuariosPassword} ${edicion ? '' : '*'}</label>
          <input type="password"
                 id="${prefix}-password"
                 class="form-control"
                 autocomplete="new-password"
                 minlength="6"
                 ${edicion ? '' : 'required'} />
          <div class="form-text">${edicion ? i18n.admin.usuariosAyudaPasswordEditar : i18n.admin.usuariosAyudaPassword}</div>
        </div>
        <div class="col-md-6">
          <label for="${prefix}-password-confirm" class="form-label">${i18n.admin.usuariosConfirmarPassword} ${edicion ? '' : '*'}</label>
          <input type="password"
                 id="${prefix}-password-confirm"
                 class="form-control"
                 autocomplete="new-password"
                 minlength="6"
                 ${edicion ? '' : 'required'} />
        </div>
      </div>
    `;
  },

  _leerDatosFormulario(prefix) {
    const rolEl = document.getElementById(`${prefix}-rol`);
    return {
      rol: rolEl?.value,
      email: document.getElementById(`${prefix}-email`)?.value,
      nombre: document.getElementById(`${prefix}-nombre`)?.value,
      primer_apellido: document.getElementById(`${prefix}-primer-apellido`)?.value,
      segundo_apellido: document.getElementById(`${prefix}-segundo-apellido`)?.value,
      tipo_documento: document.getElementById(`${prefix}-tipo-doc`)?.value,
      numero_documento: document.getElementById(`${prefix}-numero-doc`)?.value,
      ciudad_documento: document.getElementById(`${prefix}-ciudad-doc`)?.value,
      password: document.getElementById(`${prefix}-password`)?.value,
      confirmarPassword: document.getElementById(`${prefix}-password-confirm`)?.value,
    };
  },

  _buildModalUsuario() {
    return `
      <div class="modal fade modal-jal" id="modal-editar-usuario" tabindex="-1"
           aria-labelledby="modal-editar-usuario-title" aria-modal="true" role="dialog">
        <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="modal-editar-usuario-title">${i18n.admin.usuariosEditarTitulo}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body" id="modal-editar-usuario-body"></div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${i18n.app.cancelar}</button>
              <button type="button" class="btn btn-jal-primary" id="btn-guardar-usuario">
                <span id="btn-guardar-usuario-text">
                  <i class="bi bi-check2-circle me-1"></i>${i18n.app.guardar}
                </span>
                <span id="btn-guardar-usuario-loading" class="d-none">
                  <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>${i18n.app.guardando}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _buildModalEliminarUsuario() {
    return `
      <div class="modal fade modal-jal" id="modal-eliminar-usuario" tabindex="-1"
           aria-labelledby="modal-eliminar-usuario-title" aria-modal="true" role="dialog">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="modal-eliminar-usuario-title">${i18n.app.confirmar}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body" id="modal-eliminar-usuario-body"></div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${i18n.app.cancelar}</button>
              <button type="button" class="btn btn-danger" id="btn-confirmar-eliminar-usuario">
                <span id="btn-confirmar-eliminar-usuario-text">
                  <i class="bi bi-trash me-1"></i>${i18n.app.eliminar}
                </span>
                <span id="btn-confirmar-eliminar-usuario-loading" class="d-none">
                  <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>${i18n.app.guardando}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _buildSearchBox({ id, label, placeholder }) {
    return `
      <div class="content-search content-search--compact">
        <label class="visually-hidden" for="${id}">${label}</label>
        <div class="input-group">
          <span class="input-group-text" aria-hidden="true">
            <i class="bi bi-search"></i>
          </span>
          <input
            type="search"
            class="form-control"
            id="${id}"
            placeholder="${placeholder}"
            autocomplete="off"
          >
        </div>
      </div>
    `;
  },

  _bindSearchInput(inputId, onSearch) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('input', () => onSearch(input.value));
  },

  _filtrarUsuarios(usuarios, termino) {
    const q = this._normalizarBusqueda(termino);
    if (!q) return usuarios;

    return usuarios.filter((usuario) => this._coincideBusqueda(q, [
      usuario.nombre_completo,
      usuario.email,
      usuario.tipo_documento,
      usuario.numero_documento,
      usuario.ciudad_documento,
      usuario.rol,
    ]));
  },

  _normalizarBusqueda(valor) {
    return String(valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  },

  _coincideBusqueda(terminoNormalizado, valores) {
    return valores.some((valor) => this._normalizarBusqueda(valor).includes(terminoNormalizado));
  },

  _renderTablaError(mensaje) {
    const tbody = document.getElementById('tabla-usuarios-body');
    if (!tbody) return;

    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-5 text-muted">
          <i class="bi bi-exclamation-triangle opacity-50 d-block mb-2" style="font-size:2rem;"></i>
          ${this._esc(mensaje)}
        </td>
      </tr>
    `;
  },

  _mostrarError(errorEl, mensaje) {
    if (!errorEl) return;
    errorEl.textContent = mensaje;
    errorEl.classList.remove('d-none');
  },

  _setFormLoading(btnId, cargando) {
    const text = document.getElementById(`${btnId}-text`);
    const loading = document.getElementById(`${btnId}-loading`);
    const btn = document.getElementById(btnId);

    text?.classList.toggle('d-none', cargando);
    loading?.classList.toggle('d-none', !cargando);
    if (btn) btn.disabled = cargando;
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

export default AdminUsuariosView;
