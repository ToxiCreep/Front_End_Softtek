import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { AlertTriangle, Box, ChevronRight, PackagePlus, Pencil, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { api, exactMoney, quantity } from '../api'
import type { Schema } from '../api'
import { Empty, ErrorState, Loading, Modal, Notice, PageTitle, SectionHeading, Status, useOnline } from '../ui'
import { fechaHora, tiposMovimiento } from '../backend-types'
import type { MovimientoDetalle, Pagina, PerdidasDetalle, ProductoSolicitud } from '../backend-types'

export default function Inventory() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [selected, setSelected] = useState<Schema['Producto'] | null>(null)
  const [action, setAction] = useState<'ENTRADA' | 'MERMA' | 'VENTA' | null>(null)
  const [notice, setNotice] = useState('')
  const [defaultProduct, setDefaultProduct] = useState<number | undefined>()
  const [productForm, setProductForm] = useState<Schema['Producto'] | 'nuevo' | null>(null)
  const [skuError, setSkuError] = useState('')
  const client = useQueryClient()
  const online = useOnline()
  const desactivar = useMutation({ mutationFn: (p: Schema['Producto']) => api<null>(`/productos/${p.id}`, { method: 'DELETE' }), onSuccess: (_d, p) => { client.invalidateQueries(); setSelected(null); setNotice(`${p.nombre} se desactivó. Ya no aparecerá en la lista.`) } })
  async function buscarSku(event: FormEvent) {
    event.preventDefault(); setSkuError('')
    const sku = search.trim()
    if (!sku) return
    try { setSelected(await api<Schema['Producto']>(`/productos/sku/${encodeURIComponent(sku)}`)) } catch { setSkuError(`No hay un producto con el código ${sku}.`) }
  }
  const query = new URLSearchParams({ q: search, ...(category ? { categoria: category } : {}) }).toString()
  const products = useQuery({ queryKey: ['productos', search, category], queryFn: () => api<Schema['Producto'][]>(`/productos?${query}`) })
  const states = useQuery({ queryKey: ['inventario'], queryFn: () => api<Schema['InventarioEstado'][]>('/inventario/estado') })
  const categories = useQuery({ queryKey: ['categorias'], queryFn: () => api<string[]>('/productos/categorias') })
  const filter = params.has('atencion') ? 'atencion' : params.has('excedente') ? 'excedente' : 'todos'
  const sale = params.has('venta')
  const filtered = products.data?.filter(p => { const status = states.data?.find(s => s.productoId === p.id)?.semaforo; return filter === 'todos' || (filter === 'atencion' ? ['AGOTADO', 'BAJO_STOCK'].includes(status || '') : status === 'SOBRESTOCK') }) || []
  function open(action: 'ENTRADA' | 'MERMA' | 'VENTA', id?: number) { setDefaultProduct(id); setSelected(null); setAction(action) }
  return <>
    <PageTitle title="Productos" description="Revisa cuántas unidades quedan y agrega las que recibiste."><div className="heading-actions"><button className="button outlined" disabled={!online} onClick={() => setProductForm('nuevo')}><PackagePlus size={19} aria-hidden="true" />Nuevo producto</button><button className="button primary" onClick={() => open('ENTRADA')}><Plus size={19} aria-hidden="true" />Agregar existencias</button></div></PageTitle>
    {notice && <Notice message={notice} />}
    {states.data && <section className="summary-grid" aria-label="Resumen de existencias">{[
      { label: 'Total de productos', value: states.data.length, icon: Box },
      { label: 'Necesitan existencias', value: states.data.filter(p => ['AGOTADO', 'BAJO_STOCK'].includes(p.semaforo)).length, icon: AlertTriangle },
      { label: 'Con excedente', value: states.data.filter(p => p.semaforo === 'SOBRESTOCK').length, icon: Box },
    ].map(item => <article className="metric-card summary-stat" key={item.label}><span className="summary-icon blue"><item.icon size={22} aria-hidden="true" /></span><div><span>{item.label}</span><strong>{item.value}</strong></div></article>)}</section>}
    <section className="panel inventory-panel"><div className="inventory-toolbar"><form className="search-form" onSubmit={buscarSku}><label className="search-field"><Search size={20} aria-hidden="true" /><span className="sr-only">Buscar producto por nombre o código</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Busca un producto por nombre o código" /></label><span className="sr-only">Presiona Enter para abrir el producto con ese código exacto</span></form><label className="category-select"><SlidersHorizontal size={18} aria-hidden="true" /><span className="sr-only">Categoría del producto</span><select value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas las categorías</option>{categories.data?.map(c => <option key={c}>{c}</option>)}</select></label></div>
      {skuError && <div className="inventory-tabs"><Notice error message={skuError} /></div>}
      <div className="inventory-tabs" aria-label="Filtrar por existencias">{[['todos', 'Todos los productos'], ['atencion', 'Necesitan existencias'], ['excedente', 'Con excedente']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setParams(value === 'todos' ? {} : { [value]: 'true' })}>{label}</button>)}</div>
      {products.isPending || states.isPending ? <Loading /> : products.isError || states.isError ? <ErrorState error={products.error || states.error} retry={() => { products.refetch(); states.refetch() }} /> : !filtered.length ? <Empty title="No hay productos en esta lista" description="Prueba con otro nombre, categoría o filtro de existencias." /> : <div className="product-list"><div className="product-table-header" aria-hidden="true"><span>Producto</span><span>Disponibles</span><span>Precio de venta</span><span>Estado</span><span /></div>{filtered.map(p => <article key={p.id} className="product-row"><div className="product-name"><div className={`product-icon category-${p.categoria}`}><Box size={23} aria-hidden="true" /></div><div><h3>{p.nombre}</h3><span>{p.categoria}</span></div></div><div className="product-stock"><span className="mobile-label">Disponibles</span><strong>{p.stockActual}</strong><span> unidades</span></div><div className="product-price"><span className="mobile-label">Precio</span><strong>{exactMoney(p.precioVenta)}</strong></div><div className="product-status"><Status value={states.data?.find(s => s.productoId === p.id)?.semaforo || 'NORMAL'} /></div><button className="product-detail" onClick={() => setSelected(p)} aria-label={`Ver producto: ${p.nombre}`}><span>Ver producto</span><ChevronRight size={17} aria-hidden="true" /></button></article>)}</div>}
      <div className="inventory-list-footer"><span>{filtered.length} {filtered.length === 1 ? 'producto' : 'productos'} en esta lista</span></div>
    </section>
    {selected && <Modal title={selected.nombre} description={`Código ${selected.sku} · ${selected.categoria}`} onClose={() => setSelected(null)}><div className="product-detail-summary"><div><span>Unidades disponibles</span><strong>{selected.stockActual}</strong></div><div><span>Precio de venta</span><strong>{exactMoney(selected.precioVenta)}</strong></div></div><div className="detail-facts"><p>Existencias mínimas <strong>{quantity(selected.stockMinimo)} unidades</strong></p><p>Existencias máximas <strong>{quantity(selected.stockMaximo)} unidades</strong></p><p>Tiempo del proveedor <strong>{selected.leadTimeDias} días</strong></p></div><div className="detail-buttons"><button className="button primary" onClick={() => open('ENTRADA', selected.id)}><Plus size={18} aria-hidden="true" />Agregar existencias</button><button className="button outlined" onClick={() => open('VENTA', selected.id)}>Registrar una venta</button><button className="text-button" onClick={() => open('MERMA', selected.id)}>Registrar producto dañado</button><button className="text-button" disabled={!online} onClick={() => { setProductForm(selected); setSelected(null) }}><Pencil size={15} aria-hidden="true" /> Editar producto</button><button className="text-button" disabled={!online || desactivar.isPending} onClick={() => desactivar.mutate(selected)}>{desactivar.isPending ? 'Desactivando…' : 'Desactivar producto'}</button></div>{desactivar.isError && <Notice error message={desactivar.error.message} />}<Movimientos productoId={selected.id} /></Modal>}
    <Perdidas />
    {productForm && <ProductForm product={productForm === 'nuevo' ? null : productForm} onClose={() => setProductForm(null)} onSaved={message => { client.invalidateQueries(); setProductForm(null); setNotice(message) }} />}
    {(action || sale) && <StockForm action={action || 'VENTA'} productId={defaultProduct} onClose={() => { setAction(null); setParams(p => { p.delete('venta'); return p }) }} onSuccess={message => { setNotice(message); setAction(null); setParams(p => { p.delete('venta'); return p }) }} />}
  </>
}

function StockForm({ action, productId, onClose, onSuccess }: { action: 'ENTRADA' | 'MERMA' | 'VENTA'; productId?: number; onClose: () => void; onSuccess: (message: string) => void }) {
  const online = useOnline()
  const client = useQueryClient()
  const products = useQuery({ queryKey: ['productos', '', ''], queryFn: () => api<Schema['Producto'][]>('/productos') })
  const [id, setId] = useState(String(productId || ''))
  const [count, setCount] = useState('')
  const [reason, setReason] = useState(action === 'ENTRADA' ? 'Recepción de proveedor' : 'Producto dañado')
  const [ticket] = useState(`T-${crypto.randomUUID()}`)
  const p = products.data?.find(p => p.id === Number(id))
  const insufficientStock = !!p && action !== 'ENTRADA' && Number(count) > p.stockActual
  const mutation = useMutation<Schema['Venta'] | Schema['Movimiento'], Error>({ mutationFn: () => action === 'VENTA' ? api<Schema['Venta']>('/ventas', { method: 'POST', body: JSON.stringify({ ticket, fechaHora: new Date().toISOString(), empleadoId: null, lineas: [{ productoId: Number(id), cantidad: Number(count) }] }) }) : api<Schema['Movimiento']>('/inventario/movimientos', { method: 'POST', body: JSON.stringify({ productoId: Number(id), tipo: action, cantidad: Number(count), motivo: reason }) }), onSuccess: result => {
    client.invalidateQueries()
    onSuccess(action === 'VENTA' ? `Venta registrada. Total: ${exactMoney((result as Schema['Venta']).total)}. Las existencias se actualizaron.` : `${count} unidades ${action === 'ENTRADA' ? 'agregadas' : 'retiradas'} de ${p?.nombre}.`)
  } })
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!online || mutation.isPending || !p || insufficientStock || !Number.isInteger(Number(count)) || Number(count) <= 0) return; mutation.mutate() }
  return <Modal title={action === 'VENTA' ? 'Registrar una venta' : action === 'ENTRADA' ? 'Agregar existencias' : 'Registrar producto dañado'} description={action === 'VENTA' ? 'Elige el producto y cuántas unidades vendiste.' : action === 'ENTRADA' ? 'Registra las unidades que llegaron a tu sucursal.' : 'Estas unidades se retirarán de tus existencias.'} onClose={onClose} busy={mutation.isPending}>
    <form onSubmit={submit} className="stack-form"><label>Producto<select autoFocus required value={id} onChange={e => { setId(e.target.value); mutation.reset() }}><option value="">Selecciona un producto</option>{products.data?.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>{products.isError && <Notice error message="No pudimos cargar los productos. Cierra e intenta de nuevo." />}
      {p && <p className="field-help">Actualmente tienes <strong>{p.stockActual} unidades</strong> de este producto.</p>}
      <label>{action === 'ENTRADA' ? '¿Cuántas unidades recibiste?' : action === 'VENTA' ? '¿Cuántas unidades vendiste?' : '¿Cuántas unidades están dañadas?'}<input type="number" min="1" step="1" required inputMode="numeric" placeholder="Ejemplo: 20" value={count} onChange={e => { setCount(e.target.value); mutation.reset() }} /></label>
      {action !== 'VENTA' && <label>Motivo<input value={reason} onChange={e => setReason(e.target.value)} required maxLength={200} /></label>}
      {insufficientStock && <Notice error message={`Solo tienes ${p!.stockActual} unidades disponibles. Reduce la cantidad para continuar.`} />}
      {p && Number(count) > 0 && !insufficientStock && <div className="form-preview"><span>{action === 'VENTA' ? 'Importe antes de promociones' : 'Después de guardar tendrás'}</span><strong>{action === 'VENTA' ? exactMoney(p.precioVenta * Number(count)) : `${p.stockActual + (action === 'MERMA' ? -Number(count) : Number(count))} unidades`}</strong></div>}
      {action === 'VENTA' && <p className="form-note">Si hay una promoción vigente, el descuento se aplicará al registrar la venta.</p>}
      {mutation.isError && <Notice error message={mutation.error.message} />}
      {!online && <Notice error message="Necesitas conexión para guardar esta operación." />}
      <div className="modal-actions"><button type="button" className="button outlined" onClick={onClose} disabled={mutation.isPending}>Cancelar</button><button className="button primary" disabled={!online || mutation.isPending || !p || insufficientStock}>{mutation.isPending ? 'Guardando…' : action === 'VENTA' ? 'Registrar venta' : 'Guardar existencias'}</button></div>
    </form>
  </Modal>
}

function Movimientos({ productoId }: { productoId: number }) {
  const movs = useQuery({ queryKey: ['movimientos', productoId], queryFn: () => api<Pagina<MovimientoDetalle>>(`/inventario/movimientos?productoId=${productoId}&size=10`) })
  return <details className="chart-table"><summary><ChevronRight size={16} aria-hidden="true" />Últimos movimientos</summary>
    {movs.isPending ? <Loading /> : movs.isError ? <ErrorState error={movs.error} retry={() => movs.refetch()} /> : !movs.data.contenido.length ? <p className="field-help">Sin movimientos registrados.</p> :
      <div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Cambio</th><th>Quedaron</th></tr></thead>
        <tbody>{movs.data.contenido.map(m => <tr key={m.id}><td>{fechaHora(m.fecha)}</td><td>{tiposMovimiento[m.tipo]}{m.motivo ? <span className="cell-note">{m.motivo}</span> : null}</td><td>{m.efectoEnStock > 0 ? `+${m.efectoEnStock}` : m.efectoEnStock}</td><td>{m.stockResultante}</td></tr>)}</tbody></table></div>}
  </details>
}

function Perdidas() {
  const perdidas = useQuery({ queryKey: ['perdidas'], queryFn: () => api<PerdidasDetalle>('/inventario/perdidas') })
  const p = perdidas.data
  // El backend manda porTipo como objeto { MERMA: 120 }; los datos de ejemplo, como lista.
  const porTipo: Record<string, number> = !p ? {} : Array.isArray(p.porTipo) ? Object.fromEntries((p.porTipo as { tipo: string; importe: number }[]).map(t => [t.tipo, t.importe])) : p.porTipo ?? {}
  return <section className="panel page-section"><SectionHeading title="Pérdidas de los últimos 30 días" description="Mermas, caducidades y faltantes valuados a costo." />
    {perdidas.isPending ? <Loading /> : perdidas.isError ? <ErrorState error={perdidas.error} retry={() => perdidas.refetch()} /> : p && <>
      <div className="result-grid loss-grid"><div><span>Total</span><strong>{exactMoney(p.total)}</strong></div>{Object.entries(porTipo).map(([tipo, total]) => <div key={tipo}><span>{tiposMovimiento[tipo as keyof typeof tiposMovimiento] ?? tipo}</span><strong>{exactMoney(Number(total))}</strong></div>)}</div>
      {!!p.topProductos?.length && <div className="table-scroll"><table><thead><tr><th>Producto</th><th>Unidades</th><th>Pérdida</th></tr></thead><tbody>{p.topProductos.map(t => <tr key={t.productoId}><td>{t.nombre}</td><td>{t.unidades}</td><td>{exactMoney(t.total)}</td></tr>)}</tbody></table></div>}
    </>}
  </section>
}

function ProductForm({ product, onClose, onSaved }: { product: Schema['Producto'] | null; onClose: () => void; onSaved: (message: string) => void }) {
  const online = useOnline()
  const categories = useQuery({ queryKey: ['categorias'], queryFn: () => api<string[]>('/productos/categorias') })
  const [f, setF] = useState({ sku: product?.sku ?? '', nombre: product?.nombre ?? '', categoria: product?.categoria ?? '', precioVenta: String(product?.precioVenta ?? ''), costo: String(product?.costo ?? ''),
    stockActual: String(product?.stockActual ?? 0), stockMinimo: String(product?.stockMinimo ?? 0), stockMaximo: String(product?.stockMaximo ?? ''), leadTimeDias: String(product?.leadTimeDias ?? 3),
    esPerecedero: product?.esPerecedero ?? false, vidaUtilDias: String(product?.vidaUtilDias ?? '') })
  const set = (key: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [key]: e.target.value })
  const opt = (v: string) => (v === '' ? undefined : Number(v))
  const save = useMutation({ mutationFn: () => {
    const body: ProductoSolicitud = { sku: f.sku.trim(), nombre: f.nombre.trim(), categoria: f.categoria.trim(), precioVenta: Number(f.precioVenta), costo: Number(f.costo), stockActual: opt(f.stockActual),
      stockMinimo: opt(f.stockMinimo), stockMaximo: opt(f.stockMaximo), leadTimeDias: opt(f.leadTimeDias), esPerecedero: f.esPerecedero, vidaUtilDias: f.esPerecedero ? opt(f.vidaUtilDias) ?? null : null }
    return api<Schema['Producto']>(product ? `/productos/${product.id}` : '/productos', { method: product ? 'PUT' : 'POST', body: JSON.stringify(body) })
  }, onSuccess: p => onSaved(product ? `${p.nombre} actualizado.` : `${p.nombre} se agregó al catálogo.`) })
  function submit(event: FormEvent) { event.preventDefault(); if (online && !save.isPending) save.mutate() }
  return <Modal title={product ? 'Editar producto' : 'Nuevo producto'} onClose={onClose} busy={save.isPending}>
    <form className="stack-form" onSubmit={submit}>
      <div className="form-two"><label>Código (SKU)<input required maxLength={50} value={f.sku} onChange={set('sku')} /></label><label>Categoría<input required maxLength={80} list="categorias-producto" value={f.categoria} onChange={set('categoria')} /><datalist id="categorias-producto">{categories.data?.map(c => <option key={c} value={c} />)}</datalist></label></div>
      <label>Nombre<input required maxLength={150} value={f.nombre} onChange={set('nombre')} /></label>
      <div className="form-two"><label>Precio de venta<input type="number" min="0" step="0.01" required value={f.precioVenta} onChange={set('precioVenta')} /></label><label>Costo<input type="number" min="0" step="0.01" required value={f.costo} onChange={set('costo')} /></label></div>
      {!product && <label>Existencias iniciales<input type="number" min="0" step="1" value={f.stockActual} onChange={set('stockActual')} /></label>}
      <div className="form-two"><label>Existencias mínimas<input type="number" min="0" step="1" value={f.stockMinimo} onChange={set('stockMinimo')} /></label><label>Existencias máximas<input type="number" min="0" step="1" value={f.stockMaximo} onChange={set('stockMaximo')} /></label></div>
      <label>Días que tarda el proveedor<input type="number" min="0" step="1" value={f.leadTimeDias} onChange={set('leadTimeDias')} /></label>
      <label className="check-label"><input type="checkbox" checked={f.esPerecedero} onChange={e => setF({ ...f, esPerecedero: e.target.checked })} />Es perecedero</label>
      {f.esPerecedero && <label>Vida útil (días)<input type="number" min="1" step="1" required value={f.vidaUtilDias} onChange={set('vidaUtilDias')} /></label>}
      {save.isError && <Notice error message={save.error.message} />}
      <div className="modal-actions"><button type="button" className="button outlined" onClick={onClose} disabled={save.isPending}>Cancelar</button><button className="button primary" disabled={!online || save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar'}</button></div>
    </form>
  </Modal>
}
