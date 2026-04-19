import { useCallback, useRef, useState } from 'react'

export interface WebSocketState {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
}

export interface UseWebSocket {
  state: WebSocketState
  connect: (url: string) => Promise<void>
  disconnect: () => void
  write: (data: string) => Promise<void>
}

export function useWebSocket(onLine: (line: string) => void): UseWebSocket {
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
  })
  const socketRef = useRef<WebSocket | null>(null)
  const lineBufferRef = useRef('')

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }
    lineBufferRef.current = ''
    setState((prev) => ({ ...prev, isConnected: false, isConnecting: false }))
  }, [])

  const connect = useCallback(async (url: string) => {
    if (!url.trim()) {
      throw new Error('WebSocket URL wajib diisi')
    }

    disconnect()
    setState({ isConnected: false, isConnecting: true, error: null })

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(url)
      socketRef.current = socket

      socket.onopen = () => {
        setState({ isConnected: true, isConnecting: false, error: null })
        resolve()
      }

      socket.onmessage = (event) => {
        const message = typeof event.data === 'string' ? event.data : ''
        if (!message) return

        lineBufferRef.current += message
        let index = lineBufferRef.current.indexOf('\n')
        while (index >= 0) {
          const line = lineBufferRef.current.slice(0, index).replace(/\r$/, '')
          lineBufferRef.current = lineBufferRef.current.slice(index + 1)
          onLine(line)
          index = lineBufferRef.current.indexOf('\n')
        }

        if (!message.includes('\n') && !message.includes('\r')) {
          onLine(message)
          lineBufferRef.current = ''
        }
      }

      socket.onerror = () => {
        const err = 'Koneksi WebSocket gagal. Periksa URL/server.'
        setState({ isConnected: false, isConnecting: false, error: err })
        reject(new Error(err))
      }

      socket.onclose = () => {
        socketRef.current = null
        setState((prev) => ({ ...prev, isConnected: false, isConnecting: false }))
      }
    })
  }, [disconnect, onLine])

  const write = useCallback(async (data: string) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket belum terhubung')
    }
    socket.send(data)
  }, [])

  return {
    state,
    connect,
    disconnect,
    write,
  }
}
