#include <WiFiManager.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SPI.h>
#include <MFRC522.h>

/*
===========================================================
PumpPilot ESP32 Firmware
ESP32 + RC522 RFID + LCD 16x2 I2C + LEDs + Relay
===========================================================

WIRING
------

RC522 (SPI)
RC522 SDA (SS)  -> GPIO5
RC522 SCK       -> GPIO18
RC522 MOSI      -> GPIO23
RC522 MISO      -> GPIO19
RC522 RST       -> GPIO13
RC522 VCC       -> 3.3V
RC522 GND       -> GND

LED
Motor LED        -> GPIO16
Load LED         -> GPIO17
Device LED       -> GPIO4
Internet OK LED  -> GPIO2
Internet FAIL    -> GPIO15

LCD 16x2 (I2C)
SDA -> GPIO21
SCL -> GPIO22
VCC -> 5V
GND -> GND

INPUT
Load Pin         -> GPIO32
Device Ready     -> GPIO33

OUTPUT
Motor Relay      -> GPIO25
===========================================================
*/

// =========================
// DEBUG
// =========================
#define DEBUG 1

#if DEBUG
  #define LOG(x) Serial.print(x)
  #define LOGLN(x) Serial.println(x)
#else
  #define LOG(x)
  #define LOGLN(x)
#endif

// =========================
// PIN CONFIG
// =========================
#define MOTOR_PIN   25
#define LOAD_PIN    32
#define DEVICE_PIN  33

// RFID
#define RFID_SS_PIN   5
#define RFID_RST_PIN  13
#define RFID_SCK_PIN  18
#define RFID_MISO_PIN 19
#define RFID_MOSI_PIN 23

// LED
#define LED_MOTOR     16
#define LED_LOAD      17
#define LED_DEVICE    4
#define LED_NET_OK    2
#define LED_NET_FAIL  15

// =========================
// CONFIG
// =========================
#define POLL_INTERVAL      5000UL
#define FAIL_TIMEOUT       15000UL
#define RFID_DEBOUNCE_MS   3000UL
#define HTTP_TIMEOUT_MS    5000UL

#define LOAD_ACTIVE_LOW         1
#define DEVICE_READY_ACTIVE_LOW 0

const char* API_URL = "https://pms.mechatronicslab.net/api/esp32/poll";
const char* ADMIN_ID = "69a40837b2e2acccfbe8c476";
const char* DEVICE_KEY = "spm_9Kx2vQ7mLp4Tn8YzR1cH6uBw3Fd0Js5";

// =========================
// GLOBALS
// =========================
LiquidCrystal_I2C lcd(0x27, 16, 2);
MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);

unsigned long lastPoll = 0;
unsigned long lastRFID = 0;
unsigned long lastSuccess = 0;
unsigned long lastNetLog = 0;

String lastLine1 = "";
String lastLine2 = "";

// =========================
// HELPERS
// =========================
void lcdMessage(const String& line1, const String& line2 = "") {
  String l1 = line1.substring(0, 16);
  String l2 = line2.substring(0, 16);

  if (l1 == lastLine1 && l2 == lastLine2) return;

  lastLine1 = l1;
  lastLine2 = l2;

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(l1);
  lcd.setCursor(0, 1);
  lcd.print(l2);
}

void setMotor(bool on) {
  digitalWrite(MOTOR_PIN, on ? HIGH : LOW);
  digitalWrite(LED_MOTOR, on ? HIGH : LOW);

  LOG("[MOTOR] ");
  LOGLN(on ? "ON" : "OFF");
}

bool readLoad() {
  int raw = digitalRead(LOAD_PIN);
  bool state = LOAD_ACTIVE_LOW ? (raw == LOW) : (raw == HIGH);
  return state;
}

bool readDevice() {
  int raw = digitalRead(DEVICE_PIN);
  bool state = DEVICE_READY_ACTIVE_LOW ? (raw == LOW) : (raw == HIGH);
  return state;
}

void updateInputLEDs(bool ls, bool dev) {
  digitalWrite(LED_LOAD, ls ? HIGH : LOW);
  digitalWrite(LED_DEVICE, dev ? HIGH : LOW);
}

void updateNetLED() {
  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_NET_OK, HIGH);
    digitalWrite(LED_NET_FAIL, LOW);

    if (millis() - lastNetLog > 5000) {
      LOGLN("[NET] Connected");
      lastNetLog = millis();
    }
  } else {
    digitalWrite(LED_NET_OK, LOW);

    static bool blinkState = false;
    static unsigned long lastBlink = 0;
    if (millis() - lastBlink > 500) {
      lastBlink = millis();
      blinkState = !blinkState;
      digitalWrite(LED_NET_FAIL, blinkState ? HIGH : LOW);
    }

    if (millis() - lastNetLog > 5000) {
      LOGLN("[NET] Disconnected");
      lastNetLog = millis();
    }
  }
}

String readRFID() {
  if (!rfid.PICC_IsNewCardPresent()) return "";
  if (!rfid.PICC_ReadCardSerial()) return "";

  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }

  uid.toUpperCase();

  LOGLN("===== RFID DETECTED =====");
  LOG("UID: ");
  LOGLN(uid);

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  return uid;
}

void pollServer(const String& uid = "") {
  if (WiFi.status() != WL_CONNECTED) {
    LOGLN("[HTTP] Skipped: WiFi not connected");
    return;
  }

  bool ls = readLoad();
  bool dev = readDevice();
  updateInputLEDs(ls, dev);

  String url = String(API_URL) +
               "?adminId=" + ADMIN_ID +
               "&ls=" + (ls ? "1" : "0") +
               "&dev=" + (dev ? "1" : "0");

  if (uid.length()) {
    url += "&uid=" + uid;
  }

  LOG("[HTTP] URL: ");
  LOGLN(url);

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);

  if (!http.begin(client, url)) {
    LOGLN("[HTTP] begin() failed");
    return;
  }

  http.addHeader("x-device-key", DEVICE_KEY);

  int code = http.GET();

  LOG("[HTTP] Code: ");
  LOGLN(code);

  if (code == HTTP_CODE_OK) {
    String payload = http.getString();

    LOGLN("[HTTP] Response:");
    LOGLN(payload);

    StaticJsonDocument<512> doc;
    DeserializationError err = deserializeJson(doc, payload);

    if (err) {
      LOG("[JSON] Error: ");
      LOGLN(err.c_str());
      http.end();
      return;
    }

    const char* status = doc["motorStatus"] | "OFF";
    bool backendLS = doc["loadShedding"] | false;
    bool backendDev = doc["deviceReady"] | false;
    const char* cardMessage = doc["cardModeMessage"] | "";

    LOG("[STATE] motorStatus: ");
    LOGLN(status);
    LOG("[STATE] backendLS: ");
    LOGLN(backendLS ? "true" : "false");
    LOG("[STATE] backendDev: ");
    LOGLN(backendDev ? "true" : "false");

    bool turnOn =
      (strcmp(status, "RUNNING") == 0) &&
      !backendLS &&
      !ls &&
      dev &&
      backendDev;

    LOG("[DECISION] statusRUNNING=");
    LOG((strcmp(status, "RUNNING") == 0) ? "1" : "0");
    LOG(" backendLS=");
    LOG(backendLS ? "1" : "0");
    LOG(" localLS=");
    LOG(ls ? "1" : "0");
    LOG(" dev=");
    LOG(dev ? "1" : "0");
    LOG(" backendDev=");
    LOGLN(backendDev ? "1" : "0");

    setMotor(turnOn);
    lastSuccess = millis();

    String line1 = "M:";
    line1 += turnOn ? "ON " : "OFF";
    line1 += " L:";
    line1 += ls ? "Y" : "N";
    line1 += " D:";
    line1 += dev ? "Y" : "N";

    String line2;
    if (uid.length()) {
      line2 = String(cardMessage);
      if (line2.length() == 0) line2 = "CARD OK";
    } else {
      line2 = backendLS ? "BACKEND LS" : "NET OK";
    }

    lcdMessage(line1, line2);
  } else {
    LOGLN("[HTTP] Request failed");
  }

  http.end();
}

void failSafe() {
  if (millis() - lastSuccess > FAIL_TIMEOUT) {
    LOGLN("[FAILSAFE] No successful response, motor OFF");
    setMotor(false);
  }
}

// =========================
// SETUP
// =========================
void setup() {
  Serial.begin(115200);
  delay(1000);

  LOGLN("");
  LOGLN("=================================");
  LOGLN("PumpPilot ESP32 Booting...");
  LOGLN("=================================");

  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(LOAD_PIN, INPUT_PULLUP);
  pinMode(DEVICE_PIN, INPUT_PULLUP);

  pinMode(LED_MOTOR, OUTPUT);
  pinMode(LED_LOAD, OUTPUT);
  pinMode(LED_DEVICE, OUTPUT);
  pinMode(LED_NET_OK, OUTPUT);
  pinMode(LED_NET_FAIL, OUTPUT);

  digitalWrite(MOTOR_PIN, LOW);
  digitalWrite(LED_MOTOR, LOW);
  digitalWrite(LED_LOAD, LOW);
  digitalWrite(LED_DEVICE, LOW);
  digitalWrite(LED_NET_OK, LOW);
  digitalWrite(LED_NET_FAIL, LOW);

  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  lcdMessage("PumpPilot", "Booting...");

  LOGLN("[LCD] Initialized");

  WiFiManager wm;
  lcdMessage("WiFi Config", "Starting...");
  LOGLN("[WIFI] Starting WiFiManager portal if needed");
  wm.autoConnect("ESP32-Setup");

  LOGLN("[WIFI] Connected");
  LOG("[WIFI] IP: ");
  LOGLN(WiFi.localIP());

  lcdMessage("WiFi Connected", WiFi.localIP().toString());

  SPI.begin(RFID_SCK_PIN, RFID_MISO_PIN, RFID_MOSI_PIN, RFID_SS_PIN);
  rfid.PCD_Init();

  LOGLN("[RFID] RC522 Initialized");

  bool ls = readLoad();
  bool dev = readDevice();
  updateInputLEDs(ls, dev);

  LOG("[BOOT] Load State: ");
  LOGLN(ls ? "ACTIVE" : "NORMAL");
  LOG("[BOOT] Device Ready: ");
  LOGLN(dev ? "YES" : "NO");

  lastSuccess = millis();
}

// =========================
// LOOP
// =========================
void loop() {
  updateNetLED();

  bool ls = readLoad();
  bool dev = readDevice();
  updateInputLEDs(ls, dev);

  String uid = readRFID();
  if (uid.length() && millis() - lastRFID > RFID_DEBOUNCE_MS) {
    lastRFID = millis();
    LOG("[RFID] Sending UID to server: ");
    LOGLN(uid);
    lcdMessage("RFID", uid.substring(0, 16));
    pollServer(uid);
  }

  if (millis() - lastPoll > POLL_INTERVAL) {
    lastPoll = millis();
    LOGLN("[LOOP] Periodic poll");
    pollServer();
  }

  failSafe();
}
