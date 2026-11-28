# Imágenes optimizadas

Lo que pongas acá se convierte automáticamente a WebP y al tamaño justo al hacer `npm run build`.

- **Tu foto** (sección "Sobre mí"): `src/assets/yo.jpg` (cuadrada, mínimo 600×600).
- **Productos de una demo/cliente**: por ejemplo `src/assets/pizzeria/muzzarella.jpg`,
  y en el JSON: `"imagen": "pizzeria/muzzarella.jpg"`.
- **Fotos de profesionales**: `src/assets/barberia/martin.jpg` → `"foto": "barberia/martin.jpg"`.

Si el campo queda en `null`, se muestra el emoji (productos) o las iniciales (profesionales).
