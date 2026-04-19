import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDataConnection } from '../useDataConnection'

const serialState = {
  isSupported: true,
  isConnecting: false,
  isConnected: false,
  port: null,
  readerLocked: false,
  error: null as string | null,
}

const websocketState = {
  isConnecting: false,
  isConnected: false,
  error: null as string | null,
  url: null as string | null,
}

const serialConnectMock = vi.fn(async () => {
  serialState.isConnected = true
})
const serialDisconnectMock = vi.fn(async () => {
  serialState.isConnected = false
})
const serialWriteMock = vi.fn(async () => {})

const websocketConnectMock = vi.fn(async (url: string) => {
  websocketState.url = url
  websocketState.isConnected = true
})
const websocketDisconnectMock = vi.fn(async () => {
  websocketState.isConnected = false
  websocketState.url = null
})
const websocketWriteMock = vi.fn(async () => {})
const websocketSetAutoReconnectMock = vi.fn(() => {})

const generator = {
  isRunning: false,
  config: { mode: 'sine3', channels: 3, sampleRateHz: 100, frequencyHz: 1, amplitude: 1, includeHeader: true, channelNames: ['a','b','c'] },
  setConfig: vi.fn((next: Partial<typeof generator.config>) => {
    generator.config = { ...generator.config, ...next }
  }),
  start: vi.fn(() => {
    generator.isRunning = true
  }),
  stop: vi.fn(() => {
    generator.isRunning = false
  }),
}

vi.mock('../useSerial', () => ({
  useSerial: () => ({
    state: serialState,
    connect: serialConnectMock,
    disconnect: serialDisconnectMock,
    onLine: vi.fn(() => {}),
    write: serialWriteMock,
  })
}))

vi.mock('../useWebSocket', () => ({
  useWebSocket: () => ({
    state: websocketState,
    connect: websocketConnectMock,
    disconnect: websocketDisconnectMock,
    write: websocketWriteMock,
    onMessage: vi.fn(() => {}),
    setAutoReconnect: websocketSetAutoReconnectMock,
  })
}))

vi.mock('../useSignalGenerator', () => ({
  useSignalGenerator: () => generator
}))

describe('useDataConnection', () => {
  beforeEach(() => {
    serialState.isConnected = false
    serialState.isConnecting = false
    serialState.error = null

    websocketState.isConnected = false
    websocketState.isConnecting = false
    websocketState.error = null
    websocketState.url = null

    generator.isRunning = false
    generator.setConfig.mockClear()
    generator.start.mockClear()
    generator.stop.mockClear()

    serialConnectMock.mockClear()
    serialDisconnectMock.mockClear()
    serialWriteMock.mockClear()
    websocketConnectMock.mockClear()
    websocketDisconnectMock.mockClear()
    websocketWriteMock.mockClear()
    websocketSetAutoReconnectMock.mockClear()
  })

  it('transitions from generator to websocket', async () => {
    const { result } = renderHook(() => useDataConnection(vi.fn()))

    await act(async () => {
      await result.current.connectGenerator({ mode: 'sine3', channels: 3, sampleRateHz: 10, frequencyHz: 1, amplitude: 1, includeHeader: true, channelNames: ['a', 'b', 'c'] })
    })
    expect(result.current.state.type).toBe('generator')
    expect(generator.start).toHaveBeenCalled()

    await act(async () => {
      await result.current.connectWebSocket({ url: 'ws://localhost:8765' })
    })

    expect(generator.stop).toHaveBeenCalledTimes(1)
    expect(websocketConnectMock).toHaveBeenCalledWith('ws://localhost:8765')
    expect(result.current.state.type).toBe('websocket')
  })

  it('transitions from serial to websocket', async () => {
    const { result } = renderHook(() => useDataConnection(vi.fn()))

    await act(async () => {
      await result.current.connectSerial({ baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' })
    })

    expect(result.current.state.type).toBe('serial')

    await act(async () => {
      await result.current.connectWebSocket({ url: 'ws://localhost:8765', autoReconnect: true })
    })

    expect(serialDisconnectMock).toHaveBeenCalledTimes(1)
    expect(websocketSetAutoReconnectMock).toHaveBeenCalledWith(true)
    expect(result.current.state.type).toBe('websocket')
  })

  it('disconnect clears active connection type from websocket', async () => {
    const { result } = renderHook(() => useDataConnection(vi.fn()))

    await act(async () => {
      await result.current.connectWebSocket({ url: 'ws://localhost:8765' })
    })
    expect(result.current.state.type).toBe('websocket')

    await act(async () => {
      await result.current.disconnect()
    })

    expect(websocketDisconnectMock).toHaveBeenCalledTimes(1)
    expect(result.current.state.type).toBe(null)
  })

  it('write succeeds when connected via websocket', async () => {
    const { result } = renderHook(() => useDataConnection(vi.fn()))

    await act(async () => {
      await result.current.connectWebSocket({ url: 'ws://localhost:8765' })
    })

    await act(async () => {
      await result.current.write('{"type":"ping"}')
    })

    expect(websocketWriteMock).toHaveBeenCalledWith('{"type":"ping"}')
  })

  it('write throws when disconnected', async () => {
    const { result } = renderHook(() => useDataConnection(vi.fn()))

    await expect(result.current.write('cmd')).rejects.toThrow('No active writable connection')
  })
})
