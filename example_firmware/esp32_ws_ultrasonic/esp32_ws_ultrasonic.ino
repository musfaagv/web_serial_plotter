/*
  ESP32 WebSocket + HC-SR04 example

  Payload sent periodically:
    {"type":"ultrasonic","cm":123.4,"inch":48.6,"ts":1710000000}

  Command expected from WebSocket server:
    {"type":"led","state":"on"}
    {"type":"led","state":"off"}
*/

#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// =========================
// Wi-Fi and Server Settings
// =========================
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* WS_HOST = "192.168.1.100";  // IP laptop running server.py
const uint16_t WS_PORT = 8765;
const char* WS_PATH = "/";

// =========================
// Pin Configuration
// =========================
constexpr uint8_t PIN_TRIG = 5;
constexpr uint8_t PIN_ECHO = 18;
constexpr uint8_t PIN_LED = 2;  // many ESP32 boards use GPIO2 built-in LED

constexpr uint32_t SENSOR_SEND_INTERVAL_MS = 1000;
constexpr uint32_t WIFI_RETRY_INTERVAL_MS = 5000;

WebSocketsClient webSocket;
uint32_t lastSensorSentAt = 0;
uint32_t lastWifiRetryAt = 0;

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  Serial.printf("Connecting to Wi-Fi SSID: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

float readDistanceCm() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  // Timeout ~30ms (avoid long blocking when no echo)
  unsigned long duration = pulseIn(PIN_ECHO, HIGH, 30000);
  if (duration == 0) {
    return -1.0f;
  }

  // Speed of sound in air: 0.0343 cm/us, divide by 2 (go-return)
  return (duration * 0.0343f) / 2.0f;
}

void sendSensorPayload() {
  if (!webSocket.isConnected()) {
    return;
  }

  float cm = readDistanceCm();
  if (cm < 0) {
    Serial.println("Ultrasonic timeout, skip payload");
    return;
  }

  float inch = cm / 2.54f;

  StaticJsonDocument<192> doc;
  doc["type"] = "ultrasonic";
  doc["cm"] = cm;
  doc["inch"] = inch;
  doc["ts"] = static_cast<uint32_t>(time(nullptr));

  String payload;
  serializeJson(doc, payload);
  webSocket.sendTXT(payload);

  Serial.print("Sent: ");
  Serial.println(payload);
}

void handleLedCommand(const JsonDocument& doc) {
  if (!doc["state"].is<const char*>()) {
    Serial.println("Invalid LED command: missing state");
    return;
  }

  const String state = doc["state"].as<const char*>();
  if (state == "on") {
    digitalWrite(PIN_LED, HIGH);
    Serial.println("LED turned ON");
  } else if (state == "off") {
    digitalWrite(PIN_LED, LOW);
    Serial.println("LED turned OFF");
  } else {
    Serial.printf("Unknown LED state: %s\n", state.c_str());
  }
}

void onWebSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("WebSocket disconnected");
      break;

    case WStype_CONNECTED:
      Serial.printf("WebSocket connected to: %s\n", payload);
      break;

    case WStype_TEXT: {
      String text = String(reinterpret_cast<char*>(payload), length);
      Serial.print("Received: ");
      Serial.println(text);

      StaticJsonDocument<256> doc;
      DeserializationError err = deserializeJson(doc, text);
      if (err) {
        Serial.printf("Invalid JSON command: %s\n", err.c_str());
        return;
      }

      if (!doc["type"].is<const char*>()) {
        Serial.println("Command rejected: missing 'type'");
        return;
      }

      String commandType = doc["type"].as<const char*>();
      if (commandType == "led") {
        handleLedCommand(doc);
      } else {
        Serial.printf("Unknown command type: %s\n", commandType.c_str());
      }
      break;
    }

    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, LOW);

  connectWiFi();

  webSocket.begin(WS_HOST, WS_PORT, WS_PATH);
  webSocket.onEvent(onWebSocketEvent);
  webSocket.setReconnectInterval(3000);
}

void loop() {
  webSocket.loop();

  if (WiFi.status() != WL_CONNECTED) {
    uint32_t now = millis();
    if (now - lastWifiRetryAt >= WIFI_RETRY_INTERVAL_MS) {
      lastWifiRetryAt = now;
      connectWiFi();
    }
    delay(10);
    return;
  }

  uint32_t now = millis();
  if (now - lastSensorSentAt >= SENSOR_SEND_INTERVAL_MS) {
    lastSensorSentAt = now;
    sendSensorPayload();
  }
}
