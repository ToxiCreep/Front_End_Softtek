/**
 * Tipos de los endpoints que no estaban en contracts/openapi.json.
 * Reflejan exactamente los records de Spring Boot (paquetes empleado, plantilla, venta,
 * contexto, basedatos, configuracion, prediccion, inventario y promocion).
 */

export type Rol = 'CAJERO' | 'PISO' | 'ALMACEN' | 'GERENTE'
export const roles: Record<Rol, string> = { CAJERO: 'Cajero', PISO: 'Piso de venta', ALMACEN: 'Almacén', GERENTE: 'Gerente' }

export interface Empleado { id: number; nombre: string; rol: Rol; costoHora: number; horasMaxSemana: number | null; activo: boolean }
export interface EmpleadoSolicitud { nombre: string; rol: Rol; costoHora: number; horasMaxSemana?: number | null; activo?: boolean }

export interface Plantilla {
  id: number; diaSemana: number; dia: string; horaInicio: string; horaFin: string; rol: Rol
  personalRequerido: number; origen: 'MANUAL' | 'RECOMENDADO'; horasPersona: number
}
export interface PlantillaSolicitud { diaSemana: number; horaInicio: string; horaFin: string; rol: Rol; personalRequerido: number }
export interface DiaPlantilla { diaSemana: number; dia: string; horasPersona: number; bloques: Plantilla[] }
export interface CoberturaRol {
  rol: Rol; horasRequeridas: number; horasDisponibles: number; deficitHoras: number; picoSimultaneo: number
  empleadosActivos: number; empleadosFaltantes: number; estado: 'SIN_DATOS' | 'DEFICIT' | 'JUSTO' | 'EXCESO' | 'OK'
}
export interface RecomendacionPersonal {
  semanasAnalizadas: number; transaccionesPorEmpleadoHora: number; guardado: boolean; bloques: Plantilla[]
  horasPersonaPorRol: Record<string, number>; costoSemanalEstimado: number
  demandaPorHora: Record<string, Record<string, number>>; notas: string[]
}

export interface Pagina<T> { contenido: T[]; pagina: number; tamano: number; totalElementos: number; totalPaginas: number }

export interface VentaLinea {
  id: number; ticket: string; fechaHora: string; productoId: number; sku: string; productoNombre: string; cantidad: number
  precioUnitario: number; descuentoAplicado: number; total: number; promocionId: number | null; empleadoId: number | null
}
export interface Ticket { ticket: string; fechaHora: string; empleadoId: number | null; lineas: VentaLinea[]; subtotal: number; descuento: number; total: number }
export interface RecordsVentas {
  desde: string; hasta: string
  totales: { ingresos: number; margen: number; unidades: number; tickets: number; ticketPromedio: number }
  mejorDia: { fecha: string; ingresos: number; tickets: number } | null
  mejorHora: { hora: number; ingresos: number; tickets: number; ticketsPromedioPorDia: number } | null
  mejorDiaSemana: { diaSemana: number; nombre: string; ingresos: number; tickets: number } | null
  productoEstrella: ProductoTop | null
  productoMasRentable: ProductoTop | null
  mejorEmpleado: { empleadoId: number; nombre: string; ingresos: number; tickets: number } | null
  ticketMasAlto: { ticket: string; fecha: string; total: number; articulos: number } | null
}
export interface ProductoTop { productoId: number; sku: string; nombre: string; unidades: number; ingresos: number; margen: number }
export interface ResumenAgrupado { periodo: string; etiqueta?: string; unidades: number; ingresos: number; costo: number; margen: number; tickets: number }

export type TipoMovimiento = 'ENTRADA' | 'MERMA' | 'CADUCIDAD' | 'AJUSTE' | 'DEVOLUCION'
export const tiposMovimiento: Record<TipoMovimiento, string> = { ENTRADA: 'Entrada', MERMA: 'Merma', CADUCIDAD: 'Caducidad', AJUSTE: 'Ajuste', DEVOLUCION: 'Devolución' }
export interface MovimientoDetalle {
  id: number; productoId: number; sku: string; productoNombre: string; fecha: string; tipo: TipoMovimiento; cantidad: number
  efectoEnStock: number; costoTotal: number | null; motivo: string | null; stockResultante: number
}
export interface PerdidasDetalle {
  desde: string; hasta: string; total: number; porTipo: Record<string, number>
  porCategoria: { categoria: string; total: number; unidades: number }[]
  topProductos: { productoId: number; sku: string; nombre: string; total: number; unidades: number }[]
  porDia: { fecha: string; total: number }[]
}

export interface ProductoSolicitud {
  sku: string; nombre: string; categoria: string; precioVenta: number; costo: number; stockActual?: number; stockMinimo?: number
  stockMaximo?: number; leadTimeDias?: number; esPerecedero?: boolean; vidaUtilDias?: number | null
}

export interface PromocionSolicitud {
  productoId: number; tipo: 'PORCENTAJE' | 'DOS_X_UNO' | 'PRECIO_FIJO'; valor?: number; fechaInicio: string; fechaFin: string
  motivo?: 'SOBRESTOCK' | 'POR_CADUCAR' | 'BAJA_ROTACION' | 'TEMPORADA'; explicacion?: string; activar?: boolean
}

export interface PrediccionDetalle {
  id: number; productoId: number; fechaObjetivo: string; cantidadPredicha: number; limiteInferior: number; limiteSuperior: number
  stockRecomendado: number; cantidadAPedir: number; modelo: 'BASE' | 'IA'; generadaEn: string
}
export interface Precision {
  desde: string; hasta: string
  modelos: { modelo: 'BASE' | 'IA'; puntos: number; mape: number; wape: number; sesgo: number; precision: number
    porProducto: { productoId: number; sku: string; nombre: string; puntos: number; real: number; predicho: number; mape: number; wape: number }[] }[]
}

export type Temporada = 'REGRESO_CLASES' | 'NAVIDAD' | 'VERANO' | 'NORMAL'
export const temporadas: Record<Temporada, string> = { NORMAL: 'Normal', REGRESO_CLASES: 'Regreso a clases', NAVIDAD: 'Navidad', VERANO: 'Verano' }
export interface Contexto {
  fecha: string; esFestivo: boolean | null; nombreEvento: string | null; esQuincena: boolean | null
  temporada: Temporada | null; clima: string | null; temperatura: number | null
}

export type Tamano = 'PEQUENA' | 'MEDIANA' | 'GRANDE'
export const tamanos: Record<Tamano, string> = { PEQUENA: 'Pequeña', MEDIANA: 'Mediana', GRANDE: 'Grande' }
export interface SucursalActiva { activa: Tamano; disponibles: Tamano[] }

export type ProveedorIa = 'ANTHROPIC' | 'OPENAI' | 'GEMINI' | 'NINGUNO'
export const proveedoresIa: Record<ProveedorIa, string> = { GEMINI: 'Gemini', ANTHROPIC: 'Claude', OPENAI: 'GPT', NINGUNO: 'Ninguna' }
export interface EstadoIa {
  proveedorConfigurado: ProveedorIa; modeloConfigurado: string | null; disponible: boolean; registrados: ProveedorIa[]
  conLlave: ProveedorIa[]; llamadas: number; fallos: number; ultimaOk: boolean | null; ultimaLatenciaMs: number | null; ultimoError: string | null
}

/** Campos extra que llegan en /configuracion además del contrato de las páginas. */
export interface ConfiguracionExtra { proveedorIa?: ProveedorIa; modeloIa?: string | null; iaActiva?: boolean }

export const dias = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const hora = (value: string) => value?.slice(0, 5) ?? ''
export const fechaHora = (value: string) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
