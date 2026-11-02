import { useState } from 'react'
import { ArrowLeft, ArrowRight, Brush, Camera, Layers3, Music2, Palette, PenTool, Shapes, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAction, useDemo } from '../context/DemoContext'
import { disciplines, inspirationTypes, type User } from '../data/model'
import { Button, Choice, ErrorMessage } from '../components/UI'

const icons = [PenTool, Palette, Camera, Shapes, Layers3, Music2, Brush, Sparkles]

export function OnboardingPage() {
  const { user } = useDemo()
  const navigate = useNavigate()
  const { run, pending, error } = useAction()
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<User['disciplines']>(user?.disciplines ?? [])
  const [inspirations, setInspirations] = useState<User['inspirations']>(user?.inspirations ?? [])
  return <div className="onboarding">
    <p className="meta step-label">Paso {step + 1} de 2</p><progress value={step + 1} max={2} aria-label={`Paso ${step + 1} de 2`} />
    <h1>{step === 0 ? '¿Qué te inspira?' : '¿Dónde aparecen tus ideas?'}</h1>
    <p className="onboarding-intro">{step === 0 ? 'Elegí las disciplinas que te dan curiosidad. Hay lugar para más de una.' : 'Contanos qué te gusta encontrar. Podés cambiar estas preferencias después.'}</p>
    <div className="choice-grid">
      {step === 0 ? disciplines.map((discipline, index) => <Choice key={discipline} icon={icons[index]} selected={selected.includes(discipline)}
        onClick={() => setSelected(current => current.includes(discipline) ? current.filter(item => item !== discipline) : [...current, discipline])}>{discipline}</Choice>)
        : inspirationTypes.map(inspiration => <Choice key={inspiration} selected={inspirations.includes(inspiration)}
          onClick={() => setInspirations(current => current.includes(inspiration) ? current.filter(item => item !== inspiration) : [...current, inspiration])}>{inspiration}</Choice>)}
    </div>
    <p className="field-hint">No hay una cantidad mínima. Usamos tus preferencias para sugerirte obras.</p>
    <ErrorMessage message={error} />
    <div className="onboarding-actions">
      {step ? <Button variant="ghost" onClick={() => setStep(0)} disabled={pending}><ArrowLeft size={18} aria-hidden="true" />Atrás</Button>
        : <Button variant="ghost" onClick={() => navigate('/inicio')} disabled={pending}>Omitir por ahora</Button>}
      <Button loading={pending} onClick={() => {
        if (step === 0) setStep(1)
        else void run({ type: 'set-interests', disciplines: selected, inspirations }, 'Tus preferencias se guardaron.').then(result => { if (result) navigate('/inicio') })
      }}>{step ? 'Explorar Trama' : 'Continuar'}<ArrowRight size={18} aria-hidden="true" /></Button>
    </div>
  </div>
}
