/**
 * @fileoverview ArchivoController — Orquesta la gestión de solicitudes de carta barrial.
 * Coordina la generación de documentos, subida a Drive y registro en Firestore.
 *
 * @module controllers/ArchivoController
 */

import ArchivoModel               from '../models/ArchivoModel.js';
import AuthModel                  from '../models/AuthModel.js';
import { ESTADOS_TRAMITE }        from '../config/collections.js';
import { i18n }                   from '../config/i18n.js';

const PLANTILLA_URL = 'assets/Plantilla.docx';
const PLANTILLA_FINALIZACION_URL = 'assets/Plantilla.Finalizacion.docx';

const ArchivoController = {
  /**
   * Obtiene todas las solicitudes del estudiante autenticado.
   */
  async obtenerMisTramites({ onLoading, onSuccess, onError }) {
    const sesion = AuthModel.getSesion();
    if (!sesion) {
      onError(i18n.auth.accesoDenegado);
      return;
    }

    onLoading(true);
    try {
      const tramites = await ArchivoModel.getTramitesPorEstudiante(sesion.uid);
      onSuccess(tramites);
    } catch (err) {
      console.error('[ArchivoController.obtenerMisTramites]', err);
      if (this._esErrorPermisosLectura(err)) {
        onSuccess([]);
        return;
      }
      onError(i18n.app.errorGenerico);
    } finally {
      onLoading(false);
    }
  },

  /**
   * Valida y registra una solicitud de carta del estudiante.
   *
   * @param {Object} formData
   * @param {Object} callbacks
   */
  async enviarSolicitud(formData, { onLoading, onProgress, onSuccess, onError }) {
    const sesion = AuthModel.getSesion();
    if (!sesion) {
      onError(i18n.auth.accesoDenegado);
      return;
    }

    const datos = this._normalizarFormulario(formData, sesion);
    const errorValidacion = this._validarFormulario(datos);
    if (errorValidacion) {
      onError(errorValidacion);
      return;
    }

    onLoading(true);
    try {
      onProgress(i18n.tramite.guardandoFirestore);
      await ArchivoModel.registrarSolicitud({
        uid_estudiante:    sesion.uid,
        ...datos,
      });
      onSuccess();
    } catch (err) {
      console.error('[ArchivoController.enviarSolicitud]', err);
      onError(this._mapearErrorEnvio(err));
    } finally {
      onLoading(false);
    }
  },

  /**
   * Solicita la carta de finalizacion asociada a una carta barrial expedida.
   *
   * @param {string} tramiteId
   * @param {Object} tramiteData
   * @param {Object} callbacks
   */
  async solicitarFinalizacion(tramiteId, tramiteData, { onLoading, onSuccess, onError }) {
    const sesion = AuthModel.getSesion();
    if (!sesion || tramiteData?.uid_estudiante !== sesion.uid) {
      onError(i18n.auth.accesoDenegado);
      return;
    }

    if (tramiteData.estado !== ESTADOS_TRAMITE.EXPEDIDA) {
      onError(i18n.tramite.errorFinalizacionNoDisponible);
      return;
    }

    if (tramiteData.finalizacion_solicitada || tramiteData.finalizacion_estado) {
      onError(i18n.tramite.errorFinalizacionYaSolicitada);
      return;
    }

    onLoading(true);
    try {
      await ArchivoModel.solicitarFinalizacion(tramiteId);
      onSuccess();
    } catch (err) {
      console.error('[ArchivoController.solicitarFinalizacion]', err);
      onError(
        this._esErrorPermisosLectura(err)
          ? i18n.tramite.errorPermisosFinalizacion
          : i18n.tramite.errorSolicitarFinalizacion,
      );
    } finally {
      onLoading(false);
    }
  },

  async expedirDocumento(tramiteId, tramiteData, { onLoading, onProgress, onSuccess, onError }) {
    onLoading(true);
    try {
      onProgress(i18n.tramite.generandoDocumento);
      const blob = await this._generarDocx(tramiteData);

      const nombreArchivo = `Carta_Barrial_${this._sanitizarNombre(tramiteData.nombre_completo)}_${this._timestampArchivo()}.docx`;
      const carpetaEstudiante = this._buildNombreCarpetaEstudiante(tramiteData);

      onProgress(i18n.tramite.subiendoDocumento);
      const { fileId, viewUrl } = await ArchivoModel.subirDrive(blob, nombreArchivo, {
        carpetaEstudiante,
        compartirConEmail: this._getCorreoCompartirDrive(),
      });

      await ArchivoModel.expedirTramite(tramiteId, fileId, viewUrl);
      onSuccess({ viewUrl });
    } catch (err) {
      console.error('[ArchivoController.expedirDocumento]', err);
      const mensaje = err?.message || i18n.tramite.errorGenerar;
      onError(mensaje);
    } finally {
      onLoading(false);
    }
  },

  /**
   * Genera el DOCX desde la plantilla y lo entrega como Blob para que el Edil
   * lo descargue en su propio dispositivo. NO sube a Drive ni cambia el estado.
   *
   * @param {Object} tramiteData - Datos del trámite para rellenar la plantilla
   * @param {Object} callbacks
   */
  async descargarCarta(tramiteData, { onLoading, onProgress, onSuccess, onError }) {
    onLoading(true);
    try {
      onProgress(i18n.tramite.generandoDocumento);
      const blob = await this._generarDocx(tramiteData);
      const nombreArchivo = `Carta_Barrial_${this._sanitizarNombre(tramiteData.nombre_completo)}_${this._timestampArchivo()}.docx`;
      onSuccess({ blob, nombreArchivo });
    } catch (err) {
      console.error('[ArchivoController.descargarCarta]', err);
      onError(err?.message || i18n.tramite.errorGenerar);
    } finally {
      onLoading(false);
    }
  },

  /**
   * Genera la carta de finalizacion y la entrega como Blob al Edil.
   *
   * @param {Object} tramiteData
   * @param {Object} callbacks
   */
  async descargarCartaFinalizacion(tramiteData, { onLoading, onProgress, onSuccess, onError }) {
    onLoading(true);
    try {
      onProgress(i18n.tramite.generandoDocumento);
      const blob = await this._generarDocx(tramiteData, PLANTILLA_FINALIZACION_URL);
      const nombreArchivo = `Carta_Finalizacion_${this._sanitizarNombre(tramiteData.nombre_completo)}_${this._timestampArchivo()}.docx`;
      onSuccess({ blob, nombreArchivo });
    } catch (err) {
      console.error('[ArchivoController.descargarCartaFinalizacion]', err);
      onError(err?.message || i18n.tramite.errorGenerar);
    } finally {
      onLoading(false);
    }
  },

  /**
   * Genera, sube a Drive y marca como expedida la carta de finalizacion.
   *
   * @param {string} tramiteId
   * @param {Object} tramiteData
   * @param {Object} callbacks
   */
  async expedirDocumentoFinalizacion(tramiteId, tramiteData, { onLoading, onProgress, onSuccess, onError }) {
    onLoading(true);
    try {
      onProgress(i18n.tramite.generandoDocumento);
      const blob = await this._generarDocx(tramiteData, PLANTILLA_FINALIZACION_URL);

      const nombreArchivo = `Carta_Finalizacion_${this._sanitizarNombre(tramiteData.nombre_completo)}_${this._timestampArchivo()}.docx`;
      const carpetaEstudiante = this._buildNombreCarpetaEstudiante(tramiteData);

      onProgress(i18n.tramite.subiendoDocumento);
      const { fileId, viewUrl } = await ArchivoModel.subirDrive(blob, nombreArchivo, {
        carpetaEstudiante,
        compartirConEmail: this._getCorreoCompartirDrive(),
      });

      await ArchivoModel.expedirFinalizacion(tramiteId, fileId, viewUrl);
      onSuccess({ viewUrl });
    } catch (err) {
      console.error('[ArchivoController.expedirDocumentoFinalizacion]', err);
      onError(err?.message || i18n.tramite.errorGenerar);
    } finally {
      onLoading(false);
    }
  },

  async listarTodos({ onLoading, onSuccess, onError }) {
    onLoading(true);
    try {
      const tramites = await ArchivoModel.getAllTramites();
      onSuccess(tramites);
    } catch (err) {
      console.error('[ArchivoController.listarTodos]', err);
      onError(i18n.app.errorGenerico);
    } finally {
      onLoading(false);
    }
  },

  /**
   * Aprueba una solicitud sin expedir ni subir documento a Drive.
   */
  async aprobar(tramiteId, { onLoading, onSuccess, onError }) {
    const sesion = AuthModel.getSesion();
    if (!sesion) {
      onError(i18n.auth.accesoDenegado);
      return;
    }

    onLoading(true);
    try {
      await ArchivoModel.actualizarEstado(tramiteId, ESTADOS_TRAMITE.APROBADO);
      onSuccess();
    } catch (err) {
      console.error('[ArchivoController.aprobar]', err);
      onError(i18n.admin.errorAccion);
    } finally {
      onLoading(false);
    }
  },

  /**
   * Rechaza una solicitud y guarda la sugerencia de correccion.
   */
  async rechazar(tramiteId, sugerenciaCorreccion, { onLoading, onSuccess, onError }) {
    const sesion = AuthModel.getSesion();
    const sugerencia = this._normalizarSugerenciaRevision(sugerenciaCorreccion);

    if (!sesion) {
      onError(i18n.auth.accesoDenegado);
      return;
    }

    if (!this._sugerenciaRevisionValida(sugerencia)) {
      onError(i18n.admin.sugerenciaCorreccionRequerida);
      return;
    }

    onLoading(true);
    try {
      await ArchivoModel.rechazarTramite(tramiteId, sugerencia, sesion.uid);
      onSuccess();
    } catch (err) {
      console.error('[ArchivoController.rechazar]', err);
      onError(i18n.admin.errorAccion);
    } finally {
      onLoading(false);
    }
  },

  /**
   * Rechaza una solicitud de carta de finalizacion y guarda la sugerencia.
   */
  async rechazarFinalizacion(tramiteId, sugerenciaCorreccion, { onLoading, onSuccess, onError }) {
    const sesion = AuthModel.getSesion();
    const sugerencia = this._normalizarSugerenciaRevision(sugerenciaCorreccion);

    if (!sesion) {
      onError(i18n.auth.accesoDenegado);
      return;
    }

    if (!this._sugerenciaRevisionValida(sugerencia)) {
      onError(i18n.admin.sugerenciaCorreccionRequerida);
      return;
    }

    onLoading(true);
    try {
      await ArchivoModel.rechazarFinalizacion(tramiteId, sugerencia, sesion.uid);
      onSuccess();
    } catch (err) {
      console.error('[ArchivoController.rechazarFinalizacion]', err);
      onError(i18n.admin.errorAccion);
    } finally {
      onLoading(false);
    }
  },

  /**
   * Suscribe listener a todos los trámites.
   */
  suscribirTodos(callback) {
    return ArchivoModel.onSnapshotAll(callback);
  },

  /**
   * Genera un Blob DOCX rellenando la plantilla con los datos del trámite.
   * @private
   */
  async _generarDocx(tramiteData, plantillaUrl = PLANTILLA_URL) {
    const resp = await fetch(plantillaUrl);
    if (!resp.ok) throw new Error('No se pudo cargar la plantilla');

    const arrayBuffer = await resp.arrayBuffer();

    let { PizZipCtor, DocxCtor } = this._resolverLibreriasDocx();

    // Si faltan, intentar cargarlas dinámicamente desde varios CDN (fallback robusto)
    if (!PizZipCtor || !DocxCtor) {

      try {
        if (!PizZipCtor) {
          PizZipCtor = await this._cargarScriptGlobal([
            'js/vendor/pizzip.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/PizZip/3.1.4/pizzip.umd.min.js',
            'https://cdn.jsdelivr.net/npm/pizzip@3.1.4/dist/pizzip.umd.min.js',
            'https://unpkg.com/pizzip@3.1.4/dist/pizzip.umd.js',
          ], () => this._resolverLibreriasDocx().PizZipCtor, 'PizZip');
        }

        if (!DocxCtor) {
          DocxCtor = await this._cargarScriptGlobal([
            'js/vendor/docxtemplater.js',
            'https://cdnjs.cloudflare.com/ajax/libs/docxtemplater/3.42.3/docxtemplater.umd.min.js',
            'https://cdn.jsdelivr.net/npm/docxtemplater@3.42.3/build/docxtemplater.umd.js',
            'https://unpkg.com/docxtemplater@3.42.3/build/docxtemplater.umd.js',
          ], () => this._resolverLibreriasDocx().DocxCtor, 'docxtemplater');
        }
      } catch (e) {
        console.error('[ArchivoController._generarDocx] carga fallback libs fallida', e);
      }

      // Reintentar obtener las referencias globales
      ({ PizZipCtor, DocxCtor } = this._resolverLibreriasDocx());
    }

    if (!PizZipCtor || !DocxCtor) {
      const estado = {
        PizZip:               !!PizZipCtor,
        PizZip_default:       !!(window.PizZip && window.PizZip.default),
        pizzip:               !!window.pizzip,
        DocxCtor:             !!DocxCtor,
        docxtemplater:        !!window.docxtemplater,
        docxtemplater_default:!!(window.docxtemplater && window.docxtemplater.default),
        Docxtemplater:        !!window.Docxtemplater,
        DocxTemplater:        !!window.DocxTemplater,
      };
      console.error('[ArchivoController._generarDocx] libs faltantes estado:', estado);
      throw new Error(`Librerías docxtemplater no cargadas. Estado: ${JSON.stringify(estado)}`);
    }

    const zip = new PizZipCtor(arrayBuffer);
    const doc = new DocxCtor(zip, {
      delimiters: {
        start: '{{',
        end:   '}}',
      },
      paragraphLoop: true,
      linebreaks:    true,
    });

    doc.render({
      nombre_completo:   tramiteData.nombre_completo,
      tipo_documento:    tramiteData.tipo_documento,
      numero_documento:  tramiteData.numero_documento,
      ciudad_documento:  tramiteData.ciudad_documento || '',
      universidad:       tramiteData.universidad,
      carrera:           tramiteData.carrera,
      semestre_actual:   String(tramiteData.semestre_actual ?? ''),
      horas_a_realizar:  String(tramiteData.horas_a_realizar),
      lugar_realizacion: tramiteData.lugar_realizacion,
    });

    return doc.getZip().generate({
      type:     'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  },
  /**
   * Resuelve posibles nombres globales publicados por las versiones UMD.
   * @private
   */
  _resolverLibreriasDocx() {
    return {
      PizZipCtor: window.PizZip?.default || window.PizZip || window.pizzip?.default || window.pizzip || window.Pizzip,
      DocxCtor:   window.docxtemplater?.default || window.docxtemplater || window.Docxtemplater || window.DocxTemplater,
    };
  },
  /**
   * Carga un script y valida el global esperado antes de considerarlo exitoso.
   * @private
   */
  async _cargarScriptGlobal(candidates, resolver, nombre) {
    const existente = resolver();
    if (existente) return existente;
    for (const src of candidates) {
      try {
        const scriptExistente = Array.from(document.scripts).find((script) => script.src === src);
        if (scriptExistente) {
          await this._esperarScript(scriptExistente);
        } else {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = false;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Error cargando script ${src}`));
            document.head.appendChild(script);
          });
        }
        const cargada = resolver();
        if (cargada) return cargada;
        console.warn(`[ArchivoController._cargarScriptGlobal] ${nombre} no quedo disponible tras cargar ${src}`);
      } catch (err) {
        console.warn('[ArchivoController._cargarScriptGlobal] intento carga script fallo:', src, err.message || err);
      }
    }
    throw new Error(`No se pudo cargar ${nombre} desde los CDN configurados`);
  },
  /**
   * Espera brevemente un script existente; si ya cargo, continua enseguida.
   * @private
   */
  _esperarScript(script) {
    if (script.dataset.docxLibLoaded === 'true') {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 1500);
      script.addEventListener('load', () => {
        script.dataset.docxLibLoaded = 'true';
        clearTimeout(timer);
        resolve();
      }, { once: true });
      script.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error(`Error cargando script existente ${script.src}`));
      }, { once: true });
    });
  },
  /**
   * Normaliza los campos del formulario.
   * @private
   */
  _normalizarFormulario(formData, sesion) {
    const semestreRaw = String(formData.semestre_actual || '').trim();
    const perfil = this._datosPerfilSesion(sesion);

    return {
      ...perfil,
      universidad:       (formData.universidad || '').trim(),
      carrera:           (formData.carrera || '').trim(),
      semestre_actual:   /^\d+$/.test(semestreRaw) ? Number(semestreRaw) : NaN,
      horas_a_realizar:  Number(formData.horas_a_realizar),
      lugar_realizacion: (formData.lugar_realizacion || '').trim(),
    };
  },

  _datosPerfilSesion(sesion = {}) {
    const nombreCompleto = [
      sesion.nombre_perfil,
      sesion.primer_apellido,
      sesion.segundo_apellido,
    ].filter(Boolean).join(' ').trim() || String(sesion.nombre || '').trim();

    return {
      nombre_completo:  nombreCompleto,
      tipo_documento:   String(sesion.tipo_documento || '').trim(),
      numero_documento: String(sesion.numero_documento || '').trim(),
      ciudad_documento: String(sesion.ciudad_documento || '').trim(),
    };
  },

  /**
   * Valida los campos del formulario de solicitud.
   * @private
   * @returns {string|null}
   */
  _validarFormulario(datos) {
    const requeridos = [
      'nombre_completo',
      'tipo_documento',
      'numero_documento',
      'ciudad_documento',
      'universidad',
      'carrera',
      'lugar_realizacion',
    ];

    if (requeridos.some((campo) => !datos[campo])) {
      return i18n.tramite.errorCampos;
    }

    if (!Number.isInteger(datos.semestre_actual) || datos.semestre_actual <= 0) {
      return i18n.tramite.errorSemestre;
    }

    if (!Number.isFinite(datos.horas_a_realizar) || datos.horas_a_realizar <= 0) {
      return i18n.tramite.errorHoras;
    }

    return null;
  },

  /**
   * Sanitiza un nombre para usarlo en el nombre del archivo.
   * @private
   */
  _sanitizarNombre(nombre) {
    return (nombre || 'Estudiante')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50);
  },

  /**
   * Construye el nombre de la subcarpeta del estudiante en Drive.
   * Incluye documento para diferenciar estudiantes con nombres iguales.
   * @private
   */
  _buildNombreCarpetaEstudiante(tramiteData) {
    return [
      tramiteData.nombre_completo,
      tramiteData.numero_documento,
    ].filter(Boolean).join(' - ') || 'Estudiante';
  },

  _getCorreoCompartirDrive() {
    return AuthModel.getSesion()?.email || '';
  },

  _normalizarSugerenciaRevision(valor) {
    return String(valor || '').trim().replace(/\s+/g, ' ');
  },

  _sugerenciaRevisionValida(valor) {
    return valor.length > 0 && valor.length <= 1000;
  },

  /**
   * Genera un sufijo estable para evitar nombres duplicados en Drive.
   * @private
   */
  _timestampArchivo() {
    return new Date()
      .toISOString()
      .slice(0, 16)
      .replace('T', '_')
      .replace(':', '');
  },

  /**
   * Detecta errores de reglas de Firestore al leer solicitudes previas.
   * Permite mostrar el formulario aunque la consulta historica aun no este habilitada.
   * @private
   */
  _esErrorPermisosLectura(err) {
    const codigo = err?.code || '';
    const mensaje = String(err?.message || '').toLowerCase();
    return codigo === 'permission-denied' ||
      mensaje.includes('missing or insufficient permissions');
  },

  /**
   * Convierte errores tecnicos de guardado en mensajes utiles para el usuario.
   * @private
   */
  _mapearErrorEnvio(err) {
    if (this._esErrorPermisosLectura(err)) {
      return i18n.tramite.errorPermisosFirestore;
    }
    return i18n.tramite.errorSubir;
  },
};

export default ArchivoController;
