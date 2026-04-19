# Example Arduino Firmware

This folder contains sample Arduino sketches for testing the Web Serial Plotter.

## basic_plotter.ino

A basic example that generates simulated sensor data with 4 series:
- Temperature (°C)
- Humidity (%)
- Pressure (hPa)
- Light (lux)

### Features
- Outputs data at 10 Hz (100ms intervals)
- Uses sine waves with random noise for realistic sensor simulation
- Includes proper header line with series names
- Compatible with standard Arduino boards (Uno, Nano, ESP32, etc.)

### Upload Instructions

1. Open `basic_plotter.ino` in Arduino IDE
2. Select your board and COM port
3. Upload the sketch
4. Open the Web Serial Plotter in your browser
5. Click "Connect" and select the Arduino's serial port
6. Use default settings: 115200 baud, 8 data bits, 1 stop bit, no parity

### Data Format

The sketch outputs data in the format expected by the Web Serial Plotter:

```
# Temperature,Humidity,Pressure,Light
22.45,65.23,1015.67,789.12
22.67,64.89,1015.23,792.45
...
```

- Header line starts with `#` followed by comma-separated series names
- Data lines contain comma-separated numerical values
- Each line represents one time sample across all series

### Customization

You can modify the sketch to:
- Change the number of data series
- Adjust sampling rate (modify `delay()` value)
- Change data generation functions
- Add real sensor readings instead of simulated data

### Serial Settings

- **Baud Rate**: 115200
- **Data Bits**: 8
- **Stop Bits**: 1
- **Parity**: None
- **Flow Control**: None

---

## esp32_ws_ultrasonic.ino

Firmware example for ESP32 + HC-SR04 that sends ultrasonic data over WebSocket and receives LED commands.

Path: `example_firmware/esp32_ws_ultrasonic/esp32_ws_ultrasonic.ino`


Panduan langkah-demi-langkah berbahasa Indonesia tersedia di:

- `example_firmware/PANDUAN_ESP32_WS_ULTRASONIC_ID.md`

### 1) Konfigurasi SSID / Password Wi‑Fi

Edit bagian berikut di sketch:

```cpp
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
```

### 2) Set IP laptop untuk WebSocket server

Pastikan IP laptop sesuai jaringan lokal, lalu edit:

```cpp
const char* WS_HOST = "192.168.1.100";
const uint16_t WS_PORT = 8765;
```

Server URL lengkap yang dituju ESP32: `ws://<IP_LAPTOP>:8765`

### 3) Pin ultrasonic + LED

Default pin mapping di sketch:

- `PIN_TRIG = GPIO5`
- `PIN_ECHO = GPIO18`
- `PIN_LED = GPIO2`

Silakan ubah jika board Anda berbeda.

### 4) Format payload kirim / terima

**Payload sensor (ESP32 -> server/web):**

```json
{"type":"ultrasonic","cm":123.4,"inch":48.6,"ts":1710000000}
```

**Payload command LED (web -> server -> ESP32):**

```json
{"type":"led","state":"on"}
{"type":"led","state":"off"}
```

### 5) Dependensi library Arduino

Install dari Arduino Library Manager:

- `ArduinoJson`
- `WebSockets` (WebSocketsClient)

### 6) Jalankan contoh WebSocket server Python

Masuk ke folder server:

```bash
cd example_websocket_server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

Server listen di `ws://0.0.0.0:8765`.
