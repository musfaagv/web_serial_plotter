import { useCallback, useState, useEffect } from 'react'
import { useSerial } from './useSerial'
import { useSignalGenerator, type GeneratorConfig } from './useSignalGenerator'

export interface SerialConfig {
  baudRate: number
  dataBits: 5 | 6 | 7 | 8
  stopBits: 1 | 2
  parity: 'none' | 'even' | 'odd'
  flowControl: 'none' | 'hardware'
}

export interface WebSocketConfig {
  url: string
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
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false)
  const [webSocket, setWebSocket] = useState<WebSocket | null>(null)


  const serial = useSerial()
  const generator = useSignalGenerator(onLine)

  const state: ConnectionState = {
    type: connectionType,
    isConnecting: isConnecting || serial.state.isConnecting,
    isConnected: serial.state.isConnected || generator.isRunning || isWebSocketConnected,
    isSupported: serial.state.isSupported || typeof WebSocket !== 'undefined',
    error: error || serial.state.error
  }

  const disconnectWebSocket = useCallback(async () => {
    if (webSocket) {
      webSocket.onopen = null
      webSocket.onclose = null
      webSocket.onerror = null
      webSocket.onmessage = null
      webSocket.close()
      setWebSocket(null)
    }
    setIsWebSocketConnected(false)
  }, [webSocket])

  const connectSerial = useCallback(async (config: SerialConfig) => {
    if (generator.isRunning) {
      generator.stop()
    }
    if (isWebSocketConnected) {
      await disconnectWebSocket()
    }
    
    setIsConnecting(true)
    setError(null)
    
    try {
      // Convert our config to the format useSerial expects
      // Note: Web Serial API has limited configuration options
      await serial.connect(config.baudRate)
      setConnectionType('serial')
      // The actual port configuration would need to be done at the port.open() level
      // For now, we'll just use baudRate as useSerial currently does
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to serial port'
      setError(message)
      setConnectionType(null)
      throw err // Re-throw so ConnectModal knows the connection failed
    } finally {
      setIsConnecting(false)
    }
  }, [serial, generator, isWebSocketConnected, disconnectWebSocket])

  const connectWebSocket = useCallback(async (config: WebSocketConfig) => {
    if (serial.state.isConnected) {
      await serial.disconnect()
    }
    if (generator.isRunning) {
      generator.stop()
    }
    await disconnectWebSocket()

    setIsConnecting(true)
    setError(null)

    try {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(config.url)
        let buffer = ''

        ws.onopen = () => {
          setWebSocket(ws)
          setIsWebSocketConnected(true)
          setConnectionType('websocket')
          resolve()
        }

        ws.onmessage = (event) => {
          const text = typeof event.data === 'string' ? event.data : String(event.data)
          buffer += text
          const normalized = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
          const lines = normalized.split('\n')
          buffer = lines.pop() ?? ''
          lines.forEach((line) => onLine(line))
        }

        ws.onerror = () => {
          reject(new Error('Failed to connect to WebSocket server'))
        }

        ws.onclose = () => {
          setIsWebSocketConnected(false)
          setWebSocket(null)
          setConnectionType((prev) => (prev === 'websocket' ? null : prev))
        }
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to WebSocket server'
      setError(message)
      setConnectionType(null)
      throw err
    } finally {
      setIsConnecting(false)
    }
  }, [serial, generator, disconnectWebSocket, onLine])

  const connectGenerator = useCallback(async (config: GeneratorConfig) => {
    if (serial.state.isConnected) {
      await serial.disconnect()
    }
    if (isWebSocketConnected) {
      await disconnectWebSocket()
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
  }, [serial, generator, isWebSocketConnected, disconnectWebSocket])

  const disconnect = useCallback(async () => {
    setError(null)
    
    if (serial.state.isConnected) {
      await serial.disconnect()
    }
    
    if (generator.isRunning) {
      generator.stop()
    }
    if (isWebSocketConnected) {
      await disconnectWebSocket()
    }
    
    setConnectionType(null)
  }, [serial, generator, isWebSocketConnected, disconnectWebSocket])

  // Set up serial line handler
  useEffect(() => {
    serial.onLine(onLine)
  }, [serial, onLine])

  useEffect(() => {
    return () => {
      if (webSocket) {
        webSocket.close()
      }
    }
  }, [webSocket])

  const write = useCallback(async (data: string) => {
    if (connectionType === 'serial' && serial.state.isConnected) {
      await serial.write(data)
      return
    }
    if (connectionType === 'websocket' && webSocket && isWebSocketConnected) {
      webSocket.send(data)
      return
    }
    throw new Error('No active serial/websocket connection')
  }, [connectionType, serial, webSocket, isWebSocketConnected])

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
