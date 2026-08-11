/*
 * site.js — efectos de la landing WhiteMoon. Vanilla, sin dependencias.
 *
 *  1. Reveal     IntersectionObserver, once, margen 50px -> clase .in
 *  2. Magnet     la imagen del hero sigue al cursor a 1/3 de distancia
 *  3. Marquee    dos filas que se desplazan en sentidos opuestos con el scroll
 *  4. Chars      el párrafo de "Sobre nosotros" ilumina letra a letra
 *  5. Cards      las tarjetas de proyectos se apilan y encogen al superponerse
 *
 * Todo respeta prefers-reduced-motion: con la preferencia activa el contenido
 * se muestra en su estado final y no se registra ningún listener de scroll.
 */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Un único listener de scroll reparte a todos los efectos, con el trabajo
     agrupado en un rAF para no forzar reflows en cada evento. */
  var tareas = [];
  var pendiente = false;

  function alScroll() {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(function () {
      pendiente = false;
      for (var i = 0; i < tareas.length; i++) tareas[i]();
    });
  }

  function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

  /* ------------------------------------------------------ 1. Reveal --- */

  var revelables = document.querySelectorAll("[data-rv]");

  if (reduced || !("IntersectionObserver" in window)) {
    Array.prototype.forEach.call(revelables, function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);          // once
      });
    }, { rootMargin: "50px" });
    Array.prototype.forEach.call(revelables, function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------ 2. Magnet --- */

  var magnet = document.querySelector("[data-magnet]");
  if (magnet && !reduced) {
    var RADIO = 150;   // px alrededor del borde que activan el efecto
    var activo = false;

    document.addEventListener("mousemove", function (e) {
      var r = magnet.getBoundingClientRect();
      if (!r.width) return;

      var dentro =
        e.clientX >= r.left - RADIO && e.clientX <= r.right + RADIO &&
        e.clientY >= r.top - RADIO && e.clientY <= r.bottom + RADIO;

      if (dentro) {
        if (!activo) {
          activo = true;
          magnet.style.transition = "transform 0.3s ease-out";
        }
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        magnet.style.transform = "translate3d(" + (dx / 3) + "px," + (dy / 3) + "px,0)";
      } else if (activo) {
        activo = false;
        magnet.style.transition = "transform 0.6s ease-in-out";
        magnet.style.transform = "translate3d(0,0,0)";
      }
    }, { passive: true });
  }

  /* ----------------------------------------------------- 3. Marquee --- */

  var marquee = document.querySelector("[data-marquee]");
  if (marquee) {
    var filas = marquee.querySelectorAll(".marquee__row");

    /* Triplicar los tiles para que el bucle no deje huecos al desplazarse. */
    Array.prototype.forEach.call(filas, function (fila) {
      var base = fila.innerHTML;
      fila.innerHTML = base + base + base;
      /* Las copias son decorativas: se ocultan a los lectores de pantalla. */
      var imgs = fila.querySelectorAll("img");
      for (var i = imgs.length / 3; i < imgs.length; i++) {
        imgs[i].setAttribute("aria-hidden", "true");
        imgs[i].setAttribute("alt", "");
      }
    });

    /* Posición absoluta en el documento: offsetTop sería relativo a
       .wrapper, que está posicionado. */
    var topDocumento = function (el) {
      return el.getBoundingClientRect().top + window.scrollY;
    };

    var moverMarquee = function () {
      var offset = (window.scrollY - topDocumento(marquee) + window.innerHeight) * 0.3;
      var d = offset - 200;
      if (filas[0]) filas[0].style.transform = "translateX(" + d + "px)";
      if (filas[1]) filas[1].style.transform = "translateX(" + (-d) + "px)";
    };
    /* Con movimiento reducido el marquee se queda quieto en su posición
       inicial: no se registra su tarea de scroll. */
    if (!reduced) tareas.push(moverMarquee);
    moverMarquee();
  }

  /* ------------------------------------------------------- 4. Chars --- */

  var parrafo = document.querySelector("[data-chars]");
  if (parrafo) {
    var texto = parrafo.textContent;
    var frag = document.createDocumentFragment();
    for (var c = 0; c < texto.length; c++) {
      var s = document.createElement("span");
      /* Espacio normal, NO duro: un   impediría el salto de línea y el
         párrafo entero saldría en una sola línea desbordando el ancho. */
      s.textContent = texto[c];
      frag.appendChild(s);
    }
    parrafo.textContent = "";
    parrafo.appendChild(frag);
    /* El texto ya está en el DOM carácter a carácter; se expone el original
       para que un lector de pantalla no lo lea letra por letra. */
    parrafo.setAttribute("aria-label", texto);

    var letras = parrafo.querySelectorAll("span");

    if (reduced) {
      Array.prototype.forEach.call(letras, function (s) { s.style.opacity = 1; });
    } else {
      var pintarChars = function () {
        var r = parrafo.getBoundingClientRect();
        var vh = window.innerHeight;
        /* Equivale al offset ['start 0.8', 'end 0.2'] de Framer Motion:
           progreso 0 cuando el inicio cruza el 80% del viewport,
           progreso 1 cuando el final llega al 20%. */
        var recorrido = 0.6 * vh + r.height;
        var progreso = clamp((0.8 * vh - r.top) / recorrido, 0, 1);
        var avance = progreso * letras.length;
        for (var i = 0; i < letras.length; i++) {
          letras[i].style.opacity = 0.2 + 0.8 * clamp(avance - i, 0, 1);
        }
      };
      tareas.push(pintarChars);
      pintarChars();
    }
  }

  /* ------------------------------------------------------- 5. Cards --- */

  var huecos = document.querySelectorAll(".case-slot");
  if (huecos.length && !reduced) {
    var escalarCards = function () {
      /* En móvil las cards dejan de ser sticky: no se escalan. */
      if (window.matchMedia("(max-width: 599px)").matches) return;

      var tope = window.matchMedia("(min-width: 768px)").matches ? 128 : 96;
      var total = huecos.length;

      for (var i = 0; i < total; i++) {
        var card = huecos[i].querySelector(".case");
        if (!card) continue;

        /* Cuánto han "llegado" las cards posteriores encima de esta. */
        var cubierto = 0;
        for (var j = i + 1; j < total; j++) {
          var r = huecos[j].getBoundingClientRect();
          cubierto += clamp((tope - r.top) / huecos[j].offsetHeight, 0, 1);
        }
        /* Escala final cuando está totalmente tapada: 1-(total-1-i)*0.03 */
        card.style.transform = "scale(" + (1 - 0.03 * cubierto).toFixed(4) + ")";
      }
    };
    tareas.push(escalarCards);
    escalarCards();
  }

  /* ------------------------------------------------------- listeners --- */

  /*
   * Antes esto iba condicionado a !reduced, así que con movimiento reducido
   * no se registraba ningún listener. Ahora la barra fija necesita el suyo,
   * y las tareas puramente decorativas ya se filtran una a una al añadirlas.
   */
  if (tareas.length) {
    window.addEventListener("scroll", alScroll, { passive: true });
    window.addEventListener("resize", alScroll, { passive: true });
    alScroll();
  }

  /* ----------------------------------------- Barra fija --- */
  /*
   * Dos cosas:
   *  a) publica la altura REAL de la barra en --nav-h, que el CSS usa para
   *     el hueco del hero y para el scroll-margin-top de las anclas. Así el
   *     valor sigue siendo correcto en cualquier breakpoint.
   *  b) añade .scrolled pasados 40px, reusando el despachador de scroll ya
   *     existente (un solo listener, agrupado en rAF).
   */
  var nav = document.querySelector(".nav");
  if (nav) {
    var medirNav = function () {
      var alto = Math.round(nav.getBoundingClientRect().height);
      if (alto) document.documentElement.style.setProperty("--nav-h", alto + "px");
    };
    medirNav();

    if (window.ResizeObserver) {
      new ResizeObserver(medirNav).observe(nav);
    } else {
      window.addEventListener("resize", medirNav, { passive: true });
    }
    /* La fuente Kanit cambia la altura del texto al cargar */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(medirNav);

    tareas.push(function () {
      nav.classList.toggle("scrolled", window.scrollY > 40);
    });
  }

  /* ------------------------------- Logo: volver arriba --- */
  /*
   * El href="#top" ya funciona sin JS, pero con el fragmento ya puesto en la
   * URL un segundo clic puede no hacer nada. Esto lo vuelve determinista y
   * deja la URL limpia, sin "#top" colgando.
   */
  var logo = document.querySelector('.wm[href="#top"]');
  if (logo) {
    logo.addEventListener("click", function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      if (history.replaceState) {
        history.replaceState(null, "", location.pathname + location.search);
      }
    });
  }

  /* --------------------------------- CTAs que abren el agente IA --- */

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-agente]");
    if (!t) return;
    e.preventDefault();
    if (window.WhiteMoonAgente) window.WhiteMoonAgente.open();
  });

  /* ------------------------- FAQ: solo una abierta a la vez --- */

  var detalles = document.querySelectorAll(".faq details");
  Array.prototype.forEach.call(detalles, function (d) {
    d.addEventListener("toggle", function () {
      if (!d.open) return;
      Array.prototype.forEach.call(detalles, function (o) { if (o !== d) o.open = false; });
    });
  });
})();
