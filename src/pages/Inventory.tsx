import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { AlertTriangle, Box, ChevronRight, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { api, exactMoney, quantity } from '../api'
import type { Schema } from '../api'
import { Empty, ErrorState, Loading, Modal, Notice, PageTitle, Status, useOnline } from '../ui'

export default function Inventory() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [selected, setSelected] = useState<Schema['Producto'] | null>(null)
  const [action, setAction] = useState<'ENTRADA' | 'MERMA' | 'VENTA' | null>(null)
  const [notice, setNotice] = useState('')
  const [defaultProduct, setDefaultProduct] = useState<number | undefined>()
  const query = new URLSearchParams({ q: search, ...(category ? { categoria: category } : {}) }).toString()
  const products = useQuery({ queryKey: ['productos', search, category], queryFn: () => api<Schema['Producto'][]>(`/productos?${query}`) })
  const states = useQuery({ queryKey: ['inventario'], queryFn: () => api<Schema['InventarioEstado'][]>('/inventario/estado') })
  const categories = useQuery({ queryKey: ['categorias'], queryFn: () => api<string[]>('/productos/categorias') })
  const filter = params.has('atencion') ? 'atencion' : params.has('excedente') ? 'excedente' : 'todos'
  const sale = params.has('venta')
  const filtered = products.data?.filter(p => { const status = states.data?.find(s => s.productoId === p.id)?.semaforo; return filter === 'todos' || (filter === 'atencion' ? ['AGOTADO', 'BAJO_STOCK'].includes(status || '') : status === 'SOBRESTOCK') }) || []
  function open(action: 'ENTRADA' | 'MERMA' | 'VENTA', id?: number) { setDefaultProduct(id); setSelected(null); setAction(action) }
  return <>
    <PageTitle title="Productos" description="Revisa cuántas unidades quedan y agrega las que recibiste."><button className="button primary" onClick={() => open('ENTRADA')}><Plus size={19} aria-hidden="true" />Agregar existencias</button></PageTitle>
    {notice && <Notice message={notice} />}
    {states.data && <section className="summary-grid" aria-label="Resumen de existencias">{[
      { label: 'Total de productos', value: states.data.length, icon: Box },
      { label: 'Necesitan existencias', value: states.data.filter(p => ['AGOTADO', 'BAJO_STOCK'].includes(p.semaforo)).length, icon: AlertTriangle },
      { label: 'Con excedente', value: states.data.filter(p => p.semaforo === 'SOBRESTOCK').length, icon: Box },
    ].map(item => <article className="metric-card summary-stat" key={item.label}><span className="summary-icon blue"><item.icon size={22} aria-hidden="true" /></span><div><span>{item.label}</span><strong>{item.value}</strong></div></article>)}</section>}
    <section className="panel inventory-panel"><div className="inventory-toolbar"><label className="search-field"><Search size={20} aria-hidden="true" /><span className="sr-only">Buscar producto por nombre o código</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Busca un producto por nombre o código" /></label><label className="category-select"><SlidersHorizontal size={18} aria-hidden="true" /><span className="sr-only">Categoría del producto</span><select value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas las categorías</option>{categories.data?.map(c => <option key={c}>{c}</option>)}</select></label></div>
      <div className="inventory-tabs" aria-label="Filtrar por existencias">{[['todos', 'Todos los productos'], ['atencion', 'Necesitan existencias'], ['excedente', 'Con excedente']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setParams(value === 'todos' ? {} : { [value]: 'true' })}>{label}</button>)}</div>
      {products.isPending || states.isPending ? <Loading /> : products.isError || states.isError ? <ErrorState error={products.error || states.error} retry={() => { products.refetch(); states.refetch() }} /> : !filtered.length ? <Empty title="No hay productos en esta lista" description="Prueba con otro nombre, categoría o filtro de existencias." /> : <div className="product-list"><div className="product-table-header" aria-hidden="true"><span>Producto</span><span>Disponibles</span><span>Precio de venta</span><span>Estado</span><span /></div>{filtered.map(p => <article key={p.id} className="product-row"><div className="product-name"><div className={`product-icon category-${p.categoria}`}><Box size={23} aria-hidden="true" /></div><div><h3>{p.nombre}</h3><span>{p.categoria}</span></div></div><div className="product-stock"><span className="mobile-label">Disponibles</span><strong>{p.stockActual}</strong><span> unidades</span></div><div className="product-price"><span className="mobile-label">Precio</span><strong>{exactMoney(p.precioVenta)}</strong></div><div className="product-status"><Status value={states.data?.find(s => s.productoId === p.id)?.semaforo || 'NORMAL'} /></div><button className="product-detail" onClick={() => setSelected(p)} aria-label={`Ver producto: ${p.nombre}`}><span>Ver producto</span><ChevronRight size={17} aria-hidden="true" /></button></article>)}</div>}
      <div className="inventory-list-footer"><span>{filtered.length} {filtered.length === 1 ? 'producto' : 'productos'} en esta lista</span></div>
    </section>
    {selected && <Modal title={selected.nombre} description={`Código ${selected.sku} · ${selected.categoria}`} onClose={() => setSelected(null)}><div className="product-detail-summary"><div><span>Unidades disponibles</span><strong>{selected.stockActual}</strong></div><div><span>Precio de venta</span><strong>{exactMoney(selected.precioVenta)}</strong></div></div><div className="detail-facts"><p>Existencias mínimas <strong>{quantity(selected.stockMinimo)} unidades</strong></p><p>Existencias máximas <strong>{quantity(selected.stockMaximo)} unidades</strong></p><p>Tiempo del proveedor <strong>{selected.leadTimeDias} días</strong></p></div><div className="detail-buttons"><button className="button primary" onClick={() => open('ENTRADA', selected.id)}><Plus size={18} aria-hidden="true" />Agregar existencias</button><button className="button outlined" onClick={() => open('VENTA', selected.id)}>Registrar una venta</button><button className="text-button" onClick={() => open('MERMA', selected.id)}>Registrar producto dañado</button></div></Modal>}
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
