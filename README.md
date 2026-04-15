# Casa Alberto

App de escritorio para la marqueteria de mi papa en Barrio Verbenal, Bogota. Reemplaza las cotizaciones en papel, pedidos a mano y listas de precios fisicas que ha usado por 36 anos.

## Desarrollo

```bash
npm install
npm run dev        # abre la app con hot reload
npm test           # corre los tests
npm run typecheck  # verifica tipos
```

## Publicar actualizacion

```bash
npm version patch            # 1.0.0 -> 1.0.1
git push origin main --tags  # GitHub Actions construye el .exe y lo publica
```

La app se actualiza sola la proxima vez que se abra.

## Primera instalacion

Descargar `CasaAlberto-X.X.X-setup.exe` desde [Releases](../../releases), pasarlo al PC por USB y ejecutar.
