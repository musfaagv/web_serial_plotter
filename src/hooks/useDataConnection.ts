import { useCallback, useState, useEffect, useRef } from 'react'
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
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false)
  const websocketRef = useRef<WebSocket | null>(null)


  const serial = useSerial()
  const generator = useSignalGenerator(onLine)

  const state: ConnectionState = {
    type: connectionType,
    isConnecting: isConnecting || serial.state.isConnecting,
    isConnected: serial.state.isConnected || generator.isRunning || isWebSocketConnected,
    isSupported: serial.state.isSupported || typeof WebSocket !== 'undefined',
    error: error || serial.state.error
  }


  const connectSerial = useCallback(async (config: SerialConfig) => {
    if (generator.isRunning) {
      generator.stop()
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
  }, [serial, generator])

  const connectWebSocket = useCallback(async (config: WebSocketConfig) => {
    if (serial.state.isConnected) {
      await serial.disconnect()
    }

    if (generator.isRunning) {
      generator.stop()
    }

    if (websocketRef.current) {
      websocketRef.current.close()
      websocketRef.current = null
    }

    setIsConnecting(true)
    setError(null)

    try {
      const ws = new WebSocket(config.url)
      websocketRef.current = ws

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
          setConnectionType('websocket')
          setIsWebSocketConnected(true)
          resolve()
        }

        ws.onerror = () => {
          reject(new Error('Failed to connect to WebSocket'))
        }

        ws.onmessage = (event) => {
          const data = typeof event.data === 'string' ? event.data : String(event.data)
          data
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .forEach(onLine)
        }

        ws.onclose = () => {
          setIsWebSocketConnected(false)
          if (config.autoReconnect) {
            setError('WebSocket disconnected (auto reconnect is not implemented yet)')
          }
          if (connectionType === 'websocket') {
            setConnectionType(null)
          }
        }
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect WebSocket'
      setError(message)
      setIsWebSocketConnected(false)
      setConnectionType(null)
      throw err
    } finally {
      setIsConnecting(false)
    }
  }, [serial, generator, onLine, connectionType])

  const connectGenerator = useCallback(async (config: GeneratorConfig) => {
    if (serial.state.isConnected) {
      await serial.disconnect()
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
  }, [serial, generator])

  const disconnect = useCallback(async () => {
    setError(null)
    
    if (serial.state.isConnected) {
      await serial.disconnect()
    }
    
    if (generator.isRunning) {
      generator.stop()
    }

    if (websocketRef.current) {
      websocketRef.current.close()
      websocketRef.current = null
      setIsWebSocketConnected(false)
    }
    
    setConnectionType(null)
  }, [serial, generator])

  // Set up serial line handler
  useEffect(() => {
    serial.onLine(onLine)
  }, [serial, onLine])

  const write = useCallback(async (data: string) => {
    if (connectionType === 'websocket') {
      if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not connected')
      }
      websocketRef.current.send(data)
      return
    }

    if (connectionType !== 'serial' || !serial.state.isConnected) {
      throw new Error('No active writable connection')
    }
    await serial.write(data)
  }, [connectionType, serial])

  useEffect(() => {
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close()
      }
    }
  }, [])

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
