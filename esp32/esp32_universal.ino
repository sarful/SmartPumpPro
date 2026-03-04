// ======================================
// PumpPilot - Universal ESP32 Client
// - Only adminId required (userId optional)
// - Sends local load-shedding sensing (ls=0/1)
// - Respects server loadShedding and motorStatus
// - Minimal dependencies (WiFiManager + ArduinoJson)
// ======================================

#include <WiFiManager.h>
#include <WiFiClient.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ===== PIN CONFIG =====
#define MOTOR_PIN 2       // Change to your relay GPIO (2 = onboard LED)
#define LOAD_PIN  4       // HIGH = local load shedding; keep if you have sensor
#define DEVICE_PIN 5      // HIGH = device ready

// ===== TIMING =====
#define POLL_INTERVAL_MS 5000
#define HTTP_TIMEOUT_MS 4000

// ===== YOUR CONFIG =====
const char* ADMIN_ID = "PUT_YOUR_ADMIN_ID_HERE";       // e.g. 69a40837b2e2acccfbe8c476
const char* API_HOST = "http://192.168.2.101:3000";    // Use server LAN IP for ESP32, not localhost

// ===== GLOBAL =====
unsigned long lastPoll = 0;

// -------- Motor Control --------
void setMotor(bool on) {
  digitalWrite(MOTOR_PIN, on ? HIGH : LOW);
  Serial.printf("[MOTOR] %s\n", on ? "ON" : "OFF");
}

// -------- WiFi Helper --------
void ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.println("[WiFi] Reconnecting...");
  WiFi.reconnect();
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 8000) {
    delay(200);
    Serial.print(".");
  }
  Serial.println();
}

// -------- Poll Server --------
void pollServer() {
  if (WiFi.status() != WL_CONNECTED) return;

  bool localLS = digitalRead(LOAD_PIN) == HIGH;
  bool localDeviceReady = digitalRead(DEVICE_PIN) == HIGH;

  WiFiClient client;
  HTTPClient http;

  String url = String(API_HOST) + "/api/esp32/poll?adminId=" + ADMIN_ID +
               "&ls=" + (localLS ? "1" : "0") +
               "&dev=" + (localDeviceReady ? "1" : "0");

  http.setTimeout(HTTP_TIMEOUT_MS);
  if (!http.begin(client, url)) {
    Serial.println("[HTTP] begin failed");
    return;
  }

  int code = http.GET();
  if (code != 200) {
    Serial.printf("[HTTP] code=%d\n", code);
    http.end();
    return;
  }

  String payload = http.getString();
  http.end();

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, payload);
  if (err) {
    Serial.println("[JSON] parse error");
    return;
  }

  const char* status       = doc["motorStatus"] | "OFF";
  bool loadSheddingServer  = doc["loadShedding"] | false;
  const char* adminName    = doc["adminName"] | "unknown";

  Serial.printf("[POLL] admin=%s status=%s lsServer=%d lsLocal=%d dev=%d\n",
                adminName, status, loadSheddingServer, localLS, localDeviceReady);

  bool turnOn = strcmp(status, "RUNNING") == 0 &&
                !loadSheddingServer &&
                !localLS &&
                localDeviceReady;
  setMotor(turnOn);
}

// -------- Setup --------
void setup() {
  Serial.begin(115200);
  pinMode(MOTOR_PIN, OUTPUT);
  digitalWrite(MOTOR_PIN, LOW);
  pinMode(LOAD_PIN, INPUT_PULLUP);
  pinMode(DEVICE_PIN, INPUT_PULLUP);

  Serial.println("\n=== PumpPilot (Universal) ===");

  WiFiManager wm;
  wm.setConfigPortalTimeout(180);
  if (!wm.autoConnect("PumpPilot-Setup")) {
    Serial.println("WiFi failed, rebooting...");
    delay(3000);
    ESP.restart();
  }
  Serial.print("WiFi IP: ");
  Serial.println(WiFi.localIP());
}

// -------- Loop --------
void loop() {
  ensureWiFi();

  unsigned long now = millis();
  if (now - lastPoll >= POLL_INTERVAL_MS) {
    lastPoll = now;
    pollServer();
  }

  delay(10);
}
