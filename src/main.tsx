import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router'
import { useMocks } from './api'
import App from './App'
import { SoftyProvider } from './Softy'
import './styles.css'

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 }, mutations: { retry: false } } })
async function start() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    for (const registration of registrations) {
      if (registration.active?.scriptURL.endsWith('/mockServiceWorker.js')) await registration.unregister()
    }
    if (import.meta.env.PROD && !useMocks) await navigator.serviceWorker.register('/sw.js')
  }
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode><QueryClientProvider client={client}><BrowserRouter><SoftyProvider><App /></SoftyProvider></BrowserRouter></QueryClientProvider></React.StrictMode>,
  )
}
start().catch(() => {
  document.getElementById('root')!.innerHTML = '<main style="padding:32px;font-family:Arial,sans-serif"><h1>No pudimos abrir Mi sucursal</h1><p>Recarga esta página para volver a intentar.</p><button onclick="location.reload()">Volver a intentar</button></main>'
})
