/* Space Chat — app (celular y computadora). Sin librerías: todo en este archivo. */
(function () {
  'use strict';
  var CFG = window.SPACE_CONFIG || {};
  var DEMO = !CFG.API_URL;
  var app = document.getElementById('app');
  var E = { sesion: null, chats: [], contactos: [], conv: null, filtroChat: 'Todos', filtroEtapa: '', textoBusca: '', lote: 20, previa: null, semaforo: null, telSel: '' };

  // ------------------------------------------------------------------ utilidades
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(t) { var el = document.getElementById('toast'); el.textContent = t; el.classList.add('ver'); clearTimeout(toast._t); toast._t = setTimeout(function () { el.classList.remove('ver'); }, 3200); }
  function esCompu() { return window.matchMedia('(min-width: 900px)').matches; }
  function nombreDe(c) { return ((c.titulo ? c.titulo + ' ' : '') + (c.nombre || '') + ' ' + (c.apellido || '')).trim() || c.telefono; }
  function iniciales(c) { var n = ((c.nombre || '') + ' ' + (c.apellido || '')).trim().split(/\s+/); return ((n[0] || '?')[0] + ((n[1] || '')[0] || '')).toUpperCase(); }
  var COLORES = ['#2E7D64', '#3B6EA5', '#7A5BA6', '#A65B5B', '#5B8FA6', '#8A7A3B', '#4F7F3F'];
  function color(c) { var s = String(c.telefono || ''), h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997; return COLORES[h % COLORES.length]; }
  function horaCorta(iso) {
    if (!iso) return '';
    var d = new Date(iso), hoy = new Date();
    if (d.toDateString() === hoy.toDateString()) return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    var ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === ayer.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es-MX', { weekday: 'short' });
  }
  function restante(iso) {
    var ms = new Date(iso) - new Date();
    if (!(ms > 0)) return null;
    var h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3);
    return h + ' h ' + m + ' min';
  }
  var ICON = {
    chat: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    personas: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M17 4a4 4 0 010 8M22 21c0-3-2-5-4-6"/></svg>',
    enviar: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>',
    semaforo: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="3"/><circle cx="12" cy="7" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="17" r="1.5"/></svg>',
    atras: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    reloj: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B45309" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    campana: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 004 0"/></svg>',
    palomita: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
    alto: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 7v6M12 16.5v.5"/></svg>',
    logo: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0B6B4F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8"/><path d="M8 13h5"/></svg>'
  };

  // ------------------------------------------------------------------ conexión con el cerebro
  function api(fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (DEMO) return Promise.resolve(Demo[fn].apply(null, args));
    return fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ idToken: E.sesion && E.sesion.token, fn: fn, args: args }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) {
          if (/Sesión|Inicia sesión/.test(j.mensaje)) { cerrarSesion(); }
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
      { titulo: 'Dr.', nombre: 'Ejemplo', apellido: 'Ramírez', especialidad: 'Ortopedia', ciudad: 'Tlaquepaque', telefono: '523300000006', etapa: 'Contactado', lote: 1, ultimoMsg: 'Tú: Plantilla de primer contacto', ultimaHora: hace(60 * 51), sinLeer: 0, ventanaHasta: '', notas: '' },
      { titulo: 'Dra.', nombre: 'Ejemplo', apellido: 'Torres', especialidad: 'Nutrición', ciudad: 'Guadalajara', telefono: '523300000007', etapa: 'Nuevo', lote: '', ultimoMsg: '', ultimaHora: '', sinLeer: 0, ventanaHasta: '', notas: '' },
      { titulo: 'Dr.', nombre: 'Ejemplo', apellido: 'Vega', especialidad: 'Urología', ciudad: 'Zapopan', telefono: '523300000008', etapa: 'Nuevo', lote: '', ultimoMsg: '', ultimaHora: '', sinLeer: 0, ventanaHasta: '', notas: '' }
    ];
    var plantilla = 'Dr(a). {apellido}:\n\nEspero que se encuentre bien. Le escribo en nombre de Alto Espacio, colaborador de MÉDICA COUNTRY, un nuevo desarrollo médico en la colonia Country Club de Guadalajara…';
    var msgs = {
      '523300000001': [
        { direccion: 'salida', tipo: 'plantilla', texto: plantilla.replace('{apellido}', 'Escobedo'), estado: 'read', hora: hace(80) },
        { direccion: 'entrada', tipo: 'button', texto: 'Sí, quiero información', estado: 'recibido', hora: hace(20) }
      ],
      '523300000002': [
        { direccion: 'salida', tipo: 'plantilla', texto: plantilla.replace('{apellido}', 'Martínez'), estado: 'read', hora: hace(90) },
        { direccion: 'entrada', tipo: 'button', texto: 'Sí, quiero información', estado: 'recibido', hora: hace(60) },
        { direccion: 'entrada', tipo: 'text', texto: '¿Qué metros tiene el más chico?', estado: 'recibido', hora: hace(47) }
      ]
    };
    function buscar(tel) { for (var i = 0; i < cs.length; i++) if (cs[i].telefono === tel) return cs[i]; return null; }
    return {
      listarChats: function () { return cs.filter(function (c) { return c.ultimaHora; }).sort(function (a, b) { return new Date(b.ultimaHora) - new Date(a.ultimaHora); }); },
      listarContactos: function () { return cs.slice(); },
      conversacion: function (tel) {
        var c = buscar(tel); if (c) c.sinLeer = 0;
        var lista = msgs[tel] || (c && c.ultimaHora ? [{ direccion: 'salida', tipo: 'plantilla', texto: plantilla.replace('{apellido}', c.apellido), estado: 'delivered', hora: c.ultimaHora }] : []);
        return { contacto: c, mensajes: lista, ventanaAbierta: !!(c && c.ventanaHasta && new Date(c.ventanaHasta) > new Date()) };
      },
      enviarTexto: function (tel, texto) {
        var c = buscar(tel);
        if (c.etapa === 'BAJA') throw new Error('Este contacto pidió BAJA: no se le puede escribir');
        if (!(c.ventanaHasta && new Date(c.ventanaHasta) > new Date())) throw new Error('Pasaron más de 24 h: solo se puede mandar plantilla');
        (msgs[tel] = msgs[tel] || []).push({ direccion: 'salida', tipo: 'texto', texto: texto, estado: 'enviado', hora: new Date().toISOString() });
        c.ultimoMsg = 'Tú: ' + texto; c.ultimaHora = new Date().toISOString();
        return true;
      },
      cambiarEtapa: function (tel, etapa) { buscar(tel).etapa = etapa; return true; },
      guardarNotas: function (tel, notas) { buscar(tel).notas = notas; return true; },
      importarContactos: function (filas) {
        var n = 0, r = 0, s = 0;
        filas.forEach(function (f) {
          var t = String(f.telefono || '').replace(/\D/g, ''); if (t.length === 10) t = '52' + t;
          if (t.length !== 12) { s++; return; } if (buscar(t)) { r++; return; }
          var p = String(f.nombre || '').trim().split(/\s+/), tit = '';
          if (/^(dr|dra)\.?$/i.test(p[0])) tit = /a\.?$/i.test(p.shift()) ? 'Dra.' : 'Dr.';
          cs.push({ titulo: tit, nombre: p.slice(0, Math.max(1, p.length - 2)).join(' '), apellido: p.length >= 3 ? p[p.length - 2] : p[p.length - 1], especialidad: f.especialidad || '', ciudad: f.ciudad || '', telefono: t, etapa: 'Nuevo', sinLeer: 0 });
          n++;
        });
        return { nuevos: n, repetidos: r, sinTelefono: s };
      },
      vistaPreviaLote: function (cuantos) {
        var nuevos = cs.filter(function (c) { return c.etapa === 'Nuevo'; });
        var lista = nuevos.slice(0, cuantos);
        return { plantilla: 'primer_contacto_medica_country', estadoPlantilla: 'En revisión', cuantos: lista.length, disponibles: nuevos.length, enviadosHoy: 0, tope: 250, costoAprox: Math.round(lista.length * 0.7298 * 1.16), excluidosBaja: cs.filter(function (c) { return c.etapa === 'BAJA'; }).length, ejemplo: lista[0] || null, semaforo: 'Verde' };
      },
      mandarLote: function () { throw new Error('Modo demo: todavía no está conectado a WhatsApp'); },
      semaforo: function () {
        return { calidadMeta: 'Sin avisos', estadoPlantilla: 'En revisión', tope: 250, lotes: [{ lote: 1, fecha: hace(60 * 52), enviados: 20, entregados: 19, si: 4, baja: 1, fallidos: 1, semaforo: 'Verde' }] };
      },
      resumen: function () { return { total: cs.length }; },
      guardarSuscripcion: function () { return true; }
    };
  })();

  // ------------------------------------------------------------------ sesión
  function guardarSesion(s) { E.sesion = s; try { localStorage.setItem('sc_sesion', JSON.stringify(s)); } catch (e) {} }
  function cargarSesion() {
    try {
      var s = JSON.parse(localStorage.getItem('sc_sesion') || 'null');
      if (s && (DEMO || (s.exp && s.exp * 1000 > Date.now() + 60e3))) E.sesion = s;
    } catch (e) {}
  }
  function cerrarSesion() { E.sesion = null; try { localStorage.removeItem('sc_sesion'); } catch (e) {} pintar(); }

  function pantallaLogin() {
    app.innerHTML =
      '<main class="login">' +
      '<div class="login-logo"><div class="login-icono">' + ICON.logo + '</div><h1>Space Chat</h1><p>Prospectos y chats de<br>Alto Espacio Hábitat</p></div>' +
      '<div class="login-acciones">' +
      (DEMO ? '<button class="login-boton" id="entrarDemo">Entrar (modo demo)</button>' : '<div id="botonGoogle"></div>') +
      '<p style="font-size:13px">' + (DEMO ? 'Modo demo: datos de ejemplo, no manda mensajes.' : 'Solo entran las cuentas autorizadas.') + '</p>' +
      '</div></main>';
    if (DEMO) {
      document.getElementById('entrarDemo').onclick = function () { guardarSesion({ correo: 'demo', nombre: 'Demo' }); ir('chats'); };
    } else {
      cargarGoogle(function () {
        google.accounts.id.initialize({
          client_id: CFG.GOOGLE_CLIENT_ID,
          callback: function (resp) {
            var info = JSON.parse(atob(resp.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            guardarSesion({ token: resp.credential, correo: info.email, nombre: info.given_name || info.name, exp: info.exp });
            ir('chats');
          },
          auto_select: true
        });
        google.accounts.id.renderButton(document.getElementById('botonGoogle'), { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'es' });
        google.accounts.id.prompt();
      });
    }
  }
  function cargarGoogle(listo) {
    if (window.google && google.accounts) return listo();
    var s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = listo; document.head.appendChild(s);
  }

  // ------------------------------------------------------------------ navegación
  function ir(ruta) { if (location.hash !== '#' + ruta) location.hash = ruta; else pintar(); }
  function ruta() { var h = location.hash.replace(/^#/, ''); return h || 'chats'; }
  window.addEventListener('hashchange', pintar);
  window.matchMedia('(min-width: 900px)').addEventListener('change', pintar);

  function seccion() { var r = ruta(); return r.indexOf('chat/') === 0 ? 'chats' : r; }

  function tabs() {
    var s = seccion(), sinLeer = E.chats.reduce(function (n, c) { return n + (Number(c.sinLeer) || 0); }, 0);
    function t(id, txt, ic, extra) { return '<a class="tab' + (s === id ? ' activo' : '') + '" href="#' + id + '">' + ic + txt + (extra || '') + '</a>'; }
    return '<nav class="tabs solo-cel" aria-label="Secciones">' +
      t('chats', 'Chats', ICON.chat, sinLeer ? '<span class="punto">' + sinLeer + '</span>' : '') +
      t('contactos', 'Contactos', ICON.personas) + t('campanas', 'Campañas', ICON.enviar) + t('semaforo', 'Semáforo', ICON.semaforo) + '</nav>';
  }
  function barraEscritorio() {
    var s = seccion();
    function b(id, txt) { return '<button class="' + (s === id ? 'activo' : '') + '" data-ir="' + id + '">' + txt + '</button>'; }
    return '<header class="barra escritorio solo-escritorio">' +
      '<div style="display:flex;align-items:center;gap:12px"><div class="login-icono" style="width:36px;height:36px;border-radius:10px">' + ICON.chat.replace('currentColor', '#0B6B4F') + '</div><b style="font-size:18px">Space Chat</b>' + (DEMO ? '<span class="badge" style="background:#FFF1DB;color:#8A4B08">Demo</span>' : '') + '</div>' +
      '<nav class="nav-escritorio" aria-label="Secciones">' + b('chats', 'Chats') + b('contactos', 'Contactos') + b('campanas', 'Campañas') + b('semaforo', 'Semáforo') + '</nav>' +
      '<div style="display:flex;align-items:center;gap:8px"><button class="icono-btn" data-accion="notif" aria-label="Activar notificaciones">' + ICON.campana + '</button><span style="color:#D7EFE5;font-size:13px">' + esc(E.sesion.nombre || E.sesion.correo) + '</span></div></header>';
  }
  function enlazar() {
    app.querySelectorAll('[data-ir]').forEach(function (b) { b.onclick = function () { ir(b.getAttribute('data-ir')); }; });
    app.querySelectorAll('[data-accion="notif"]').forEach(function (b) { b.onclick = activarNotificaciones; });
  }

  // ------------------------------------------------------------------ pintar
  function pintar() {
    if (!E.sesion) return pantallaLogin();
    var r = ruta();
    if (r === 'contactos') return vistaContactos();
    if (r === 'campanas') return vistaCampanas();
    if (r === 'semaforo') return vistaSemaforo();
    if (r.indexOf('chat/') === 0) return vistaChats(r.slice(5));
    return vistaChats('');
  }

  // ---------- Chats
  function filaChat(c, sel) {
    var nueva = Number(c.sinLeer) > 0;
    return '<a class="fila' + (sel ? ' sel' : '') + '" href="#chat/' + esc(c.telefono) + '">' +
      '<div class="avatar" style="background:' + color(c) + '">' + esc(iniciales(c)) + '</div>' +
      '<div class="fila-info"><div class="fila-arriba"><span class="nombre">' + esc(nombreDe(c)) + '</span><span class="hora' + (nueva ? ' nueva' : '') + '">' + esc(horaCorta(c.ultimaHora)) + '</span></div>' +
      '<div class="fila-abajo"><span class="ultimo">' + esc(c.ultimoMsg) + '</span>' + (nueva ? '<span class="contador">' + Number(c.sinLeer) + '</span>' : '') + '</div>' +
      '<span class="etapa t-' + esc(c.etapa) + '">' + esc(c.etapa) + (c.especialidad ? ' · ' + esc(c.especialidad) : '') + '</span></div></a>';
  }
  function chatsFiltrados() {
    return E.chats.filter(function (c) {
      if (E.filtroChat === 'Sin leer' && !(Number(c.sinLeer) > 0)) return false;
      if (E.filtroChat === 'Interesados' && c.etapa !== 'Interesado') return false;
      if (E.textoBusca && nombreDe(c).toLowerCase().indexOf(E.textoBusca.toLowerCase()) === -1) return false;
      return true;
    });
  }
  function listaChatsHtml(sel) {
    var l = chatsFiltrados();
    return l.length ? l.map(function (c) { return filaChat(c, c.telefono === sel); }).join('') : '<p class="vacio">Todavía no hay chats aquí.<br>Cuando mandes un lote o un doctor te escriba, aparecerá en esta lista.</p>';
  }
  function chipsChat(oscuro) {
    var sinLeer = E.chats.filter(function (c) { return Number(c.sinLeer) > 0; }).length;
    return '<div class="chips' + (oscuro ? '' : ' claros') + '">' + ['Todos', 'Sin leer', 'Interesados'].map(function (f) {
      return '<button class="chip' + (E.filtroChat === f ? ' activo' : '') + '" data-filtro="' + f + '">' + f + (f === 'Sin leer' && sinLeer ? ' · ' + sinLeer : '') + '</button>';
    }).join('') + '</div>';
  }

  function vistaChats(tel) {
    api('listarChats').then(function (l) { E.chats = l; dibujar(); if (tel) abrirConv(tel); }).catch(function (e) { toast(e.message); });
    dibujar();
    function dibujar() {
      if (esCompu()) {
        app.innerHTML = barraEscritorio() +
          '<div class="marco"><section class="panel panel-lista"><div style="padding:14px;border-bottom:1px solid #EEF1EF;display:flex;flex-direction:column;gap:10px"><label class="oculto" for="buscaChat">Buscar chat</label><input id="buscaChat" class="buscar borde" type="search" placeholder="Buscar chat" value="' + esc(E.textoBusca) + '">' + chipsChat(false) + '</div><div class="contenido" id="listaChats">' + listaChatsHtml(tel) + '</div></section>' +
          '<section class="panel panel-conv" id="panelConv">' + (tel ? '<p class="vacio">Cargando…</p>' : '<p class="vacio">Elige un chat de la lista.</p>') + '</section>' +
          '<aside class="panel panel-ficha" id="panelFicha"><span class="rotulo">Ficha</span><p class="nota">Elige un chat para ver la ficha del doctor.</p></aside></div>';
      } else if (tel) {
        app.innerHTML = '<div class="conv" id="panelConv"><p class="vacio">Cargando…</p></div>';
      } else {
        app.innerHTML = '<header class="barra"><div class="barra-fila"><h1>Space Chat' + (DEMO ? ' <span class="badge" style="background:#FFF1DB;color:#8A4B08;vertical-align:middle">Demo</span>' : '') + '</h1><button class="icono-btn" data-accion="notif" aria-label="Activar notificaciones">' + ICON.campana + '</button></div>' +
          '<label class="oculto" for="buscaChat">Buscar chat</label><input id="buscaChat" class="buscar" type="search" placeholder="Buscar chat" value="' + esc(E.textoBusca) + '">' + chipsChat(true) + '</header>' +
          '<div class="contenido" id="listaChats">' + listaChatsHtml('') + '</div>' + tabs();
      }
      enlazar();
      app.querySelectorAll('[data-filtro]').forEach(function (b) { b.onclick = function () { E.filtroChat = b.getAttribute('data-filtro'); dibujar(); }; });
      var bc = document.getElementById('buscaChat');
      if (bc) bc.oninput = function () { E.textoBusca = bc.value; document.getElementById('listaChats').innerHTML = listaChatsHtml(tel); };
    }
  }

  function abrirConv(tel) {
    E.telSel = tel;
    api('conversacion', tel).then(function (d) { E.conv = d; pintarConv(); }).catch(function (e) { toast(e.message); });
  }

  function pintarConv() {
    var d = E.conv, c = d && d.contacto, panel = document.getElementById('panelConv');
    if (!panel || !c) return;
    var resto = d.ventanaAbierta ? restante(c.ventanaHasta) : null;
    var puede = !!resto && c.etapa !== 'BAJA';
    var aviso = c.etapa === 'BAJA'
      ? '<div class="ventana cerrada">Pidió BAJA: no se le puede volver a escribir.</div>'
      : resto ? '<div class="ventana">' + ICON.reloj + '<span><b>Ventana abierta:</b> puedes escribir libre por ' + resto + '</span></div>'
        : '<div class="ventana cerrada">Pasaron más de 24 h desde su último mensaje: solo se puede mandar plantilla.</div>';
    var msgs = d.mensajes.map(function (m) {
      var hora = new Date(m.hora).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      if (m.direccion === 'salida') {
        var vista = { read: '✓✓ Leído', delivered: '✓✓', sent: '✓', enviado: '✓', failed: 'No se entregó' }[m.estado] || '';
        return '<div class="globo salida">' + (m.tipo === 'plantilla' ? '<span class="marca">Plantilla · primer contacto</span>' : '') + esc(m.texto) + '<span class="meta">' + hora + ' ' + vista + '</span></div>';
      }
      return '<div class="globo entrada">' + (m.tipo === 'button' || m.tipo === 'interactive' ? '<span class="marca">Tocó el botón</span>' : '') + esc(m.texto) + '<span class="meta">' + hora + '</span></div>';
    }).join('');
    var sub = [c.especialidad, c.ciudad].filter(Boolean).join(' · ');
    panel.innerHTML =
      '<header class="conv-barra"><a class="icono-btn" href="#chats" aria-label="Volver a chats">' + ICON.atras + '</a>' +
      '<div class="avatar" style="background:' + color(c) + '">' + esc(iniciales(c)) + '</div>' +
      '<div style="flex:1;min-width:0"><div class="conv-nombre">' + esc(nombreDe(c)) + '</div><div class="conv-sub">' + esc(sub) + '</div></div></header>' +
      '<div class="conv-cab-escritorio solo-escritorio"><div><div style="font-weight:700">' + esc(nombreDe(c)) + '</div><div class="nota">' + esc(sub) + '</div></div><span class="badge e-' + esc(c.etapa) + '">' + esc(c.etapa) + '</span></div>' +
      aviso +
      '<div class="mensajes" id="mensajes">' + (msgs || '<p class="vacio">Sin mensajes todavía.</p>') + '</div>' +
      '<form class="redactar" id="formMsg"><div class="atajos solo-cel"><button type="button" class="atajo" data-etapa>Cambiar etapa</button></div>' +
      '<div class="escribir"><label class="oculto" for="msg">Escribe un mensaje</label><input id="msg" autocomplete="off" placeholder="' + (puede ? 'Escribe un mensaje' : 'No se puede escribir libre') + '"' + (puede ? '' : ' disabled') + '>' +
      '<button class="enviar" aria-label="Enviar"' + (puede ? '' : ' disabled') + '>' + ICON.enviar.replace('currentColor', '#fff').replace(/24/g, '20') + '</button></div></form>';
    var m = document.getElementById('mensajes'); m.scrollTop = m.scrollHeight;
    document.getElementById('formMsg').onsubmit = function (ev) {
      ev.preventDefault();
      var inp = document.getElementById('msg'), txt = inp.value.trim();
      if (!txt) return;
      inp.value = '';
      api('enviarTexto', c.telefono, txt).then(function () { abrirConv(c.telefono); refrescarLista(); }).catch(function (e) { toast(e.message); inp.value = txt; });
    };
    panel.querySelectorAll('[data-etapa]').forEach(function (b) { b.onclick = function () { elegirEtapa(c); }; });
    pintarFicha(c);
    refrescarLista();
  }

  function refrescarLista() {
    var l = document.getElementById('listaChats');
    if (l) api('listarChats').then(function (x) { E.chats = x; l.innerHTML = listaChatsHtml(E.telSel); });
  }

  var ETAPAS = ['Nuevo', 'Contactado', 'Interesado', 'Cita', 'Apartado', 'Vendido', 'BAJA'];
  function elegirEtapa(c) {
    var nueva = prompt('Nueva etapa para ' + nombreDe(c) + ':\n' + ETAPAS.join(', '), c.etapa);
    if (!nueva) return;
    nueva = ETAPAS.filter(function (e) { return e.toLowerCase() === nueva.trim().toLowerCase(); })[0];
    if (!nueva) return toast('Etapa no válida');
    if (nueva === 'BAJA' && !confirm('¿Marcar BAJA? Ya no se le podrá escribir.')) return;
    api('cambiarEtapa', c.telefono, nueva).then(function () { toast('Etapa: ' + nueva); abrirConv(c.telefono); }).catch(function (e) { toast(e.message); });
  }

  function pintarFicha(c) {
    var f = document.getElementById('panelFicha');
    if (!f) return;
    f.innerHTML = '<span class="rotulo">Ficha</span>' +
      ['Etapa|' + c.etapa, 'Especialidad|' + (c.especialidad || '—'), 'Ciudad|' + (c.ciudad || '—'), 'Teléfono|+' + c.telefono, 'Lote|' + (c.lote || '—')].map(function (x) {
        var p = x.split('|'); return '<div class="fila-dato"><span style="color:#5B6661">' + p[0] + '</span><span>' + esc(p[1]) + '</span></div>';
      }).join('') +
      '<label class="rotulo" for="notas">Notas</label><textarea id="notas" style="height:110px;border-radius:10px;border:1px solid #D5DDD9;padding:10px;resize:vertical" placeholder="Ej. busca consultorio con vista, piso alto">' + esc(c.notas) + '</textarea>' +
      '<button class="boton-sec" id="guardaNotas">Guardar notas</button><button class="boton-sec" id="cambiaEtapa">Cambiar etapa</button>' +
      (c.etapa !== 'BAJA' ? '<button class="boton-sec" id="marcaBaja" style="color:#B42318;border-color:#F1C4C0">Marcar BAJA</button>' : '');
    document.getElementById('guardaNotas').onclick = function () { api('guardarNotas', c.telefono, document.getElementById('notas').value).then(function () { toast('Notas guardadas'); }); };
    document.getElementById('cambiaEtapa').onclick = function () { elegirEtapa(c); };
    var mb = document.getElementById('marcaBaja');
    if (mb) mb.onclick = function () { if (confirm('¿Marcar BAJA a ' + nombreDe(c) + '? Ya no se le podrá escribir.')) api('cambiarEtapa', c.telefono, 'BAJA').then(function () { abrirConv(c.telefono); }); };
  }

  // ---------- Contactos
  function vistaContactos() {
    api('listarContactos').then(function (l) { E.contactos = l; dibujar(); }).catch(function (e) { toast(e.message); });
    dibujar();
    function filtrados() {
      return E.contactos.filter(function (c) {
        if (E.filtroEtapa && c.etapa !== E.filtroEtapa) return false;
        var t = (nombreDe(c) + ' ' + c.especialidad + ' ' + c.ciudad).toLowerCase();
        return !E.textoBusca || t.indexOf(E.textoBusca.toLowerCase()) > -1;
      });
    }
    function chips() {
      var cuenta = function (e) { return E.contactos.filter(function (c) { return c.etapa === e; }).length; };
      return '<div class="chips claros">' + [['', 'Todos · ' + E.contactos.length], ['Nuevo', 'Nuevos'], ['Interesado', 'Interesados'], ['Cita', 'Cita'], ['BAJA', 'BAJA']].map(function (x) {
        return '<button class="chip' + (E.filtroEtapa === x[0] ? ' activo' : '') + '" data-etapa-f="' + x[0] + '">' + x[1] + (x[0] ? ' · ' + cuenta(x[0]) : '') + '</button>';
      }).join('') + '</div>';
    }
    function lista() {
      var l = filtrados();
      if (!l.length) return '<p class="vacio">No hay contactos con ese filtro.</p>';
      if (esCompu()) {
        return '<div style="overflow-x:auto"><table class="tabla"><thead><tr><th>Nombre</th><th>Especialidad</th><th>Ciudad</th><th>Teléfono</th><th>Etapa</th><th>Último contacto</th></tr></thead><tbody>' +
          l.map(function (c) { return '<tr><td><a href="#chat/' + esc(c.telefono) + '" style="font-weight:600;color:inherit;text-decoration:none">' + esc(nombreDe(c)) + '</a></td><td>' + esc(c.especialidad) + '</td><td>' + esc(c.ciudad) + '</td><td style="color:#5B6661">+' + esc(c.telefono) + '</td><td><span class="badge e-' + esc(c.etapa) + '">' + esc(c.etapa) + '</span></td><td style="color:#5B6661">' + esc(horaCorta(c.ultimaHora) || '—') + '</td></tr>'; }).join('') +
          '</tbody></table></div>';
      }
      return l.map(function (c) {
        return '<a class="fila" href="#chat/' + esc(c.telefono) + '"><div class="fila-info"><span class="nombre">' + esc(nombreDe(c)) + '</span><span style="font-size:13px;color:#5B6661">' + esc([c.especialidad, c.ciudad].filter(Boolean).join(' · ')) + '</span><span style="font-size:12px;color:#5B6661">+' + esc(c.telefono) + '</span></div><span class="badge e-' + esc(c.etapa) + '">' + esc(c.etapa) + '</span></a>';
      }).join('');
    }
    function dibujar() {
      var importar = '<label class="boton-sec" style="display:inline-flex;align-items:center;' + (esCompu() ? '' : 'background:#fff;border:none;height:36px') + '">Importar Excel<input type="file" id="archivo" accept=".xlsx,.xls,.csv" class="oculto"></label>';
      if (esCompu()) {
        app.innerHTML = barraEscritorio() + '<div class="contenido"><div class="pagina"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><h1 style="margin:0;font-size:24px">Contactos</h1>' + importar + '</div>' +
          '<div class="panel" style="padding:14px 18px;gap:12px"><label class="oculto" for="buscaC">Buscar contacto</label><input id="buscaC" class="buscar borde" type="search" placeholder="Buscar por nombre, especialidad o ciudad" value="' + esc(E.textoBusca) + '">' + chips() + '</div>' +
          '<div class="panel" id="listaC">' + lista() + '</div></div></div>';
      } else {
        app.innerHTML = '<header class="barra"><div class="barra-fila"><h1>Contactos</h1>' + importar + '</div><label class="oculto" for="buscaC">Buscar contacto</label><input id="buscaC" class="buscar" type="search" placeholder="Buscar por nombre, especialidad o ciudad" value="' + esc(E.textoBusca) + '"></header>' +
          '<div style="padding:12px 20px;border-bottom:1px solid #EEF1EF;background:#fff">' + chips() + '</div><div class="contenido" id="listaC" style="background:#fff">' + lista() + '</div>' + tabs();
      }
      enlazar();
      app.querySelectorAll('[data-etapa-f]').forEach(function (b) { b.onclick = function () { E.filtroEtapa = b.getAttribute('data-etapa-f'); dibujar(); }; });
      var bc = document.getElementById('buscaC');
      bc.oninput = function () { E.textoBusca = bc.value; document.getElementById('listaC').innerHTML = lista(); };
      document.getElementById('archivo').onchange = importarArchivo;
    }
  }

  function importarArchivo(ev) {
    var f = ev.target.files[0];
    if (!f) return;
    if (!window.XLSX) return toast('Espera un segundo y vuelve a intentar');
    var r = new FileReader();
    r.onload = function () {
      var libro = XLSX.read(new Uint8Array(r.result), { type: 'array' });
      var filas = XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]], { defval: '' });
      var norm = function (s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
      var datos = filas.map(function (o) {
        var x = {};
        Object.keys(o).forEach(function (k) {
          var n = norm(k);
          if (n.indexOf('especialidad') > -1) x.especialidad = o[k];
          else if (n.indexOf('ciudad') > -1) x.ciudad = o[k];
          else if (n.indexOf('nombre') > -1) x.nombre = o[k];
          else if (n.indexOf('link') > -1) x.link = o[k];
          else if (n.indexOf('telefono') > -1 || n.indexOf('celular') > -1 || n.indexOf('whatsapp') > -1) x.telefono = o[k];
        });
        return x;
      });
      if (!confirm('Se van a importar ' + datos.length + ' filas de "' + f.name + '". ¿Continuar?')) return;
      api('importarContactos', datos).then(function (res) {
        toast(res.nuevos + ' nuevos · ' + res.repetidos + ' repetidos · ' + res.sinTelefono + ' sin teléfono válido');
        vistaContactos();
      }).catch(function (e) { toast(e.message); });
    };
    r.readAsArrayBuffer(f);
  }

  // ---------- Campañas
  function vistaCampanas() {
    function cargar() { api('vistaPreviaLote', E.lote).then(function (p) { E.previa = p; dibujar(); }).catch(function (e) { toast(e.message); }); }
    cargar();
    dibujar();
    function dibujar() {
      var p = E.previa || {};
      var ej = p.ejemplo;
      var bloqueo = p.bloqueadoHasta && new Date(p.bloqueadoHasta) > new Date() ? restante(p.bloqueadoHasta) : null;
      var activa = !p.estadoPlantilla || /APPROVED|Activa/i.test(p.estadoPlantilla);
      var puede = p.cuantos > 0 && !bloqueo && p.semaforo !== 'Rojo' && activa;
      var motivo = !activa ? 'La plantilla todavía no está aprobada por Meta.' : bloqueo ? 'El siguiente lote se habilita en ' + bloqueo + '.' : p.semaforo === 'Rojo' ? 'Semáforo en rojo: no se puede mandar.' : !p.cuantos ? 'No hay contactos nuevos para mandar.' : 'Después de mandar, el siguiente lote se habilita en 48 h y según el semáforo.';
      var cuerpo =
        '<section class="tarjeta"><span class="rotulo">Plantilla</span><div class="fila-dato" style="gap:8px;align-items:center"><b>Primer contacto Médica Country</b><span class="badge ' + (activa ? 'e-Interesado' : 'e-Cita') + '">' + (activa ? 'Activa' : esc(p.estadoPlantilla || '…')) + '</span></div><span class="nota">Imagen + texto · botones Sí / No me interesa</span></section>' +
        '<section class="tarjeta"><span class="rotulo">A quién</span><div class="fila-dato" style="align-items:center"><span>Contactos nuevos</span><div class="contador-lote"><button class="redondo" data-lote="-1" aria-label="Menos">−</button><b style="font-size:20px;min-width:32px;text-align:center">' + E.lote + '</b><button class="redondo" data-lote="1" aria-label="Más">+</button></div></div><span class="nota">' + (p.disponibles != null ? p.disponibles + ' contactos nuevos disponibles' : '') + '</span></section>' +
        '<section class="tarjeta grid3"><div class="dato"><span>Tope hoy</span><b>' + ((p.enviadosHoy || 0) + (p.cuantos || 0)) + ' / ' + (p.tope || 250) + '</b></div><div class="dato"><span>Costo aprox.</span><b>$' + (p.costoAprox || 0) + '</b></div><div class="dato"><span>Excluidos</span><b>' + (p.excluidosBaja || 0) + ' BAJA</b></div></section>' +
        '<section class="previa"><span class="rotulo" style="color:#3F4A45">Vista previa</span><div class="globo salida" style="max-width:92%"><div style="height:90px;border-radius:8px;background:#2B3A4A;color:#DCE3EA;display:flex;align-items:center;justify-content:center;font-size:12px">[Imagen de la torre]</div><span>Dr(a). <b>' + esc(ej ? ej.apellido : 'Apellido') + '</b>: Espero que se encuentre bien. Le escribo en nombre de Alto Espacio…</span></div></section>' +
        '<p class="nota">' + esc(motivo) + '</p>' +
        '<button class="boton" id="mandar"' + (puede ? '' : ' disabled') + '>Mandar lote de ' + (p.cuantos != null ? p.cuantos : E.lote) + '</button>';
      if (esCompu()) app.innerHTML = barraEscritorio() + '<div class="contenido"><div class="pagina" style="max-width:720px"><h1 style="margin:0;font-size:24px">Nuevo lote</h1>' + cuerpo + '</div></div>';
      else app.innerHTML = '<header class="barra"><h1>Nuevo lote</h1></header><div class="contenido"><div class="pagina">' + cuerpo + '</div></div>' + tabs();
      enlazar();
      app.querySelectorAll('[data-lote]').forEach(function (b) {
        b.onclick = function () { E.lote = Math.max(1, Math.min(250, E.lote + Number(b.getAttribute('data-lote')) * (E.lote >= 50 ? 10 : 5))); cargar(); };
      });
      document.getElementById('mandar').onclick = function () {
        if (!confirm('¿Mandar la plantilla a ' + p.cuantos + ' contactos? Costo aproximado $' + p.costoAprox + '. Esto no se puede deshacer.')) return;
        var btn = document.getElementById('mandar'); btn.disabled = true; btn.textContent = 'Mandando…';
        api('mandarLote', E.lote, {}).then(function (r) { toast('Lote ' + r.lote + ': ' + r.enviados + ' enviados'); ir('semaforo'); })
          .catch(function (e) { toast(e.message); btn.disabled = false; btn.textContent = 'Mandar lote'; });
      };
    }
  }

  // ---------- Semáforo
  function vistaSemaforo() {
    api('semaforo').then(function (s) { E.semaforo = s; dibujar(); }).catch(function (e) { toast(e.message); });
    dibujar();
    function dibujar() {
      var s = E.semaforo || { lotes: [] }, u = s.lotes[s.lotes.length - 1];
      var color = u ? u.semaforo : 'Verde';
      var frase = { Verde: 'Verde: puedes seguir', Amarillo: 'Amarillo: pausa y cambia el mensaje', Rojo: 'Rojo: deja de mandar' }[color];
      var cuerpo =
        '<section class="tarjeta" style="flex-direction:row;align-items:center;gap:14px"><div class="semaforo-circulo s-' + color + '">' + (color === 'Verde' ? ICON.palomita : ICON.alto) + '</div><div><span class="rotulo">' + (u ? 'Lote ' + u.lote + ' · ' + u.enviados + ' contactos' : 'Sin lotes todavía') + '</span><div style="font-size:20px;font-weight:700">' + (u ? frase : 'Manda tu primer lote') + '</div></div></section>' +
        (u ? '<section class="tarjeta grid2"><div class="dato"><span>Entregados</span><b>' + u.entregados + ' de ' + u.enviados + '</b></div><div class="dato"><span>Dijeron Sí</span><b style="color:#0B6B4F">' + u.si + '</b></div><div class="dato"><span>BAJA / bloqueos</span><b style="color:#B42318">' + u.baja + '</b></div><div class="dato"><span>Sin respuesta</span><b>' + Math.max(0, u.entregados - u.si - u.baja) + '</b></div></section>' : '') +
        '<section class="tarjeta"><span class="rotulo">Según Meta</span><div class="fila-dato"><span>Calidad del número</span><b>' + esc(s.calidadMeta || '—') + '</b></div><div class="fila-dato"><span>Plantilla</span><b>' + esc(s.estadoPlantilla || '—') + '</b></div><div class="fila-dato"><span>Tope diario</span><b>' + (s.tope || 250) + '</b></div></section>' +
        '<section class="tarjeta" style="font-size:13px;color:#3F4A45;line-height:1.5"><span class="rotulo">Reglas (lotes chicos)</span><span><b style="color:#0B6B4F">Verde</b> · 0 a 1 BAJA o bloqueo: seguir</span><span><b style="color:#8A4B08">Amarillo</b> · 2 BAJA: pausar y cambiar mensaje</span><span><b style="color:#B42318">Rojo</b> · 3 o más, o Meta marca la plantilla: parar</span></section>' +
        (esCompu() && s.lotes.length ? '<section class="panel"><div style="padding:14px 18px" class="rotulo">Historial de lotes</div><div style="overflow-x:auto"><table class="tabla"><thead><tr><th>Lote</th><th>Fecha</th><th>Enviados</th><th>Entregados</th><th>Sí</th><th>BAJA</th><th>Semáforo</th></tr></thead><tbody>' +
          s.lotes.map(function (l) { return '<tr><td><b>' + l.lote + '</b></td><td>' + new Date(l.fecha).toLocaleDateString('es-MX') + '</td><td>' + l.enviados + '</td><td>' + l.entregados + '</td><td>' + l.si + '</td><td>' + l.baja + '</td><td><span class="badge ' + (l.semaforo === 'Verde' ? 'e-Interesado' : l.semaforo === 'Rojo' ? 'e-BAJA' : 'e-Cita') + '">' + l.semaforo + '</span></td></tr>'; }).join('') +
          '</tbody></table></div></section>' : '') +
        (DEMO ? '<p class="nota">Modo demo: números de ejemplo.</p>' : '');
      if (esCompu()) app.innerHTML = barraEscritorio() + '<div class="contenido"><div class="pagina"><h1 style="margin:0;font-size:24px">Semáforo</h1>' + cuerpo + '</div></div>';
      else app.innerHTML = '<header class="barra"><h1>Semáforo</h1></header><div class="contenido"><div class="pagina">' + cuerpo + '</div></div>' + tabs();
      enlazar();
    }
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
      .catch(function (e) { toast(e.message); });
  }

  // ------------------------------------------------------------------ arranque
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
  cargarSesion();
  pintar();
  // Si la app está abierta, revisa chats nuevos cada 30 s.
  setInterval(function () { if (E.sesion && seccion() === 'chats' && !document.hidden) refrescarLista(); }, 30000);
})();
