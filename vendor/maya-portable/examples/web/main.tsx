import { createRoot } from 'react-dom/client';
import { MayaAssistant } from '../../src/react/index.js';
import '../../src/react/styles.css';
import './page.css';

createRoot(document.getElementById('root')!).render(<main>
  <header className="demo-header"><span>MAYA · PORTABLE</span><h1>Describe lo que quieres construir.</h1>
    <p>Escribe o dicta una solicitud para generar una interfaz y seguir interactuando con ella.</p></header>
  <MayaAssistant />
</main>);
