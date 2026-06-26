# Mejoras aplicadas a SETU

- Diseño responsive mobile-first y panel lateral corregido para ocupar toda la altura en escritorio.
- Enlace "Saltar al contenido principal" para navegación con teclado.
- Atributos ARIA en navegación, formularios, botones, tablas, ranking y gráficas.
- Jerarquía lógica de títulos: un h1 por vista y h2/h3 para secciones internas.
- Contraste reforzado con paleta de alto contraste y foco visible.
- Controles con nombre accesible, labels, hints, captions y estados `aria-disabled`/`aria-readonly`.
- Página de resultados mejorada con Top 3 de mejores tesis.
- Corrección funcional: `ResultsService.updateScore()` agregado para guardar la nota final calculada.
- Eliminada dependencia externa de Google Fonts en `index.html` para evitar errores de build sin internet.

## Validación

Se ejecutó `npm run build` correctamente. Angular solo mostró una advertencia de tamaño de bundle inicial.
