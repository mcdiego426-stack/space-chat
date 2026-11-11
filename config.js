/**
 * Configuración de Space Chat.
 * Mientras API_URL esté vacío, la app funciona con datos de ejemplo (modo demo).
 */
window.SPACE_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwW0w87bI-1Q7JDD-YK_NIXlgeypNOVd6m_nb1QOENaZOapB-GHPfpmc-YQr5j-oj_C/exec', // URL /exec del Apps Script (el "cerebro")
  GOOGLE_CLIENT_ID: '392226940969-kscmjj5ras24cnne2gvac0tvdblfgro4.apps.googleusercontent.com', // ID de cliente OAuth para "Entrar con Google"
  VAPID_PUBLIC: 'BI57UvKqzu-J7Yj_XhRIaLzZXojxYA5lPI-3GjDZE-3tvyhqVDvR2Ja35iGr-w_YOM0_Ay64KrtCbb5Lp3i_0A8' // llave pública para notificaciones (no es secreta)
};
