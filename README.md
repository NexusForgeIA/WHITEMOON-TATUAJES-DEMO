# WHITEMOON-TATUAJES-DEMO — demo de estudio de tatuajes

Landing de captación de una sola página para **estudios de tatuajes**, con el
agente IA de WhiteMoon. Marca: **WhiteMoon** (la propia agencia).

**En vivo:** https://nexusforgeia.github.io/WHITEMOON-TATUAJES-DEMO/

HTML5 + CSS plano + JS vanilla. Sin React, Vite, Framer ni Tailwind.
Sin paso de build: GitHub Pages sirve el repo tal cual.

Es una réplica exacta de la demo de limpiezas (`WHITEMOON-LIMPIEZAS`): mismo
layout, mismo sistema visual, mismos efectos y mismos breakpoints. Solo cambian
los textos, las imágenes, el schema y el sector del backend.

---

## Regla de oro: honestidad

Esta demo **no inventa datos**. No hay años de experiencia, reseñas,
testimonios, artistas, clientes reales ni cifras de resultados. Los tres casos
de "Nuestro trabajo" son **ejemplos ilustrativos**, no clientes.

Los dos primeros van etiquetados como **Portfolio**. Solo el tercero
(cover-up) usa el formato **Antes / Después**, porque en una cobertura sí hay
una pieza previa que enseñar; aun así las fotos son de stock y **no son la
misma persona ni el mismo tatuaje**: los `alt` describen lo que cada imagen
muestra de verdad.

El bloque de contacto incluye un hueco marcado como *Hueco reservado* para el
portfolio, las reseñas y los datos que aportará el estudio real.

---

## Estructura

```
index.html                              landing completa
assets/css/styles.css                   sistema de diseño + @font-face de Kanit
assets/fonts/kanit-{300,500,600,900}-latin.woff2
assets/js/site.js                       reveal · magnet · marquee · chars · cards apiladas
assets/js/lead.js                       envío de leads — ÚNICO sitio con config de Supabase
assets/js/agente.js                     asistente IA "Neo"
assets/img/                             27 fotos locales + og:image JPG
supabase/functions/tatuajes-notify/     Edge Function del aviso por Telegram
robots.txt  sitemap.xml  llms.txt  .nojekyll
```

Orden de secciones: **Hero · Marquee · Sobre nosotros · Servicios · Proyectos**,
más un bloque **FAQ + Contacto** al final.

Todo el contenido va dentro de un único `<main id="contenido">`; el `<nav>` y
el `<footer>` quedan fuera, así que hay un solo landmark principal.

---

## Tipografía autoalojada

Kanit se sirve desde `assets/fonts` en **woff2, subset latin**, en vez del
`<link>` de Google Fonts. Motivos:

- Dos conexiones menos a terceros (`fonts.googleapis.com`, `fonts.gstatic.com`).
- El peso **900** —el del titular del hero— va en `<link rel="preload">`, así
  que el H1 se pinta ya con Kanit y **no hay reflow del hero**, que era lo que
  disparaba el CLS.

Solo se embarcan los 4 pesos que usa la página (300 · 500 · 600 · 900), ~19 KB
cada uno. El `unicode-range` es el del subset latin de Google, que cubre las
tildes, la ñ y los signos `¿` `¡` del castellano.

---

## Imágenes

Las 27 fotos son de **Unsplash** con licencia libre y están **descargadas y
servidas en local**: nada de hotlink en caliente, que penaliza el rendimiento
móvil y puede acabar limitado por peticiones. Descargadas a `q=70` y al ancho
real del hueco (×2 en las cards, para retina). En el HTML hay un comentario
`<!-- [IMG_XXX] -->` justo antes de cada `<img>` para localizar cada hueco.

| Token | Fichero | Tamaño |
|---|---|---|
| `[IMG_HERO]` | `hero-tatuaje.jpg` | 1040×693 |
| `[IMG_MARQUEE_1..21]` | `mq-01.jpg` … `mq-12.jpg` (12 únicas, en bucle) | 840×540 |
| `[IMG_DECO_1..4]` | `deco-1.jpg` … `deco-4.jpg` | 440×440 |
| `[IMG_P1_A/B/C]` | `case1-*.jpg` · retrato en realismo | 940×460 · 940×676 · 1200×980 |
| `[IMG_P2_A/B/C]` | `case2-*.jpg` · blackwork geométrico | idem |
| `[IMG_P3_A/B/C]` | `case3-*.jpg` · cover-up | idem |
| `og:image` | `og-tatuajes.jpg` | 1200×630 **JPG** (nunca SVG) |

Todas con `width`/`height` **reales** declarados (evita saltos de layout) y
`loading="lazy"` salvo el hero, que además va con `fetchpriority="high"` y
`rel="preload"`. Los `alt` describen lo que la foto muestra de verdad.

**Son fotos de stock genéricas de tatuajes, no trabajos de un estudio
concreto.** Al personalizar para un cliente real hay que sustituirlas por su
portfolio. Está declarado en el bloque *Hueco reservado* de la web y en
`llms.txt`.

---

## Efectos (todos vanilla, en `site.js`)

| Efecto | Implementación |
|---|---|
| **Reveal** | `IntersectionObserver` once, `rootMargin: 50px` → clase `.in`. Transición CSS de `opacity` + `transform`, `cubic-bezier(.25,.1,.25,1)`, 0.7 s. Offsets y delays por elemento vía `--rx` `--ry` `--rdelay` `--rdur`. |
| **Magnet** | `mousemove`; si el cursor entra en el rect + 150 px, `translate3d(dx/3, dy/3, 0)`. |
| **Marquee** | `scroll` passive. `offset = (scrollY − sectionTop + innerHeight) × 0.3`; fila 1 `translateX(offset−200)`, fila 2 al revés. Tiles triplicados por JS, con las copias en `aria-hidden` y `alt=""`. |
| **Chars** | Cada carácter en un `<span>`; opacidad de 0.2 a 1 según el progreso de scroll. El párrafo completo queda en `aria-label` para que el lector no lo lea letra a letra. |
| **Cards apiladas** | `position: sticky` (`top` 96 px / md 128 px, más `i × 28px`) dentro de contenedores de `85vh`. La escala baja 0.03 por cada card posterior. |

Un único listener de `scroll` agrupado en `requestAnimationFrame`. Con
`prefers-reduced-motion` no se registra ningún listener decorativo y todo se
muestra en su estado final.

---

## Asistente IA "Neo"

Flujo guiado, máximo 3 frases por respuesta y una pregunta cada vez:

```
estilo → zona del cuerpo → tamaño → nombre → teléfono → cierre
```

Solo el nombre y el teléfono son obligatorios. El **estilo** elegido es lo que
viaja como `servicio` y acaba en la columna `interes` de `leads_web`.

### Cierre: tarjeta de datos verificados

Al capturar nombre y teléfono se pinta una tarjeta con un check en círculo
(color de acento, `aria-hidden`), el titular **Datos recibidos**, el resumen de
lo registrado y el mensaje *"Gracias, {nombre}. Hemos registrado tu consulta de
{estilo} en {zona}. Te contactamos en breve."*

La tarjeta va con `role="status"` y `aria-live="polite"`. El input se queda a la
vista pero **deshabilitado**, con el placeholder *"Conversación finalizada"*.
**No hay CTA de "llámanos"**: en un estudio de tatuajes no hay urgencias.

### Envío del lead

`lead.js` hace **dos cosas en paralelo**:

1. `INSERT` en `leads_web` (Supabase) con la clave **publicable**, protegida por
   RLS — `origen='demo-tatuajes'`, `sector='tatuajes'`, `empresa='WhiteMoon'`.
   Con **un reintento** si PostgREST devuelve `503` (proyecto despertando).
2. Aviso a la Edge Function `tatuajes-notify` por **`navigator.sendBeacon`**,
   con el cuerpo como `Blob` de tipo `text/plain;charset=UTF-8` — **no**
   `application/json`, que dispararía un preflight que `sendBeacon` no puede
   hacer. Así el aviso sale aunque el usuario cierre la pestaña justo después
   de dejar el teléfono. Si el navegador no encola el beacon, cae a `fetch`
   con `keepalive`.

### Edge Function `tatuajes-notify`

Calcada de `mudanzas-notify`. Envía por **Telegram Bot API** leyendo los
secrets `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`, con `verify_jwt: false` y
guard de lead incompleto (sin nombre o sin teléfono → `400`, sin aviso).
Formato del mensaje:

```
🔔 Nuevo lead (demo-tatuajes) · tatuajes
Nombre: …
Teléfono: …
Servicio: …
Zona: …
```

Despliegue:

```bash
supabase functions deploy tatuajes-notify --project-ref mlaqtniujnvfxcvcourm --no-verify-jwt
```

**Nunca CallMeBot**: los avisos de WhiteMoon van siempre por Telegram.

### Seguridad

En el repo **solo** vive la clave publicable de Supabase (`sb_publishable_…`),
pensada para el navegador. El token del bot de Telegram y cualquier otro
secreto viven como *secrets* de la Edge Function, nunca en el JS.

---

## SEO / GEO

- `title` 31 c y `meta description` 148 c.
- Open Graph y Twitter sincronizados; `og:image` en **JPG** 1200×630.
- JSON-LD en un único `@graph`: `TattooParlor` (subtipo válido de
  `LocalBusiness`), `Service`, `BreadcrumbList` y `FAQPage`. Sin duplicados.
- Las respuestas del `FAQPage` son texto plano, sin etiquetas inline, y
  **coinciden palabra por palabra** con el DOM visible.
- `areaServed`: noroeste de Madrid.
- `llms.txt` con un único `#` inicial y enlaces en Markdown.
- `robots.txt` permite GPTBot, ClaudeBot, PerplexityBot y Google-Extended.
- `.nojekyll` para que GitHub Pages sirva el repo tal cual.

---

## Personalizar para un cliente real

1. **Marca** — buscar y reemplazar `WhiteMoon` en `index.html`, `llms.txt` y la
   constante `EMPRESA` de `assets/js/lead.js`, y sustituir los dos ficheros
   `assets/img/whitemoon-logo.*` por el logo del cliente.
2. **Colores** — bloque `:root` de `assets/css/styles.css` y el degradado
   `.hero-heading`.
3. **Contacto y mapa** — la sección `#contacto` lleva los datos **reales de
   WhiteMoon** (643 199 580, `comercial@whitemoon.es`, Majadahonda) para que los
   enlaces se puedan probar. Hay que sustituir el `tel:`, el `mailto:`, el
   `wa.me/` y las coordenadas del `<iframe>` del mapa por los del estudio.
4. **Dominio** — sustituir `https://nexusforgeia.github.io/WHITEMOON-TATUAJES-DEMO/`
   en canonical, og:url, JSON-LD, `sitemap.xml`, `robots.txt` y `llms.txt`.
5. **Zonas y estilos** — `areaServed` del JSON-LD, `llms.txt` y las constantes
   `ESTILOS`, `ZONAS` y `TAMANOS` de `assets/js/agente.js`.
6. **Afirmaciones de servicio** — repasar el copy (material de un solo uso,
   coberturas, edad mínima) y confirmar que el estudio real lo cumple antes de
   publicar.

---

## Accesibilidad

- Enlace *saltar al contenido* hacia el `<main>`, `:focus-visible` en toda la web.
- Un solo `<main>` y jerarquía `h1 → h2 → h3` sin saltos.
- Contrastes medidos sobre el color real ya compuesto con la opacidad: los
  textos secundarios sobre `#0C0C0C` se subieron de `.5`/`.45` a `.58` porque a
  `.5` el gris resultante se quedaba en 4.32:1, por debajo del 4.5:1 de la AA.
- El FAB del asistente lleva un `aria-label` que **empieza por su texto
  visible**, para no disparar `label-content-name-mismatch` (WCAG 2.5.3).
- Las copias de los tiles del marquee van con `aria-hidden` y `alt=""`.
- Las imágenes decorativas de "Sobre nosotros" son `aria-hidden`.
- FAQ sobre `<details>` nativo: legible aunque el JS no cargue.
- `prefers-reduced-motion` respetado en la web y en el asistente.
- Responsive real en 600, 640, 768, 900 y 1024. En móvil las cards dejan de
  ser sticky y se apilan en flujo normal.

---

Demo de [WhiteMoon Agencia IA](https://whitemoon.es/).
