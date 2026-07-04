/* ============================================================
   FRAGMENTO DE INTEGRACIÓN — Reservas Wix en el Hub Docentes
   ============================================================
   Este archivo NO es un módulo independiente.
   Muestra exactamente QUÉ agregar y DÓNDE en el Hub existente.

   PASO 1: index.html — agregar en <head> ANTES del cierre </head>
   ------------------------------------------------------------
   <!-- FullCalendar 6 (incluye su propio CSS en el bundle) -->
   <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js"></script>
   <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/locales/es.global.min.js"></script>
   <!-- CSS del módulo Reservas Wix -->
   <link rel="stylesheet" href="css/reservas-calendar.css">

   PASO 2: index.html — agregar en el menú de navegación del Hub
   ------------------------------------------------------------
   (Buscar donde están los otros botones/secciones del nav)

   <button
     class="nav-item"
     data-section="reservasWix"
     onclick="navegarA('reservasWix')"
   >
     Reservas Wix
   </button>

   PASO 3: index.html — agregar el contenedor de la sección
   ------------------------------------------------------------
   (Junto a las otras secciones ocultas con display:none o similar)

   <section id="seccion-reservasWix" class="hub-seccion" style="display:none">
     <div id="modulo-reservas"></div>
   </section>

   PASO 4: en el JS principal del Hub — importar e integrar
   ------------------------------------------------------------
   Copiar el bloque de código de abajo al archivo JS principal.
   ============================================================ */

/* ---- BLOQUE A AGREGAR EN EL JS PRINCIPAL DEL HUB ---- */

import { initReservasCalendar } from "./js/reservas-calendar.js";

/* Variable que guarda la instancia activa del módulo */
let _reservasModulo = null;

/**
 * Llama esta función cuando el usuario navega a la sección "Reservas Wix".
 * @param {object} db        - Instancia de Firestore ya inicializada por el Hub
 * @param {object} user      - Objeto usuario autenticado (user.email)
 */
function abrirReservasWix(db, user) {
  const container = document.getElementById("modulo-reservas");
  if (!container) return;

  /* Destruir instancia anterior si existe */
  if (_reservasModulo) {
    _reservasModulo.destroy();
    _reservasModulo = null;
  }

  _reservasModulo = initReservasCalendar({
    container,
    db,
    userEmail: user.email,
  });
}

/**
 * Llama esta función cuando el usuario sale de la sección "Reservas Wix"
 * (cambia a otra sección, cierra sesión, etc.)
 */
function cerrarReservasWix() {
  if (_reservasModulo) {
    _reservasModulo.destroy();
    _reservasModulo = null;
  }
}

/* ---- EJEMPLO DE INTEGRACIÓN CON NAVEGACIÓN EXISTENTE ---- */
/*
   Si el Hub ya tiene una función tipo "mostrarSeccion(nombre)" o
   "navegarA(nombre)", agrega las llamadas así:

   function mostrarSeccion(nombre) {
     // ... tu lógica actual para mostrar/ocultar secciones ...

     if (nombre === "reservasWix") {
       abrirReservasWix(db, currentUser);
     } else {
       cerrarReservasWix(); // destruir al salir
     }
   }

   Si el Hub usa un router o un switch de secciones, asegúrate de
   llamar cerrarReservasWix() antes de saltar a otra sección.
*/
