# Redisenio UI

## Resumen
- Frontend Angular 21 redisenado con Material 3, tokens globales, shell nuevo, dashboards por rol, CRUDs compartidos, clases con QR, escaner QR y reportes.
- El backend no se modifico durante el redisenio. Solo quedo el fix previo del seed de cuentas demo para evitar colision con tests.

## Archivos clave
- `frontend/src/styles/*`
- `frontend/src/app/shared/components/*`
- `frontend/src/app/shared/forms/*`
- `frontend/src/app/shared/shell/*`
- `frontend/src/app/core/services/*`
- `frontend/src/app/views/*`

## Decisiones visuales
- Tokens CSS centralizados para color, superficies, radios, sombras y tipografia.
- Shell con sidebar colapsable, breadcrumbs, tema claro/oscuro y menu de perfil.
- CRUDs con `PageHeader`, `FilterBar`, `ResponsiveTable`, `ConfirmDialog` y formularios en dialogo/drawer.
- Tablas con alternativa movil tipo cards.
- Estados vacio/error/cargando unificados.

## Verificacion
- Backend: `97 passed`.
- Frontend: `npx ng build --configuration production` OK.
- Smoke server: `http://localhost:4200` y `http://localhost:8000/docs` responden.

## Pendientes
- No se generaron capturas porque no hubo navegador headless utilizable en el entorno.
- El bundle inicial supera el budget de warning, aunque no el error maximo.
