/*
  ESP32 Ultrasonic + LED WebSocket Client

  Kebutuhan library:
  - WebSockets by Markus Sattler (WebSocketsClient.h)

  Protokol:
  - Kirim JSON ke server:
    {"type":"sensor","cm":123.4,"inch":48.6,"led":true}
  - Terima JSON command dari server:
    {"type":"command","led":"on"}
    {"type":"command","led":"off"}
*/

#include <WiFi.h>
#include <WebSocketsClient.h>

// ======== Ganti sesuai jaringan Anda ========
const char* WIFI_SSID = "GANTI_SSID";
const char* WIFI_PASSWORD = "GANTI_PASSWORD";

// Jalankan python server lalu isi IP/port server di sini
const char* WS_HOST = "192.168.1.10";
const uint16_t WS_PORT = 8765;
const char* WS_PATH = "/";

// ======== Pin setup ========
const int TRIG_PIN = 5;
const int ECHO_PIN = 18;
const int LED_PIN = 2;      // LED built-in banyak board ESP32

WebSocketsClient webSocket;
unsigned long lastSendMs = 0;
const unsigned long SEND_INTERVAL_MS = 500;

float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // timeout 30ms (~5m)
  if (duration <= 0) {
    return -1.0f;
  }

  // Kecepatan suara: 0.0343 cm/us, pulang-pergi dibagi 2
  return (duration * 0.0343f) / 2.0f;
}

float cmToInch(float cm) {
  if (cm < 0) return -1.0f;
  return cm / 2.54f;
}

void sendSensorData() {
  float cm = readDistanceCm();
  float inch = cmToInch(cm);
  bool ledState = digitalRead(LED_PIN) == HIGH;

  char msg[128];
  snprintf(msg, sizeof(msg),
           "{\"type\":\"sensor\",\"cm\":%.2f,\"inch\":%.2f,\"led\":%s}",
           cm, inch, ledState ? "true" : "false");

  webSocket.sendTXT(msg);
  Serial.println(msg);
}

void handleCommand(const String& payload) {
  // Parsing sederhana tanpa ArduinoJson
  String lower = payload;
  lower.toLowerCase();

  if (lower.indexOf("\"led\":\"on\"") >= 0) {
    digitalWrite(LED_PIN, HIGH);
    Serial.println("[CMD] LED ON");
  } else if (lower.indexOf("\"led\":\"off\"") >= 0) {
    digitalWrite(LED_PIN, LOW);
    Serial.println("[CMD] LED OFF");
  }
}

void onWebSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected");
      break;

    case WStype_CONNECTED:
      Serial.printf("[WS] Connected to: %s\n", payload);
      break;

    case WStype_TEXT: {
      String text = String((char*)payload);
      Serial.printf("[WS RX] %s\n", text.c_str());
      handleCommand(text);
      break;
    }

    case WStype_ERROR:
      Serial.println("[WS] Error");
      break;

    default:
      break;
  }
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Menghubungkan WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi terhubung");
  Serial.print("IP ESP32: ");
  Serial.println(WiFi.localIP());
}

void setup() {
  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  connectWiFi();

  webSocket.begin(WS_HOST, WS_PORT, WS_PATH);
  webSocket.onEvent(onWebSocketEvent);
  webSocket.setReconnectInterval(3000);
}

void loop() {
  webSocket.loop();

  unsigned long now = millis();
  if (now - lastSendMs >= SEND_INTERVAL_MS) {
    lastSendMs = now;
    if (WiFi.status() == WL_CONNECTED) {
      sendSensorData();
    }
  }
}
