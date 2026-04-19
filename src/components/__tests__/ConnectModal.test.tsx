import type { GeneratorConfig } from '../../hooks/useSignalGenerator'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ConnectModal from '../ConnectModal'

const noop = () => {}
const genConfig: GeneratorConfig = { mode: 'sine3', channels: 3, sampleRateHz: 100, frequencyHz: 1, amplitude: 1, includeHeader: true, channelNames: ['a','b','c'] }

describe('ConnectModal', () => {
  afterEach(() => {
    cleanup()
  })
  it('shows websocket tab and allows selecting it', () => {
    render(
      <ConnectModal
        isOpen
        onClose={noop}
        onConnectSerial={async () => {}}
        onConnectWebSocket={async () => {}}
        onConnectGenerator={async () => {}}
        isConnecting={false}
        isSupported={true}
        generatorConfig={genConfig}
      />
    )

    const websocketTab = screen.getByRole('button', { name: /^websocket$/i })
    expect(websocketTab).toBeInTheDocument()

    fireEvent.click(websocketTab)

    expect(screen.getByText(/websocket url/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /connect websocket/i })).toBeInTheDocument()
  })

  it('renders websocket url input with default value and calls connect action', async () => {
    const onConnectWebSocket = vi.fn(async () => {})

    render(
      <ConnectModal
        isOpen
        onClose={noop}
        onConnectSerial={async () => {}}
        onConnectWebSocket={onConnectWebSocket}
        onConnectGenerator={async () => {}}
        isConnecting={false}
        isSupported={true}
        generatorConfig={genConfig}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /^websocket$/i }))

    const urlInput = screen.getByDisplayValue('ws://localhost:8765')
    expect(urlInput).toHaveValue('ws://localhost:8765')

    fireEvent.change(urlInput, { target: { value: 'ws://localhost:9000' } })
    fireEvent.click(screen.getByRole('button', { name: /connect websocket/i }))

    expect(onConnectWebSocket).toHaveBeenCalledWith({ url: 'ws://localhost:9000' })
  })
})
