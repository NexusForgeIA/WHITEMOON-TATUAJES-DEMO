/*
 * agente.js — Neo, asistente del estudio de tatuajes de WhiteMoon.
 *
 * Modelo "demo + pivote". Quien visita la demo no es cliente de tatuajes: es
 * un dueño de negocio viendo el producto. Así que Neo:
 *   FASE 1 — demuestra: resuelve dudas del estudio con botones y respuestas
 *            fijas (sin cifras de precio). No pide ningún dato.
 *   FASE 2 — pivota: tras 2 respuestas, o al pulsar "¿Cómo funciona esto?" /
 *            "Me interesa para mi negocio", ofrece un agente así para SU
 *            negocio y pide tipo de negocio -> nombre -> teléfono.
 * El lead viaja como PROSPECTO DE AGENCIA, no como reserva de tatuaje: el
 * tipo de negocio va en 'mensaje' y tatuajes-notify lo lee de ahí.
 *
 * El envío del lead se delega en lead.js, que es el único sitio con la
 * configuración de Supabase. Aquí no hay claves.
 *
 * Requiere assets/js/lead.js cargado antes. Sin más dependencias.
 */
(function () {
  "use strict";
  if (window.WhiteMoonAgente) return;

  var EMPRESA = (window.WhiteMoonLead && window.WhiteMoonLead.empresa) || "WhiteMoon";

  var BG   = "#0C0C0C";
  var INK  = "#D7E2EA";
  var LINE = "rgba(215,226,234,.18)";
  var GRAD = "linear-gradient(123deg,#18011F 7%,#B600A8 37%,#7621B0 72%,#BE4C00 100%)";

  /* ------------------------------- Guion ------------------------------- */
  /* Respuestas fijas de la fase 1. Sin cifras: el precio va siempre por
     factores y se cierra al ver el diseño. */
  var DUDAS = [
    { id: "estilos", label: "Estilos",
      texto: "Trabajamos realismo, blackwork, línea fina y coberturas de tatuajes antiguos. Cada diseño se dibuja a medida a partir de tu idea." },
    { id: "higiene", label: "Cuidados e higiene",
      texto: "Material esterilizado y de un solo uso, abierto delante de ti. Al terminar te explicamos los cuidados para que cicatrice bien." },
    { id: "proceso", label: "Cómo es el proceso",
      texto: "Nos cuentas la idea, la dibujamos a medida y, cuando encaja contigo, la tatuamos a tu ritmo. La primera consulta y el presupuesto son sin compromiso." },
    { id: "precios", label: "Precios",
      texto: "Depende del tamaño, la zona y el estilo: no cuesta lo mismo una línea fina pequeña que una pieza en color. El presupuesto se cierra al ver el diseño, sin compromiso." }
  ];

  var PIVOTE = "Por cierto: todo esto te lo estoy respondiendo yo solo, un agente de " +
    "WhiteMoon, 24/7. En tu negocio haría lo mismo: atender, resolver dudas y " +
    "captar clientes mientras tú trabajas. ¿Quieres uno así?";

  /* Respuestas de fase 1 antes de pivotar solo. */
  var MAX_DUDAS = 2;

  /* Si en vez del tipo de negocio escriben que quieren tatuarse o reservar,
     se aclara que es una demo. Estrecho a propósito: "estudio de tatuajes"
     es un negocio válido y NO debe caer aquí. */
  var RESERVA = /reserv|pedir cita|tatuarme|hacerme un tatu|mi boceto|quiero un tatu/i;

  var lead = { negocio: "", nombre: "", telefono: "" };
  var vistas = [];
  var step = "";
  var els = {};
  var abierto = false;

  /* ------------------------------- Estilos ------------------------------- */
  var css = "" +
    ".nt-fab{position:fixed;right:clamp(14px,3vw,26px);bottom:clamp(14px,3vw,26px);z-index:2147483000;" +
      "display:flex;align-items:center;gap:9px;height:56px;padding:0 24px;border:0;border-radius:999px;cursor:pointer;" +
      "background:" + GRAD + ";color:#fff;font-family:'Kanit',system-ui,sans-serif;font-size:13px;font-weight:500;" +
      "text-transform:uppercase;letter-spacing:.12em;outline:2px solid #fff;outline-offset:-3px;" +
      "box-shadow:0 4px 4px rgba(181,1,167,.25),4px 4px 12px #7721B1 inset;" +
      "transition:transform .2s ease-out,filter .2s ease-out}" +
    ".nt-fab:hover{transform:translateY(-2px);filter:brightness(1.12)}" +
    ".nt-fab:active{transform:scale(.97)}" +
    ".nt-fab svg{width:19px;height:19px;flex:none}" +
    ".nt-fab[aria-expanded=true]{transform:scale(.94);opacity:.85}" +
    /* Mientras el hero está a la vista su propio CTA hace este trabajo:
       el FAB se esconde para no taparlo. */
    ".nt-fab.nt-hide{opacity:0;visibility:hidden;pointer-events:none;transform:translateY(14px)}" +
    "@media (max-width:600px){.nt-fab{height:52px;padding:0 18px;font-size:11.5px}}" +

    ".nt-panel{position:fixed;right:clamp(14px,3vw,26px);bottom:calc(clamp(14px,3vw,26px) + 70px);z-index:2147483000;" +
      "width:min(374px,calc(100vw - 28px));height:min(556px,calc(100vh - 128px));" +
      "background:" + BG + ";border:2px solid " + INK + ";border-radius:28px;overflow:hidden;display:none;flex-direction:column;" +
      "font-family:'Kanit',system-ui,-apple-system,sans-serif;color:" + INK + ";" +
      "box-shadow:0 30px 80px rgba(0,0,0,.7);opacity:0;transform:translateY(14px) scale(.98);" +
      "transition:opacity .24s cubic-bezier(.25,.1,.25,1),transform .24s cubic-bezier(.25,.1,.25,1)}" +
    ".nt-panel.open{display:flex}.nt-panel.in{opacity:1;transform:none}" +

    ".nt-head{display:flex;align-items:center;gap:11px;padding:15px 16px;flex:none;border-bottom:1px solid " + LINE + "}" +
    ".nt-ava{width:38px;height:38px;border-radius:12px;flex:none;display:grid;place-items:center;background:" + GRAD + ";color:#fff}" +
    ".nt-ava svg{width:19px;height:19px}" +
    ".nt-htxt b{display:block;font-size:15px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}" +
    ".nt-htxt span{display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:300;opacity:.6;" +
      "text-transform:uppercase;letter-spacing:.12em;margin-top:1px}" +
    ".nt-htxt span::before{content:'';width:6px;height:6px;border-radius:50%;background:#B600A8}" +
    ".nt-x{margin-left:auto;border:0;background:none;color:" + INK + ";cursor:pointer;width:34px;height:34px;border-radius:10px;" +
      "display:grid;place-items:center;opacity:.6;transition:opacity .2s,background-color .2s}" +
    ".nt-x:hover{opacity:1;background:rgba(215,226,234,.1)}" +
    ".nt-x svg{width:18px;height:18px}" +

    ".nt-body{flex:1;overflow-y:auto;padding:18px 15px 10px;display:flex;flex-direction:column;gap:11px;scroll-behavior:smooth}" +
    ".nt-body::-webkit-scrollbar{width:7px}" +
    ".nt-body::-webkit-scrollbar-thumb{background:rgba(215,226,234,.2);border-radius:8px}" +

    ".nt-row{display:flex;gap:8px;align-items:flex-end;max-width:90%}" +
    ".nt-row.bot{align-self:flex-start}" +
    ".nt-row.user{align-self:flex-end;flex-direction:row-reverse}" +
    ".nt-mini{width:24px;height:24px;border-radius:8px;flex:none;display:grid;place-items:center;background:" + GRAD + ";color:#fff}" +
    ".nt-mini svg{width:13px;height:13px}" +
    ".nt-bub{padding:10px 14px;border-radius:16px;font-size:13.5px;font-weight:300;line-height:1.55;" +
      "white-space:pre-line;text-wrap:pretty}" +
    ".nt-row.bot .nt-bub{background:rgba(215,226,234,.07);border:1px solid " + LINE + ";border-bottom-left-radius:5px}" +
    ".nt-row.user .nt-bub{background:" + INK + ";color:" + BG + ";font-weight:500;border-bottom-right-radius:5px}" +

    ".nt-opts{display:flex;flex-wrap:wrap;gap:7px;align-self:flex-start;max-width:97%;padding-left:32px}" +
    ".nt-chip{background:none;border:1px solid rgba(215,226,234,.32);color:" + INK + ";font-family:inherit;" +
      "font-size:12.5px;font-weight:300;padding:8px 14px;border-radius:999px;cursor:pointer;min-height:36px;" +
      "transition:border-color .18s,background-color .18s,transform .12s}" +
    ".nt-chip:hover{border-color:" + INK + ";background:rgba(215,226,234,.1)}" +
    ".nt-chip:active{transform:scale(.97)}" +
    ".nt-chip.skip{opacity:.6}" +

    ".nt-foot{flex:none;border-top:1px solid " + LINE + ";padding:12px;background:" + BG + "}" +
    ".nt-form{display:flex;gap:9px}" +
    ".nt-input{flex:1;min-width:0;background:rgba(215,226,234,.07);border:1px solid rgba(215,226,234,.3);" +
      "color:" + INK + ";border-radius:999px;padding:12px 18px;font-family:inherit;font-size:14.5px;font-weight:300;min-height:46px}" +
    ".nt-input::placeholder{color:rgba(215,226,234,.62)}" +
    ".nt-input:focus{outline:none;border-color:" + INK + ";background:rgba(215,226,234,.12)}" +
    ".nt-input:disabled{opacity:1;cursor:not-allowed}" +
    ".nt-send{flex:none;width:46px;height:46px;border-radius:50%;border:0;cursor:pointer;background:" + GRAD + ";color:#fff;" +
      "display:grid;place-items:center;transition:transform .12s,filter .2s}" +
    ".nt-send:hover{filter:brightness(1.12);transform:translateY(-1px)}.nt-send:active{transform:scale(.95)}" +
    ".nt-send:disabled{opacity:.45;cursor:not-allowed;transform:none;filter:none}" +
    ".nt-send svg{width:18px;height:18px}" +
    ".nt-err{color:#ff8f7a;font-size:12px;font-weight:300;padding:7px 6px 0}" +
    ".nt-note{text-align:center;font-size:10px;font-weight:300;opacity:.6;padding-top:9px;" +
      "text-transform:uppercase;letter-spacing:.12em}" +

    ".nt-typing{display:flex;gap:4px;padding:4px 2px}" +
    ".nt-typing i{width:6px;height:6px;border-radius:50%;background:" + INK + ";opacity:.5;animation:nt-b 1.2s infinite ease-in-out}" +
    ".nt-typing i:nth-child(2){animation-delay:.15s}.nt-typing i:nth-child(3){animation-delay:.3s}" +
    "@keyframes nt-b{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}" +

    "@media (prefers-reduced-motion:reduce){" +
      ".nt-panel,.nt-fab,.nt-chip,.nt-send{transition:none}" +
      ".nt-typing i{animation:none}.nt-body{scroll-behavior:auto}}" +
    "@media (max-width:600px){.nt-panel{right:8px;left:8px;width:auto;bottom:76px;height:min(72vh,520px)}}";

  /* ------------------------------- Iconos ------------------------------- */
  var IC_SPARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3z"/><path d="M18.5 15.5 19.3 18l2.5.8-2.5.8-.8 2.5-.8-2.5-2.5-.8 2.5-.8.8-2.5z"/></svg>';
  var IC_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  var IC_SEND  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';

  /* ------------------------------- DOM ------------------------------- */
  function build() {
    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    var fab = document.createElement("button");
    fab.className = "nt-fab";
    fab.type = "button";
    /* El nombre accesible empieza por el texto visible: si no, salta
       label-content-name-mismatch (WCAG 2.5.3). */
    fab.setAttribute("aria-label", "Habla con el agente IA de " + EMPRESA);
    fab.setAttribute("aria-expanded", "false");
    fab.innerHTML = IC_SPARK + "<span>Habla con el agente</span>";

    var panel = document.createElement("div");
    panel.className = "nt-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Asistente del estudio de tatuajes de " + EMPRESA);
    panel.innerHTML =
      '<div class="nt-head">' +
        '<div class="nt-ava">' + IC_SPARK + '</div>' +
        '<div class="nt-htxt"><b>Neo</b><span>Asistente del estudio · ' + EMPRESA + '</span></div>' +
        '<button class="nt-x" type="button" aria-label="Cerrar el asistente">' + IC_CLOSE + '</button>' +
      '</div>' +
      '<div class="nt-body" aria-live="polite"></div>' +
      '<div class="nt-foot" hidden>' +
        '<form class="nt-form" autocomplete="on">' +
          '<input class="nt-input" type="text" autocomplete="name" aria-label="Tu respuesta">' +
          '<button class="nt-send" type="submit" aria-label="Enviar">' + IC_SEND + '</button>' +
        '</form>' +
        '<div class="nt-err" hidden></div>' +
        '<div class="nt-note">Demo · tus datos llegan al equipo</div>' +
      '</div>';

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    els.fab = fab;
    els.panel = panel;
    els.body = panel.querySelector(".nt-body");
    els.foot = panel.querySelector(".nt-foot");
    els.form = panel.querySelector(".nt-form");
    els.input = panel.querySelector(".nt-input");
    els.send = panel.querySelector(".nt-send");
    els.err = panel.querySelector(".nt-err");

    ocultarSobreHero(fab);

    fab.addEventListener("click", toggle);
    panel.querySelector(".nt-x").addEventListener("click", close);
    els.form.addEventListener("submit", onSubmit);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel.classList.contains("open")) close();
    });
  }

  /*
   * El hero ya tiene su botón "Habla con el agente" abajo a la derecha, justo
   * donde va el FAB. Mientras el hero esté en pantalla el FAB se oculta, y
   * aparece al pasar de largo. Sin hero (o sin IntersectionObserver) se
   * muestra siempre.
   */
  function ocultarSobreHero(fab) {
    var hero = document.querySelector(".hero");
    if (!hero || !("IntersectionObserver" in window)) return;

    fab.classList.add("nt-hide");
    new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        /* No esconderlo si el panel está abierto: cerrarlo dejaría al
           usuario sin forma de volver a abrirlo. */
        if (els.panel && els.panel.classList.contains("open")) return;
        fab.classList.toggle("nt-hide", e.isIntersecting);
      });
    }, { threshold: 0.18 }).observe(hero);
  }

  function toggle() { els.panel.classList.contains("open") ? close() : open(); }

  function open() {
    els.panel.classList.add("open");
    els.fab.setAttribute("aria-expanded", "true");
    requestAnimationFrame(function () { els.panel.classList.add("in"); });
    if (!abierto) { abierto = true; start(); }
  }

  function close() {
    els.panel.classList.remove("in");
    els.fab.setAttribute("aria-expanded", "false");
    setTimeout(function () { els.panel.classList.remove("open"); }, 240);
  }

  /* ------------------------------- Render ------------------------------- */
  function scroll() { els.body.scrollTop = els.body.scrollHeight; }

  function botMsg(text, cb) {
    var row = document.createElement("div");
    row.className = "nt-row bot";
    row.innerHTML = '<div class="nt-mini">' + IC_SPARK + '</div>' +
      '<div class="nt-bub"><div class="nt-typing"><i></i><i></i><i></i></div></div>';
    els.body.appendChild(row);
    scroll();

    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(function () {
      var bub = row.querySelector(".nt-bub");
      bub.innerHTML = "";
      bub.textContent = text;
      scroll();
      if (cb) cb();
    }, reduced ? 120 : 480);
  }

  function userMsg(text) {
    var row = document.createElement("div");
    row.className = "nt-row user";
    row.innerHTML = '<div class="nt-bub"></div>';
    row.querySelector(".nt-bub").textContent = text;
    els.body.appendChild(row);
    scroll();
  }

  function options(list, onPick) {
    var wrap = document.createElement("div");
    wrap.className = "nt-opts";
    list.forEach(function (item) {
      var opt = typeof item === "string" ? { label: item, value: item } : item;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "nt-chip" + (opt.skip ? " skip" : "");
      b.textContent = opt.label;
      b.addEventListener("click", function () {
        wrap.remove();
        userMsg(opt.label);
        onPick(opt.value);
      });
      wrap.appendChild(b);
    });
    els.body.appendChild(wrap);
    scroll();
  }

  function showInput(placeholder, type, autocomplete) {
    els.foot.hidden = false;
    els.input.value = "";
    els.input.placeholder = placeholder;
    els.input.type = type || "text";
    els.input.inputMode = type === "tel" ? "tel" : "text";
    els.input.setAttribute("autocomplete", autocomplete || "off");
    hideErr();
    setTimeout(function () { els.input.focus(); }, 60);
  }
  function hideInput() { els.foot.hidden = true; }
  function showErr(m) { els.err.textContent = m; els.err.hidden = false; }
  function hideErr() { els.err.hidden = true; }

  /* --------------------------- Máquina de estados --------------------------- */
  function start() {
    botMsg("Hola, soy Neo, el asistente del estudio. Puedo resolverte dudas.\n¿Qué quieres saber?", ofrecerDudas);
  }

  /* FASE 1. Dudas aún no vistas + "¿Cómo funciona esto?" al principio,
     o + "Me interesa para mi negocio" tras la primera respuesta. */
  function ofrecerDudas() {
    step = "dudas";
    var opts = DUDAS.filter(function (d) { return vistas.indexOf(d.id) < 0; })
      .map(function (d) { return { label: d.label, value: d.id }; });
    opts.push(vistas.length
      ? { label: "Me interesa para mi negocio", value: "pivote" }
      : { label: "¿Cómo funciona esto?", value: "pivote" });
    options(opts, pickDuda);
  }

  function pickDuda(id) {
    if (id === "pivote") { pivota(); return; }
    var d = DUDAS.filter(function (x) { return x.id === id; })[0];
    vistas.push(d.id);
    botMsg(d.texto, vistas.length >= MAX_DUDAS ? pivota : ofrecerDudas);
  }

  /* FASE 2. */
  function pivota() {
    botMsg(PIVOTE, function () {
      botMsg("¿Qué tipo de negocio tienes?", function () {
        step = "negocio";
        showInput("Ej.: peluquería, clínica, taller…", "text", "off");
      });
    });
  }

  function onSubmit(e) {
    e.preventDefault();
    var val = els.input.value.trim();
    if (!val) return;

    if (step === "negocio") {
      userMsg(val);
      hideInput();
      if (RESERVA.test(val)) {
        botMsg("Esto es una demo de WhiteMoon: aquí no se reservan tatuajes reales. " +
          "Si tienes un negocio y quieres un agente así, dime de qué tipo y te llamamos, sin compromiso.", function () {
          showInput("Ej.: peluquería, clínica, taller…", "text", "off");
        });
        return;
      }
      lead.negocio = val;
      botMsg("¿Tu nombre?", function () {
        step = "nombre";
        showInput("Escribe tu nombre", "text", "name");
      });
      return;
    }

    if (step === "nombre") {
      if (val.length < 2) { showErr("Dime tu nombre, por favor."); return; }
      lead.nombre = val;
      userMsg(val);
      hideInput();
      botMsg("¿Un teléfono para llamarte, sin compromiso?", function () {
        step = "telefono";
        showInput("6XX XXX XXX", "tel", "tel");
      });
      return;
    }

    if (step === "telefono") {
      var digits = window.WhiteMoonLead
        ? window.WhiteMoonLead.normalizaTelefono(val)
        : val.replace(/[^\d]/g, "");
      if (!digits) { showErr("Necesito un teléfono válido de 9 dígitos."); return; }
      lead.telefono = digits;
      userMsg(val);
      finish();
    }
  }

  /*
   * Cierre: se envía el lead y Neo confirma en una frase. El input se queda
   * a la vista pero deshabilitado, para que se entienda que la conversación
   * terminó y no parezca que la web se ha quedado colgada.
   */
  function finish() {
    step = "done";
    submitLead();

    els.input.value = "";
    els.input.disabled = true;
    els.input.placeholder = "Conversación finalizada";
    els.send.disabled = true;

    botMsg("Perfecto, " + lead.nombre + ". Te llamamos al " + lead.telefono +
      " para enseñarte cómo sería en tu negocio.");
  }

  /*
   * PROSPECTO DE AGENCIA, no reserva. origen y sector los fija lead.js
   * ("demo-tatuajes" / "tatuajes": el sector enruta el aviso). El tipo de
   * negocio va en 'mensaje' con el prefijo "Tipo de negocio: ", que es lo
   * que busca tatuajes-notify: si se cambia aquí, cambiarlo allí.
   */
  function submitLead() {
    if (!window.WhiteMoonLead) {
      console.warn("[Neo] lead.js no está cargado: el lead no se envía.");
      return;
    }
    return window.WhiteMoonLead.send({
      nombre: lead.nombre,
      telefono: lead.telefono,
      servicio: "Quiere agente IA para su negocio",   /* -> columna 'interes' */
      mensaje: "Dueño de negocio llegado desde la demo de tatuajes. Tipo de negocio: " + lead.negocio
    });
  }

  window.WhiteMoonAgente = { open: open, close: close };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
