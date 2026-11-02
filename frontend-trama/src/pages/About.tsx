import { ExternalLink } from 'lucide-react'
import { PageTitle } from '../components/UI'
import { imageCredits } from '../data/seed'
const photoLabels: Record<string, string> = {
  corriente: 'Pintura abstracta', equilibrio: 'Cerámica esmaltada', taller: 'Materiales del taller',
  fragmentos: 'Composición floral', color: 'Pliegues de color', proceso: 'Pinceles y proceso',
}

export function AboutPage() {
  return <div className="about-page"><PageTitle title="Acerca de Trama" description="Una comunidad para artistas." />
    <section className="about-section"><h2>Qué es Trama</h2>
      <p>Trama reúne a artistas para compartir obras, guardar referencias, participar de desafíos y conversar. Las publicaciones, comentarios, likes, seguimientos, carpetas y decisiones de administración se guardan en los servicios de Trama.</p>
      <p>Tu sesión se mantiene en este navegador hasta que la cierres desde Salir.</p>
    </section>
    <section className="about-section"><h2>Créditos y licencias</h2><dl className="credits-list">
      <div><dt>Identidad Trama</dt><dd>Símbolo 11 · Encuentro e identidad suministrada para este proyecto. La vectorización conserva la forma elegida; no es una marca nueva.</dd></div>
      <div><dt>Inter</dt><dd>Copyright 2020 The Inter Project Authors. Fuente incluida sin modificar, bajo <a className="text-link" href="/fonts/OFL.txt" target="_blank" rel="noopener noreferrer">SIL Open Font License 1.1</a>.</dd></div>
      <div><dt>Lucide</dt><dd>Lucide Icons and Contributors, licencia ISC. Incluye iconos derivados de Feather, de Cole Bemis, bajo MIT. <a className="text-link" href="/licenses/lucide.txt" target="_blank" rel="noopener noreferrer">Avisos y licencias completos</a>.</dd></div>
      <div><dt>Ilustraciones</dt><dd>Seis ilustraciones SVG originales: línea, objetos, botánica, herbario y las dos portadas sonoras. </dd></div>
      <div><dt>Audio</dt><dd>Dos piezas instrumentales sintetizadas, de 8 y 6 segundos, sin grabaciones ni voces de terceros. Publicadas bajo <a className="text-link" href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener noreferrer">CC0</a>.</dd></div>
      <div><dt>Fotografías</dt><dd>Seis referencias obtenidas de Unsplash y bajo la <a className="text-link" href="https://unsplash.com/license" target="_blank" rel="noopener noreferrer">licencia Unsplash</a>. Las fuentes utilizadas se enlazan a continuación; no se atribuyen a los perfiles de la comunidad.</dd></div>
    </dl>
      <ul className="photo-credits">{Object.entries(imageCredits).map(([asset, url]) => <li key={asset}><img src={`/media/${asset}.jpg`} alt="" loading="lazy" width="240" height="160" /><strong>{photoLabels[asset] ?? asset}</strong><a className="text-link" href={url} target="_blank" rel="noopener noreferrer" aria-label={`Ver referencia de ${photoLabels[asset] ?? asset} en Unsplash`}>Referencia original<ExternalLink size={16} aria-hidden="true" /></a></li>)}</ul>
    </section>
  </div>
}
