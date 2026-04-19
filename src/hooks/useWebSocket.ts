import { useCallback, useRef, useState } from 'react'

export interface WebSocketState {
  isConnecting: boolean
  isConnected: boolean
  error: string | null
  url: string | null
}

export interface UseWebSocket {
  state: WebSocketState
  connect: (url: string) => Promise<void>
  disconnect: () => Promise<void>
  write: (data: string) => Promise<void>
  onMessage: (handler: (message: string) => void) => void
  setAutoReconnect: (enabled: boolean) => void
}

interface UseWebSocketOptions {
  autoReconnect?: boolean
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocket {
  const [state, setState] = useState<WebSocketState>({
    isConnecting: false,
    isConnected: false,
    error: null,
    url: null,
  })

  const socketRef = useRef<WebSocket | null>(null)
  const messageHandlerRef = useRef<((message: string) => void) | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const shouldReconnectRef = useRef(Boolean(options.autoReconnect))
  const currentUrlRef = useRef<string | null>(null)

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  const onMessage = useCallback((handler: (message: string) => void) => {
    messageHandlerRef.current = handler
  }, [])

  const setAutoReconnect = useCallback((enabled: boolean) => {
    shouldReconnectRef.current = enabled
  }, [])

  const disconnect = useCallback(async () => {
    shouldReconnectRef.current = false
    clearReconnectTimer()

    const socket = socketRef.current
    socketRef.current = null

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close()
    } else if (socket && socket.readyState === WebSocket.CONNECTING) {
      socket.close()
    }

    currentUrlRef.current = null
    setState((prev) => ({
      ...prev,
      isConnecting: false,
      isConnected: false,
      error: null,
      url: null,
    }))
  }, [clearReconnectTimer])

  const connect = useCallback(async (url: string) => {
    currentUrlRef.current = url
    clearReconnectTimer()

    const previous = socketRef.current
    if (previous) {
      previous.close()
      socketRef.current = null
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: null, url }))

    await new Promise<void>((resolve, reject) => {
      let settled = false

      const connectSocket = () => {
        const socket = new WebSocket(url)
        socketRef.current = socket

        socket.onopen = () => {
          reconnectAttemptRef.current = 0
          setState((prev) => ({ ...prev, isConnecting: false, isConnected: true, error: null, url }))
          if (!settled) {
            settled = true
            resolve()
          }
        }

        socket.onmessage = (event) => {
          const payload = typeof event.data === 'string' ? event.data : String(event.data)
          payload
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .forEach((line) => messageHandlerRef.current?.(line))
        }

        socket.onerror = () => {
          const error = 'WebSocket connection error'
          setState((prev) => ({ ...prev, error, isConnecting: false }))
          if (!settled) {
            settled = true
            reject(new Error(error))
          }
        }

        socket.onclose = () => {
          setState((prev) => ({ ...prev, isConnected: false, isConnecting: false }))

          if (shouldReconnectRef.current && currentUrlRef.current) {
            const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, 5000)
            reconnectAttemptRef.current += 1
            reconnectTimerRef.current = window.setTimeout(() => {
              connectSocket()
            }, delay)
          }
        }
      }

      connectSocket()
    })
  }, [clearReconnectTimer])

  const write = useCallback(async (data: string) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected')
    }

    socket.send(data)
  }, [])

  return {
    state,
    connect,
    disconnect,
    write,
    onMessage,
    setAutoReconnect,
  }
}
