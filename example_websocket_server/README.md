# Example WebSocket Server

Simple relay server using Python `websockets` for ESP32 and web UI communication.

## Run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

Server endpoint: `ws://0.0.0.0:8765`

## Supported payloads

Sensor data:

```json
{"type":"ultrasonic","cm":123.4,"inch":48.6,"ts":1710000000}
```

LED command:

```json
{"type":"led","state":"on"}
{"type":"led","state":"off"}
```

Invalid JSON or unknown LED states will receive an error payload with `type: "error"`.
