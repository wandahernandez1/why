# why · demos comerciales

Sitio comercial de why y demos interactivas para negocios locales. Las operaciones de barbería y take away son simulaciones de frontend: no hay backend, cobros, reservas reales ni envío de notificaciones. Los datos se guardan en el navegador que ejecuta la demo.

## Ejecutar

Requiere Node.js y npm.

```powershell
npm install
npm run dev
```

Para comprobar la versión de producción:

```powershell
npm run build
npm run preview
```

## Rutas principales

- `/`: landing comercial del estudio, servicios y demos en vivo.
- `/demo/landing`: constructor de landing page con contenido y estilo persistentes.
- `/demo/barberia`: recorrido de solicitud de turnos.
- `/demo/pizzeria`: menú, personalización de productos, carrito y checkout.
- `/demo/admin`: panel de gestión local. Puede abrirse con `?negocio=barberia` o `?negocio=pizzeria`.

## Arquitectura actual

El proyecto existente está construido con **Astro y TypeScript**, no React. Se conserva esa base para reutilizar las demos probadas y evitar una migración amplia que duplicaría funcionalidades. La UI pública se renderiza con componentes Astro; las interacciones se encapsulan en módulos TypeScript del navegador. Tailwind CSS se integra en la configuración existente y los iconos actuales son Phosphor.

La identidad visual usa superficies negras, texto claro, verde para acciones y detalles borgoña. Los tokens comunes están en `src/styles/tokens.css`; la demo de landing conserva la personalización de colores guardada en el navegador. El agente de proyecto `landing-page-architect` sigue esta arquitectura y paleta.

```text
src/
  components/landing/     secciones del sitio comercial
  components/demos/       componentes compartidos por barbería y take away
  data/                   datos semilla JSON independientes por demo
  layouts/                documento y metadatos Astro
  pages/demo/             experiencias públicas y panel de gestión
  scripts/                lógica de interacción, horarios y persistencia
  styles/                 tokens, estilos globales y estilos de demos
```

### Persistencia y modelos

`src/scripts/persistencia-demo.ts` ofrece almacenamiento CRUD versionado para registros del navegador:

- `why:demo:barberia:turnos:v1`: solicitudes de turno.
- `why:demo:pizzeria:pedidos:v1`: pedidos.
- `why:demo:landing-pages:configuracion:v1`: configuración de la plantilla comercial.

Cada registro incluye su propio estado y una instantánea de los datos relevantes al momento de la solicitud. Una entrada con JSON inválido o versión desconocida se restaura al valor inicial y se registra en la consola. Las solicitudes nuevas no se presentan como confirmadas: turnos y pedidos se crean como `pendiente`; cancelar un turno vuelve a liberar el horario en la disponibilidad local. El carrito y los datos de checkout existentes mantienen sus claves actuales, separadas por demo.

El panel permite revisar registros, cambiar los estados de demostración y vaciarlos con confirmación. Sus datos son locales a ese navegador y no se sincronizan con el teléfono usado para escanear el QR ni con otros visitantes.

### Flujos implementados

- **Barbería:** servicio → profesional → disponibilidad → datos y validación → solicitud pendiente → WhatsApp simulado. Los horarios de solicitudes activas se bloquean también en la disponibilidad local y se vuelve a comprobar el horario antes de registrar.
- **Take away:** producto y adicionales → carrito persistente → entrega y pago → datos y validación → pedido pendiente → WhatsApp simulado. El panel permite avanzar el pedido por sus estados de muestra.
- **Landing pages:** edición en vivo de marca, textos, colores, tipografía, imagen de una selección local, servicios y secciones → vista escritorio/celular → consulta simulada. La configuración persiste separada del resto de demos.
- **Gestión:** selección de demo → métricas y lista vacía o registros → edición de estado o restauración confirmada.

## Alcance por etapas

La plataforma se desarrolla sobre las dos demos existentes y se amplía de forma incremental, verificando cada recorrido antes de sumar el siguiente:

1. **Persistencia y ciclo de gestión de pedidos/turnos:** implementado.
2. **Demo de landing pages:** constructor de contenido y marca, estado persistente, vista responsive y formulario simulado; implementado con imágenes locales predefinidas.
3. **Personalización comercial de barbería y take away:** editar catálogo/servicios, identidad, horarios, disponibilidad y contacto con vista pública sincronizada.
4. **Gestión ampliada:** calendario, reprogramación e historial; panel de productos, categorías, promociones y configuración gastronómica.
5. **Catálogo independiente y páginas de servicios/contacto**, si la navegación comercial necesita separarse de la landing actual.

No se introducen React, React Router ni un backend en esta etapa: el repositorio ya tiene Astro y las rutas existentes cubren las experiencias públicas. La selección de librerías se revisará solo si una etapa posterior requiere migrar el sitio completo.
