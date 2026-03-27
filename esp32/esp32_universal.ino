// ======================================
// PumpPilot - Universal ESP32 Client
// - Only adminId required (userId optional)
// - Sends local load-shedding sensing (ls=0/1)
// - Respects server loadShedding and motorStatus
// - Minimal dependencies (WiFiManager + ArduinoJson)
// ======================================

#include <WiFiManager.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ===== PIN CONFIG =====
#define MOTOR_PIN 2       // Change to your relay GPIO (2 = onboard LED)
#define LOAD_PIN  4       // HIGH = local load shedding; keep if you have sensor
#define DEVICE_PIN 5      // HIGH = device ready

// ===== TIMING =====
#define POLL_INTERVAL_MS 5000
#define HTTP_TIMEOUT_MS 4000
#define FAILSAFE_TIMEOUT_MS 15000UL
#define LOAD_ACTIVE_LOW 1
#define DEVICE_READY_ACTIVE_LOW 1

// ===== YOUR CONFIG =====
const char* ADMIN_ID = "69a40837b2e2acccfbe8c476";
const char* API_URL = "https://pms.mechatronicslab.net/api/esp32/poll";
const char* DEVICE_KEY = "spm_9Kx2vQ7mLp4Tn8YzR1cH6uBw3Fd0Js5";

// ===== GLOBAL =====
unsigned long lastPoll = 0;
unsigned long lastSuccess = 0;

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

  bool localLS = LOAD_ACTIVE_LOW ? (digitalRead(LOAD_PIN) == LOW) : (digitalRead(LOAD_PIN) == HIGH);
  bool localDeviceReady = DEVICE_READY_ACTIVE_LOW ? (digitalRead(DEVICE_PIN) == LOW) : (digitalRead(DEVICE_PIN) == HIGH);

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String url = String(API_URL) + "?adminId=" + ADMIN_ID +
               "&ls=" + (localLS ? "1" : "0") +
               "&dev=" + (localDeviceReady ? "1" : "0");

  http.setTimeout(HTTP_TIMEOUT_MS);
  if (!http.begin(client, url)) {
    Serial.println("[HTTP] begin failed");
    return;
  }

  http.addHeader("x-device-key", DEVICE_KEY);

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
  bool deviceReadyServer   = doc["deviceReady"] | false;
  const char* adminName    = doc["adminName"] | "unknown";

  Serial.printf("[POLL] admin=%s status=%s lsServer=%d lsLocal=%d devLocal=%d devServer=%d\n",
                adminName, status, loadSheddingServer, localLS, localDeviceReady, deviceReadyServer);

  bool turnOn = strcmp(status, "RUNNING") == 0 &&
                !loadSheddingServer &&
                !localLS &&
                localDeviceReady &&
                deviceReadyServer;
  setMotor(turnOn);
  lastSuccess = millis();
}

void failSafe() {
  if (millis() - lastSuccess > FAILSAFE_TIMEOUT_MS) {
    setMotor(false);
  }
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

  failSafe();
  delay(10);
}
