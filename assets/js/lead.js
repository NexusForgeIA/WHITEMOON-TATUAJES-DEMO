/*
 * lead.js — punto único de envío de leads de WhiteMoon.
 *
 * Cada lead hace dos cosas EN PARALELO:
 *   1) INSERT en la tabla leads_web con la clave PUBLICABLE de Supabase.
 *      Es una clave de navegador, protegida por RLS (política de inserción
 *      anónima). No da acceso de lectura a los leads de nadie.
 *      Se reintenta UNA vez si PostgREST devuelve 503 (el proyecto acaba de
 *      despertar): con un solo reintento el lead se salva sin arriesgar
 *      duplicados por insistir.
 *   2) AVISO a la Edge Function tatuajes-notify, que notifica por Telegram.
 *      Va por navigator.sendBeacon: el navegador se lo lleva aunque el
 *      usuario cierre la pestaña justo después de dejar el teléfono, que es
 *      exactamente cuando se pierden los avisos con fetch. sendBeacon exige
 *      un tipo "CORS-safelisted", así que el cuerpo viaja como Blob
 *      text/plain (NO application/json: eso dispararía un preflight que
 *      sendBeacon no puede hacer). La función lo parsea igual.
 *      El token del bot vive como secret de la función, NUNCA aquí.
 *
 * Ningún token ni secreto debe añadirse a este fichero.
 */
(function () {
  "use strict";
  if (window.WhiteMoonLead) return;

  var SUPABASE_URL = "https://mlaqtniujnvfxcvcourm.supabase.co";
  var SUPABASE_KEY = "sb_publishable_6no6BuOgiA_2nonTJntAuQ_DTqEgrcV";
  var NOTIFY_URL   = SUPABASE_URL + "/functions/v1/tatuajes-notify";

  var EMPRESA = "WhiteMoon";
  var ORIGEN  = "demo-tatuajes";
  var SECTOR  = "tatuajes";

  /* INSERT en leads_web. Un único reintento ante 503. */
  function insertaLead(fila, reintentos) {
    return fetch(SUPABASE_URL + "/rest/v1/leads_web", {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(fila)
    }).then(function (r) {
      if (r.status === 503 && reintentos > 0) {
        console.warn("[WhiteMoon] leads_web 503, reintentando una vez");
        return new Promise(function (ok) { setTimeout(ok, 800); })
          .then(function () { return insertaLead(fila, reintentos - 1); });
      }
      if (!r.ok) console.warn("[WhiteMoon] leads_web:", r.status);
      return r.ok;
    }).catch(function (e) {
      console.warn("[WhiteMoon] leads_web error:", e);
      return false;
    });
  }

  /*
   * Aviso a la Edge Function. sendBeacon devuelve false si el navegador no
   * lo encola (cuerpo demasiado grande, o no existe la API); en ese caso se
   * cae a un fetch normal para no perder el aviso.
   */
  function avisa(cuerpo) {
    var texto = JSON.stringify(cuerpo);
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([texto], { type: "text/plain;charset=UTF-8" });
        if (navigator.sendBeacon(NOTIFY_URL, blob)) return Promise.resolve(true);
      }
    } catch (e) {
      console.warn("[WhiteMoon] sendBeacon error:", e);
    }
    return fetch(NOTIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: texto,
      keepalive: true
    }).then(function (r) {
      if (!r.ok) console.warn("[WhiteMoon] notify:", r.status);
      return r.ok;
    }).catch(function (e) {
      console.warn("[WhiteMoon] notify error:", e);
      return false;
    });
  }

  /*
   * send({ nombre, telefono, servicio, zona, mensaje })
   * Resuelve siempre: un fallo de red no debe romper la conversación.
   * Devuelve [insertOk, notifyOk] para poder informar al usuario.
   */
  function send(data) {
    var nombre   = (data.nombre || "").trim();
    var telefono = (data.telefono || "").trim();
    var servicio = (data.servicio || "").trim();
    var zona     = (data.zona || "").trim();
    var mensaje  = (data.mensaje || "").trim();

    var insert = insertaLead({
      nombre: nombre,
      telefono: telefono,
      empresa: EMPRESA,
      sector: SECTOR,
      origen: ORIGEN,
      interes: servicio,
      mensaje: mensaje
    }, 1);

    var notify = avisa({
      empresa: EMPRESA,
      nombre: nombre,
      telefono: telefono,
      sector: SECTOR,
      servicio: servicio,
      zona: zona,
      mensaje: mensaje,
      origen: ORIGEN
    });

    return Promise.all([insert, notify]);
  }

  /* Móvil o fijo español: 9 dígitos empezando por 6, 7, 8 o 9,
     tolerando espacios, guiones y el prefijo +34 / 0034. */
  function normalizaTelefono(raw) {
    var d = String(raw || "").replace(/[^\d]/g, "").replace(/^(0034|34)/, "");
    return /^[6789]\d{8}$/.test(d) ? d : "";
  }

  window.WhiteMoonLead = {
    empresa: EMPRESA,
    origen: ORIGEN,
    sector: SECTOR,
    send: send,
    normalizaTelefono: normalizaTelefono
  };
})();
