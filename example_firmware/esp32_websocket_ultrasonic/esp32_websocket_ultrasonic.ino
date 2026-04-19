#include <WiFi.h>
#include <WebSocketsClient.h>

// ===== WiFi config =====
const char* WIFI_SSID = "GANTI_SSID";
const char* WIFI_PASSWORD = "GANTI_PASSWORD";

// ===== Laptop/local websocket server config =====
const char* WS_HOST = "192.168.1.10"; // IP laptop Anda
const uint16_t WS_PORT = 8765;
const char* WS_PATH = "/";

// ===== Ultrasonic pins (HC-SR04) =====
constexpr int TRIG_PIN = 5;
constexpr int ECHO_PIN = 18;

// ===== LED pin =====
constexpr int LED_PIN = 2; // LED built-in ESP32 umumnya GPIO2

WebSocketsClient webSocket;
unsigned long lastSampleMs = 0;
bool sentHeader = false;

float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long durationUs = pulseIn(ECHO_PIN, HIGH, 30000); // timeout 30ms
  if (durationUs <= 0) {
    return -1.0f;
  }

  return durationUs * 0.0343f / 2.0f;
}

void handleTextMessage(const String& message) {
  String cmd = message;
  cmd.trim();
  cmd.toUpperCase();

  if (cmd == "LED_ON") {
    digitalWrite(LED_PIN, HIGH);
    webSocket.sendTXT("ACK LED_ON\n");
  } else if (cmd == "LED_OFF") {
    digitalWrite(LED_PIN, LOW);
    webSocket.sendTXT("ACK LED_OFF\n");
  }
}

void onWebSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      sentHeader = false;
      break;
    case WStype_TEXT: {
      String msg = String((char*)payload).substring(0, length);
      handleTextMessage(msg);
      break;
    }
    default:
      break;
  }
}

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  Serial.begin(115200);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }

  webSocket.begin(WS_HOST, WS_PORT, WS_PATH);
  webSocket.onEvent(onWebSocketEvent);
  webSocket.setReconnectInterval(2000);
}

void loop() {
  webSocket.loop();

  const unsigned long now = millis();
  if (now - lastSampleMs < 200) {
    return;
  }
  lastSampleMs = now;

  if (webSocket.isConnected()) {
    if (!sentHeader) {
      webSocket.sendTXT("# distance_cm distance_in\n");
      sentHeader = true;
    }

    float distanceCm = readDistanceCm();
    if (distanceCm > 0) {
      float distanceIn = distanceCm / 2.54f;
      String line = String(distanceCm, 2) + " " + String(distanceIn, 2) + "\n";
      webSocket.sendTXT(line);
    }
  }
}
