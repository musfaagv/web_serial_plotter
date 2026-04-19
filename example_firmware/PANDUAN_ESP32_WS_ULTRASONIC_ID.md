# Panduan Lengkap: ESP32 + Ultrasonic + WebSocket + Web UI

Dokumen ini menjelaskan alur end-to-end untuk:

1. ESP32 membaca sensor ultrasonic HC-SR04,
2. ESP32 mengirim data lewat WebSocket,
3. WebSocket server me-relay data,
4. Website menerima data sensor dan mengirim perintah (contoh: LED on/off).

---

## 1. Arsitektur sistem (gambaran besar)

Alur komunikasi:

```text
HC-SR04 -> ESP32 -> WebSocket Server (Python) -> Website (browser)
                      ^                              |
                      |------------------------------|
                     (perintah JSON dari web, mis. LED)
```

- ESP32 membaca jarak (cm/inch) dari HC-SR04.
- ESP32 mengirim payload JSON `type: "ultrasonic"` ke server.
- Server Python memvalidasi payload lalu broadcast ke klien lain.
- Website terhubung ke server yang sama, menerima payload dan mem-plot data.
- Website juga bisa mengirim perintah JSON `type: "led"`, lalu server relay ke ESP32.

---

## 2. Prasyarat

### Hardware
- 1x board ESP32
- 1x sensor HC-SR04
- Kabel jumper
- (Opsional) LED onboard (umumnya GPIO2 pada banyak board ESP32)

### Software
- Arduino IDE + board package ESP32
- Python 3.10+ (disarankan)
- Node.js 20.19+ atau 22.12+
- Browser Chromium (Chrome/Edge/Opera)

### Library Arduino
Install via **Library Manager**:
- `ArduinoJson`
- `WebSockets` (untuk `WebSocketsClient`)

---

## 3. Wiring HC-SR04 ke ESP32

Default sketch (`esp32_ws_ultrasonic.ino`) menggunakan:

- `TRIG -> GPIO5`
- `ECHO -> GPIO18`
- `LED -> GPIO2`

Catatan penting:
- Banyak HC-SR04 memberi sinyal `ECHO` 5V. Pastikan board/sensor Anda aman untuk GPIO ESP32 3.3V.
- Jika perlu, gunakan level shifter atau resistor divider pada jalur ECHO.

---

## 4. Konfigurasi firmware ESP32

Buka file:

`example_firmware/esp32_ws_ultrasonic/esp32_ws_ultrasonic.ino`

Lalu ubah bagian berikut:

```cpp
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* WS_HOST = "192.168.1.100";
const uint16_t WS_PORT = 8765;
const char* WS_PATH = "/";
```

Penjelasan:
- `WIFI_SSID`, `WIFI_PASSWORD`: jaringan Wi‑Fi yang sama dengan laptop/server.
- `WS_HOST`: IP laptop yang menjalankan `server.py`.
- `WS_PORT`: default `8765`.
- `WS_PATH`: default root `/`.

Laju kirim sensor diatur oleh:

```cpp
constexpr uint32_t SENSOR_SEND_INTERVAL_MS = 1000;
```

Jika ingin update lebih cepat, turunkan nilainya (mis. 200 ms).

---

## 5. Upload dan verifikasi firmware

1. Pilih board ESP32 dan port COM di Arduino IDE.
2. Upload sketch.
3. Buka Serial Monitor, baud `115200`.
4. Pastikan log menunjukkan:
   - proses konek Wi‑Fi,
   - status WebSocket connected,
   - payload `Sent: {"type":"ultrasonic",...}` berkala.

Jika belum terkoneksi WebSocket:
- cek IP `WS_HOST`,
- pastikan port `8765` tidak diblokir firewall,
- pastikan server Python sudah berjalan.

---

## 6. Jalankan WebSocket server (Python)

Dari root repo:

```bash
cd example_websocket_server
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python server.py
```

Server listen di:

`ws://0.0.0.0:8765`

Artinya dapat diakses dari perangkat lain di jaringan lokal via:

`ws://<IP_LAPTOP>:8765`

Contoh jika IP laptop `192.168.1.100`, URL jadi:

`ws://192.168.1.100:8765`

---

## 7. Jalankan website (Web Serial Plotter) untuk mode WebSocket

Dari root repo:

```bash
npm install
npm run dev
```

Buka URL lokal Vite (biasanya `http://localhost:5173`).

Kemudian:
1. Klik **Connect**.
2. Pilih mode **WebSocket**.
3. Masukkan URL server, contoh: `ws://192.168.1.100:8765`.
4. Klik connect.

Website akan menerima payload JSON sensor dari server.

---

## 8. Format payload yang dipakai

### Payload sensor (ESP32 -> server -> website)

```json
{"type":"ultrasonic","cm":123.4,"inch":48.6,"ts":1710000000}
```

Field penting:
- `type`: harus `ultrasonic`
- `cm`: angka jarak sentimeter
- `inch`: angka jarak inci
- `ts`: timestamp unix (opsional saat kirim dari device, tapi disarankan)

### Payload command LED (website -> server -> ESP32)

```json
{"type":"led","state":"on"}
{"type":"led","state":"off"}
```

Nilai `state` valid: `on` atau `off`.

---

## 9. Cara kirim perintah dari website ke ESP32

Setelah website sudah konek WebSocket:

1. Buka tab **Console** pada aplikasi.
2. Ketik JSON command, contoh:

```json
{"type":"led","state":"on"}
```

3. Kirim.
4. Server akan validasi payload dan broadcast ke klien lain.
5. ESP32 menerima command lalu menyalakan/mematikan LED.

Tips:
- Pastikan JSON valid (pakai tanda kutip ganda `"`).
- Jika format salah, server akan mengembalikan payload error (`type: "error"`).

---

## 10. Debugging cepat (checklist)

### ESP32 tidak connect Wi‑Fi
- SSID/password salah.
- Sinyal Wi‑Fi lemah.
- Board belum reboot setelah ganti kredensial.

### ESP32 tidak connect WebSocket
- `WS_HOST` salah (IP laptop berubah).
- Server Python belum jalan.
- Port/firewall memblokir `8765`.
- ESP32 dan laptop beda jaringan/subnet.

### Website tidak dapat data
- Website terkoneksi ke URL yang salah.
- Data JSON tidak valid atau field tidak sesuai (`type/cm/inch`).
- Server menerima data tapi tidak broadcast karena hanya ada satu klien.

### Perintah LED tidak jalan
- JSON command salah (`state` selain `on/off`).
- Mapping `PIN_LED` tidak sesuai board.
- LED onboard active-low pada board tertentu (jika terbalik, balik logika HIGH/LOW).

---

## 11. Uji end-to-end yang direkomendasikan

1. Jalankan server Python.
2. Nyalakan ESP32, lihat log `WebSocket connected`.
3. Buka website, connect ke `ws://<IP_LAPTOP>:8765`.
4. Pastikan data ultrasonic muncul kontinu di chart/console.
5. Kirim command `{"type":"led","state":"on"}` dari console website.
6. Verifikasi LED ESP32 menyala.
7. Kirim `{"type":"led","state":"off"}`.
8. Verifikasi LED mati.

Jika langkah 4–8 berhasil, integrasi device-server-web sudah benar.

---

## 12. Catatan keamanan dan produksi

Contoh ini ditujukan untuk jaringan lokal/dev.
Untuk produksi pertimbangkan:
- autentikasi klien,
- TLS (`wss://`),
- rate limiting,
- validasi payload lebih ketat,
- isolasi jaringan IoT.

