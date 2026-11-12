/* Space Chat — app (celular y computadora). Sin librerías: todo en este archivo.
 * v2: abre al instante con lo guardado en el aparato, actualiza por detrás, mensajes al momento
 * y se refresca sola cuando llega algo nuevo. */
(function () {
  'use strict';
  var CFG = window.SPACE_CONFIG || {};
  var DEMO = !CFG.API_URL;
  var LENTO = /[?&]lento=1/.test(location.search); // para probar en demo cómo se siente con internet lento
  var app = document.getElementById('app');
  var ETAPAS = ['Nuevo', 'Contactado', 'Interesado', 'Cita', 'Apartado', 'Vendido', 'BAJA'];
  var E = {
    medios: {},
    sesion: null, chats: [], contactos: [], convs: {}, filtroChat: 'Todos', filtroEtapa: '', buscaChat: '', buscaContacto: '',
    lote: 20, previa: null, semaforo: null, telSel: '', vista: '', cargandoConv: false, listos: {}, mostrarContactos: 80
  };

  // ------------------------------------------------------------------ utilidades
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function toast(t, tipo) {
    var el = $('toast'); el.textContent = t; el.className = 'ver' + (tipo ? ' ' + tipo : '');
    clearTimeout(toast._t); toast._t = setTimeout(function () { el.className = ''; }, 3200);
  }
  function esCompu() { return window.matchMedia('(min-width: 900px)').matches; }
  function nombreDe(c) { return ((c.titulo ? c.titulo + ' ' : '') + (c.nombre || '') + ' ' + (c.apellido || '')).trim() || telBonito(c.telefono); }
  function iniciales(c) { var n = ((c.nombre || '') + ' ' + (c.apellido || '')).trim().split(/\s+/); return ((n[0] || '?')[0] + ((n[1] || '')[0] || '')).toUpperCase(); }
  var COLORES = ['#2E7D64', '#3B6EA5', '#7A5BA6', '#A65B5B', '#4E8BA6', '#8A7A3B', '#4F7F3F'];
  function color(c) { var s = String(c.telefono || ''), h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997; return COLORES[h % COLORES.length]; }
  function avatar(c, clase) { return '<div class="avatar' + (clase ? ' ' + clase : '') + '" style="background:' + color(c) + '">' + esc(iniciales(c)) + '</div>'; }
  function hora(iso) { return new Date(iso).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' }); }
  function horaCorta(iso) {
    if (!iso) return '';
    var d = new Date(iso), hoy = new Date();
    if (d.toDateString() === hoy.toDateString()) return hora(iso);
    var ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === ayer.toDateString()) return 'Ayer';
    if (hoy - d < 6 * 864e5) return d.toLocaleDateString('es-MX', { weekday: 'short' });
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  }
  function dia(iso) {
    var d = new Date(iso), hoy = new Date(), ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === hoy.toDateString()) return 'Hoy';
    if (d.toDateString() === ayer.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function restante(iso) {
    var ms = new Date(iso) - new Date();
    if (!(ms > 0)) return null;
    var h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3);
    return h ? h + ' h ' + m + ' min' : m + ' min';
  }
  function telBonito(t) {
    var d = String(t || '').replace(/\D/g, '');
    if (d.length === 12 && d.indexOf('52') === 0) return '+52 ' + d.slice(2, 4) + ' ' + d.slice(4, 8) + ' ' + d.slice(8);
    return d ? '+' + d : '';
  }
  // Meta manda los estados en inglés; aquí se traducen.
  function estadoPlantilla(x) { return { APPROVED: 'Aprobada', PENDING: 'En revisión', PENDIENTE: 'En revisión', REJECTED: 'Rechazada', PAUSED: 'Pausada', DISABLED: 'Desactivada', FLAGGED: 'Marcada por Meta', IN_APPEAL: 'En apelación' }[String(x || '').toUpperCase()] || x || '—'; }
  function calidadNumero(x) { return { GREEN: 'Buena', YELLOW: 'Media', RED: 'Baja', UNKNOWN: 'Sin datos todavía', FLAGGED: 'Marcado por Meta', DOWNGRADE: 'Bajó de nivel' }[String(x || '').toUpperCase()] || x || '—'; }
  function sinAcentos(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function firma(x) { try { return JSON.stringify(x); } catch (e) { return String(Math.random()); } }
  var ICON = {
    ubicame: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.3 3.7a1 1 0 00-1.1-.2L3.6 10.1a1 1 0 00.1 1.9l6.6 1.7 1.7 6.6a1 1 0 001.9.1l6.6-15.6a1 1 0 00-.2-1.1z"/></svg>',
    play: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13a1 1 0 001.5.86l11-6.5a1 1 0 000-1.72l-11-6.5A1 1 0 008 5.5z"/></svg>',
    basura: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    mas: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    camara: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5A2.5 2.5 0 015.5 6h1.8l1.5-2h6.4l1.5 2h1.8A2.5 2.5 0 0121 8.5v9a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 17.5z"/><circle cx="12" cy="13" r="3.6"/></svg>',
    micro: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11.5" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3"/></svg>',
    fotos: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="8.5" cy="10" r="1.6"/><path d="M21 15.5l-5-5L7 19"/></svg>',
    camara2: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5A2.5 2.5 0 015.5 6h1.8l1.5-2h6.4l1.5 2h1.8A2.5 2.5 0 0121 8.5v9a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 17.5z"/><circle cx="12" cy="13" r="3.6"/></svg>',
    ubicacion: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    contacto: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.6 18.4a6.5 6.5 0 0110.8 0"/></svg>',
    documento: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
    chat: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    personas: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M17 4a4 4 0 010 8M22 21c0-3-2-5-4-6"/></svg>',
    enviar: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>',
    semaforo: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="3"/><circle cx="12" cy="7" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="17" r="1.5"/></svg>',
    atras: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    reloj: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    campana: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 004 0"/></svg>',
    info: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
    palomita: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
    alto: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 7v6M12 16.5v.5"/></svg>',
    mandar: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a1 1 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z"/></svg>',
    logo: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0B6B4F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8"/><path d="M8 13h5"/></svg>',
    salir: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/></svg>'
  };
  // Palomitas tipo WhatsApp (SVG para que se vean igual en todos los teléfonos).
  var CHECK1 = '<svg class="check" width="16" height="11" viewBox="0 0 16 11" aria-hidden="true"><path d="M1 6l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var CHECK2 = '<svg class="check" width="18" height="11" viewBox="0 0 18 11" aria-hidden="true"><path d="M1 6l3 3 6-7M7.5 8.5l.5.5 6-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ------------------------------------------------------------------ memoria en el aparato (para abrir al instante)
  var CLAVE_CACHE = 'sc_cache_v2';
  function cargarCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CLAVE_CACHE) || 'null');
      if (c && c.correo === (E.sesion && E.sesion.correo)) { E.chats = c.chats || []; E.contactos = c.contactos || []; E.convs = c.convs || {}; }
    } catch (e) {}
  }
  function guardarCache() {
    clearTimeout(guardarCache._t);
    guardarCache._t = setTimeout(function () {
      try {
        var tels = Object.keys(E.convs).sort(function (a, b) { return (E.convs[b]._t || 0) - (E.convs[a]._t || 0); }).slice(0, 40), convs = {};
        tels.forEach(function (t) { convs[t] = E.convs[t]; });
        localStorage.setItem(CLAVE_CACHE, JSON.stringify({ correo: E.sesion && E.sesion.correo, chats: E.chats, contactos: E.contactos, convs: convs }, function (k, v) { return k === 'local' || k === '_reenviar' ? undefined : v; }));
      } catch (e) {}
    }, 400);
  }

  // ------------------------------------------------------------------ conexión con el cerebro
  function api(fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (DEMO) {
      return new Promise(function (ok, mal) {
        setTimeout(function () { try { ok(JSON.parse(JSON.stringify(Demo[fn].apply(null, args)))); } catch (e) { mal(e); } }, LENTO ? 1800 : 150);
      });
    }
    var cuerpo = { fn: fn, args: args };
    if (E.sesion && E.sesion.sesion) cuerpo.sesion = E.sesion.sesion;
    return fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(cuerpo) })
      .then(function (r) { return r.json(); }, function () { throw new Error('Sin conexión. Revisa tu internet.'); })
      .then(function (j) {
        if (!j.ok) {
          if (/Sesión|Inicia sesión/.test(j.mensaje)) cerrarSesion();
          throw new Error(j.mensaje || 'Error');
        }
        return j.data;
      });
  }

  // ------------------------------------------------------------------ datos de ejemplo (modo demo)
  var Demo = (function () {
    var ahora = Date.now();
    function hace(min) { return new Date(ahora - min * 60e3).toISOString(); }
    var cs = [
      { titulo: 'Dra.', nombre: 'Zaira', apellido: 'Escobedo', especialidad: 'Ginecología', ciudad: 'Guadalajara', telefono: '523300000001', etapa: 'Interesado', lote: 1, ultimoMsg: 'Sí, quiero información', ultimaHora: hace(20), sinLeer: 1, ventanaHasta: new Date(ahora + 23.6 * 3600e3).toISOString(), notas: '' },
      { titulo: 'Dr.', nombre: 'Ejemplo', apellido: 'Martínez', especialidad: 'Pediatría', ciudad: 'Zapopan', telefono: '523300000002', etapa: 'Interesado', lote: 1, ultimoMsg: '¿Qué metros tiene el más chico?', ultimaHora: hace(47), sinLeer: 2, ventanaHasta: new Date(ahora + 23 * 3600e3).toISOString(), notas: '' },
      { titulo: 'Dra.', nombre: 'Ejemplo', apellido: 'García', especialidad: 'Dermatología', ciudad: 'Guadalajara', telefono: '523300000003', etapa: 'Cita', lote: 1, ultimoMsg: 'Tú: Le comparto el plano del piso 9', ultimaHora: hace(60 * 26), sinLeer: 0, ventanaHasta: '', notas: 'Busca piso alto' },
      { titulo: 'Dr.', nombre: 'Ejemplo', apellido: 'Hernández', especialidad: 'Cardiología', ciudad: 'Guadalajara', telefono: '523300000004', etapa: 'BAJA', lote: 1, ultimoMsg: 'No me interesa', ultimaHora: hace(60 * 28), sinLeer: 0, ventanaHasta: '', notas: '' },
      { titulo: 'Dra.', nombre: 'Ejemplo', apellido: 'López', especialidad: 'Oftalmología', ciudad: 'Zapopan', telefono: '523300000005', etapa: 'Contactado', lote: 1, ultimoMsg: 'Tú: Plantilla de primer contacto', ultimaHora: hace(60 * 50), sinLeer: 0, ventanaHasta: '', notas: '' },
      { titulo: 'Dr.', nombre: 'Ejemplo', apellido: 'Ramírez', especialidad: 'Ortopedia', ciudad: 'Tlaquepaque', telefono: '523300000006', etapa: 'Contactado', lote: 1, ultimoMsg: 'Tú: Plantilla de primer contacto', ultimaHora: hace(60 * 51), sinLeer: 0, ventanaHasta: '', notas: '' }
    ];
    for (var i = 7; i <= 260; i++) {
      var esp = ['Pediatría', 'Nutrición', 'Urología', 'Cardiología', 'Psicología', 'Ginecología'][i % 6];
      cs.push({ titulo: i % 2 ? 'Dr.' : 'Dra.', nombre: 'Ejemplo', apellido: 'Contacto ' + i, especialidad: esp, ciudad: i % 3 ? 'Guadalajara' : 'Zapopan', telefono: '5233000' + String(i).padStart(5, '0'), etapa: 'Nuevo', lote: '', ultimoMsg: '', ultimaHora: '', sinLeer: 0, ventanaHasta: '', notas: '' });
    }
    var plantilla = 'Dr(a). {apellido}:\n\nEspero que se encuentre bien. Le escribo en nombre de Alto Espacio, colaborador de MÉDICA COUNTRY, un nuevo desarrollo médico en la colonia Country Club de Guadalajara…';
    var msgs = {
      '523300000001': [
        { direccion: 'salida', tipo: 'plantilla', texto: plantilla.replace('{apellido}', 'Escobedo'), estado: 'read', hora: hace(60 * 25) },
        { direccion: 'entrada', tipo: 'button', texto: 'Sí, quiero información', estado: 'recibido', hora: hace(20) }
      ],
      '523300000002': [
        { direccion: 'salida', tipo: 'plantilla', texto: plantilla.replace('{apellido}', 'Martínez'), estado: 'read', hora: hace(90) },
        { direccion: 'entrada', tipo: 'button', texto: 'Sí, quiero información', estado: 'recibido', hora: hace(60) },
        { direccion: 'entrada', tipo: 'text', texto: '¿Qué metros tiene el más chico?', estado: 'recibido', hora: hace(47) }
      ]
    };
    var archivosDemo = { n: 0 };
    function buscar(tel) { for (var i = 0; i < cs.length; i++) if (cs[i].telefono === tel) return cs[i]; return null; }
    function chats() { return cs.filter(function (c) { return c.ultimaHora; }).sort(function (a, b) { return new Date(b.ultimaHora) - new Date(a.ultimaHora); }); }
    function conv(tel, sinMarcar) {
      var c = buscar(tel); if (c && !sinMarcar) c.sinLeer = 0;
      var lista = msgs[tel] || (c && c.ultimaHora ? [{ direccion: 'salida', tipo: 'plantilla', texto: plantilla.replace('{apellido}', c.apellido), estado: 'delivered', hora: c.ultimaHora }] : []);
      return { contacto: c, mensajes: lista, ventanaAbierta: !!(c && c.ventanaHasta && new Date(c.ventanaHasta) > new Date()) };
    }
    return {
      entrar: function () { return { sesion: 'demo', correo: 'demo', exp: Date.now() + 30 * 864e5 }; },
      listarChats: chats,
      sincronizar: function (tel) { var cv = tel ? conv(tel) : null; return { chats: chats(), conv: cv }; },
      listarContactos: function () { return cs.slice(); },
      conversacion: conv,
      enviarTexto: function (tel, texto) {
        var c = buscar(tel);
        if (c.etapa === 'BAJA') throw new Error('Este contacto pidió BAJA: no se le puede escribir');
        if (!(c.ventanaHasta && new Date(c.ventanaHasta) > new Date())) throw new Error('Pasaron más de 24 h: solo se puede mandar plantilla');
        if (/error/i.test(texto)) throw new Error('Meta: error de prueba');
        var h = new Date().toISOString();
        (msgs[tel] = msgs[tel] || []).push({ direccion: 'salida', tipo: 'texto', texto: texto, estado: 'enviado', hora: h });
        c.ultimoMsg = 'Tú: ' + texto; c.ultimaHora = h;
        return { estado: 'enviado', hora: h };
      },
      cambiarEtapa: function (tel, etapa) { buscar(tel).etapa = etapa; return true; },
      guardarNotas: function (tel, notas) { buscar(tel).notas = notas; return true; },
      importarContactos: function () { return { nuevos: 0, repetidos: 0, sinTelefono: 0 }; },
      vistaPreviaLote: function (cuantos) {
        var nuevos = cs.filter(function (c) { return c.etapa === 'Nuevo'; }), lista = nuevos.slice(0, cuantos);
        return { plantilla: 'primer_contacto_medica_country', estadoPlantilla: 'En revisión', cuantos: lista.length, disponibles: nuevos.length, enviadosHoy: 0, tope: 250, costoAprox: Math.round(lista.length * 0.7298 * 1.16), excluidosBaja: 1, ejemplo: lista[0] || null, semaforo: 'Verde' };
      },
      mandarLote: function () { throw new Error('Modo demo: no manda mensajes'); },
      semaforo: function () { return { calidadMeta: 'Sin avisos', estadoPlantilla: 'En revisión', tope: 250, lotes: [{ lote: 1, fecha: hace(60 * 52), enviados: 20, entregados: 19, si: 4, baja: 1, fallidos: 1, semaforo: 'Verde' }] }; },
      guardarSuscripcion: function () { return true; },
      enviarArchivo: function (tel, d) {
        var c = buscar(tel);
        if (!(c.ventanaHasta && new Date(c.ventanaHasta) > new Date())) throw new Error('Pasaron más de 24 h: solo se puede mandar plantilla');
        var id = 'demo-' + (++archivosDemo.n), h = new Date().toISOString(), tipo = d.tipo === 'imagen' ? 'image' : d.tipo === 'audio' ? 'audio' : 'document';
        archivosDemo[id] = { mime: d.mime, nombre: d.nombre, base64: d.base64 };
        (msgs[tel] = msgs[tel] || []).push({ direccion: 'salida', tipo: tipo, texto: d.pie || '', estado: 'enviado', hora: h, archivo: { id: id, mime: d.mime, nombre: d.nombre } });
        c.ultimoMsg = 'Tú: ' + (tipo === 'image' ? '📷 Foto' : tipo === 'audio' ? '🎤 Audio' : '📄 ' + d.nombre); c.ultimaHora = h;
        return { estado: 'enviado', hora: h, archivo: { id: id, mime: d.mime, nombre: d.nombre } };
      },
      enviarUbicacion: function (tel, lat, lng, nombre, direccion) {
        var c = buscar(tel), h = new Date().toISOString();
        (msgs[tel] = msgs[tel] || []).push({ direccion: 'salida', tipo: 'location', texto: nombre || '', estado: 'enviado', hora: h, archivo: { lat: lat, lng: lng, nombre: nombre || '', direccion: direccion || '' } });
        c.ultimoMsg = 'Tú: 📍 Ubicación'; c.ultimaHora = h; return { estado: 'enviado', hora: h };
      },
      enviarContacto: function (tel, nombre, t) {
        var c = buscar(tel), h = new Date().toISOString();
        (msgs[tel] = msgs[tel] || []).push({ direccion: 'salida', tipo: 'contacts', texto: '', estado: 'enviado', hora: h, archivo: { nombre: nombre, tel: t } });
        c.ultimoMsg = 'Tú: 👤 ' + nombre; c.ultimaHora = h; return { estado: 'enviado', hora: h };
      },
      archivo: function (id) { var a = archivosDemo[id]; if (!a) throw new Error('No existe'); return a; },
      // Simula que un doctor escribe (solo demo): llamar desde la consola con Demo.llega()
      _llega: function () { var c = cs[1], h = new Date().toISOString(); (msgs[c.telefono] = msgs[c.telefono] || []).push({ direccion: 'entrada', tipo: 'text', texto: '¿Tienen estacionamiento?', estado: 'recibido', hora: h }); c.ultimoMsg = '¿Tienen estacionamiento?'; c.ultimaHora = h; c.sinLeer = (c.sinLeer || 0) + 1; c.ventanaHasta = new Date(Date.now() + 24 * 3600e3).toISOString(); }
    };
  })();
  if (DEMO) window.SpaceDemo = Demo;

  // ------------------------------------------------------------------ sesión
  function guardarSesion(s) { E.sesion = s; try { localStorage.setItem('sc_sesion2', JSON.stringify(s)); } catch (e) {} }
  function cargarSesion() {
    try {
      var s = JSON.parse(localStorage.getItem('sc_sesion2') || 'null');
      if (s && s.sesion && s.exp > Date.now()) E.sesion = s;
      localStorage.removeItem('sc_sesion'); // sesión vieja (token de Google de 1 hora)
    } catch (e) {}
  }
  function cerrarSesion() {
    E.sesion = null; E.chats = []; E.contactos = []; E.convs = {};
    try { localStorage.removeItem('sc_sesion2'); localStorage.removeItem(CLAVE_CACHE); } catch (e) {}
    pintar();
  }

  function pantallaLogin() {
    E.vista = 'login';
    app.innerHTML =
      '<main class="login">' +
      '<div class="login-logo"><div class="login-icono">' + ICON.logo + '</div><h1>Space Chat</h1><p>Prospectos y chats de<br>Alto Espacio Hábitat</p></div>' +
      '<div class="login-acciones">' +
      (DEMO ? '<button class="login-boton" id="entrarDemo">Entrar (modo demo)</button>' : '<div id="botonGoogle" class="boton-google"></div><p id="entrando" class="oculto-suave">Entrando…</p>') +
      '<p style="font-size:13px">' + (DEMO ? 'Modo demo: datos de ejemplo, no manda mensajes.' : 'Solo entran las cuentas autorizadas.') + '</p>' +
      '</div></main>';
    if (DEMO) {
      $('entrarDemo').onclick = function () { guardarSesion({ sesion: 'demo', correo: 'demo', nombre: 'Demo', exp: Date.now() + 30 * 864e5 }); ir('chats'); };
      return;
    }
    cargarGoogle(function () {
      google.accounts.id.initialize({
        client_id: CFG.GOOGLE_CLIENT_ID,
        callback: function (resp) {
          var info = JSON.parse(decodeURIComponent(escape(atob(resp.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))));
          var aviso = $('entrando'); if (aviso) aviso.className = '';
          api('entrar', resp.credential).then(function (s) {
            guardarSesion({ sesion: s.sesion, correo: s.correo, nombre: info.given_name || info.name, exp: s.exp });
            ir('chats');
          }).catch(function (e) { if (aviso) aviso.className = 'oculto-suave'; toast(e.message, 'error'); });
        },
        auto_select: true
      });
      google.accounts.id.renderButton($('botonGoogle'), { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'es', width: 280 });
      google.accounts.id.prompt();
    });
  }
  function cargarGoogle(listo) {
    if (window.google && google.accounts) return listo();
    var s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = listo; document.head.appendChild(s);
  }

  // ------------------------------------------------------------------ hojas (ventanas que suben desde abajo) y confirmaciones
  function abrirHoja(html, alAbrir) {
    cerrarHoja(true);
    var fondo = document.createElement('div');
    fondo.className = 'hoja-fondo'; fondo.id = 'hoja';
    fondo.innerHTML = '<div class="hoja" role="dialog" aria-modal="true"><div class="hoja-asa"></div>' + html + '</div>';
    document.body.appendChild(fondo);
    requestAnimationFrame(function () { fondo.classList.add('abierta'); });
    fondo.addEventListener('click', function (ev) { if (ev.target === fondo) cerrarHoja(); });
    if (alAbrir) alAbrir(fondo.querySelector('.hoja'));
    return fondo;
  }
  function cerrarHoja(rapido) {
    var h = $('hoja'); if (!h) return;
    if (rapido) return h.remove();
    h.classList.remove('abierta'); setTimeout(function () { h.remove(); }, 220);
  }
  function confirmar(titulo, texto, boton, peligro) {
    return new Promise(function (resolver) {
      abrirHoja('<h2 class="hoja-titulo">' + esc(titulo) + '</h2><p class="hoja-texto">' + esc(texto) + '</p>' +
        '<div class="hoja-botones"><button class="boton-sec" data-r="no">Cancelar</button><button class="boton' + (peligro ? ' peligro' : '') + '" data-r="si">' + esc(boton) + '</button></div>', function (h) {
        h.querySelectorAll('[data-r]').forEach(function (b) { b.onclick = function () { cerrarHoja(); resolver(b.getAttribute('data-r') === 'si'); }; });
      });
    });
  }

  // ------------------------------------------------------------------ navegación
  function ir(r) { if (location.hash !== '#' + r) location.hash = r; else pintar(); }
  function ruta() { var h = location.hash.replace(/^#/, ''); return h || 'chats'; }
  window.addEventListener('hashchange', function () { cerrarHoja(true); pintar(); });
  window.matchMedia('(min-width: 900px)').addEventListener('change', function () { E.vista = ''; pintar(); });
  function seccion() { var r = ruta(); return r.indexOf('chat/') === 0 ? 'chats' : r; }
  function totalSinLeer() { return E.chats.reduce(function (n, c) { return n + (Number(c.sinLeer) || 0); }, 0); }

  function tabs() {
    var s = seccion(), n = totalSinLeer();
    function t(id, txt, ic, extra) { return '<a class="tab' + (s === id ? ' activo' : '') + '" href="#' + id + '">' + ic + '<span>' + txt + '</span>' + (extra || '') + '</a>'; }
    return '<nav class="tabs solo-cel" aria-label="Secciones">' +
      t('chats', 'Chats', ICON.chat, n ? '<span class="punto">' + n + '</span>' : '') +
      t('contactos', 'Contactos', ICON.personas) + t('campanas', 'Campañas', ICON.enviar) + t('semaforo', 'Semáforo', ICON.semaforo) + '</nav>';
  }
  function barraEscritorio() {
    var s = seccion(), n = totalSinLeer();
    function b(id, txt, extra) { return '<a class="' + (s === id ? 'activo' : '') + '" href="#' + id + '">' + txt + (extra || '') + '</a>'; }
    return '<header class="barra escritorio solo-escritorio">' +
      '<div class="marca-app"><div class="login-icono chico">' + ICON.chat.replace('currentColor', '#0B6B4F') + '</div><b>Space Chat</b>' + (DEMO ? '<span class="badge demo">Demo</span>' : '') + '</div>' +
      '<nav class="nav-escritorio" aria-label="Secciones">' + b('chats', 'Chats', n ? ' <span class="contador mini">' + n + '</span>' : '') + b('contactos', 'Contactos') + b('campanas', 'Campañas') + b('semaforo', 'Semáforo') + '</nav>' +
      '<div class="barra-der"><button class="icono-btn" data-accion="notif" aria-label="Activar notificaciones" title="Activar notificaciones">' + ICON.campana + '</button>' +
      '<span class="quien">' + esc(E.sesion.nombre || E.sesion.correo) + '</span><button class="icono-btn" data-accion="salir" aria-label="Cerrar sesión" title="Cerrar sesión">' + ICON.salir + '</button></div></header>';
  }
  function enlazarComunes(raiz) {
    (raiz || app).querySelectorAll('[data-accion="notif"]').forEach(function (b) { b.onclick = activarNotificaciones; });
    (raiz || app).querySelectorAll('[data-accion="salir"]').forEach(function (b) {
      b.onclick = function () { confirmar('¿Cerrar sesión?', 'Tendrás que volver a entrar con tu cuenta de Google.', 'Cerrar sesión').then(function (si) { if (si) cerrarSesion(); }); };
    });
  }
  function actualizarTitulo() { var n = totalSinLeer(); document.title = (n ? '(' + n + ') ' : '') + 'Space Chat'; }

  // ------------------------------------------------------------------ pintar
  function pintar() {
    if (!E.sesion) return pantallaLogin();
    var r = ruta();
    if (r === 'contactos') return vistaContactos();
    if (r === 'campanas') return vistaCampanas();
    if (r === 'semaforo') return vistaSemaforo();
    if (r.indexOf('chat/') === 0) return vistaChats(decodeURIComponent(r.slice(5)));
    return vistaChats('');
  }

  // ================================================================== CHATS
  function filaChat(c, sel) {
    var nueva = Number(c.sinLeer) > 0;
    return '<a class="fila' + (sel ? ' sel' : '') + (nueva ? ' nueva' : '') + '" href="#chat/' + esc(c.telefono) + '" data-tel="' + esc(c.telefono) + '">' + avatar(c) +
      '<div class="fila-info"><div class="fila-arriba"><span class="nombre">' + esc(nombreDe(c)) + '</span><span class="hora">' + esc(horaCorta(c.ultimaHora)) + '</span></div>' +
      '<div class="fila-abajo"><span class="ultimo">' + esc(c.ultimoMsg) + '</span>' + (nueva ? '<span class="contador">' + Number(c.sinLeer) + '</span>' : '') + '</div>' +
      '<span class="etapa t-' + esc(c.etapa) + '">' + esc(c.etapa) + (c.especialidad ? ' · ' + esc(c.especialidad) : '') + '</span></div></a>';
  }
  function chatsFiltrados() {
    var q = sinAcentos(E.buscaChat);
    return E.chats.filter(function (c) {
      if (E.filtroChat === 'Sin leer' && !(Number(c.sinLeer) > 0)) return false;
      if (E.filtroChat === 'Interesados' && c.etapa !== 'Interesado') return false;
      if (q && sinAcentos(nombreDe(c) + ' ' + c.especialidad + ' ' + c.telefono).indexOf(q) === -1) return false;
      return true;
    });
  }
  function esqueletoLista(n) {
    var s = ''; for (var i = 0; i < n; i++) s += '<div class="fila esqueleto"><div class="avatar"></div><div class="fila-info"><span class="linea l1"></span><span class="linea l2"></span></div></div>';
    return s;
  }
  function listaChatsHtml() {
    if (!E.listos.chats && !E.chats.length) return esqueletoLista(7);
    var l = chatsFiltrados();
    if (l.length) return l.map(function (c) { return filaChat(c, c.telefono === E.telSel); }).join('');
    if (E.buscaChat || E.filtroChat !== 'Todos') return '<p class="vacio">No hay chats con ese filtro.</p>';
    return '<p class="vacio">Todavía no hay chats.<br>Cuando mandes un lote o un doctor te escriba, aparecerá aquí.</p>';
  }
  function chipsChat(oscuro) {
    var sinLeer = E.chats.filter(function (c) { return Number(c.sinLeer) > 0; }).length;
    return '<div class="chips' + (oscuro ? '' : ' claros') + '" id="chipsChat">' + ['Todos', 'Sin leer', 'Interesados'].map(function (f) {
      return '<button class="chip' + (E.filtroChat === f ? ' activo' : '') + '" data-filtro="' + f + '">' + f + (f === 'Sin leer' && sinLeer ? ' · ' + sinLeer : '') + '</button>';
    }).join('') + '</div>';
  }
  function refrescarListaChats() {
    var l = $('listaChats'); if (l) l.innerHTML = listaChatsHtml();
    var ch = $('chipsChat'); if (ch) { var oscuro = !ch.classList.contains('claros'); ch.outerHTML = chipsChat(oscuro); enlazarChips(); }
    var tb = app.querySelector('.tabs'); if (tb) tb.outerHTML = tabs();
    var nv = app.querySelector('.nav-escritorio'); if (nv) { var nb = document.createElement('div'); nb.innerHTML = barraEscritorio(); nv.outerHTML = nb.querySelector('.nav-escritorio').outerHTML; }
    actualizarTitulo();
  }
  function enlazarChips() {
    app.querySelectorAll('[data-filtro]').forEach(function (b) { b.onclick = function () { E.filtroChat = b.getAttribute('data-filtro'); refrescarListaChats(); }; });
  }

  function vistaChats(tel) {
    var compu = esCompu();
    var antes = E.telSel;
    E.telSel = tel;
    // Si ya está pintada la estructura correcta, solo cambiamos lo necesario (no se reconstruye toda la pantalla).
    var clave = compu ? 'chats-compu' : (tel ? 'conv-cel' : 'chats-cel');
    if (!compu && E.vista === 'chats-cel' && tel) { var lc = $('listaChats'); E.scrollLista = lc ? lc.scrollTop : 0; E.vengoDeLista = true; }
    if (!compu && !tel) E.vengoDeLista = false;
    if (E.vista !== clave) {
      E.vista = clave;
      if (compu) {
        app.innerHTML = barraEscritorio() +
          '<div class="marco"><section class="panel panel-lista"><div class="lista-cab"><label class="oculto" for="buscaChat">Buscar chat</label><input id="buscaChat" class="buscar borde" type="search" placeholder="Buscar chat" value="' + esc(E.buscaChat) + '">' + chipsChat(false) + '</div><div class="contenido" id="listaChats"></div></section>' +
          '<section class="panel panel-conv" id="panelConv"></section>' +
          '<aside class="panel panel-ficha" id="panelFicha"></aside></div>';
      } else if (tel) {
        app.innerHTML = '<div class="conv entra" id="panelConv"></div>';
      } else {
        app.innerHTML = '<header class="barra"><div class="barra-fila"><h1>Space Chat' + (DEMO ? ' <span class="badge demo">Demo</span>' : '') + '</h1><div class="barra-der"><button class="icono-btn" data-accion="notif" aria-label="Activar notificaciones">' + ICON.campana + '</button><button class="icono-btn" data-accion="salir" aria-label="Cerrar sesión">' + ICON.salir + '</button></div></div>' +
          '<label class="oculto" for="buscaChat">Buscar chat</label><input id="buscaChat" class="buscar" type="search" placeholder="Buscar chat" value="' + esc(E.buscaChat) + '">' + chipsChat(true) + '</header>' +
          '<div class="contenido blanco" id="listaChats"></div>' + tabs();
      }
      enlazarComunes();
      var bc = $('buscaChat');
      if (bc) bc.oninput = function () { E.buscaChat = bc.value; var l = $('listaChats'); if (l) l.innerHTML = listaChatsHtml(); };
      enlazarChips();
    }
    var l = $('listaChats');
    if (l) {
      l.innerHTML = listaChatsHtml();
      if (!compu && !tel && E.scrollLista) { l.scrollTop = E.scrollLista; }
      if (!compu && !tel) activarJalarParaActualizar(l);
      if (compu && antes !== tel) { var s = l.querySelector('.fila.sel'); if (s && s.scrollIntoViewIfNeeded) s.scrollIntoViewIfNeeded(false); }
    }
    actualizarTitulo();
    if (tel) {
      if (antes !== tel || !$('mensajes')) pintarConv(true);
    } else if (compu) {
      $('panelConv').innerHTML = '<div class="vacio grande">' + ICON.chat + '<p>Elige un chat de la lista.</p></div>';
      $('panelFicha').innerHTML = '<span class="rotulo">Ficha</span><p class="nota">Elige un chat para ver la ficha del doctor.</p>';
    }
    sincronizar();
  }

  // Trae del cerebro, en UNA sola llamada, la lista de chats y la conversación abierta.
  var sincronizando = null, telEnCurso = null;
  function sincronizar() {
    if (!E.sesion) return Promise.resolve();
    var tel = E.telSel;
    // Si ya hay una actualización en curso para el mismo chat, espera a esa; si abriste otro chat, no lo hace esperar.
    if (sincronizando && telEnCurso === tel) { sincronizar.pendiente = true; return sincronizando; }
    telEnCurso = tel;
    var esta = api('sincronizar', tel || '').then(function (d) {
      var cambioLista = firma(d.chats) !== firma(E.chats);
      E.chats = d.chats || []; E.listos.chats = true;
      if (d.conv && d.conv.contacto) {
        var previo = E.convs[tel];
        var pendientes = previo ? previo.mensajes.filter(function (m) { return m._tmp && m.estado !== 'enviado'; }) : [];
        d.conv.mensajes = d.conv.mensajes.concat(pendientes);
        d.conv._t = Date.now();
        var cambioConv = !previo || firma(previo.mensajes) !== firma(d.conv.mensajes) || firma(previo.contacto) !== firma(d.conv.contacto);
        E.convs[tel] = d.conv;
        if (cambioConv && E.telSel === tel) pintarConv(false);
        // El chat abierto ya está leído.
        E.chats.forEach(function (c) { if (c.telefono === tel) c.sinLeer = 0; });
      } else if (tel && E.telSel === tel && !E.convs[tel]) {
        pintarConv(false, 'No encontré este contacto.');
      }
      if (cambioLista) refrescarListaChats(); else actualizarTitulo();
      guardarCache();
      precargar();
    }).catch(function (e) {
      if (!E.chats.length) { var l = $('listaChats'); if (l) l.innerHTML = '<p class="vacio">' + esc(e.message) + '<br><button class="boton-sec" id="reintentar" style="margin-top:12px">Reintentar</button></p>'; var r = $('reintentar'); if (r) r.onclick = sincronizar; }
      else toast(e.message, 'error');
    }).then(function () {
      if (sincronizando === esta) { sincronizando = null; telEnCurso = null; }
      if (sincronizar.pendiente) { sincronizar.pendiente = false; sincronizar(); }
    });
    sincronizando = esta;
    return esta;
  }

  // Baja por detrás las conversaciones de los chats más recientes para que abran al instante (sin marcarlas como leídas).
  var precargando = false;
  function precargar() {
    if (precargando) return;
    var faltan = E.chats.slice(0, 8).filter(function (c) {
      var cv = E.convs[c.telefono];
      return !cv || (cv.contacto && cv.contacto.ultimaHora !== c.ultimaHora);
    }).map(function (c) { return c.telefono; });
    if (!faltan.length) return;
    precargando = true;
    (function siguiente() {
      var tel = faltan.shift();
      if (!tel || !E.sesion) { precargando = false; guardarCache(); return; }
      api('conversacion', tel, true).then(function (cv) {
        if (cv && cv.contacto && tel !== E.telSel) { cv._t = Date.now() - 1; E.convs[tel] = cv; }
      }).catch(function () {}).then(siguiente);
    })();
  }

  function contactoDe(tel) {
    var cv = E.convs[tel];
    if (cv && cv.contacto) return cv.contacto;
    for (var i = 0; i < E.chats.length; i++) if (E.chats[i].telefono === tel) return E.chats[i];
    for (var j = 0; j < E.contactos.length; j++) if (E.contactos[j].telefono === tel) return E.contactos[j];
    return null;
  }

  // ---------- Fotos, audios, documentos, ubicación y contactos dentro del chat
  var TIPOS_MEDIO = { image: 'foto', sticker: 'foto', audio: 'audio', document: 'doc', video: 'doc', location: 'ubicacion', contacts: 'contacto' };
  function esMedio(m) { return !!TIPOS_MEDIO[m.tipo]; }
  function medioHtml(m) {
    var t = TIPOS_MEDIO[m.tipo]; if (!t) return '';
    var a = m.archivo || {};
    if (a.error) return '<div class="medio doc"><span class="medio-ic">' + ICON.documento + '</span><span class="medio-nombre">No se pudo bajar el archivo</span></div>';
    if (t === 'foto') {
      var src = m.local || (a.id && E.medios[a.id] && E.medios[a.id].url) || '';
      return '<button type="button" class="medio foto" data-arch="' + esc(a.id || '') + '">' + (src ? '<img src="' + src + '" alt="Foto">' : '<span class="medio-cargando"></span>') + '</button>';
    }
    if (t === 'audio') {
      var au = m.local || (a.id && E.medios[a.id] && E.medios[a.id].url) || '';
      return au ? '<audio class="medio-audio" controls src="' + au + '"></audio>'
        : '<button type="button" class="medio audio" data-arch="' + esc(a.id || '') + '" data-abrir="audio"><span class="medio-play">' + ICON.play + '</span><span class="medio-nombre">Audio · toca para escuchar</span></button>';
    }
    if (t === 'doc') {
      return '<button type="button" class="medio doc" data-arch="' + esc(a.id || '') + '" data-abrir="doc"><span class="medio-ic">' + ICON.documento + '</span><span class="medio-nombre">' + esc(a.nombre || (m.tipo === 'video' ? 'Video' : 'Documento')) + '</span></button>';
    }
    if (t === 'ubicacion') {
      var q = encodeURIComponent(a.lat + ',' + a.lng);
      return '<a class="medio ubic" href="https://www.google.com/maps/search/?api=1&query=' + q + '" target="_blank" rel="noopener"><span class="medio-ic">' + ICON.ubicacion + '</span><span class="medio-textos"><b>' + esc(a.nombre || 'Ubicación') + '</b>' + (a.direccion ? '<small>' + esc(a.direccion) + '</small>' : '') + '<span>Abrir en Mapas</span></span></a>';
    }
    if (t === 'contacto') {
      return '<a class="medio contacto" href="tel:' + esc(a.tel || '') + '"><span class="medio-ic">' + ICON.contacto + '</span><span class="medio-textos"><b>' + esc(a.nombre || 'Contacto') + '</b><span>' + esc(a.tel || '') + '</span></span></a>';
    }
    return '';
  }
  // Los archivos se piden al cerebro una sola vez y se guardan mientras la app está abierta.
  function obtenerMedio(id) {
    if (!E.medios[id]) {
      E.medios[id] = { promesa: api('archivo', id).then(function (r) {
        var bin = atob(r.base64), arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        var url = URL.createObjectURL(new Blob([arr], { type: r.mime }));
        E.medios[id].url = url; E.medios[id].nombre = r.nombre; E.medios[id].mime = r.mime;
        return E.medios[id];
      }).catch(function (e) { delete E.medios[id]; throw e; }) };
    }
    return E.medios[id].promesa;
  }
  function cargarMedios() {
    app.querySelectorAll('.medio.foto[data-arch]').forEach(function (b) {
      var id = b.getAttribute('data-arch');
      if (!id || b.querySelector('img')) return;
      obtenerMedio(id).then(function (r) {
        var mm = $('mensajes'), alFinal = mm && mm.scrollHeight - mm.scrollTop - mm.clientHeight < 80;
        b.innerHTML = '<img src="' + r.url + '" alt="Foto">';
        b.querySelector('img').onload = function () { if (alFinal && mm) mm.scrollTop = mm.scrollHeight; };
      }).catch(function () { b.innerHTML = '<span class="medio-nombre">No se pudo cargar la foto</span>'; });
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.medio[data-arch]');
    if (!b) return;
    var id = b.getAttribute('data-arch'), que = b.getAttribute('data-abrir');
    if (b.classList.contains('foto')) {
      var img = b.querySelector('img'); if (!img) return;
      var v = document.createElement('div'); v.className = 'visor'; v.innerHTML = '<img src="' + img.src + '" alt="Foto"><button class="visor-cerrar" aria-label="Cerrar">✕</button>';
      v.onclick = function () { v.remove(); }; document.body.appendChild(v); return;
    }
    if (!id) return;
    var nom = b.querySelector('.medio-nombre'), antes = nom && nom.textContent;
    if (nom) nom.textContent = 'Cargando…';
    obtenerMedio(id).then(function (r) {
      if (que === 'audio') { b.outerHTML = '<audio class="medio-audio" controls autoplay src="' + r.url + '"></audio>'; return; }
      if (nom) nom.textContent = antes;
      var a = document.createElement('a'); a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; a.download = r.nombre || 'archivo';
      document.body.appendChild(a); a.click(); a.remove();
    }).catch(function (err) { if (nom) nom.textContent = antes; toast('No se pudo abrir: ' + err.message, 'error'); });
  });

  // Texto completo de la plantilla aprobada (en la hoja solo se guarda "Plantilla de primer contacto").
  var TEXTO_PLANTILLA = 'Dr(a). {apellido}:\n\nEspero que se encuentre bien. Le escribo en nombre de Alto Espacio, colaborador de MÉDICA COUNTRY, un nuevo desarrollo médico en la colonia Country Club de Guadalajara. Le invitamos a unirse a nuestra lista de preventa fase 0.\n\nMÉDICA COUNTRY, desarrollado por GRUPO OPERA y GRUPO INVERTI grupos responsables de Médica Acueducto, tendrá 15 niveles de consultorios y clínicas especializadas, sanitarios, elevadores y recepción en cada piso. Comedor, cafetería, laboratorio, gimnasio y valet parking para profesionales de la salud y 6 niveles de estacionamiento.\n\nLa entrega es en diciembre de 2029. Tenemos promociones como meses sin intereses, crédito interno y las mensualidades más bajas. Enganche desde el 10%, 20% en mensualidades durante obra y 70% contra entrega, opción de crédito bancario preferencial. Unidades con vista panorámica desde $1,182,067.00, apartado con solo $50,000.00, reembolsables.\n\nQuedo a su disposición para brindarle más información.\n\nMarco Smith\nAlto Espacio';
  function textoPlantilla(m, c) {
    var t = m.texto || '';
    if (!t || /^Plantilla de primer contacto$/i.test(t) || /…$/.test(t)) t = TEXTO_PLANTILLA.replace('{apellido}', (c && c.apellido) || '');
    return t;
  }
  function burbujas(mensajes, c) {
    var html = '', ultimoDia = '';
    mensajes.forEach(function (m, i) {
      var d = dia(m.hora);
      if (d !== ultimoDia) { html += '<div class="aviso-centro">' + esc(d) + '</div>'; ultimoDia = d; }
      if (m.direccion === 'salida') {
        var est = m.estado, vista;
        if (est === 'pendiente') vista = '<span class="estado reloj">' + ICON.reloj + '</span>';
        else if (est === 'error') vista = '';
        else if (est === 'read') vista = '<span class="estado leido">' + CHECK2 + '</span>';
        else if (est === 'delivered') vista = '<span class="estado">' + CHECK2 + '</span>';
        else if (est === 'failed') vista = '<span class="estado fallo">No se entregó</span>';
        else vista = '<span class="estado">' + CHECK1 + '</span>';
        html += '<div class="globo salida' + (esMedio(m) ? ' con-medio' : '') + (est === 'pendiente' ? ' pendiente' : '') + (est === 'error' ? ' con-error' : '') + '">' +
          (m.tipo === 'plantilla'
            ? '<span class="marca">Plantilla · primer contacto</span><span class="txt plegado">' + esc(textoPlantilla(m, c)) + '</span><button type="button" class="ver-plantilla">Ver mensaje completo</button>'
            : medioHtml(m) + (m.texto && m.tipo !== 'location' && m.tipo !== 'contacts' ? '<span class="txt">' + esc(m.texto) + '</span>' : '')) +
          '<span class="meta">' + hora(m.hora) + ' ' + vista + '</span></div>' +
          (est === 'error' ? '<button class="reintentar-msg" data-i="' + i + '">No se envió · ' + esc(m.error || '') + ' <b>Reintentar</b></button>' : '');
      } else {
        html += '<div class="globo entrada' + (esMedio(m) ? ' con-medio' : '') + '">' + (m.tipo === 'button' || m.tipo === 'interactive' ? '<span class="marca">Tocó el botón</span>' : '') + medioHtml(m) + (m.texto && m.tipo !== 'location' && m.tipo !== 'contacts' ? '<span class="txt">' + esc(m.texto) + '</span>' : '') + '<span class="meta">' + hora(m.hora) + '</span></div>';
      }
    });
    return html;
  }

  /** Pinta la conversación. "inicial" = recién abierta: se arma toda la pantalla con lo que haya en memoria. */
  function pintarConv(inicial, error) {
    var tel = E.telSel, panel = $('panelConv');
    if (!panel || !tel) return;
    var cv = E.convs[tel], c = contactoDe(tel);
    if (!c) {
      panel.innerHTML = '<header class="conv-barra"><a class="icono-btn volver" href="#chats" aria-label="Volver">' + ICON.atras + '</a><div class="conv-nombre">Cargando…</div></header>' +
        '<div class="mensajes">' + (error ? '<p class="vacio">' + esc(error) + '</p>' : '<div class="cargando-msgs"><span></span><span></span><span></span></div>') + '</div>';
      return;
    }
    var m = $('mensajes');
    var cercaDelFinal = m ? (m.scrollHeight - m.scrollTop - m.clientHeight < 120) : true;
    var sub = [c.especialidad, c.ciudad].filter(Boolean).join(' · ') || telBonito(c.telefono);
    var resto = c.ventanaHasta ? restante(c.ventanaHasta) : null;
    var puede = !!resto && c.etapa !== 'BAJA';
    var aviso = c.etapa === 'BAJA'
      ? '<div class="ventana cerrada">Pidió BAJA: no se le puede volver a escribir.</div>'
      : resto ? '<div class="ventana">' + ICON.reloj + '<span><b>Puedes escribirle libre</b> por ' + resto + '</span></div>'
        : (cv ? '<div class="ventana cerrada">Pasaron más de 24 h desde su último mensaje: solo se puede mandar plantilla.</div>' : '');
    var cuerpoMsgs = cv ? (cv.mensajes.length ? burbujas(cv.mensajes, c) : '<p class="vacio">Sin mensajes todavía.</p>')
      : '<div class="cargando-msgs"><span></span><span></span><span></span></div>';

    if (inicial || !$('formMsg')) {
      panel.innerHTML =
        '<div class="conv-arriba"><header class="conv-barra"><a class="icono-btn volver" href="#chats" aria-label="Volver a chats">' + ICON.atras + '</a>' +
        '<button class="conv-quien" id="verFicha" aria-label="Ver ficha">' + avatar(c, 'chico') +
        '<span class="conv-textos"><span class="conv-nombre" id="convNombre">' + esc(nombreDe(c)) + '</span><span class="conv-sub" id="convSub">' + esc(sub) + '</span></span></button>' +
        '<button class="icono-btn" id="verFicha2" aria-label="Ver ficha">' + ICON.info + '</button></header>' +
        '<div class="conv-cab-escritorio solo-escritorio"><div class="conv-cab-quien">' + avatar(c, 'chico') + '<div><div class="cab-nombre" id="cabNombre">' + esc(nombreDe(c)) + '</div><div class="nota" id="cabSub">' + esc(sub) + '</div></div></div><div class="cab-der"><button class="badge e-' + esc(c.etapa) + ' badge-btn" id="cabEtapa" title="Cambiar etapa">' + esc(c.etapa) + ' ▾</button><button class="icono-btn oscuro ficha-btn" id="verFicha3" aria-label="Ver ficha" title="Ver ficha">' + ICON.info + '</button></div></div>' +
        '<div id="avisoVentana">' + aviso + '</div></div>' +
        '<div class="mensajes" id="mensajes">' + cuerpoMsgs + '</div>' +
        '<form class="redactar" id="formMsg" autocomplete="off"><div class="marco-barra" style="display:flex;justify-content:flex-start;padding:0 4px 6px"><button type="button" class="boton-sec chico-btn" id="btnMarco" style="font-size:13px;padding:6px 12px"' + (puede ? '' : ' disabled') + '>✨ Sugerir respuesta (Marco)</button></div><div class="escribir">' +
        '<button type="button" class="extra-btn solo-cel" id="btnMas" aria-label="Adjuntar"' + (puede ? '' : ' disabled') + '>' + ICON.mas + '</button>' +
        '<label class="oculto" for="msg">Escribe un mensaje</label><textarea id="msg" rows="1" placeholder="' + (puede ? 'Escribe un mensaje' : (c.etapa === 'BAJA' ? 'Pidió BAJA' : 'Solo con plantilla')) + '"' + (puede ? '' : ' disabled') + '></textarea>' +
        '<button type="button" class="extra-btn solo-cel" id="btnCamara" aria-label="Cámara"' + (puede ? '' : ' disabled') + '>' + ICON.camara + '</button>' +
        '<button type="button" class="extra-btn micro solo-cel" id="btnMicro" aria-label="Grabar audio"' + (puede ? '' : ' disabled') + '>' + ICON.micro + '</button>' +
        '<button class="enviar" id="btnEnviar" aria-label="Enviar"' + (puede ? '' : ' disabled') + '>' + ICON.mandar + '</button></div></form>';
      enlazarConv();
      medirConv(panel);
      var mm = $('mensajes'); mm.scrollTop = mm.scrollHeight;
    } else {
      $('avisoVentana').innerHTML = aviso;
      ['convNombre', 'cabNombre'].forEach(function (id) { var x = $(id); if (x) x.textContent = nombreDe(c); });
      ['convSub', 'cabSub'].forEach(function (id) { var x = $(id); if (x) x.textContent = sub; });
      var ce = $('cabEtapa'); if (ce) { ce.className = 'badge e-' + c.etapa + ' badge-btn'; ce.textContent = c.etapa + ' ▾'; }
      m.innerHTML = cuerpoMsgs;
      if (cercaDelFinal) m.scrollTop = m.scrollHeight;
      var inp = $('msg'), btn = $('btnEnviar');
      inp.disabled = !puede; btn.disabled = !puede || !inp.value.trim();
      ['btnMas', 'btnCamara', 'btnMicro', 'btnMarco'].forEach(function (id) { var x = $(id); if (x) x.disabled = !puede; });
      inp.placeholder = puede ? 'Escribe un mensaje' : (c.etapa === 'BAJA' ? 'Pidió BAJA' : 'Solo con plantilla');
    }
    enlazarReintentos();
    cargarMedios();
    pintarFicha(c);
  }

  // En el celular, el encabezado y la barra de escribir flotan sobre los mensajes (como WhatsApp):
  // se mide cuánto ocupan para que el primer y el último mensaje no queden tapados.
  function medirConv(panel) {
    if (!window.ResizeObserver) return;
    var arriba = panel.querySelector('.conv-arriba'), abajo = panel.querySelector('.redactar'), mm = $('mensajes');
    var ro = new ResizeObserver(function () {
      var alFinal = mm.scrollHeight - mm.scrollTop - mm.clientHeight < 60;
      panel.style.setProperty('--arriba', arriba.offsetHeight + 'px');
      panel.style.setProperty('--abajo', abajo.offsetHeight + 'px');
      if (alFinal) mm.scrollTop = mm.scrollHeight;
    });
    ro.observe(arriba); ro.observe(abajo);
  }

  function volverALista(ev) {
    if (ev) ev.preventDefault();
    if (E.vengoDeLista) history.back(); else ir('chats');
  }
  function enlazarConv() {
    var inp = $('msg'), btn = $('btnEnviar');
    app.querySelectorAll('.volver').forEach(function (a) { a.onclick = volverALista; });
    function ajustar() {
      inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 120) + 'px'; btn.disabled = inp.disabled || !inp.value.trim();
      // Como WhatsApp: con texto se ve el botón de enviar; sin texto, cámara y micrófono.
      inp.parentNode.classList.toggle('con-texto', !!inp.value.trim());
    }
    // "+", cámara y micrófono: mandar fotos, documentos, ubicación, contactos y audios.
    $('btnMas').onclick = function () {
      var ops = [['fotos', 'Fotos', 'fotos'], ['camara2', 'Cámara', 'camara'], ['ubicacion', 'Ubicación', 'ubicacion'], ['contacto', 'Contacto', 'contacto'], ['documento', 'Documento', 'documento']];
      abrirHoja('<div class="adjuntar">' + ops.map(function (o) {
        return '<button type="button" class="adjuntar-op" data-op="' + o[2] + '"><span class="adjuntar-ic ' + o[2] + '">' + ICON[o[0]] + '</span><span>' + o[1] + '</span></button>';
      }).join('') + '</div>', function (h) {
        h.querySelectorAll('.adjuntar-op').forEach(function (b) {
          b.onclick = function () {
            var op = b.getAttribute('data-op'); cerrarHoja();
            if (op === 'fotos') elegirArchivo('image/*', false, prepararFoto);
            else if (op === 'camara') elegirArchivo('image/*', true, prepararFoto);
            else if (op === 'documento') elegirArchivo('', false, prepararDocumento);
            else if (op === 'ubicacion') prepararUbicacion();
            else if (op === 'contacto') prepararContacto();
          };
        });
      });
    };
    $('btnCamara').onclick = function () { elegirArchivo('image/*', true, prepararFoto); };
    $('btnMicro').onclick = grabarAudio;
    // Marco (Gemini) sugiere la respuesta; tú la revisas y la mandas.
    $('btnMarco').onclick = function () {
      var b = $('btnMarco'), antes = b.textContent, tel = E.telSel;
      b.disabled = true; b.textContent = 'Marco está escribiendo…';
      api('sugerirRespuesta', tel).then(function (t) {
        if (E.telSel !== tel) return;
        inp.value = t || ''; ajustar(); inp.focus();
        toast('Revisa la sugerencia antes de mandarla');
      }).catch(function (e) { toast(e.message, 'error'); })
        .then(function () { var x = $('btnMarco'); if (x) { x.disabled = inp.disabled; x.textContent = antes; } });
    };
    inp.oninput = ajustar; ajustar();
    inp.onkeydown = function (ev) { if (ev.key === 'Enter' && !ev.shiftKey && esCompu()) { ev.preventDefault(); $('formMsg').requestSubmit ? $('formMsg').requestSubmit() : $('formMsg').onsubmit(ev); } };
    $('formMsg').onsubmit = function (ev) {
      ev.preventDefault();
      var txt = inp.value.trim();
      if (!txt || inp.disabled) return;
      inp.value = ''; ajustar();
      if (esCompu()) inp.focus();
      enviar(E.telSel, txt);
    };
    var vf = function () { if (!esCompu() || window.innerWidth < 1200) abrirFichaCel(); };
    $('verFicha').onclick = vf; $('verFicha2').onclick = vf; $('verFicha3').onclick = vf;
    var ce = $('cabEtapa'); if (ce) ce.onclick = function () { elegirEtapa(contactoDe(E.telSel)); };
  }
  function enlazarReintentos() {
    app.querySelectorAll('.reintentar-msg').forEach(function (b) {
      b.onclick = function () {
        var cv = E.convs[E.telSel], m = cv && cv.mensajes[Number(b.getAttribute('data-i'))];
        if (!m) return;
        if (m._reenviar) { m.estado = 'pendiente'; m.error = ''; pintarConv(false); m._reenviar(); return; }
        cv.mensajes.splice(cv.mensajes.indexOf(m), 1);
        enviar(E.telSel, m.texto);
      };
    });
  }

  // ---------- Mandar archivos
  function elegirArchivo(accept, camara, alElegir) {
    var inp = document.createElement('input');
    inp.type = 'file'; if (accept) inp.accept = accept; if (camara) inp.setAttribute('capture', 'environment');
    inp.style.display = 'none';
    inp.onchange = function () { var f = inp.files && inp.files[0]; inp.remove(); if (f) alElegir(f); };
    document.body.appendChild(inp); inp.click();
  }
  function leerBase64(blob) {
    return new Promise(function (ok, mal) {
      var r = new FileReader();
      r.onload = function () { var s = String(r.result); ok({ dataUrl: s, base64: s.slice(s.indexOf(',') + 1) }); };
      r.onerror = function () { mal(new Error('No se pudo leer el archivo')); };
      r.readAsDataURL(blob);
    });
  }
  // Las fotos se achican (máx. 1600 px) para que suban rápido.
  function comprimirFoto(file) {
    return new Promise(function (ok, mal) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1600, k = Math.min(1, max / Math.max(img.width, img.height));
        var cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
        var s = cv.toDataURL('image/jpeg', 0.82);
        ok({ dataUrl: s, base64: s.slice(s.indexOf(',') + 1), mime: 'image/jpeg', nombre: 'foto.jpg' });
      };
      img.onerror = function () { URL.revokeObjectURL(url); mal(new Error('No se pudo abrir la foto')); };
      img.src = url;
    });
  }
  function hojaEnviar(html, alEnviar) {
    abrirHoja(html + '<div class="hoja-botones"><button class="boton-sec" data-r="no">Cancelar</button><button class="boton" data-r="si">Enviar</button></div>', function (h) {
      h.querySelector('[data-r="no"]').onclick = function () { cerrarHoja(); };
      h.querySelector('[data-r="si"]').onclick = function () { if (alEnviar(h) !== false) cerrarHoja(); };
    });
  }
  function prepararFoto(file) {
    var tel = E.telSel;
    comprimirFoto(file).then(function (f) {
      hojaEnviar('<h2 class="hoja-titulo">Mandar foto</h2><img class="vista-foto" src="' + f.dataUrl + '" alt="Foto">' +
        '<label class="oculto" for="pieFoto">Comentario</label><input id="pieFoto" class="campo" placeholder="Añade un comentario (opcional)">', function (h) {
        var pie = h.querySelector('#pieFoto').value.trim();
        enviarMedio(tel, { tipo: 'image', texto: pie, local: f.dataUrl, archivo: { mime: f.mime, nombre: f.nombre } }, 'Tú: 📷 Foto', function () {
          return api('enviarArchivo', tel, { tipo: 'imagen', nombre: f.nombre, mime: f.mime, base64: f.base64, pie: pie });
        });
      });
    }).catch(function (e) { toast(e.message, 'error'); });
  }
  function prepararDocumento(file) {
    var tel = E.telSel;
    if (file.size > 15 * 1024 * 1024) return toast('El archivo pesa más de 15 MB', 'error');
    var mb = file.size > 1048576 ? (file.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(file.size / 1024)) + ' KB';
    hojaEnviar('<h2 class="hoja-titulo">Mandar documento</h2><div class="medio doc grande"><span class="medio-ic">' + ICON.documento + '</span><span class="medio-textos"><b>' + esc(file.name) + '</b><span>' + mb + '</span></span></div>', function () {
      leerBase64(file).then(function (f) {
        var mime = file.type || 'application/octet-stream';
        enviarMedio(tel, { tipo: 'document', texto: '', archivo: { mime: mime, nombre: file.name } }, 'Tú: 📄 ' + file.name, function () {
          return api('enviarArchivo', tel, { tipo: 'documento', nombre: file.name, mime: mime, base64: f.base64 });
        });
      }).catch(function (e) { toast(e.message, 'error'); });
    });
  }
  // ---------- Mandar ubicación (como WhatsApp): mapa, "mi ubicación actual", lugares cercanos y buscador.
  // Mapa: Leaflet + mapa de OpenStreetMap. Lugares: OpenStreetMap (Overpass y Nominatim). Todo gratis, sin claves.
  function cargarMapa(listo, mal) {
    if (window.L) return listo();
    var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(css);
    var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    s.onload = listo; s.onerror = function () { mal(new Error('No se pudo cargar el mapa')); }; document.head.appendChild(s);
  }
  function distancia(a, b, c, d) { var r = Math.PI / 180, x = (d - b) * r * Math.cos((a + c) / 2 * r), y = (c - a) * r; return Math.round(Math.sqrt(x * x + y * y) * 6371000); }
  function direccionOSM(t) {
    t = t || {};
    var calle = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
    return [calle, t['addr:suburb'] || t['addr:neighbourhood'], t['addr:city']].filter(Boolean).join(', ');
  }
  // Pide a la vez a varios servidores de OpenStreetMap; se usa el primero que conteste (a veces alguno está saturado).
  function conTiempo(url, opciones, ms) {
    var c = window.AbortController ? new AbortController() : null;
    if (c) { opciones = opciones || {}; opciones.signal = c.signal; setTimeout(function () { c.abort(); }, ms); }
    return fetch(url, opciones).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function primeroQueConteste(promesas) {
    return new Promise(function (ok, mal) {
      var fallas = 0;
      promesas.forEach(function (p) { p.then(function (l) { if (l && l.length) ok(l); else if (++fallas === promesas.length) ok([]); }, function () { if (++fallas === promesas.length) mal(new Error('sin lugares')); }); });
    });
  }
  function lugaresCercanos(lat, lng) {
    var a = '(around:400,' + lat + ',' + lng + ')';
    var q = '[out:json][timeout:8];(nwr' + a + '[amenity][name];nwr' + a + '[shop][name];nwr' + a + '[office][name];nwr' + a + '[healthcare][name];nwr' + a + '[leisure][name];nwr' + a + '[tourism][name];);out center 40;';
    function arreglar(l) { return l.filter(function (x) { return x.lat && x.nombre; }).map(function (x) { x.dist = distancia(lat, lng, x.lat, x.lng); return x; }).sort(function (a, b) { return a.dist - b.dist; }).slice(0, 25); }
    var overpass = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'].map(function (u) {
      return conTiempo(u, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, 9000).then(function (j) {
        return arreglar((j.elements || []).map(function (e) {
          return { nombre: e.tags && e.tags.name, direccion: direccionOSM(e.tags), lat: e.lat || (e.center && e.center.lat), lng: e.lon || (e.center && e.center.lon) };
        }));
      });
    });
    var photon = conTiempo('https://photon.komoot.io/reverse?lat=' + lat + '&lon=' + lng + '&limit=25&radius=0.5', {}, 9000).then(function (j) {
      return arreglar((j.features || []).filter(function (f) { return /amenity|shop|office|healthcare|leisure|tourism/.test(f.properties.osm_key); }).map(function (f) {
        var p = f.properties;
        return { nombre: p.name, direccion: [[p.street, p.housenumber].filter(Boolean).join(' '), p.district, p.city].filter(Boolean).join(', '), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
      }));
    });
    return primeroQueConteste(overpass.concat([photon]));
  }
  function buscarLugares(texto, lat, lng) {
    var u = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=10&countrycodes=mx&accept-language=es&q=' + encodeURIComponent(texto);
    if (lat) u += '&viewbox=' + (lng - .4) + ',' + (lat + .4) + ',' + (lng + .4) + ',' + (lat - .4);
    return fetch(u).then(function (r) { return r.json(); }).then(function (l) {
      return l.map(function (x) {
        var nombre = x.name || String(x.display_name).split(',')[0];
        return { nombre: nombre, direccion: String(x.display_name).split(',').slice(1, 4).join(',').trim(), lat: +x.lat, lng: +x.lon };
      });
    });
  }
  function direccionDe(lat, lng) {
    return fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=es&lat=' + lat + '&lon=' + lng)
      .then(function (r) { return r.json(); }).then(function (x) { return String(x.display_name || '').split(',').slice(0, 3).join(',').trim(); }).catch(function () { return ''; });
  }
  function prepararUbicacion() {
    var tel = E.telSel;
    if (!navigator.geolocation) return toast('Tu teléfono no deja usar la ubicación aquí', 'error');
    var yo = null, mapa = null, punto = null, movida = false, buscando = 0;
    var h = abrirHoja(
      '<div class="ubic-cab"><button type="button" class="extra-btn" data-u="cerrar" aria-label="Cerrar">✕</button><h2>Enviar ubicación</h2><button type="button" class="extra-btn" data-u="recargar" aria-label="Volver a buscar">↻</button></div>' +
      '<div class="ubic-mapa"><div id="mapaUbic"></div><span class="ubic-centro"></span>' +
      '<label class="oculto" for="buscaUbic">Buscar lugar</label><input id="buscaUbic" class="ubic-buscar" type="search" placeholder="Buscar o escribir dirección" autocomplete="off">' +
      '<button type="button" class="extra-btn ubic-yo" data-u="yo" aria-label="Ir a mi ubicación">' + ICON.ubicame + '</button></div>' +
      '<div class="ubic-lista" id="listaUbic"><div class="ubic-op actual" data-u="actual"><span class="ubic-ic yo"><span></span></span><span class="medio-textos"><b>Enviar mi ubicación actual</b><span id="precUbic">Buscando tu ubicación…</span></span></div>' +
      '<div class="ubic-titulo" id="tituloUbic">Lugares cercanos</div><div id="cercanos"><p class="nota">Buscando lugares…</p></div></div>'
    ).querySelector('.hoja');
    h.classList.add('hoja-ubic');
    var lista = h.querySelector('#cercanos');
    function filaLugar(x) {
      return '<button type="button" class="ubic-op" data-lat="' + x.lat + '" data-lng="' + x.lng + '" data-nombre="' + esc(x.nombre) + '" data-dir="' + esc(x.direccion || '') + '"><span class="ubic-ic">' + ICON.ubicacion + '</span><span class="medio-textos"><b>' + esc(x.nombre) + '</b><span>' + esc(x.direccion || (x.dist != null ? 'A ' + x.dist + ' m' : '')) + '</span></span></button>';
    }
    function pintarLugares(l, vacio) { lista.innerHTML = l.length ? l.map(filaLugar).join('') : '<p class="nota">' + vacio + '</p>'; }
    function mandar(lat, lng, nombre, direccion) {
      cerrarHoja();
      enviarMedio(tel, { tipo: 'location', texto: nombre || '', archivo: { lat: lat, lng: lng, nombre: nombre || '', direccion: direccion || '' } }, 'Tú: 📍 ' + (nombre || 'Ubicación'), function () {
        return api('enviarUbicacion', tel, lat, lng, nombre || '', direccion || '');
      });
    }
    function cercanosDe(lat, lng) {
      var n = ++buscando; lista.innerHTML = '<p class="nota">Buscando lugares…</p>';
      lugaresCercanos(lat, lng).then(function (l) { if (n === buscando) pintarLugares(l, 'No encontré lugares con nombre cerca.'); })
        .catch(function () { if (n === buscando) pintarLugares([], 'Ahorita no cargaron los lugares cercanos. Puedes buscar uno arriba o mandar tu ubicación actual.'); });
    }
    function ubicarme() {
      h.querySelector('#precUbic').textContent = 'Buscando tu ubicación…';
      navigator.geolocation.getCurrentPosition(function (pos) {
        yo = { lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6), prec: Math.round(pos.coords.accuracy) };
        movida = false; actualizarPrimera();
        if (mapa) { mapa.setView([yo.lat, yo.lng], 17); punto.setLatLng([yo.lat, yo.lng]); }
        cercanosDe(yo.lat, yo.lng);
      }, function () {
        h.querySelector('#precUbic').textContent = 'No se pudo obtener tu ubicación. Revisa el permiso.';
        lista.innerHTML = '<p class="nota">Puedes buscar un lugar arriba.</p>';
      }, { enableHighAccuracy: true, timeout: 15000 });
    }
    function actualizarPrimera() {
      var b = h.querySelector('.ubic-op.actual b'), p = h.querySelector('#precUbic');
      if (movida) { b.textContent = 'Enviar esta ubicación'; p.textContent = 'El punto del centro del mapa'; }
      else if (yo) { b.textContent = 'Enviar mi ubicación actual'; p.textContent = 'Margen de precisión: ' + yo.prec + ' m'; }
    }
    cargarMapa(function () {
      if (!document.body.contains(h)) return;
      var ini = yo ? [yo.lat, yo.lng] : [20.6736, -103.344];
      mapa = L.map('mapaUbic', { zoomControl: false, attributionControl: true }).setView(ini, yo ? 17 : 12);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa);
      punto = L.circleMarker(ini, { radius: 9, color: '#fff', weight: 3, fillColor: '#23B07D', fillOpacity: 1 }).addTo(mapa);
      mapa.on('dragstart', function () { movida = true; h.classList.add('movida'); actualizarPrimera(); });
      mapa.on('moveend', function () { if (movida) { var c = mapa.getCenter(); cercanosDe(+c.lat.toFixed(6), +c.lng.toFixed(6)); } });
      setTimeout(function () { mapa.invalidateSize(); }, 250);
    }, function () { h.querySelector('.ubic-mapa').classList.add('sin-mapa'); });
    ubicarme();
    // Buscar un lugar o dirección.
    var tBusca, inp = h.querySelector('#buscaUbic');
    inp.oninput = function () {
      clearTimeout(tBusca);
      var q = inp.value.trim(), titulo = h.querySelector('#tituloUbic');
      if (q.length < 3) { titulo.textContent = 'Lugares cercanos'; var c = movida && mapa ? mapa.getCenter() : yo; if (c) cercanosDe(c.lat, c.lng); return; }
      titulo.textContent = 'Resultados';
      tBusca = setTimeout(function () {
        var n = ++buscando; lista.innerHTML = '<p class="nota">Buscando…</p>';
        buscarLugares(q, yo && yo.lat, yo && yo.lng).then(function (l) { if (n === buscando) pintarLugares(l, 'No encontré ese lugar.'); })
          .catch(function () { if (n === buscando) pintarLugares([], 'No se pudo buscar. Revisa tu internet.'); });
      }, 600);
    };
    h.addEventListener('click', function (e) {
      var b = e.target.closest('[data-u], .ubic-op'); if (!b) return;
      var u = b.getAttribute('data-u');
      if (u === 'cerrar') return cerrarHoja();
      if (u === 'recargar' || u === 'yo') { h.classList.remove('movida'); return ubicarme(); }
      if (u === 'actual') {
        if (movida && mapa) { var c = mapa.getCenter(), la = +c.lat.toFixed(6), lo = +c.lng.toFixed(6); return direccionDe(la, lo).then(function (dir) { mandar(la, lo, '', dir); }); }
        if (!yo) return toast('Todavía no tengo tu ubicación');
        return direccionDe(yo.lat, yo.lng).then(function (dir) { mandar(yo.lat, yo.lng, '', dir); });
      }
      if (b.hasAttribute('data-lat')) mandar(+b.getAttribute('data-lat'), +b.getAttribute('data-lng'), b.getAttribute('data-nombre'), b.getAttribute('data-dir'));
    });
  }
  function prepararContacto() {
    var tel = E.telSel;
    hojaEnviar('<h2 class="hoja-titulo">Mandar un contacto</h2>' +
      '<label class="rotulo" for="nomContacto">Nombre</label><input id="nomContacto" class="campo" placeholder="Ej. Diego McGregor">' +
      '<label class="rotulo" for="telContacto">Teléfono</label><input id="telContacto" class="campo" type="tel" inputmode="tel" placeholder="33 1234 5678">', function (h) {
      var nombre = h.querySelector('#nomContacto').value.trim(), t = h.querySelector('#telContacto').value.replace(/[^\d+]/g, '');
      if (!nombre || t.replace(/\D/g, '').length < 10) { toast('Pon nombre y teléfono de 10 dígitos', 'error'); return false; }
      if (t.replace(/\D/g, '').length === 10) t = '+52' + t.replace(/\D/g, '');
      enviarMedio(tel, { tipo: 'contacts', texto: '', archivo: { nombre: nombre, tel: t } }, 'Tú: 👤 ' + nombre, function () {
        return api('enviarContacto', tel, nombre, t);
      });
    });
  }
  // Notas de voz: se toca el micrófono para grabar; luego "Enviar" o la basura para cancelar.
  function grabarAudio() {
    var tel = E.telSel, form = $('formMsg');
    if (!navigator.mediaDevices || !window.MediaRecorder) return toast('Tu teléfono no deja grabar audio aquí', 'error');
    var tipos = ['audio/mp4', 'audio/ogg;codecs=opus', 'audio/aac'], mime = '';
    for (var i = 0; i < tipos.length; i++) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(tipos[i])) { mime = tipos[i]; break; }
    if (!mime) return toast('Este navegador no graba en un formato que acepte WhatsApp', 'error');
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var rec = new MediaRecorder(stream, { mimeType: mime }), partes = [], inicio = Date.now(), cancelado = false;
      var barra = document.createElement('div'); barra.className = 'grabando';
      barra.innerHTML = '<button type="button" class="extra-btn" data-g="cancelar" aria-label="Cancelar">' + ICON.basura + '</button><span class="grab-punto"></span><span class="grab-tiempo">0:00</span><span class="grab-texto">Grabando…</span><button type="button" class="enviar" data-g="enviar" aria-label="Enviar audio">' + ICON.mandar + '</button>';
      form.appendChild(barra);
      var reloj = setInterval(function () { var s = Math.floor((Date.now() - inicio) / 1000); barra.querySelector('.grab-tiempo').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }, 500);
      rec.ondataavailable = function (e) { if (e.data && e.data.size) partes.push(e.data); };
      rec.onstop = function () {
        clearInterval(reloj); stream.getTracks().forEach(function (t) { t.stop(); }); barra.remove();
        if (cancelado || !partes.length) return;
        var blob = new Blob(partes, { type: mime.split(';')[0] });
        var nombre = 'audio' + (mime.indexOf('ogg') > -1 ? '.ogg' : '.m4a');
        leerBase64(blob).then(function (f) {
          enviarMedio(tel, { tipo: 'audio', texto: '', local: URL.createObjectURL(blob), archivo: { mime: blob.type, nombre: nombre } }, 'Tú: 🎤 Audio', function () {
            return api('enviarArchivo', tel, { tipo: 'audio', nombre: nombre, mime: blob.type, base64: f.base64 });
          });
        });
      };
      barra.querySelector('[data-g="cancelar"]').onclick = function () { cancelado = true; rec.stop(); };
      barra.querySelector('[data-g="enviar"]').onclick = function () { rec.stop(); };
      rec.start();
    }).catch(function () { toast('No hay permiso para usar el micrófono', 'error'); });
  }
  /** Igual que un texto: aparece al instante con relojito; luego palomita o "Reintentar". */
  function enviarMedio(tel, datos, vista, mandar) {
    var cv = E.convs[tel] || (E.convs[tel] = { contacto: contactoDe(tel), mensajes: [], ventanaAbierta: true, _t: Date.now() });
    var m = { direccion: 'salida', tipo: datos.tipo, texto: datos.texto || '', archivo: datos.archivo, local: datos.local, estado: 'pendiente', hora: new Date().toISOString(), _tmp: true };
    m._reenviar = function () {
      mandar().then(function (r) {
        m.estado = 'enviado'; if (r && r.hora) m.hora = r.hora;
        if (r && r.archivo) { m.archivo = r.archivo; if (m.local) E.medios[r.archivo.id] = { url: m.local, promesa: Promise.resolve({ url: m.local, nombre: r.archivo.nombre }) }; }
        if (E.telSel === tel) pintarConv(false);
        guardarCache();
        setTimeout(sincronizar, 1500);
      }).catch(function (e) {
        m.estado = 'error'; m.error = e.message.replace(/^Meta: /, '');
        if (E.telSel === tel) pintarConv(false); else toast('No se envió: ' + e.message, 'error');
      });
    };
    cv.mensajes.push(m);
    moverArriba(tel, vista, m.hora);
    pintarConv(false);
    var mm = $('mensajes'); if (mm) mm.scrollTop = mm.scrollHeight;
    m._reenviar();
  }

  /** Manda un texto: aparece al instante con relojito; luego palomita o "Reintentar". */
  function enviar(tel, txt) {
    var cv = E.convs[tel] || (E.convs[tel] = { contacto: contactoDe(tel), mensajes: [], ventanaAbierta: true, _t: Date.now() });
    var m = { direccion: 'salida', tipo: 'texto', texto: txt, estado: 'pendiente', hora: new Date().toISOString(), _tmp: true };
    cv.mensajes.push(m);
    moverArriba(tel, 'Tú: ' + txt, m.hora);
    pintarConv(false);
    var mm = $('mensajes'); if (mm) mm.scrollTop = mm.scrollHeight;
    api('enviarTexto', tel, txt).then(function (r) {
      m.estado = 'enviado'; if (r && r.hora) m.hora = r.hora;
      if (E.telSel === tel) pintarConv(false);
      guardarCache();
      setTimeout(sincronizar, 1500);
    }).catch(function (e) {
      m.estado = 'error'; m.error = e.message.replace(/^Meta: /, '');
      if (E.telSel === tel) pintarConv(false); else toast('No se envió: ' + e.message, 'error');
    });
  }
  function moverArriba(tel, ultimo, horaIso) {
    var i = -1;
    for (var k = 0; k < E.chats.length; k++) if (E.chats[k].telefono === tel) i = k;
    var c = i > -1 ? E.chats.splice(i, 1)[0] : contactoDe(tel);
    if (!c) return;
    c.ultimoMsg = ultimo; c.ultimaHora = horaIso;
    E.chats.unshift(c);
    refrescarListaChats();
  }

  // ---------- Ficha del doctor (en compu a la derecha; en celular como hoja que sube)
  function fichaHtml(c) {
    var datos = [['Etapa', c.etapa], ['Especialidad', c.especialidad || '—'], ['Ciudad', c.ciudad || '—'], ['Teléfono', telBonito(c.telefono)], ['Lote', c.lote || '—']];
    return '<div class="ficha-cab">' + avatar(c, 'grande') + '<div class="ficha-nombre">' + esc(nombreDe(c)) + '</div></div>' +
      '<div class="ficha-datos">' + datos.map(function (d) { return '<div class="fila-dato"><span>' + d[0] + '</span><b>' + esc(d[1]) + '</b></div>'; }).join('') + '</div>' +
      '<a class="boton-sec ancho" href="https://wa.me/' + esc(c.telefono) + '" target="_blank" rel="noopener">Abrir en WhatsApp</a>' +
      '<label class="rotulo" for="notas">Notas</label><textarea id="notas" class="notas" placeholder="Ej. busca consultorio con vista, piso alto">' + esc(c.notas) + '</textarea>' +
      '<span class="nota" id="estadoNotas"></span>' +
      '<button class="boton-sec ancho" data-cambiar-etapa>Cambiar etapa</button>' +
      (c.etapa !== 'BAJA' ? '<button class="boton-sec ancho peligro-sec" data-baja>Marcar BAJA</button>' : '');
  }
  function enlazarFicha(raiz, c) {
    var n = raiz.querySelector('#notas'), est = raiz.querySelector('#estadoNotas'), t;
    n.oninput = function () {
      est.textContent = 'Escribiendo…'; clearTimeout(t);
      t = setTimeout(function () {
        est.textContent = 'Guardando…';
        c.notas = n.value;
        api('guardarNotas', c.telefono, n.value).then(function () { est.textContent = 'Guardado ✓'; guardarCache(); }).catch(function (e) { est.textContent = 'No se guardó: ' + e.message; });
      }, 900);
    };
    raiz.querySelector('[data-cambiar-etapa]').onclick = function () { elegirEtapa(c); };
    var b = raiz.querySelector('[data-baja]');
    if (b) b.onclick = function () { pedirBaja(c); };
  }
  function pintarFicha(c) {
    var f = $('panelFicha'); if (!f || !c) return;
    if (f.getAttribute('data-tel') === c.telefono && f.querySelector('#notas') === document.activeElement) return; // no interrumpir mientras escribe
    f.setAttribute('data-tel', c.telefono);
    f.innerHTML = fichaHtml(c);
    enlazarFicha(f, c);
  }
  function abrirFichaCel() {
    var c = contactoDe(E.telSel); if (!c) return;
    abrirHoja('<div class="hoja-ficha">' + fichaHtml(c) + '</div>', function (h) { enlazarFicha(h, c); });
  }

  function elegirEtapa(c) {
    if (!c) return;
    abrirHoja('<h2 class="hoja-titulo">Etapa de ' + esc(nombreDe(c)) + '</h2><div class="etapas">' + ETAPAS.map(function (e) {
      return '<button class="etapa-op e-' + e + (e === c.etapa ? ' actual' : '') + '" data-e="' + e + '">' + e + (e === c.etapa ? ' <small>actual</small>' : '') + '</button>';
    }).join('') + '</div>', function (h) {
      h.querySelectorAll('[data-e]').forEach(function (b) {
        b.onclick = function () {
          var e = b.getAttribute('data-e');
          if (e === c.etapa) return cerrarHoja();
          if (e === 'BAJA') { cerrarHoja(true); return pedirBaja(c); }
          cerrarHoja(); cambiarEtapa(c, e);
        };
      });
    });
  }
  function pedirBaja(c) {
    confirmar('¿Marcar BAJA a ' + nombreDe(c) + '?', 'Ya no se le podrá volver a escribir desde Space Chat.', 'Marcar BAJA', true).then(function (si) { if (si) cambiarEtapa(c, 'BAJA'); });
  }
  function cambiarEtapa(c, e) {
    var antes = c.etapa;
    aplicarEtapa(c.telefono, e);
    toast('Etapa: ' + e);
    api('cambiarEtapa', c.telefono, e).then(guardarCache).catch(function (err) { aplicarEtapa(c.telefono, antes); toast('No se cambió: ' + err.message, 'error'); });
  }
  function aplicarEtapa(tel, e) {
    [E.chats, E.contactos].forEach(function (l) { l.forEach(function (x) { if (x.telefono === tel) x.etapa = e; }); });
    var cv = E.convs[tel]; if (cv && cv.contacto) cv.contacto.etapa = e;
    if (E.telSel === tel) { var f = $('panelFicha'); if (f) f.removeAttribute('data-tel'); pintarConv(false); }
    refrescarListaChats();
    if (seccion() === 'contactos') pintarListaContactos();
  }

  // ================================================================== CONTACTOS
  function contactosFiltrados() {
    var q = sinAcentos(E.buscaContacto);
    return E.contactos.filter(function (c) {
      if (E.filtroEtapa && c.etapa !== E.filtroEtapa) return false;
      return !q || sinAcentos(nombreDe(c) + ' ' + c.especialidad + ' ' + c.ciudad + ' ' + c.telefono).indexOf(q) > -1;
    });
  }
  function chipsContactos() {
    var cuenta = {}; E.contactos.forEach(function (c) { cuenta[c.etapa] = (cuenta[c.etapa] || 0) + 1; });
    return '<div class="chips claros" id="chipsC">' + [['', 'Todos · ' + E.contactos.length], ['Nuevo', 'Nuevos'], ['Contactado', 'Contactados'], ['Interesado', 'Interesados'], ['Cita', 'Cita'], ['BAJA', 'BAJA']].map(function (x) {
      return '<button class="chip' + (E.filtroEtapa === x[0] ? ' activo' : '') + '" data-etapa-f="' + x[0] + '">' + x[1] + (x[0] ? ' · ' + (cuenta[x[0]] || 0) : '') + '</button>';
    }).join('') + '</div>';
  }
  function filaContacto(c) {
    return '<a class="fila" href="#chat/' + esc(c.telefono) + '">' + avatar(c) + '<div class="fila-info"><span class="nombre">' + esc(nombreDe(c)) + '</span><span class="sub">' + esc([c.especialidad, c.ciudad].filter(Boolean).join(' · ') || telBonito(c.telefono)) + '</span>' +
      '<span class="etapa t-' + esc(c.etapa) + '">' + esc(c.etapa) + (c.ultimaHora ? ' · <span class="gris">' + esc(horaCorta(c.ultimaHora)) + '</span>' : '') + '</span></div></a>';
  }
  function pintarListaContactos(reiniciar) {
    var cont = $('listaC'); if (!cont) return;
    if (reiniciar) { E.mostrarContactos = 80; cont.scrollTop = 0; }
    if (!E.listos.contactos && !E.contactos.length) { cont.innerHTML = esqueletoLista(10); return; }
    var l = contactosFiltrados();
    var ch = $('chipsC'); if (ch) { ch.outerHTML = chipsContactos(); enlazarChipsContactos(); }
    if (!l.length) { cont.innerHTML = '<p class="vacio">No hay contactos con ese filtro.</p>'; return; }
    var vis = l.slice(0, E.mostrarContactos);
    var html;
    if (esCompu()) {
      html = '<table class="tabla"><thead><tr><th>Nombre</th><th>Especialidad</th><th>Ciudad</th><th>Teléfono</th><th>Etapa</th><th>Último contacto</th></tr></thead><tbody>' +
        vis.map(function (c) { return '<tr data-href="#chat/' + esc(c.telefono) + '"><td><div class="celda-nombre">' + avatar(c, 'mini') + '<b>' + esc(nombreDe(c)) + '</b></div></td><td>' + esc(c.especialidad) + '</td><td>' + esc(c.ciudad) + '</td><td class="gris">' + esc(telBonito(c.telefono)) + '</td><td><span class="badge e-' + esc(c.etapa) + '">' + esc(c.etapa) + '</span></td><td class="gris">' + esc(horaCorta(c.ultimaHora) || '—') + '</td></tr>'; }).join('') +
        '</tbody></table>';
    } else html = vis.map(filaContacto).join('');
    if (l.length > vis.length) html += '<div class="mas" id="masContactos">Mostrando ' + vis.length + ' de ' + l.length + '…</div>';
    else html += '<div class="mas">' + l.length + ' contacto' + (l.length === 1 ? '' : 's') + '</div>';
    cont.innerHTML = html;
    cont.querySelectorAll('tr[data-href]').forEach(function (tr) { tr.onclick = function () { location.hash = tr.getAttribute('data-href'); }; });
    var mas = $('masContactos');
    if (mas && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (ents) {
        if (ents[0].isIntersecting) { io.disconnect(); E.mostrarContactos += 120; var st = cont.scrollTop; pintarListaContactos(); cont.scrollTop = st; }
      }, { root: cont, rootMargin: '400px' });
      io.observe(mas);
    }
  }
  function enlazarChipsContactos() {
    app.querySelectorAll('[data-etapa-f]').forEach(function (b) { b.onclick = function () { E.filtroEtapa = b.getAttribute('data-etapa-f'); pintarListaContactos(true); }; });
  }
  function vistaContactos() {
    E.telSel = '';
    var clave = esCompu() ? 'contactos-compu' : 'contactos-cel';
    if (E.vista !== clave) {
      E.vista = clave;
      var importar = '<label class="boton-sec chico-btn' + (esCompu() ? '' : ' en-barra') + '">Importar Excel<input type="file" id="archivo" accept=".xlsx,.xls,.csv" class="oculto"></label>';
      if (esCompu()) {
        app.innerHTML = barraEscritorio() + '<div class="contenido"><div class="pagina"><div class="pagina-cab"><h1>Contactos</h1>' + importar + '</div>' +
          '<div class="panel filtros"><label class="oculto" for="buscaC">Buscar contacto</label><input id="buscaC" class="buscar borde" type="search" placeholder="Buscar por nombre, especialidad, ciudad o teléfono" value="' + esc(E.buscaContacto) + '">' + chipsContactos() + '</div>' +
          '<div class="panel tabla-cont contenido" id="listaC"></div></div></div>';
      } else {
        app.innerHTML = '<header class="barra"><div class="barra-fila"><h1>Contactos</h1>' + importar + '</div><label class="oculto" for="buscaC">Buscar contacto</label><input id="buscaC" class="buscar" type="search" placeholder="Buscar contacto" value="' + esc(E.buscaContacto) + '"></header>' +
          '<div class="chips-barra">' + chipsContactos() + '</div><div class="contenido blanco" id="listaC"></div>' + tabs();
      }
      enlazarComunes();
      enlazarChipsContactos();
      var bc = $('buscaC'), t;
      bc.oninput = function () { clearTimeout(t); t = setTimeout(function () { E.buscaContacto = bc.value; pintarListaContactos(true); }, 120); };
      $('archivo').onchange = importarArchivo;
    }
    pintarListaContactos(true);
    api('listarContactos').then(function (l) {
      var cambio = firma(l) !== firma(E.contactos);
      E.contactos = l; E.listos.contactos = true;
      if (cambio && seccion() === 'contactos') { var cont = $('listaC'), st = cont ? cont.scrollTop : 0; pintarListaContactos(); if (cont) cont.scrollTop = st; }
      guardarCache();
    }).catch(function (e) { toast(e.message, 'error'); });
  }

  function cargarXLSX(listo) {
    if (window.XLSX) return listo();
    var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = listo; s.onerror = function () { toast('No se pudo cargar el lector de Excel', 'error'); };
    document.head.appendChild(s);
  }
  function importarArchivo(ev) {
    var f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    toast('Leyendo archivo…');
    cargarXLSX(function () {
      var r = new FileReader();
      r.onload = function () {
        var libro = XLSX.read(new Uint8Array(r.result), { type: 'array' });
        var filas = XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]], { defval: '' });
        var datos = filas.map(function (o) {
          var x = {};
          Object.keys(o).forEach(function (k) {
            var n = sinAcentos(k);
            if (n.indexOf('especialidad') > -1) x.especialidad = o[k];
            else if (n.indexOf('ciudad') > -1) x.ciudad = o[k];
            else if (n.indexOf('nombre') > -1) x.nombre = o[k];
            else if (n.indexOf('link') > -1) x.link = o[k];
            else if (n.indexOf('telefono') > -1 || n.indexOf('celular') > -1 || n.indexOf('whatsapp') > -1) x.telefono = o[k];
          });
          return x;
        });
        confirmar('Importar contactos', 'Se van a revisar ' + datos.length + ' filas de "' + f.name + '". Los números repetidos no se duplican.', 'Importar').then(function (si) {
          if (!si) return;
          toast('Importando…');
          api('importarContactos', datos).then(function (res) {
            toast(res.nuevos + ' nuevos · ' + res.repetidos + ' repetidos · ' + res.sinTelefono + ' sin teléfono válido');
            E.vista = ''; vistaContactos();
          }).catch(function (e) { toast(e.message, 'error'); });
        });
      };
      r.readAsArrayBuffer(f);
    });
  }

  // ================================================================== CAMPAÑAS
  function vistaCampanas() {
    E.telSel = ''; E.vista = 'campanas';
    function cargar() { api('vistaPreviaLote', E.lote).then(function (p) { E.previa = p; dibujar(); }).catch(function (e) { toast(e.message, 'error'); }); }
    function dibujar() {
      if (seccion() !== 'campanas') return;
      var p = E.previa || {}, cargando = !E.previa;
      var ej = p.ejemplo;
      var bloqueo = p.bloqueadoHasta && new Date(p.bloqueadoHasta) > new Date() ? restante(p.bloqueadoHasta) : null;
      var activa = !p.estadoPlantilla || /APPROVED|Activa/i.test(p.estadoPlantilla);
      var puede = !cargando && p.cuantos > 0 && !bloqueo && p.semaforo !== 'Rojo' && activa;
      var motivo = cargando ? 'Revisando…' : !activa ? 'La plantilla todavía no está aprobada por Meta.' : bloqueo ? 'El siguiente lote se habilita en ' + bloqueo + '.' : p.semaforo === 'Rojo' ? 'Semáforo en rojo: no se puede mandar.' : !p.cuantos ? 'No hay contactos nuevos para mandar.' : 'Después de mandar, el siguiente lote se habilita en 48 h y según el semáforo.';
      var cuerpo =
        '<section class="tarjeta"><span class="rotulo">Plantilla</span><div class="fila-dato"><b>Primer contacto Médica Country</b><span class="badge ' + (activa ? 'e-Interesado' : 'e-Cita') + '">' + (cargando ? '…' : activa ? 'Aprobada' : esc(estadoPlantilla(p.estadoPlantilla))) + '</span></div><span class="nota">Imagen + texto · botones Sí / No me interesa</span></section>' +
        '<section class="tarjeta"><span class="rotulo">A quién</span><div class="fila-dato"><span>Contactos nuevos</span><div class="contador-lote"><button class="redondo" data-lote="-1" aria-label="Menos">−</button><b class="num-lote">' + E.lote + '</b><button class="redondo" data-lote="1" aria-label="Más">+</button></div></div><span class="nota">' + (p.disponibles != null ? p.disponibles + ' contactos nuevos disponibles' : '&nbsp;') + '</span></section>' +
        '<section class="tarjeta grid3"><div class="dato"><span>Tope hoy</span><b>' + ((p.enviadosHoy || 0) + (p.cuantos || 0)) + ' / ' + (p.tope || 250) + '</b></div><div class="dato"><span>Costo aprox.</span><b>$' + (p.costoAprox || 0) + '</b></div><div class="dato"><span>Excluidos</span><b>' + (p.excluidosBaja || 0) + ' BAJA</b></div></section>' +
        '<section class="previa"><span class="rotulo">Vista previa</span><div class="globo salida" style="max-width:92%"><div class="img-previa"><span>MÉDICA COUNTRY</span><small>Imagen de la torre</small></div><span>Dr(a). <b>' + esc(ej ? ej.apellido : 'Apellido') + '</b>: Espero que se encuentre bien. Le escribo en nombre de Alto Espacio…</span></div></section>' +
        '<p class="nota">' + esc(motivo) + '</p>' +
        '<button class="boton" id="mandar"' + (puede ? '' : ' disabled') + '>Mandar lote de ' + (p.cuantos != null ? p.cuantos : E.lote) + '</button>';
      if (esCompu()) app.innerHTML = barraEscritorio() + '<div class="contenido"><div class="pagina angosta"><h1>Nuevo lote</h1>' + cuerpo + '</div></div>';
      else app.innerHTML = '<header class="barra"><h1>Nuevo lote</h1></header><div class="contenido"><div class="pagina">' + cuerpo + '</div></div>' + tabs();
      enlazarComunes();
      app.querySelectorAll('[data-lote]').forEach(function (b) {
        b.onclick = function () { E.lote = Math.max(1, Math.min(250, E.lote + Number(b.getAttribute('data-lote')) * (E.lote >= 50 ? 10 : 5))); app.querySelector('.num-lote').textContent = E.lote; clearTimeout(cargar._t); cargar._t = setTimeout(cargar, 350); };
      });
      $('mandar').onclick = function () {
        confirmar('¿Mandar el lote?', 'Se manda la plantilla a ' + p.cuantos + ' contactos. Costo aproximado $' + p.costoAprox + '. Esto no se puede deshacer.', 'Mandar lote').then(function (si) {
          if (!si) return;
          var btn = $('mandar'); btn.disabled = true; btn.textContent = 'Mandando…';
          api('mandarLote', E.lote, {}).then(function (r) { toast('Lote ' + r.lote + ': ' + r.enviados + ' enviados'); ir('semaforo'); })
            .catch(function (e) { toast(e.message, 'error'); btn.disabled = false; btn.textContent = 'Mandar lote'; });
        });
      };
    }
    dibujar();
    cargar();
  }

  // ================================================================== SEMÁFORO
  function vistaSemaforo() {
    E.telSel = ''; E.vista = 'semaforo';
    function dibujar() {
      if (seccion() !== 'semaforo') return;
      var s = E.semaforo || { lotes: [] }, u = s.lotes[s.lotes.length - 1];
      var col = u ? u.semaforo : 'Verde';
      var frase = { Verde: 'Verde: puedes seguir', Amarillo: 'Amarillo: pausa y cambia el mensaje', Rojo: 'Rojo: deja de mandar' }[col];
      var cuerpo =
        '<section class="tarjeta horizontal"><div class="semaforo-circulo s-' + col + '">' + (col === 'Verde' ? ICON.palomita : ICON.alto) + '</div><div><span class="rotulo">' + (u ? 'Lote ' + u.lote + ' · ' + u.enviados + ' contactos' : (E.semaforo ? 'Sin lotes todavía' : 'Revisando…')) + '</span><div class="frase">' + (u ? frase : 'Manda tu primer lote') + '</div></div></section>' +
        (u ? '<section class="tarjeta grid2"><div class="dato"><span>Entregados</span><b>' + u.entregados + ' de ' + u.enviados + '</b></div><div class="dato"><span>Dijeron Sí</span><b class="verde">' + u.si + '</b></div><div class="dato"><span>BAJA / bloqueos</span><b class="rojo">' + u.baja + '</b></div><div class="dato"><span>Sin respuesta</span><b>' + Math.max(0, u.entregados - u.si - u.baja) + '</b></div></section>' : '') +
        '<section class="tarjeta"><span class="rotulo">Según Meta</span><div class="fila-dato"><span>Calidad del número</span><b>' + esc(E.semaforo ? calidadNumero(s.calidadMeta) : '…') + '</b></div><div class="fila-dato"><span>Plantilla</span><b>' + esc(E.semaforo ? estadoPlantilla(s.estadoPlantilla) : '…') + '</b></div><div class="fila-dato"><span>Tope diario</span><b>' + (s.tope || 250) + '</b></div></section>' +
        (s.gasto ? '<section class="tarjeta"><span class="rotulo">Gasto en WhatsApp · ' + esc(s.gasto.mes) + '</span><div class="fila-dato"><span>Lo que llevas este mes</span><b>$' + Number(s.gasto.conIva).toFixed(2) + ' con IVA</b></div><div class="fila-dato"><span>Mensajes cobrados</span><b>' + s.gasto.plantillas + '</b></div><div class="fila-dato"><span>Mensajes gratis</span><b>' + (s.gasto.gratis || 0) + '</b></div><span class="nota">' + (s.gasto.fuente === 'Meta' ? 'Dato de Meta, actualizado ' + esc(horaCorta(s.gasto.hora)) + '. Meta lo cobra a tu tarjeta después, todo junto.' : 'Cálculo aproximado (Meta no contestó). Meta lo cobra a tu tarjeta después.') + '</span></section>' : '') +
        '<section class="tarjeta reglas"><span class="rotulo">Reglas (lotes chicos)</span><span><b class="verde">Verde</b> · 0 a 1 BAJA o bloqueo: seguir</span><span><b class="ambar">Amarillo</b> · 2 BAJA: pausar y cambiar mensaje</span><span><b class="rojo">Rojo</b> · 3 o más, o Meta marca la plantilla: parar</span></section>' +
        (s.lotes.length ? '<section class="panel solo-escritorio"><div class="rotulo" style="padding:14px 18px">Historial de lotes</div><div style="overflow-x:auto"><table class="tabla"><thead><tr><th>Lote</th><th>Fecha</th><th>Enviados</th><th>Entregados</th><th>Sí</th><th>BAJA</th><th>Semáforo</th></tr></thead><tbody>' +
          s.lotes.map(function (l) { return '<tr><td><b>' + l.lote + '</b></td><td>' + new Date(l.fecha).toLocaleDateString('es-MX') + '</td><td>' + l.enviados + '</td><td>' + l.entregados + '</td><td>' + l.si + '</td><td>' + l.baja + '</td><td><span class="badge ' + (l.semaforo === 'Verde' ? 'e-Interesado' : l.semaforo === 'Rojo' ? 'e-BAJA' : 'e-Cita') + '">' + l.semaforo + '</span></td></tr>'; }).join('') +
          '</tbody></table></div></section>' : '') +
        (DEMO ? '<p class="nota">Modo demo: números de ejemplo.</p>' : '');
      if (esCompu()) app.innerHTML = barraEscritorio() + '<div class="contenido"><div class="pagina angosta"><h1>Semáforo</h1>' + cuerpo + '</div></div>';
      else app.innerHTML = '<header class="barra"><h1>Semáforo</h1></header><div class="contenido"><div class="pagina">' + cuerpo + '</div></div>' + tabs();
      enlazarComunes();
    }
    dibujar();
    api('semaforo').then(function (s) { E.semaforo = s; dibujar(); }).catch(function (e) { toast(e.message, 'error'); });
  }

  // ------------------------------------------------------------------ notificaciones
  function b64aBytes(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }
  function activarNotificaciones() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return toast(/iPhone|iPad/.test(navigator.userAgent) ? 'En iPhone: primero agrega Space Chat a la pantalla de inicio (Compartir → Agregar a inicio) y ábrela desde ahí.' : 'Este navegador no acepta notificaciones.');
    }
    if (DEMO || !CFG.VAPID_PUBLIC) return toast('Las notificaciones se activan cuando la app esté conectada.');
    Notification.requestPermission().then(function (p) {
      if (p !== 'granted') throw new Error('No diste permiso de notificaciones');
      return navigator.serviceWorker.ready;
    }).then(function (reg) {
      return reg.pushManager.getSubscription().then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64aBytes(CFG.VAPID_PUBLIC) }); });
    }).then(function (sub) { return api('guardarSuscripcion', sub.toJSON()); })
      .then(function () { toast('Notificaciones activadas en este aparato'); })
      .catch(function (e) { toast(e.message, 'error'); });
  }

  // Abrir / cerrar el texto completo de la plantilla.
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.ver-plantilla');
    if (!b) return;
    var g = b.parentNode, abierta = g.classList.toggle('abierta');
    b.textContent = abierta ? 'Ver menos' : 'Ver mensaje completo';
  });

  // ------------------------------------------------------------------ gestos y teclado del celular
  // Deslizar desde la orilla izquierda en un chat = regresar (como en WhatsApp).
  (function () {
    var x0 = null, y0 = 0;
    document.addEventListener('touchstart', function (e) {
      var t = e.touches[0];
      x0 = (!esCompu() && E.vista === 'conv-cel' && t.clientX < 28) ? t.clientX : null; y0 = t.clientY;
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (x0 === null) return;
      var t = e.touches[0], dx = t.clientX - x0, c = $('panelConv');
      if (Math.abs(t.clientY - y0) > 40 && dx < 30) { x0 = null; if (c) c.style.transform = ''; return; }
      if (c && dx > 0) c.style.transform = 'translateX(' + Math.min(dx, window.innerWidth) + 'px)';
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, c = $('panelConv'); x0 = null;
      if (dx > 90) { if (c) { c.style.transition = 'transform .15s ease'; c.style.transform = 'translateX(100%)'; } setTimeout(volverALista, 140); }
      else if (c) { c.style.transition = 'transform .15s ease'; c.style.transform = ''; setTimeout(function () { c.style.transition = ''; }, 160); }
    }, { passive: true });
  })();

  // Jalar la lista hacia abajo para actualizar.
  function activarJalarParaActualizar(lista) {
    if (lista._jalar) return; lista._jalar = true;
    var y0 = null, ind = document.createElement('div');
    ind.className = 'jalar'; ind.innerHTML = '<span></span>';
    lista.parentNode.insertBefore(ind, lista);
    lista.addEventListener('touchstart', function (e) { y0 = lista.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
    lista.addEventListener('touchmove', function (e) {
      if (y0 === null) return;
      var d = Math.max(0, Math.min(90, (e.touches[0].clientY - y0) * .5));
      ind.style.height = d + 'px'; ind.classList.toggle('listo', d > 55);
    }, { passive: true });
    lista.addEventListener('touchend', function () {
      if (y0 === null) return; y0 = null;
      if (ind.classList.contains('listo')) {
        ind.classList.add('girando'); ind.style.height = '48px';
        sincronizar().then(function () { ind.classList.remove('girando', 'listo'); ind.style.height = '0'; });
      } else ind.style.height = '0';
    }, { passive: true });
  }

  // iPhone (iOS 26) con la app en la pantalla de inicio: a veces el iPhone deja la app más corta que la pantalla
  // y abajo queda una franja sin usar. Se mide ese hueco para que las pestañas no dejen espacio de más.
  var medirHueco = function () {
    var raiz = document.documentElement;
    var sonda = document.createElement('div');
    sonda.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
    document.body.appendChild(sonda);
    var cs = getComputedStyle(sonda), arriba = parseFloat(cs.paddingTop) || 0, abajo = parseFloat(cs.paddingBottom) || 0;
    sonda.remove();
    var instalada = window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    var horizontal = window.matchMedia && matchMedia('(orientation: landscape)').matches;
    var pantalla = horizontal ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
    var hueco = 0;
    if (instalada && arriba > 0 && !document.documentElement.classList.contains('con-teclado')) {
      hueco = Math.max(0, Math.min(80, pantalla - window.innerHeight));
    }
    raiz.style.setProperty('--hueco', hueco + 'px');
  };
  window.addEventListener('resize', medirHueco);
  window.addEventListener('orientationchange', function () { setTimeout(medirHueco, 300); });
  medirHueco(); setTimeout(medirHueco, 500);

  // Teclado en iPhone.
  // - Con el teclado abierto, la app ocupa solo el espacio visible arriba de él.
  // - Si estabas viendo lo último del chat, se queda pegado al último mensaje mientras el teclado sube o baja.
  // - Con el teclado abierto solo se desliza la lista de mensajes, no la página completa (eso hacía temblar la pantalla).
  // - Al cerrar el teclado, la página regresa a su lugar (si no, abajo se asomaba una franja gris).
  if (window.visualViewport) {
    var vv = window.visualViewport, raiz = document.documentElement;
    var tecladoAbierto = false, pegadoAlFinal = true, fijarHasta = 0, fijando = false;
    // Lo que se asoma detrás del teclado: del mismo gris claro que la caja de escribir (no el verde del fondo).
    var bajoTeclado = document.createElement('div'); bajoTeclado.id = 'bajo-teclado'; document.body.appendChild(bajoTeclado);
    var distanciaAlFinal = function (mm) { return mm.scrollHeight - mm.scrollTop - mm.clientHeight; };
    var alFinal = function () { var mm = $('mensajes'); if (mm) mm.scrollTop = mm.scrollHeight; };
    // Durante la animación del teclado, mantener el chat en el último mensaje cuadro por cuadro.
    var fijarAlFinal = function (ms) {
      fijarHasta = Date.now() + (ms || 700);
      if (fijando) return; fijando = true;
      (function paso() {
        if (pegadoAlFinal) alFinal();
        if (Date.now() < fijarHasta) requestAnimationFrame(paso); else fijando = false;
      })();
    };
    // Saber si la persona está viendo lo último o se subió a leer mensajes viejos (solo cuenta cuando ella desliza).
    document.addEventListener('scroll', function (e) {
      if (e.target && e.target.id === 'mensajes' && Date.now() > fijarHasta) pegadoAlFinal = distanciaAlFinal(e.target) < 60;
    }, true);
    document.addEventListener('focusin', function (e) {
      if (e.target && e.target.id === 'msg') { pegadoAlFinal = true; fijarAlFinal(900); }
    });
    document.addEventListener('focusout', function () {
      setTimeout(function () { if (!tecladoAbierto) window.scrollTo(0, 0); }, 120);
    });
    var ajustarAlto = function () {
      var abierto = (window.innerHeight - vv.height) > 80;
      if (abierto) {
        raiz.style.setProperty('--vv-alto', Math.round(vv.height) + 'px');
        raiz.style.setProperty('--vv-arriba', Math.round(vv.offsetTop) + 'px');
      }
      if (abierto !== tecladoAbierto) {
        raiz.classList.toggle('con-teclado', abierto);
        tecladoAbierto = abierto;
        // El iPhone empuja la página hacia arriba al abrir el teclado y escondía el encabezado del chat:
        // se regresa a su lugar (una vez, cuando termina de abrir; no a cada rato, para que no tiemble).
        window.scrollTo(0, 0);
        if (abierto) { setTimeout(function () { window.scrollTo(0, 0); ajustarAlto(); }, 60); setTimeout(function () { window.scrollTo(0, 0); ajustarAlto(); }, 350); }
        fijarAlFinal(700);
      } else if (pegadoAlFinal) alFinal();
    };
    vv.addEventListener('resize', ajustarAlto);
    vv.addEventListener('scroll', ajustarAlto);
    ajustarAlto();

    // Con el teclado abierto: solo se mueve lo que tiene contenido para deslizar (la lista de mensajes).
    var yToque = 0;
    document.addEventListener('touchstart', function (e) { yToque = e.touches[0].clientY; }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (!tecladoAbierto || e.touches.length > 1) return;
      var dy = e.touches[0].clientY - yToque, el = e.target;
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) return; // mover el cursor al escribir
      while (el && el !== document.body) {
        var st = el.nodeType === 1 ? getComputedStyle(el).overflowY : '';
        if ((st === 'auto' || st === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
          var arriba = el.scrollTop <= 0, abajo = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
          if ((arriba && dy > 0) || (abajo && dy < 0)) e.preventDefault();
          return;
        }
        el = el.parentNode;
      }
      e.preventDefault();
    }, { passive: false });
  }
  // En iPhone, esto hace que los botones se vean "presionados" al tocarlos.
  document.addEventListener('touchstart', function () {}, { passive: true });

  // ------------------------------------------------------------------ arranque
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
    // Cuando llega una notificación con la app abierta, actualiza al momento.
    navigator.serviceWorker.addEventListener('message', function (ev) { if (ev.data && ev.data.tipo === 'nuevo') sincronizar(); });
  }
  cargarSesion();
  if (E.sesion) cargarCache();
  pintar();
  // Con la app abierta, revisa si hay mensajes nuevos cada 12 s (y al volver a la app).
  setInterval(function () { if (E.sesion && !document.hidden && seccion() === 'chats') sincronizar(); }, 12000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && E.sesion) sincronizar(); });
  // El contador de "puedes escribirle libre por…" se actualiza cada minuto.
  setInterval(function () { if (E.telSel && $('avisoVentana')) pintarConv(false); }, 60000);
})();
