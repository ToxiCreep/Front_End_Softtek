import { useEffect, useRef, useState } from 'react'
import { NavLink, Route, Routes, Link, useLocation } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Box, ChartNoAxesCombined, ChevronRight, CircleHelp, Home, ReceiptText, Settings2, Sparkles, Store, Tag, WifiOff } from 'lucide-react'
import { api, today } from './api'
import type { Schema } from './api'
import { Modal, useOnline } from './ui'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Promotions from './pages/Promotions'
import Demand from './pages/Demand'
import Settings from './pages/Settings'
import Softy from './Softy'

const navigation = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/inventario', label: 'Productos', icon: Box },
  { to: '/promociones', label: 'Promociones', icon: Tag },
  { to: '/demanda', label: 'Demanda', icon: ChartNoAxesCombined },
  { to: '/ajustes', label: 'Ajustes', icon: Settings2 },
]

export default function App() {
  const [help, setHelp] = useState(false)
  const configuration = useQuery({ queryKey: ['configuracion'], queryFn: () => api<Schema['Configuracion']>('/configuracion') })
  const online = useOnline()
  const location = useLocation()
  const previousPath = useRef(location.pathname)
  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      window.scrollTo({ top: 0 })
      document.getElementById('main-content')?.focus({ preventScroll: true })
      previousPath.current = location.pathname
    }
    document.title = `${location.pathname === '/softy' ? 'Softy' : navigation.find(n => n.to === location.pathname)?.label || 'Mi sucursal'} · Softtek`
  }, [location.pathname])
  const date = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${today()}T12:00:00Z`))
  const saleAction = <Link to="/inventario?venta=true" className="button primary sale-action"><ReceiptText size={19} aria-hidden="true" />Registrar venta</Link>

  const nav = (mobile = false) => <nav aria-label={mobile ? 'Navegación móvil' : 'Navegación principal'} className={mobile ? 'mobile-nav' : 'sidebar-nav'}>
    {navigation.map(n => <NavLink key={n.to} to={n.to} end={n.to === '/'}><n.icon size={21} aria-hidden="true" /><span>{n.label}</span>{!mobile && <ChevronRight className="nav-arrow" size={16} aria-hidden="true" />}</NavLink>)}
  </nav>

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Ir al contenido</a>
    <aside className="sidebar">
      <Link to="/" className="brand" aria-label="Softtek · Ir a Inicio"><img src="/brand/softtek.svg" alt="Softtek" width="125" height="64" /></Link>
      <div className="workspace-label">Mi sucursal</div>
      {nav()}
      <div className="sidebar-bottom">
        {saleAction}
        <div className="sidebar-profile"><div className="avatar">SC</div><div><strong>{configuration.data?.nombreSucursal || 'Mi sucursal'}</strong></div></div>
      </div>
    </aside>
    <div className="app-body">
      <header className="topbar">
        <Link to="/" className="mobile-brand" aria-label="Softtek · Ir a Inicio"><img src="/brand/softtek.svg" alt="Softtek" width="96" height="49" /></Link>
        <div className="breadcrumb"><Store size={17} aria-hidden="true" /><span>{configuration.data?.nombreSucursal || 'Mi sucursal'}</span><ChevronRight size={14} aria-hidden="true" /><strong>{location.pathname === '/softy' ? 'Softy' : navigation.find(n => n.to === location.pathname)?.label || 'Inicio'}</strong></div>
        <div className="topbar-right"><span className="header-date">{date}</span><NavLink to="/softy" className="softy-entry"><Sparkles size={20} aria-hidden="true" /><span>Softy</span></NavLink><button className="help-button" onClick={() => setHelp(true)}><CircleHelp size={19} aria-hidden="true" /><span>Ayuda</span></button></div>
      </header>
      {!online && <div className="offline-banner" role="alert"><WifiOff size={19} aria-hidden="true" />Sin conexión. Conéctate para guardar cambios.</div>}
      <main id="main-content" tabIndex={-1}>
        <Routes><Route path="/" element={<Dashboard />} /><Route path="/inventario" element={<Inventory />} /><Route path="/promociones" element={<Promotions />} /><Route path="/demanda" element={<Demand />} /><Route path="/ajustes" element={<Settings />} /><Route path="/softy" element={<Softy />} /><Route path="*" element={<div className="empty"><h1>No encontramos esta página</h1><Link className="button primary" to="/">Volver al inicio</Link></div>} /></Routes>
      </main>
      <div className="mobile-sale">{saleAction}</div>
      {nav(true)}
    </div>
    {help && <Modal title="Cómo usar la app" onClose={() => setHelp(false)}>
      <div className="help-steps">{[
        ['1', 'Empieza en Inicio', 'Revisa qué necesita atención. Cada tarjeta te lleva a la siguiente acción.'],
        ['2', 'Revisa tus productos', 'Busca un producto, consulta cuántas unidades quedan o agrega las que recibiste.'],
        ['3', 'Decide sobre las promociones', 'Lee por qué se recomienda una promoción. Tú decides si la activas.'],
      ].map(([step, title, text]) => <div key={step}><span>{step}</span><div><h3>{title}</h3><p>{text}</p></div></div>)}</div>
      <div className="modal-actions"><button className="button primary" onClick={() => setHelp(false)}>Entendido</button></div>
    </Modal>}
  </div>
}
