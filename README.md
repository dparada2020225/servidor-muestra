# Sistema Multi-Tenant de Inventario - Backend

Backend API para el sistema de inventario multi-tenant construido con Node.js, Express y MongoDB.

## Características

- Arquitectura multi-tenant con base de datos única
- Aislamiento de datos por tenant
- Sistema de autenticación JWT
- Control de acceso basado en roles
- Gestión de productos, ventas y compras
- Auditoría de acciones críticas
- Soporte para carga de imágenes (GridFS)

## Requisitos

- Node.js >= 14.0.0
- MongoDB >= 4.2
- npm >= 6.0.0

## Instalación

1. Clonar el repositorio:
cd inventario-server

2. Instalar dependencias:
npm install

3. Configurar variables de entorno:
- Crear un archivo `.env` con el siguiente contenido:
MONGODB_URI=tu_uri_de_mongodb
PORT=5000
JWT_SECRET=**************

## Desarrollo

Para ejecutar en modo desarrollo con auto-recarga:
npm run dev

Para iniciar el servidor en producción:
npm start

## Generación de Datos de Prueba

El proyecto incluye scripts para generar datos de prueba:

1. Crear un superadmin:
node scripts/createSuperAdmin.js

2. Crear datos de demo (tenants, usuarios y productos):
node scripts/generateTestData.js

## API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/register` - Registrar nuevo usuario
- `GET /api/auth/me` - Obtener información del usuario actual
- `GET /api/auth/users` - Obtener todos los usuarios (admin)

### Productos
- `GET /api/products` - Obtener todos los productos
- `POST /api/products` - Crear nuevo producto (admin)
- `GET /api/products/:id` - Obtener un producto
- `PUT /api/products/:id` - Actualizar un producto (admin)
- `DELETE /api/products/:id` - Eliminar un producto (admin)

### Compras
- `GET /api/purchases` - Obtener todas las compras
- `POST /api/purchases` - Crear nueva compra
- `GET /api/purchases/:id` - Obtener una compra

### Ventas
- `GET /api/sales` - Obtener todas las ventas
- `POST /api/sales` - Crear nueva venta
- `GET /api/sales/:id` - Obtener una venta

### Administración de Tenants
- `GET /api/tenants/:subdomain` - Obtener información de un tenant
- `POST /api/tenants/register` - Registrar nuevo tenant
- `PUT /api/tenants/:id` - Actualizar configuración de un tenant

### Administración de Plataforma (Superadmin)
- `GET /api/admin/tenants` - Obtener todos los tenants
- `POST /api/admin/tenants` - Crear nuevo tenant
- `PUT /api/admin/tenants/:id` - Actualizar un tenant
- `DELETE /api/admin/tenants/:id` - Desactivar un tenant

## Modelo de Datos

- **Tenant**: Información y configuración del tenant
- **User**: Usuarios con roles y permisos
- **Product**: Productos con stock
- **Purchase**: Compras de productos
- **Sale**: Ventas de productos
- **Audit**: Registro de auditoría de acciones

## Licencia

MIT