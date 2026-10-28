# TONARI — TP2 Programación IV

> Red social con **Angular** (front) + **NestJS** (back) + **MongoDB** (base de datos).
> UTN Avellaneda · Programación IV · 2026 C2 · Agustín López

| | |
|---|---|
| **Front (deploy)** | _pendiente_ |
| **Back (deploy)** | _pendiente_ |
| **Colaboradores** | `afriadenrich`, `ndiez-utn` |

**Referencias:** ✅ hecho · ⬜ pendiente. Cada ítem copia el texto de la consigna.

---

## 📅 Fechas

| Corrección | Fecha | Hasta |
|---|---|---|
| Sprint 1 | 05/11 | Sprint 1 |
| Sprint 2 | 12/11 | Sprint 2 |
| Sprint 3 | 19/11 | Sprint 3 |
| **Entrega** | **26/11** | Sprint 4 |
| Promoción (elegir una) | 01/12 o 03/12 | Sprint 5 |
| Recuperatorio (última fecha para aprobar) | 10/12 | — |

---

## 📁 Estructura del repo

```
/
├── front/   → Angular
├── back/    → NestJS
└── README.md
```

---

## ▶️ Cómo correrlo en local

**Back** (`back/`):

1. `npm install`
2. Copiar `.env.example` como `.env` y completar:
   - `MONGO_URI`: connection string de MongoDB Atlas (con la base `tonari`)
   - `URL_PUBLICA`: URL del back (`http://localhost:3000`)
   - `URL_FRONT`: URL del front (`http://localhost:4200`)
   - `CONTRASENA_DEL_SERVER`: secreto con el que se firman los JWT (cualquier texto largo y difícil de adivinar)
3. `npm run start:dev` → queda en `http://localhost:3000`

**Front** (`front/`):

1. `npm install`
2. `ng serve` → queda en `http://localhost:4200`

---

## 🧩 Requisitos generales (aplican a todo el TP)

- [x] Repositorio privado con el nombre `NOMBRE-APELLIDO-TP2-PROG4-2026-C2`
- [x] Colaborador `afriadenrich` agregado
- [x] Colaborador `ndiez-utn` agregado
- [x] Idea original (no copiar el diseño de una red social existente)
- [ ] Los usuarios pueden hacer publicaciones, reaccionar y comentarlas
- [x] Cada usuario puede ver y editar su perfil
- [ ] Solo se accede a la aplicación estando registrado o logueado
- [x] Diseño trabajado, no HTML plano
- [x] No usar `alert()`: usar modales
- [x] Login y registro contra el servidor Nest propio, con JWT
- [x] Status correctos en la API (400, 401, 201, etc.). Nunca 200 en errores ni 400 en respuestas correctas
- [x] Publicaciones con título, mensaje e imagen opcional
- [x] Publicaciones con "Me gusta"
- [ ] Publicaciones con comentarios
- [ ] UX: diseño trabajado y uniforme en toda la aplicación
- [x] UX: navegación entre pantallas
- [ ] UX: información clara y completa al mostrar mensajes o realizar acciones

---

## 🏃 Sprint 1 — 05/11

### Front
- [x] Creación del proyecto front (Angular)
- [x] Pantalla Registro
- [x] Pantalla Login
- [x] Pantalla Publicaciones
- [x] Pantalla Mi Perfil
- [ ] Deploy en hosting
- [x] Navegación entre componentes (sin límites de accesibilidad)
- [x] Favicon propio
- **Login**
  - [x] Formulario con validaciones y mensajes acordes
  - [x] Por correo o por nombre de usuario (el elegido debe ser único en la base de datos)
  - [x] Contraseña: al menos 8 caracteres, una mayúscula y un número
- **Registro**
  - [x] Formulario con validaciones y mensajes acordes
  - [x] Campos: nombre, apellido, correo, nombre de usuario, contraseña, repetir contraseña, fecha de nacimiento, descripción breve
  - [x] Campo de tipo file para la imagen de perfil
  - [ ] Atributo perfil: por defecto "usuario", modificable a "administrador"

### Back
- [x] Creación del proyecto back (NestJS)
- [x] Módulo Publicaciones
- [x] Módulo Autenticación
- [x] Módulo Usuarios
- **Ruta registro (POST)**
  - [x] Recibe todos los datos del usuario, los valida y lo guarda en la base de datos
  - [x] La contraseña queda encriptada
  - [x] Recibe la imagen de perfil, la guarda apropiadamente y guarda la URL en la base de datos
- **Ruta login (POST)**
  - [x] Recibe usuario/correo y contraseña sin encriptar
  - [x] Encripta la contraseña recibida para confirmar el login
  - [x] Devuelve todos los datos del usuario

---

## 🏃 Sprint 2 — 12/11

### Front
- **Página Publicaciones**
  - [x] Listado de publicaciones ordenado por fecha por defecto
  - [x] Cambiar el ordenamiento a cantidad de "Me gusta"
  - [x] Cantidad limitada de publicaciones, con paginación
  - [x] Cada publicación es un componente
  - [x] Dar y quitar "Me gusta" cuando corresponda
  - [x] Eliminar mis propias publicaciones
- **Mi Perfil**
  - [x] Todos los datos del usuario y su foto de perfil
  - [ ] Mis últimas 3 publicaciones y sus comentarios

### Back
- **Publicaciones controller**
  - [x] Alta, listado y baja de publicaciones (baja lógica)
  - [x] POST: guarda una publicación relacionada a un usuario (título, descripción, URL de la imagen si tiene). La imagen se guarda
  - [x] DELETE: baja lógica, solo por el usuario que la creó o un administrador
  - [x] GET: listar las últimas publicaciones
  - [x] GET: parámetro para ordenar por fecha / por cantidad de "Me gusta"
  - [x] GET: filtrar las publicaciones de un usuario particular
  - [x] GET: parámetros `offset` y `limit` para paginar
  - [x] POST: dar "Me gusta" (un solo "Me gusta" por usuario por publicación)
  - [x] DELETE: quitar "Me gusta", solo si el usuario lo había dado

---

## 🏃 Sprint 3 — 19/11

### Front
- **Página Publicación**
  - [ ] Ver la publicación en grande junto con sus comentarios
  - [ ] Escribir comentarios
  - [ ] Comentarios ordenados, uno debajo del otro
  - [ ] Primera carga limitada + botón "cargar más" que suma comentarios sin perder los anteriores
  - [ ] El autor puede editar su comentario; un comentario editado lo anuncia
- **Login y Registro**
  - [x] Guardar localmente el token que devuelve la petición (o usar cookies)
- **Página Cargando**
  - [ ] Al iniciar la aplicación: pantalla de cargando con spinner
  - [ ] Validar el token contra la ruta autorizar: si es válido → Publicaciones; si no → Login
- **A nivel aplicación**
  - [ ] Al iniciar sesión, contador de 10 minutos
  - [ ] Al terminar: modal avisando que quedan 5 minutos y preguntando si extender la sesión
  - [ ] Si acepta: refrescar el token
  - [ ] Si una petición devuelve 401: redirigir al login

### Back
- **Comentarios controller**
  - [ ] Traer los comentarios de una publicación, agregar nuevos y modificarlos
  - [ ] POST: agrega un comentario con el usuario que lo hizo y la fecha
  - [ ] PUT: modifica el mensaje y agrega `modificado: true`
  - [ ] GET: comentarios de una publicación, paginados, los más recientes primero
- **Módulo Autenticación**
  - [x] Login y registro generan un JWT con quién es el usuario (uuid/correo/nombre de usuario) y su rol (usuario o administrador)
  - [x] Token devuelto en la respuesta o por cookies
  - [x] Token vence a los 15 minutos
  - [x] POST autorizar: valida que el token sea válido y no esté vencido. 401 si hay error; si es válido, devuelve los datos del usuario
  - [x] POST refrescar: valida el token y devuelve uno nuevo con la misma payload y 15 minutos de vencimiento

---

## 🏃 Sprint 4 — 26/11 (entrega)

### Front
- **Publicación y Publicaciones**
  - [ ] Si se loguea un administrador: botones para dar de baja cualquier publicación (dejan de estar disponibles la publicación y sus comentarios)
- **Dashboard / Usuarios** (solo administradores)
  - [ ] Listado de usuarios
  - [ ] Crear usuarios (mismos datos que el registro) con dos radio buttons: "usuario" o "administrador"
  - [ ] Alta y baja lógica (un usuario deshabilitado no puede ingresar y se le avisa al intentar el login)
  - [ ] Formulario de registro para nuevos usuarios
- **Dashboard / Estadísticas** (gráficos de tipos distintos: torta, barras, líneas, etc.)
  - [ ] Publicaciones por usuario en un lapso de tiempo elegible
  - [ ] Comentarios realizados en un lapso de tiempo elegible
  - [ ] Comentarios por publicación en un lapso de tiempo elegible
- **A nivel aplicación**
  - [ ] PWA
  - [ ] 3 pipes propias
  - [ ] 3 directivas propias

### Back
- **Usuarios controller** (validar que el token sea de un administrador)
  - [ ] GET: listado de usuarios
  - [ ] POST: alta de un usuario nuevo, eligiendo perfil administrador o usuario
  - [ ] DELETE: deshabilitar un usuario (al intentar ingresar se le notifica que no está autorizado)
  - [ ] POST: alta lógica, rehabilita a un usuario deshabilitado
- **Estadísticas controller** (validar que el token sea de un administrador)
  - [ ] Rutas GET necesarias para los gráficos

---

## 🏃 Sprint 5 — Recuperatorio / Promoción (01/12 o 03/12)

### Front
- **Perfil**
  - [ ] Clic en el nombre o la foto de otro usuario para ver su perfil: datos y últimas 3 publicaciones
  - [ ] Mantener las acciones del administrador (baja lógica de publicaciones)
- **Publicaciones**
  - [ ] Scroll infinito en vez de paginación tradicional
- **Dashboard / Estadísticas**
  - [ ] Cantidad de ingresos (login) por usuario
  - [ ] Visitas a mi perfil (de usuarios que no sean uno mismo)
  - [ ] "Me gusta" otorgados por día

### Back
- [ ] Lógica necesaria para los requisitos del front

---

## 🏃 Sprint 6 — Fecha de final

### Front
- [ ] Publicación: guardar / quitar de guardados, indicando si está guardada
- [ ] Pantalla Guardados: ver e interactuar con las publicaciones guardadas
- [ ] Publicación: botón compartir, eligiendo un usuario
- [ ] Pantalla Compartidos: publicaciones compartidas conmigo y quién las compartió
- [ ] Ordenamiento por cantidad de veces guardada
- [ ] Ordenamiento por cantidad de veces compartida

### Back
- [ ] POST: guardar una publicación en los guardados del usuario (token)
- [ ] POST: quitar una publicación de los guardados del usuario (token)
- [ ] POST: el usuario (token) le comparte una publicación a otro usuario (body)
- [ ] GET: publicaciones compartidas con el usuario (token) y quién las compartió
- [ ] Lógica de los nuevos ordenamientos

---