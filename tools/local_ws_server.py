#!/usr/bin/env python3
"""Local WebSocket relay server for ESP32 + browser clients.

Usage:
  python tools/local_ws_server.py --host 0.0.0.0 --port 8765

Install dependency first:
  pip install websockets
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone
from typing import Set

from websockets.asyncio.server import ServerConnection, serve

CLIENTS: Set[ServerConnection] = set()


async def broadcast(sender: ServerConnection, message: str) -> None:
  dead_clients: list[ServerConnection] = []
  for client in CLIENTS:
    if client is sender:
      continue
    try:
      await client.send(message)
    except Exception:
      dead_clients.append(client)

  for client in dead_clients:
    CLIENTS.discard(client)


async def handler(websocket: ServerConnection) -> None:
  CLIENTS.add(websocket)
  peer = getattr(websocket, "remote_address", "unknown")
  print(f"[{datetime.now(timezone.utc).isoformat()}] connected: {peer}")
  try:
    async for message in websocket:
      if isinstance(message, bytes):
        continue
      print(f"[{datetime.now(timezone.utc).isoformat()}] {peer}: {message.strip()}")
      await broadcast(websocket, message)
  finally:
    CLIENTS.discard(websocket)
    print(f"[{datetime.now(timezone.utc).isoformat()}] disconnected: {peer}")


async def main(host: str, port: int) -> None:
  print(f"Starting local WebSocket server at ws://{host}:{port}")
  async with serve(handler, host, port):
    await asyncio.Future()


if __name__ == '__main__':
  parser = argparse.ArgumentParser(description='Local websocket relay server')
  parser.add_argument('--host', default='0.0.0.0')
  parser.add_argument('--port', type=int, default=8765)
  args = parser.parse_args()

  try:
    asyncio.run(main(args.host, args.port))
  except KeyboardInterrupt:
    print('Server stopped')
