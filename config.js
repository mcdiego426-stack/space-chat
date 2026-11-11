/**
 * Configuración de Space Chat.
 * Mientras API_URL esté vacío, la app funciona con datos de ejemplo (modo demo).
 */
window.SPACE_CONFIG = {
  API_URL: '',            // URL /exec del Apps Script (el "cerebro")
  GOOGLE_CLIENT_ID: '',   // ID de cliente OAuth para "Entrar con Google"
  VAPID_PUBLIC: ''        // llave pública para notificaciones (no es secreta)
};
