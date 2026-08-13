import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GateScanner } from './GateScanner'

const { decodeFromConstraintsMock, stopSpy } = vi.hoisted(() => ({
  decodeFromConstraintsMock: vi.fn(),
  stopSpy: vi.fn(),
}))

// função nomeada, não arrow function -- `new BrowserQRCodeReader()` no componente
// exige um construtor de verdade; um mock cuja implementação é arrow function faz
// `new` lançar "is not a constructor" (arrow function nunca é construível).
vi.mock('@zxing/browser', () => ({
  BrowserQRCodeReader: vi.fn().mockImplementation(function FakeBrowserQRCodeReader() {
    return { decodeFromConstraints: decodeFromConstraintsMock }
  }),
}))

type ScanCallback = (result: { getText: () => string } | undefined, error: unknown, controls: unknown) => void

function setSecureContext(value: boolean) {
  Object.defineProperty(window, 'isSecureContext', { value, configurable: true })
}

// jsdom não trata a URL de teste como contexto seguro por padrão (`isSecureContext`
// nasce `false`) -- um `beforeEach` (não só resetar no `afterEach`) garante que cada
// teste começa em contexto seguro independente da ordem/filtro de execução; o teste
// "sem HTTPS" sobrescreve para `false` só dentro do próprio corpo.
beforeEach(() => {
  decodeFromConstraintsMock.mockReset()
  stopSpy.mockReset()
  setSecureContext(true)
})

describe('GateScanner', () => {
  it('sem HTTPS -- aviso claro, nunca tenta acessar a câmera', () => {
    setSecureContext(false)
    render(<GateScanner paused={false} onScan={vi.fn()} />)

    expect(
      screen.getByText(/Leitura por câmera exige conexão segura \(HTTPS\)/),
    ).toBeInTheDocument()
    expect(decodeFromConstraintsMock).not.toHaveBeenCalled()
  })

  it('sem permissão de câmera -- aviso, sem travar a tela', async () => {
    decodeFromConstraintsMock.mockRejectedValue(new Error('NotAllowedError'))
    render(<GateScanner paused={false} onScan={vi.fn()} />)

    expect(
      await screen.findByText(/Não foi possível acessar a câmera/),
    ).toBeInTheDocument()
  })

  it('leitura dispara onScan uma vez com o texto decodificado', async () => {
    let callback: ScanCallback = () => {}
    decodeFromConstraintsMock.mockImplementation((_constraints, _video, cb: ScanCallback) => {
      callback = cb
      return Promise.resolve({ stop: stopSpy })
    })
    const onScan = vi.fn()
    render(<GateScanner paused={false} onScan={onScan} />)

    await screen.findByLabelText('Câmera da portaria')

    act(() => {
      callback({ getText: () => 'TKT1.abc.def' }, undefined, {})
    })

    expect(onScan).toHaveBeenCalledTimes(1)
    expect(onScan).toHaveBeenCalledWith('TKT1.abc.def')
  })

  it('frame sem código (erro de decodificação comum) -- nunca chama onScan', async () => {
    let callback: ScanCallback = () => {}
    decodeFromConstraintsMock.mockImplementation((_constraints, _video, cb: ScanCallback) => {
      callback = cb
      return Promise.resolve({ stop: stopSpy })
    })
    const onScan = vi.fn()
    render(<GateScanner paused={false} onScan={onScan} />)
    await screen.findByLabelText('Câmera da portaria')

    act(() => {
      callback(undefined, new Error('NotFoundException'), {})
    })

    expect(onScan).not.toHaveBeenCalled()
  })

  it('paused -- ignora frames decodificados (debounce/pausa pós-leitura)', async () => {
    let callback: ScanCallback = () => {}
    decodeFromConstraintsMock.mockImplementation((_constraints, _video, cb: ScanCallback) => {
      callback = cb
      return Promise.resolve({ stop: stopSpy })
    })
    const onScan = vi.fn()
    render(<GateScanner paused={true} onScan={onScan} />)
    await screen.findByLabelText('Câmera da portaria')

    act(() => {
      callback({ getText: () => 'TKT1.abc.def' }, undefined, {})
      callback({ getText: () => 'TKT1.abc.def' }, undefined, {})
    })

    expect(onScan).not.toHaveBeenCalled()
  })

  it('desmonta -- libera a câmera (stop dos controles)', async () => {
    decodeFromConstraintsMock.mockResolvedValue({ stop: stopSpy })
    const { unmount } = render(<GateScanner paused={false} onScan={vi.fn()} />)
    await screen.findByLabelText('Câmera da portaria')

    unmount()

    expect(stopSpy).toHaveBeenCalledTimes(1)
  })
})
