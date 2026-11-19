import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DistanceControl } from './DistanceControl'

describe('control de distancia (FR-007/008, NFR-006)', () => {
  it('es un deslizador con etiqueta accesible, valor visible y límites de 1 a 100 km', () => {
    render(<DistanceControl value={25} onChange={() => {}} access={{ enabled: true, reason: 'ok' }} />)

    const slider = screen.getByRole('slider', { name: 'Distancia máxima' })
    expect(slider).toHaveAttribute('min', '1')
    expect(slider).toHaveAttribute('max', '100')
    expect(slider).toHaveAttribute('aria-valuetext', '25 km')
    expect(screen.getByText('25 km')).toBeVisible()
    expect(slider).toBeEnabled()
  })

  it('refleja el valor elegido y avisa del cambio', () => {
    const onChange = vi.fn()
    render(<DistanceControl value={25} onChange={onChange} access={{ enabled: true, reason: 'ok' }} />)

    fireEvent.change(screen.getByRole('slider', { name: 'Distancia máxima' }), { target: { value: '40' } })

    expect(onChange).toHaveBeenCalledWith(40)
  })

  it.each([
    ['desactivada', /desactivada/i],
    ['sin-decision', /todavía no elegiste/i],
    ['permiso-denegado', /permiso del dispositivo/i],
    ['sin-soporte', /no permite/i],
  ] as const)('se deshabilita y explica el motivo (%s)', (reason, message) => {
    const onChange = vi.fn()
    render(<DistanceControl value={25} onChange={onChange} access={{ enabled: false, reason }} />)

    expect(screen.getByRole('slider', { name: 'Distancia máxima' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(message)
  })
})
