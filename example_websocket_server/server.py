#!/usr/bin/env python3
"""Simple local WebSocket relay server for ESP32 <-> Web UI communication.

Payload conventions:
- Sensor payload from ESP32:
  {"type":"ultrasonic","cm":123.4,"inch":48.6,"ts":1710000000}
- LED command from web UI:
  {"type":"led","state":"on"}
"""

from __future__ import annotations

import asyncio
import json
import logging
import signal
import time
from typing import Any

from websockets.asyncio.server import ServerConnection, serve

HOST = "0.0.0.0"
PORT = 8765
VALID_LED_STATES = {"on", "off"}
VALID_SENSOR_TYPES = {"ultrasonic"}

clients: set[ServerConnection] = set()


async def broadcast(payload: dict[str, Any], exclude: ServerConnection | None = None) -> None:
    """Broadcast payload to all connected clients except `exclude`."""
    if not clients:
        return

    message = json.dumps(payload)
    send_jobs = [
        client.send(message)
        for client in clients
        if client.open and (exclude is None or client != exclude)
    ]

    if not send_jobs:
        return

    results = await asyncio.gather(*send_jobs, return_exceptions=True)
    for result in results:
        if isinstance(result, Exception):
            logging.warning("Broadcast error: %s", result)


def _error_payload(reason: str, detail: str) -> dict[str, Any]:
    return {
        "type": "error",
        "reason": reason,
        "detail": detail,
        "ts": int(time.time()),
    }


def parse_payload(raw_message: str) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    """Validate payload and return (normalized_payload, error_payload)."""
    try:
        payload = json.loads(raw_message)
    except json.JSONDecodeError as exc:
        return None, _error_payload("invalid_json", f"JSON parse error: {exc.msg}")

    if not isinstance(payload, dict):
        return None, _error_payload("invalid_payload", "Payload must be a JSON object")

    msg_type = payload.get("type")
    if not isinstance(msg_type, str):
        return None, _error_payload("invalid_payload", "Missing or invalid 'type' field")

    if msg_type == "led":
        state = payload.get("state")
        if state not in VALID_LED_STATES:
            return None, _error_payload(
                "invalid_led_state",
                f"Unknown LED state '{state}'. Valid states: {sorted(VALID_LED_STATES)}",
            )
        return {"type": "led", "state": state, "ts": int(time.time())}, None

    if msg_type in VALID_SENSOR_TYPES:
        cm = payload.get("cm")
        inch = payload.get("inch")
        ts = payload.get("ts", int(time.time()))

        if not isinstance(cm, (int, float)) or not isinstance(inch, (int, float)):
            return None, _error_payload(
                "invalid_sensor_payload",
                "Sensor payload must include numeric 'cm' and 'inch' fields",
            )
        if not isinstance(ts, (int, float)):
            return None, _error_payload("invalid_sensor_payload", "Field 'ts' must be numeric")

        return {
            "type": "ultrasonic",
            "cm": float(cm),
            "inch": float(inch),
            "ts": int(ts),
        }, None

    return None, _error_payload("unknown_type", f"Unsupported message type '{msg_type}'")


async def handle_client(websocket: ServerConnection) -> None:
    client_id = f"{websocket.remote_address}"
    clients.add(websocket)
    logging.info("Client connected: %s (total=%d)", client_id, len(clients))

    try:
        await websocket.send(
            json.dumps(
                {
                    "type": "info",
                    "message": "Connected to WebSocket relay",
                    "ts": int(time.time()),
                }
            )
        )

        async for raw_message in websocket:
            payload, error = parse_payload(raw_message)
            if error:
                logging.warning("Invalid message from %s: %s", client_id, error["detail"])
                await websocket.send(json.dumps(error))
                continue

            logging.info("%s -> %s", client_id, payload)
            await broadcast(payload, exclude=websocket)
    except Exception as exc:  # noqa: BLE001
        logging.warning("Connection error for %s: %s", client_id, exc)
    finally:
        clients.discard(websocket)
        logging.info("Client disconnected: %s (total=%d)", client_id, len(clients))


async def main() -> None:
    stop_event = asyncio.Event()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop_event.set)
        except NotImplementedError:
            # Windows may not support add_signal_handler for all signals.
            pass

    async with serve(handle_client, HOST, PORT):
        logging.info("WebSocket server listening on ws://%s:%s", HOST, PORT)
        await stop_event.wait()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
    asyncio.run(main())
