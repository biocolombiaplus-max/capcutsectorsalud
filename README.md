# CapCut Salud Pro · Landing del curso

Landing page del curso presencial de CapCut para profesionales de la salud en Cúcuta
(sábado 28 de noviembre, 2:00–6:00 p.m., dicta Diany Amaya). Sitio estático: HTML, CSS y JavaScript sin dependencias.

## Pagos (tarjeta y PSE con ePayco)
Usa la misma cuenta de ePayco de la landing de tiendas virtuales (llave pública `347e…3fba`, cliente `1595409`).

- **Plan Individual:** reserva con el **50%** ($125.000) o pago total. El saldo se paga el día del curso.
- **Promociones grupales** (Equipo Pro y Clínica/IPS): se pagan **completas**.
- **Botón "Quiero terminar mi registro en WhatsApp":** pide nombre y WhatsApp y abre el chat con el **350 545 7420** con el resumen.
- Tras pagar, ePayco devuelve al cliente a `pago-ok.html`, que muestra el estado y un botón para confirmar por WhatsApp.

Cómo funciona el pago:
1. **Checkout v2** (recomendado): la función `api/epayco.js` de Vercel crea la sesión y **calcula el precio en el servidor**.
   Requiere en Vercel → Settings → Environment Variables: `EPAYCO_PRIVATE_KEY` (la misma de la landing de tiendas)
   y, opcional, `EPAYCO_TEST=true` para hacer pruebas.
2. **Respaldo automático:** si no hay servidor o falta la llave privada, se abre el checkout clásico de ePayco con la llave pública.
3. Si el navegador bloquea ePayco, aparece la opción de recibir el link de pago por WhatsApp.

Si cambias precios en el administrador, cámbialos también en `PLANS` dentro de `api/epayco.js`.

## Ver la página
Abre `index.html` en el navegador, o publícalo en **Vercel** (recomendado, para el pago v2). También funciona en GitHub Pages o Netlify con el checkout clásico.

## Administrador
- Botón **"Administrador"** al pie de la página, o entra a `tu-sitio/#admin`.
- Clave: `123456` (se cambia en `assets/js/app.js`, constante `ADMIN_KEY`).
- Pestañas **Testimonios** (opiniones con foto y estrellas + capturas de WhatsApp de alumnos) y **Certificado** (textos del certificado o foto del certificado real).
- Desde ahí editas: WhatsApp, Instagram, lugar, fecha, cupos, precios y planes grupales,
  foto y biografía de la instructora, galería de cursos dictados y testimonios.

### Importante: cómo publicar los cambios
Los cambios del administrador se guardan **en el navegador donde los hiciste**.
Para que todos los visitantes los vean:
1. Administrador → pestaña **Publicar / Respaldo** → **Descargar contenido.json**.
2. Reemplaza el archivo `data/contenido.json` del sitio por el descargado y vuelve a publicar.

La clave está en el código de la página, así que solo evita que un visitante cualquiera abra el panel;
no es una protección real. Nadie puede cambiar lo que ven los demás sin subir el archivo al sitio.

## Estructura
```
index.html              Página
assets/css/styles.css   Estilos (paleta fucsia, amarillo, aguamarina)
assets/js/app.js        Lógica, formulario a WhatsApp y panel administrador
data/contenido.json     Contenido publicado (lo genera el administrador)
pago-ok.html            Resultado del pago (ePayco regresa aquí)
api/epayco.js           Función de Vercel: crea la sesión de pago
api/epayco-js.js        Función de Vercel: respaldo del script de ePayco
```
