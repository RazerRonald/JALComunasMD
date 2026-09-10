/**
 * @fileoverview Configuración de Firebase para JAL Comuna 3 Manrique.
 *
 * IMPORTANTE — SEGURIDAD:
 * Las credenciales aquí expuestas son de configuración pública del SDK de
 * Firebase (no son secretos de servidor). Sin embargo, en un entorno de
 * producción real, se recomienda mover apiKey y projectId a variables de
 * entorno servidas por un proxy (Cloud Run, Firebase Hosting rewrites, etc.)
 * y proteger el acceso mediante Firebase Security Rules rigurosas.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * INSTRUCCIONES PARA CONFIGURAR:
 * 1. Crea un proyecto en https://console.firebase.google.com
 * 2. Agrega una app web al proyecto
 * 3. Copia el objeto firebaseConfig generado y reemplaza los valores abajo
 * 4. Activa Authentication (email/password) en la consola de Firebase
 * 5. Crea la base de datos Firestore en modo producción
 * 6. Crea la colección 'users' con documentos que incluyan el campo 'rol'
 * ────────────────────────────────────────────────────────────────────────────
 *
 * FIRESTORE SECURITY RULES RECOMENDADAS (copiar en la consola de Firebase):
 *
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *
 *     // Función auxiliar: comprueba si el usuario autenticado es Edil
 *     function esEdil() {
 *       return request.auth != null &&
 *              get(/databases/$(database)/documents/users/$(request.auth.uid)).data.rol == 'edil';
 *     }
 *
 *     // Función auxiliar: comprueba si hay sesión activa
 *     function autenticado() {
 *       return request.auth != null;
 *     }
 *
 *     function finalizacionNoSolicitada() {
 *       return (
 *           !resource.data.keys().hasAny(['finalizacion_solicitada'])
 *           || resource.data.finalizacion_solicitada == false
 *           || resource.data.finalizacion_solicitada == null
 *         )
 *         && (
 *           !resource.data.keys().hasAny(['finalizacion_estado'])
 *           || resource.data.finalizacion_estado == null
 *         );
 *     }
 *
 *     function puedeSolicitarFinalizacion() {
 *       return autenticado()
 *         && resource.data.uid_estudiante == request.auth.uid
 *         && resource.data.estado == 'Expedida'
 *         && finalizacionNoSolicitada()
 *         && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
 *           'finalizacion_solicitada',
 *           'finalizacion_estado',
 *           'fecha_solicitud_finalizacion'
 *         ])
 *         && request.resource.data.finalizacion_solicitada == true
 *         && request.resource.data.finalizacion_estado == 'Pendiente'
 *         && request.resource.data.fecha_solicitud_finalizacion == request.time;
 *     }
 *
 *     // Colección: noticias
 *     // Lectura pública; escritura solo para Edil
 *     match /noticias/{noticiaId} {
 *       allow read: if true;
 *       allow write: if esEdil();
 *     }
 *
 *     // Colección: eventos
 *     // Lectura pública; escritura solo para Edil
 *     match /eventos/{eventoId} {
 *       allow read: if true;
 *       allow write: if esEdil();
 *     }
 *
 *     // Colección: info_carta_inicial (solicitudes de carta barrial)
 *     // El estudiante puede leer, crear y solicitar finalizacion sobre su propia carta expedida;
 *     // el Edil puede leer y actualizar cualquier solicitud.
 *     match /info_carta_inicial/{solicitudId} {
 *       allow read:   if autenticado() &&
 *                        (request.auth.uid == resource.data.uid_estudiante || esEdil());
 *       allow create: if autenticado() &&
 *                        request.auth.uid == request.resource.data.uid_estudiante;
 *       allow update: if esEdil() || puedeSolicitarFinalizacion();
 *       allow delete: if esEdil();
 *     }
 *
 *     // Colección privada: enlaces e IDs de documentos expedidos en Drive
 *     // Solo el Edil puede leerla o modificarla. El estudiante nunca recibe
 *     // las URLs de las cartas desde Firestore.
 *     match /info_carta_documentos/{solicitudId} {
 *       allow read, write: if esEdil();
 *     }
 *
 *     // Colección: users
 *     // Solo el propio usuario o un Edil puede leer su documento.
 *     // Escritura solo por Edil (gestión de roles).
 *     match /users/{userId} {
 *       allow read:  if autenticado() &&
 *                       (request.auth.uid == userId || esEdil());
 *       allow write: if esEdil();
 *     }
 *   }
 * }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── SDK de Firebase 10+ (modular, via CDN ESM) ───────────────────────────
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ─── ⚠️ REEMPLAZA ESTOS VALORES CON TU CONFIGURACIÓN REAL DE FIREBASE ───────
export const firebaseConfig = {
  apiKey: "AIzaSyD_1bLYxGLrIngn6K2rexgHg4EijOAeOig",
  authDomain: "jal3-fd8a2.firebaseapp.com",
  projectId: "jal3-fd8a2",
  storageBucket: "jal3-fd8a2.firebasestorage.app",
  messagingSenderId: "1087497700342",
  appId: "1:1087497700342:web:3deefa92e06c7901cf3dd7"
};

// ─────────────────────────────────────────────────────────────────────────────

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

/** Instancia de Firebase Auth */
export const auth = getAuth(app);

/** Instancia de Firestore */
export const db = getFirestore(app);

// ─── Configuración de Google Drive API v3 ────────────────────────────────
// IMPORTANTE — SEGURIDAD:
// Nunca exponer el Client Secret en el frontend. Solo usar el Client ID
// y OAuth 2.0 para tokens de acceso de usuario autenticado.
// En producción usar un service account vía backend seguro.
export const DRIVE_CONFIG = {
  /**
   * ID de la aplicación OAuth 2.0 (Google Cloud Console → Credenciales).
   * Reemplazar con el tuyo real.
   */
  CLIENT_ID: '1023557170353-5kdd29qn0kgj2ncjnsjbvpuns38o60sv.apps.googleusercontent.com',

  /**
   * API Key pública de Google Cloud (solo para llamadas autenticadas con OAuth).
   * Reemplazar con tu clave real.
   */
  API_KEY: 'AIzaSyB8kkNqzzjwyTYsIWnk_mOtwaZ50EV8Iis',

  /**
   * Scopes de OAuth requeridos para subir y gestionar archivos en Drive.
   */
  SCOPES: 'https://www.googleapis.com/auth/drive.file',

  /**
   * ID de la carpeta raíz en Google Drive donde se almacenarán los trámites.
   * Crear la carpeta en Drive y pegar su ID aquí.
   * (Extraer de la URL: drive.google.com/drive/folders/ESTE_ID)
  */
  FOLDER_ID: '1QrCG3gTP8LhPWCt-fBCmx9wNhKg05h_r',

  /**
   * Carpeta raiz independiente para imagenes y videos de noticias.
   * No debe ser la misma carpeta usada para tramites. Si se deja vacia, la app
   * buscara o creara una carpeta llamada "ContenidoJAL" en la raiz de Mi unidad.
  */
  CONTENT_FOLDER_ID: '1a3WhPsk4d8auqvhlfUbeNQfsNSraiDmV',

  /**
   * Correo que recibira acceso privado a las carpetas de tramites creadas en
   * Drive. Si se deja vacio, se usara el correo del Edil que inicio sesion.
   */
  TRAMITES_SHARE_EMAIL: 'jalcomuna32024@gmail.com',

  /**
   * Activa el correo automatico de Google Drive al compartir una carpeta de
   * tramite con TRAMITES_SHARE_EMAIL o con el Edil autenticado.
   */
  TRAMITES_SEND_SHARE_EMAIL: true,

  /** Tipos MIME permitidos para subir */
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],

  /** Extensiones de archivo permitidas (para validación en UI) */
  ALLOWED_EXTENSIONS: ['.pdf', '.docx'],

  /** Tamaño máximo de archivo: 10 MB */
  MAX_FILE_SIZE_MB: 10,
};

export default app;
