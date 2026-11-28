import { almacenamientoLanding, type ConfiguracionLanding } from './persistencia-demo';

const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) =>
  root.querySelector<T>(selector) as T;

function luminancia(hex: string): number {
  const canales = [1, 3, 5].map((inicio) => {
    const valor = parseInt(hex.slice(inicio, inicio + 2), 16) / 255;
    return valor <= 0.04045 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * canales[0] + 0.7152 * canales[1] + 0.0722 * canales[2];
}

function contraste(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function iniciar() {
  const raiz = $<HTMLElement>('[data-landing-demo]');
  const form = $<HTMLFormElement>('[data-configuracion]', raiz);
  const mensajeGuardado = $('[data-estado-guardado]', raiz);
  let configuracion: ConfiguracionLanding;

  try {
    configuracion = almacenamientoLanding.leer();
  } catch (error) {
    console.error('No se pudo acceder al almacenamiento local de la demo de landing pages.', error);
    mensajeGuardado.textContent = 'No se pudo acceder al almacenamiento local. Los cambios no se pueden guardar.';
    form.querySelectorAll('fieldset').forEach((fieldset) => (fieldset.disabled = true));
    return;
  }

  const controles = form.elements;
  const campo = <T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(nombre: string) =>
    controles.namedItem(nombre) as T;

  function cargarFormulario(datos: ConfiguracionLanding) {
    campo<HTMLInputElement>('nombre').value = datos.nombre;
    campo<HTMLInputElement>('monograma').value = datos.monograma;
    campo<HTMLInputElement>('titulo').value = datos.titulo;
    campo<HTMLTextAreaElement>('descripcion').value = datos.descripcion;
    campo<HTMLInputElement>('llamadaAccion').value = datos.llamadaAccion;
    campo<HTMLInputElement>('whatsapp').value = datos.whatsapp;
    campo<HTMLInputElement>('email').value = datos.email;
    campo<HTMLInputElement>('colorFondo').value = datos.colorFondo;
    campo<HTMLInputElement>('colorAcento').value = datos.colorAcento;
    campo<HTMLSelectElement>('tipografia').value = datos.tipografia;
    campo<HTMLSelectElement>('imagen').value = datos.imagen;
    campo<HTMLTextAreaElement>('servicios').value = datos.servicios.join('\n');
    campo<HTMLInputElement>('seccion-servicios').checked = datos.secciones.servicios;
    campo<HTMLInputElement>('seccion-portfolio').checked = datos.secciones.portfolio;
    campo<HTMLInputElement>('seccion-opiniones').checked = datos.secciones.opiniones;
    campo<HTMLInputElement>('seccion-contacto').checked = datos.secciones.contacto;
  }

  function leerFormulario(): ConfiguracionLanding {
    return {
      nombre: campo<HTMLInputElement>('nombre').value.trim(),
      monograma: campo<HTMLInputElement>('monograma').value.trim(),
      titulo: campo<HTMLInputElement>('titulo').value.trim(),
      descripcion: campo<HTMLTextAreaElement>('descripcion').value.trim(),
      llamadaAccion: campo<HTMLInputElement>('llamadaAccion').value.trim(),
      whatsapp: campo<HTMLInputElement>('whatsapp').value.trim(),
      email: campo<HTMLInputElement>('email').value.trim(),
      colorFondo: campo<HTMLInputElement>('colorFondo').value,
      colorAcento: campo<HTMLInputElement>('colorAcento').value,
      tipografia: campo<HTMLSelectElement>('tipografia').value as ConfiguracionLanding['tipografia'],
      imagen: campo<HTMLSelectElement>('imagen').value as ConfiguracionLanding['imagen'],
      servicios: campo<HTMLTextAreaElement>('servicios')
        .value.split('\n')
        .map((servicio) => servicio.trim())
        .filter(Boolean),
      secciones: {
        servicios: campo<HTMLInputElement>('seccion-servicios').checked,
        portfolio: campo<HTMLInputElement>('seccion-portfolio').checked,
        opiniones: campo<HTMLInputElement>('seccion-opiniones').checked,
        contacto: campo<HTMLInputElement>('seccion-contacto').checked,
      },
    };
  }

  function actualizarVista(datos: ConfiguracionLanding) {
    const sitio = $('[data-sitio]', raiz);
    sitio.style.setProperty('--brand-bg', datos.colorFondo);
    sitio.style.setProperty('--brand-accent', datos.colorAcento);
    const fondo = luminancia(datos.colorFondo);
    const acento = luminancia(datos.colorAcento);
    const texto = contraste(fondo, 1) >= contraste(fondo, 0) ? '#ffffff' : '#000000';
    const textoAcento = contraste(acento, 1) >= contraste(acento, 0) ? '#ffffff' : '#000000';
    sitio.style.setProperty('--brand-text', texto);
    sitio.style.setProperty('--brand-muted', texto);
    sitio.style.setProperty('--brand-accent-text', textoAcento);
    sitio.style.setProperty('--brand-label', contraste(fondo, acento) >= 4.5 ? datos.colorAcento : texto);
    sitio.dataset.tipografia = datos.tipografia;
    $$<HTMLElement>('[data-nombre]', raiz).forEach((el) => (el.textContent = datos.nombre));
    $$<HTMLElement>('[data-monograma]', raiz).forEach((el) => (el.textContent = datos.monograma));
    $$<HTMLElement>('[data-titulo]', raiz).forEach((el) => (el.textContent = datos.titulo));
    $('[data-descripcion]', raiz).textContent = datos.descripcion;
    $$<HTMLElement>('[data-cta]', raiz).forEach((el) => (el.textContent = datos.llamadaAccion));
    $('[data-email]', raiz).textContent = datos.email || 'Agregá un email de contacto';
    $('[data-telefono]', raiz).textContent = datos.whatsapp ? `WhatsApp · ${datos.whatsapp}` : 'Agregá tu WhatsApp';
    $<HTMLImageElement>('[data-imagen]', raiz).src = datos.imagen;

    const lista = $('[data-lista-servicios]', raiz);
    lista.replaceChildren(
      ...datos.servicios.map((servicio) => {
        const [nombre, precio] = servicio.split('|').map((parte) => parte.trim());
        const item = document.createElement('li');
        const titulo = document.createElement('strong');
        const detalle = document.createElement('span');
        titulo.textContent = nombre || servicio;
        detalle.textContent = precio || 'Consultanos';
        item.append(titulo, detalle);
        return item;
      }),
    );

    for (const [seccion, habilitada] of Object.entries(datos.secciones)) {
      $$<HTMLElement>(`[data-seccion="${seccion}"]`, raiz).forEach((el) => (el.hidden = !habilitada));
    }
  }

  function guardarCambios() {
    if (!form.reportValidity()) return;
    const nuevosDatos = leerFormulario();
    try {
      almacenamientoLanding.guardar(nuevosDatos);
      configuracion = nuevosDatos;
      actualizarVista(configuracion);
      mensajeGuardado.textContent = 'Cambios guardados en este navegador.';
    } catch (error) {
      console.error('No se pudo guardar la configuración de la demo de landing pages.', error);
      mensajeGuardado.textContent = 'No se pudieron guardar los cambios. Revisá el almacenamiento local.';
    }
  }

  cargarFormulario(configuracion);
  actualizarVista(configuracion);
  form.addEventListener('input', guardarCambios);
  form.addEventListener('change', guardarCambios);

  $$<HTMLButtonElement>('[data-vista]', raiz).forEach((boton) =>
    boton.addEventListener('click', () => {
      const vista = boton.dataset.vista === 'mobile' ? 'mobile' : 'desktop';
      $('[data-marco]', raiz).dataset.vista = vista;
      $$<HTMLButtonElement>('[data-vista]', raiz).forEach((otro) =>
        otro.setAttribute('aria-pressed', String(otro === boton)),
      );
    }),
  );

  $('[data-restaurar]', raiz).addEventListener('click', () => {
    if (!window.confirm('¿Restaurar el contenido y el estilo iniciales de esta demo?')) return;
    try {
      configuracion = almacenamientoLanding.reiniciar();
      cargarFormulario(configuracion);
      actualizarVista(configuracion);
      mensajeGuardado.textContent = 'Se restauró la configuración inicial.';
    } catch (error) {
      console.error('No se pudo restaurar la demo de landing pages.', error);
      mensajeGuardado.textContent = 'No se pudo restaurar la configuración.';
    }
  });

  const formularioContacto = $<HTMLFormElement>('[data-form-contacto]', raiz);
  const estadoContacto = $('[data-contacto-estado]', raiz);
  formularioContacto.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!formularioContacto.reportValidity()) return;
    estadoContacto.textContent = '¡Gracias! La consulta se simuló correctamente; no se envió a ningún servicio.';
    formularioContacto.reset();
  });

  $('[data-whatsapp-demo]', raiz).addEventListener('click', () => {
    estadoContacto.textContent = `WhatsApp simulado para ${configuracion.whatsapp || 'el negocio'}. No se abrió una aplicación externa.`;
  });
}

const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => [
  ...root.querySelectorAll<T>(selector),
];

iniciar();
