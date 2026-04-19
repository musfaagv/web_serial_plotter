import { useCallback, useState, useEffect } from 'react'
import { useSerial } from './useSerial'
import { useSignalGenerator, type GeneratorConfig } from './useSignalGenerator'
import { useWebSocket } from './useWebSocket'

export interface SerialConfig {
  baudRate: number
  dataBits: 5 | 6 | 7 | 8
  stopBits: 1 | 2
  parity: 'none' | 'even' | 'odd'
  flowControl: 'none' | 'hardware'
}

export interface WebSocketConfig {
  url: string
  autoReconnect?: boolean
}

export type ConnectionType = 'serial' | 'websocket' | 'generator'

export interface ConnectionState {
  type: ConnectionType | null
  isConnecting: boolean
  isConnected: boolean
  isSupported: boolean
  error: string | null
}

export interface UseDataConnection {
  state: ConnectionState
  connectSerial: (config: SerialConfig) => Promise<void>
  connectWebSocket: (config: WebSocketConfig) => Promise<void>
  connectGenerator: (config: GeneratorConfig) => Promise<void>
  disconnect: () => Promise<void>
  write: (data: string) => Promise<void>
  generatorConfig: GeneratorConfig
  setGeneratorConfig: (config: Partial<GeneratorConfig>) => void
}

const DEFAULT_SERIAL_CONFIG: SerialConfig = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none'
}

export function useDataConnection(onLine: (line: string) => void): UseDataConnection {
  const [connectionType, setConnectionType] = useState<ConnectionType | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const serial = useSerial()
  const websocket = useWebSocket()
  const generator = useSignalGenerator(onLine)

  const state: ConnectionState = {
    type: connectionType,
    isConnecting: isConnecting || serial.state.isConnecting || websocket.state.isConnecting,
    isConnected: serial.state.isConnected || generator.isRunning || websocket.state.isConnected,
    isSupported: serial.state.isSupported || typeof WebSocket !== 'undefined',
    error: error || serial.state.error || websocket.state.error
  }

  const connectSerial = useCallback(async (config: SerialConfig) => {
    if (websocket.state.isConnected || websocket.state.isConnecting) {
      await websocket.disconnect()
    }

    if (generator.isRunning) {
      generator.stop()
    }

    setIsConnecting(true)
    setError(null)

    try {
      await serial.connect(config.baudRate)
      setConnectionType('serial')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to serial port'
      setError(message)
      setConnectionType(null)
      throw err
    } finally {
      setIsConnecting(false)
    }
  }, [serial, websocket, generator])

  const connectWebSocket = useCallback(async (config: WebSocketConfig) => {
    if (serial.state.isConnected) {
      await serial.disconnect()
    }

    if (generator.isRunning) {
      generator.stop()
    }

    websocket.setAutoReconnect(Boolean(config.autoReconnect))

    setIsConnecting(true)
    setError(null)

    try {
      await websocket.connect(config.url)
      setConnectionType('websocket')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect WebSocket'
      setError(message)
      setConnectionType(null)
      throw err
    } finally {
      setIsConnecting(false)
    }
  }, [serial, generator, websocket])

  const connectGenerator = useCallback(async (config: GeneratorConfig) => {
    if (serial.state.isConnected) {
      await serial.disconnect()
    }

    if (websocket.state.isConnected || websocket.state.isConnecting) {
      await websocket.disconnect()
    }

    setError(null)
    setConnectionType('generator')

    try {
      generator.setConfig(config)
      generator.start()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start signal generator'
      setError(message)
      setConnectionType(null)
    }
  }, [serial, websocket, generator])

  const disconnect = useCallback(async () => {
    setError(null)

    if (serial.state.isConnected) {
      await serial.disconnect()
    }

    if (generator.isRunning) {
      generator.stop()
    }

    if (websocket.state.isConnected || websocket.state.isConnecting) {
      await websocket.disconnect()
    }

    setConnectionType(null)
  }, [serial, websocket, generator])

  useEffect(() => {
    serial.onLine(onLine)
    websocket.onMessage(onLine)
  }, [serial, websocket, onLine])

  const write = useCallback(async (data: string) => {
    if (connectionType === 'websocket') {
      await websocket.write(data)
      return
    }

    if (connectionType !== 'serial' || !serial.state.isConnected) {
      throw new Error('No active writable connection')
    }

    await serial.write(data)
  }, [connectionType, serial, websocket])

  return {
    state,
    connectSerial,
    connectWebSocket,
    connectGenerator,
    disconnect,
    write,
    generatorConfig: generator.config,
    setGeneratorConfig: generator.setConfig
  }
}

export { DEFAULT_SERIAL_CONFIG }
