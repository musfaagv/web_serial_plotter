#!/usr/bin/env python3
"""Simple WebSocket server for ESP32 ultrasonic sensor + LED control.

Features:
- Accepts sensor data from ESP32 clients.
- Prints values in cm and inch.
- Sends LED ON/OFF commands to one client or broadcasts to all clients.

Protocol:
- ESP32 -> server (JSON):
  {"type":"sensor","cm":123.4,"inch":48.6,"led":true}
- Dashboard/browser -> server (JSON):
  {"type":"command","led":"on"}
  {"type":"command","led":"off"}
- Server -> ESP32 (JSON):
  {"type":"command","led":"on"}
  {"type":"command","led":"off"}
"""

from __future__ import annotations

import argparse
import asyncio
import json
from collections.abc import Awaitable
from collections.abc import Callable

from websockets.asyncio.server import ServerConnection
from websockets.asyncio.server import serve

CLIENTS: set[ServerConnection] = set()


async def send_command(client: ServerConnection, led_state: str) -> None:
    payload = json.dumps({"type": "command", "led": led_state})
    await client.send(payload)


async def broadcast_command(led_state: str) -> None:
    if not CLIENTS:
        print("[INFO] Tidak ada client terhubung.")
        return

    results = await asyncio.gather(
        *(send_command(client, led_state) for client in CLIENTS),
        return_exceptions=True,
    )

    success = sum(1 for result in results if result is None)
    print(f"[TX] Perintah LED '{led_state}' terkirim ke {success}/{len(CLIENTS)} client.")


def print_sensor_data(data: dict) -> None:
    cm = data.get("cm")
    inch = data.get("inch")
    led = data.get("led")
    print(f"[RX] cm={cm} | inch={inch} | led={led}")


def parse_led_command(payload: dict) -> str | None:
    if payload.get("type") != "command":
        return None

    led = str(payload.get("led", "")).strip().lower()
    if led in {"on", "off"}:
        return led
    return None


async def handle_client(websocket: ServerConnection) -> None:
    CLIENTS.add(websocket)
    peer = websocket.remote_address
    print(f"[OPEN] Client terhubung: {peer}")

    try:
        async for message in websocket:
            try:
                payload = json.loads(message)
            except json.JSONDecodeError:
                print(f"[WARN] Bukan JSON valid: {message!r}")
                continue

            if payload.get("type") == "sensor":
                print_sensor_data(payload)
            elif (led_cmd := parse_led_command(payload)) is not None:
                await broadcast_command(led_cmd)
            else:
                print(f"[INFO] Pesan non-sensor diterima: {payload}")
    except Exception as exc:  # noqa: BLE001
        print(f"[ERROR] Koneksi {peer} error: {exc}")
    finally:
        CLIENTS.discard(websocket)
        print(f"[CLOSE] Client terputus: {peer}")


async def command_loop(get_input: Callable[[str], Awaitable[str]]) -> None:
    help_text = (
        "\nPerintah server:\n"
        "  on        -> broadcast LED ON\n"
        "  off       -> broadcast LED OFF\n"
        "  list      -> tampilkan jumlah client\n"
        "  help      -> tampilkan bantuan\n"
        "  quit/exit -> keluar\n"
    )
    print(help_text)

    while True:
        raw = (await get_input("server> ")).strip().lower()

        if raw in {"quit", "exit"}:
            print("[INFO] Menutup server...")
            break
        if raw == "help":
            print(help_text)
            continue
        if raw == "list":
            print(f"[INFO] Client aktif: {len(CLIENTS)}")
            continue
        if raw == "on":
            await broadcast_command("on")
            continue
        if raw == "off":
            await broadcast_command("off")
            continue

        if raw:
            print("[WARN] Perintah tidak dikenal. Ketik 'help'.")


def make_async_input() -> Callable[[str], Awaitable[str]]:
    async def _get_input(prompt: str) -> str:
        return await asyncio.to_thread(input, prompt)

    return _get_input


async def run_server(host: str, port: int) -> None:
    async with serve(handle_client, host, port):
        print(f"[INFO] WebSocket server aktif di ws://{host}:{port}")
        await command_loop(make_async_input())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="WebSocket server ESP32 ultrasonic + LED")
    parser.add_argument("--host", default="0.0.0.0", help="Host bind (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8765, help="Port (default: 8765)")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    try:
        asyncio.run(run_server(args.host, args.port))
    except KeyboardInterrupt:
        print("\n[INFO] Server dihentikan user.")
