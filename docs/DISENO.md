# Dirección de diseño — Mi sucursal

Interfaz para personas con poca experiencia digital. El objetivo es reconocer qué necesita atención y completar una acción sin tener que interpretar jerga o adivinar iconos.

- Identidad: fondo oscuro y tarjetas de información en grises; barra lateral completa en azul Softtek `#002855`, conservar color en cabecera y botones. La tarjeta principal de Inicio usa verde oscuro con una ilustración de barras. La selección usa texto e iconos `#AFD785` y verde Softtek `#84BD00` con baja opacidad para el brillo de iconos. Fuente de la marca: [Brand System 2025](https://www.softtek.com/hubfs/Softtek/images/Media%20Resources/BRAND-SofttekBrandkeeper-2025.pdf?hsLang=en).
- Helvetica Neue del usuario: Roman 400, Medium 500 y Bold 700. No usar Thin para información operativa.
- Logo oficial completo sobre fondo azul, visible en sidebar de escritorio y cabecera fija de móvil. Sin reconstruir o modificar el wordmark.
- Apple Design: jerarquía, espaciado regular, esquinas suaves, feedback y navegación persistente; adaptar al navegador y respetar la marca Softtek.
- Modo oscuro fijo, independientemente del tema del sistema; controles táctiles de al menos 44 px. Selección con fondo ligeramente elevado (azul en la barra lateral, gris en el contenido), etiqueta e icono verdes y brillo suave en el icono. Sin subrayados ni bloques de relleno verde.
- Registrar venta: acción persistente encima de la navegación inferior en móvil, separada de los tabs; en escritorio, al pie de la barra lateral. Reservar espacio en el contenido para que el botón no tape elementos al terminar de desplazarse.
- Secciones visibles: Inicio, Productos, Promociones, Demanda, Ajustes. Icono siempre acompañado de palabra.
- Lenguaje cotidiano y orientado a acciones: “Quedan pocas unidades”, “Agregar existencias”, “Activar promoción”. Mantener frases naturales que expliquen lo que ocurre y el siguiente paso; no limitar la interfaz a etiquetas y cifras. Unidades y cantidades monetarias explícitas.
- Estado de producto comunicado con texto e icono. El motivo de una promoción y su ganancia estimada se muestran antes de activarla.
- Modal con título, campos etiquetados, botón Cancelar, validación, confirmación del resultado y retorno del foco. No decisiones escondidas en hover.
- Gráficas acompañadas de descripción y tabla consultable. Respetar reduced motion, teclado y safe areas.
- Sin eslóganes, subtítulos de relleno, badge de demostración ni explicaciones repetidas. Inicio recupera la tarjeta verde con pendientes y gráfico decorativo, los cuatro indicadores de negocio, las tarjetas de atención y la gráfica de ventas siempre visible. La comparación de indicadores conserva una etiqueta para identificar el periodo anterior.
- Productos y Promociones muestran resúmenes en tarjetas redondeadas. El motivo y la ganancia estimada de una promoción quedan visibles. Demanda conserva sus indicadores, gráfica y recuadro para el próximo pedido con fecha y existencias recomendadas. Ajustes conserva las tarjetas de sucursal, asistencia y límites.
- Aplicar la guía de escritura de Apple: vocabulario familiar, contexto y acciones concretas. Inicio resume los pendientes en una frase, explica la ganancia bruta y orienta cada tarjeta de atención. Productos, Promociones y Demanda incluyen una orientación breve; Ajustes explica qué hace la asistencia y qué significa el margen mínimo. Eliminar textos repetidos o decorativos, conservar explicaciones que ayuden a entender o decidir.
- La información sobre datos de ejemplo se consulta en Ayuda; conservar unidades, etiquetas de campos, errores y confirmaciones.

El frontend usa las rutas del documento original mediante fetch. MSW simula esas solicitudes mientras llega Spring Boot; los DTO añadidos en OpenAPI siguen pendientes de acuerdo con backend.
