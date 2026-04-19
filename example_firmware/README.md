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
## websocket_ultrasonic/websocket_ultrasonic.ino + websocket_ultrasonic/server.py

Contoh lengkap komunikasi **ESP32 ↔ WebSocket server Python** untuk:
- Mengirim data sensor ultrasonic dalam **cm** dan **inch**.
- Menerima perintah untuk **LED ON/OFF** dari server.

### Arsitektur singkat

1. ESP32 membaca sensor HC-SR04 (TRIG + ECHO).
2. ESP32 menghitung jarak cm dan inch.
3. ESP32 kirim data JSON ke server Python lewat WebSocket.
4. Server dapat kirim command `on` / `off` untuk mengontrol LED ESP32.

### Format pesan

ESP32 ke server:

```json
{"type":"sensor","cm":123.40,"inch":48.58,"led":true}
```

Server ke ESP32:

```json
{"type":"command","led":"on"}
{"type":"command","led":"off"}
```

### Menjalankan server Python

```bash
cd example_firmware/websocket_ultrasonic
python3 -m venv .venv
source .venv/bin/activate
pip install websockets
python server.py --host 0.0.0.0 --port 8765
```

> `ws://10.54.93.165:8765` adalah endpoint WebSocket (bukan halaman web), jadi jika dibuka langsung di browser biasanya tidak menampilkan UI.

Perintah di terminal server:
- `on`  → LED ON di semua client
- `off` → LED OFF di semua client
- `list` → lihat jumlah client aktif
- `help` → bantuan
- `exit` → keluar server

### Menjalankan website dashboard (opsional)

Jika ingin kontrol/monitor dari browser, gunakan `dashboard.html`:

```bash
cd example_firmware/websocket_ultrasonic
python3 -m http.server 8080
```

Lalu buka:

```text
http://localhost:8080/dashboard.html
```

Jika browser berjalan di device lain, ganti `localhost` dengan IP laptop (contoh `http://10.54.93.165:8080/dashboard.html`).

Di dashboard:
1. Isi URL WebSocket (contoh `ws://10.54.93.165:8765`).
2. Klik **Connect**.
3. Klik **LED ON** / **LED OFF** untuk mengirim command JSON.

### Upload sketch ESP32

1. Install library **WebSockets** (Markus Sattler) di Arduino IDE.
2. Buka `websocket_ultrasonic.ino`.
3. Ubah `WIFI_SSID`, `WIFI_PASSWORD`, dan `WS_HOST` sesuai jaringan Anda.
4. Upload ke ESP32.
5. Buka Serial Monitor (115200 baud) untuk melihat log kirim/terima data.

### Catatan wiring HC-SR04

Contoh default di sketch:
- TRIG → GPIO 5
- ECHO → GPIO 18
- VCC → 5V
- GND → GND

> Catatan: ECHO HC-SR04 biasanya 5V. Gunakan level shifter atau pembagi tegangan ke 3.3V agar aman untuk GPIO ESP32.
