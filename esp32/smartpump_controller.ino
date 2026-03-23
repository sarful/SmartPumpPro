#include <WiFi.h>
#include <WiFiClient.h>
#include <WiFiManager.h> // https://github.com/tzapu/WiFiManager
#include <HTTPClient.h>
#include <ArduinoJson.h>

#define MOTOR_PIN 5
#define LOAD_PIN 4        // Digital input to read load-shedding signal (HIGH = shedding)
#define DEVICE_PIN 18     // HIGH = device ready
#define POLL_INTERVAL_MS 5000
#define HTTP_TIMEOUT_MS 4000

const char* ADMIN_ID      = "PUT_ADMIN_ID_HERE";
const char* API_HOST      = "http://192.168.1.10:3000";
const char* DEVICE_KEY    = "PUT_YOUR_ESP32_DEVICE_SECRET_HERE";

unsigned long lastPoll = 0;

WiFiManager wifiManager;

void setMotor(bool on) {
  digitalWrite(MOTOR_PIN, on ? HIGH : LOW);
  Serial.printf("[MOTOR] %s -> GPIO5 %s\n", on ? "ON" : "OFF", on ? "HIGH" : "LOW");
}

void pollServer() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (WiFi.status() != WL_CONNECTED) return;

  bool localLoadShedding = digitalRead(LOAD_PIN) == HIGH;
  bool localDeviceReady = digitalRead(DEVICE_PIN) == HIGH;

  String pollUrl = String(API_HOST) + "/api/esp32/poll?adminId=" + ADMIN_ID +
                   "&ls=" + (localLoadShedding ? "1" : "0") +
                   "&dev=" + (localDeviceReady ? "1" : "0");

  HTTPClient http;
  WiFiClient client;

  http.setTimeout(HTTP_TIMEOUT_MS);
  http.begin(client, pollUrl);
  http.addHeader("x-device-key", DEVICE_KEY);

  int httpCode = http.GET();
  if (httpCode != HTTP_CODE_OK) {
    Serial.printf("[HTTP] GET failed, code: %d\n", httpCode);
    http.end();
    return;
  }

  String payload = http.getString();
  http.end();

  StaticJsonDocument<256> doc;
  auto err = deserializeJson(doc, payload);
  if (err) {
    Serial.printf("[JSON] Parse failed: %s\n", err.c_str());
    return;
  }

  const char* motorStatus = doc["motorStatus"] | "OFF";
  bool loadShedding = doc["loadShedding"] | false;
  int remaining = doc["remainingMinutes"] | 0;

  Serial.printf("[POLL] status=%s remaining=%d loadShedding=%s localLS=%s dev=%s\n",
                motorStatus, remaining,
                loadShedding ? "true" : "false",
                localLoadShedding ? "true" : "false",
                localDeviceReady ? "true" : "false");

  bool turnOn =
    strcmp(motorStatus, "RUNNING") == 0 &&
    !loadShedding &&
    !localLoadShedding &&
    localDeviceReady;
  setMotor(turnOn);
}

void setup() {
  Serial.begin(115200);
  pinMode(MOTOR_PIN, OUTPUT);
  digitalWrite(MOTOR_PIN, LOW);
  pinMode(LOAD_PIN, INPUT_PULLUP);
  pinMode(DEVICE_PIN, INPUT_PULLUP);

  // WiFiManager portal auto-connect
  wifiManager.setHostname("PumpPilot");
  wifiManager.setTimeout(120); // portal stays 2 minutes if needed
  if (!wifiManager.autoConnect("PumpPilot-Setup")) {
    Serial.println("WiFi connect failed, rebooting...");
    delay(3000);
    ESP.restart();
  }
  Serial.printf("WiFi connected, IP: %s\n", WiFi.localIP().toString().c_str());
}

void loop() {
  unsigned long now = millis();
  if (now - lastPoll >= POLL_INTERVAL_MS) {
    lastPoll = now;
    pollServer();
  }
  delay(10); // yield
}
