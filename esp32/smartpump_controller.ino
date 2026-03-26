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
HARDWARE WIRING TABLE (ESP32 + RFID + LED + MOTOR)
===========================================================

WIFI
----
Uses WiFiManager (auto config portal)
SSID: ESP32-Setup

RFID RC522 (SPI)
----------------
RC522 SDA (SS)  -> GPIO5
RC522 SCK       -> GPIO18
RC522 MOSI      -> GPIO23
RC522 MISO      -> GPIO19
RC522 RST       -> GPIO13
RC522 VCC       -> 3.3V
RC522 GND       -> GND

LED CONNECTION (220 ohm resistor)
---------------------------------
Motor LED        -> GPIO16
Load LED         -> GPIO17
Device LED       -> GPIO4
Internet OK LED  -> GPIO2
Internet FAIL    -> GPIO15

LCD 16x2 (I2C)
--------------
SDA -> GPIO21
SCL -> GPIO22
VCC -> 5V
GND -> GND

INPUT SIGNALS
-------------
Load Pin         -> GPIO32
Device Ready     -> GPIO33

OUTPUT
------
Motor Relay      -> GPIO25

===========================================================
*/

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
#define POLL_INTERVAL 5000UL
#define FAIL_TIMEOUT  15000UL
#define RFID_DEBOUNCE_MS 3000UL
#define LOAD_ACTIVE_LOW 0
#define DEVICE_READY_ACTIVE_LOW 0

const char* API_URL = "https://pms.mechatronicslab.net/api/esp32/poll";
const char* ADMIN_ID = "PUT_ADMIN_ID_HERE";
const char* DEVICE_KEY = "PUT_YOUR_ESP32_DEVICE_SECRET_HERE";

// =========================
// GLOBAL
// =========================
LiquidCrystal_I2C lcd(0x27, 16, 2);
MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);

unsigned long lastPoll = 0;
unsigned long lastRFID = 0;
unsigned long lastSuccess = 0;

// =========================
// FUNCTIONS
// =========================
void setMotor(bool on) {
  digitalWrite(MOTOR_PIN, on ? HIGH : LOW);
  digitalWrite(LED_MOTOR, on ? HIGH : LOW);
}

bool readLoad() {
  int raw = digitalRead(LOAD_PIN);
  return LOAD_ACTIVE_LOW ? (raw == LOW) : (raw == HIGH);
}

bool readDevice() {
  int raw = digitalRead(DEVICE_PIN);
  return DEVICE_READY_ACTIVE_LOW ? (raw == LOW) : (raw == HIGH);
}

void lcdMessage(const String& line1, const String& line2 = "") {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1.substring(0, 16));
  lcd.setCursor(0, 1);
  lcd.print(line2.substring(0, 16));
}

void updateNetLED() {
  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_NET_OK, HIGH);
    digitalWrite(LED_NET_FAIL, LOW);
  } else {
    digitalWrite(LED_NET_OK, LOW);
    static bool blinkState = false;
    static unsigned long lastBlink = 0;
    if (millis() - lastBlink > 500) {
      lastBlink = millis();
      blinkState = !blinkState;
      digitalWrite(LED_NET_FAIL, blinkState ? HIGH : LOW);
    }
  }
}

String readRFID() {
  if (!rfid.PICC_IsNewCardPresent()) return "";
  if (!rfid.PICC_ReadCardSerial()) return "";

  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    uid += String(rfid.uid.uidByte[i], HEX);
  }

  uid.toUpperCase();
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  return uid;
}

void pollServer(const String& uid = "") {
  if (WiFi.status() != WL_CONNECTED) return;

  bool ls = readLoad();
  bool dev = readDevice();

  digitalWrite(LED_LOAD, ls ? HIGH : LOW);
  digitalWrite(LED_DEVICE, dev ? HIGH : LOW);

  String url = String(API_URL) +
               "?adminId=" + ADMIN_ID +
               "&ls=" + (ls ? "1" : "0") +
               "&dev=" + (dev ? "1" : "0");
  if (uid.length()) {
    url += "&uid=" + uid;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  if (!http.begin(client, url)) {
    return;
  }

  http.addHeader("x-device-key", DEVICE_KEY);
  int code = http.GET();

  if (code == HTTP_CODE_OK) {
    String payload = http.getString();

    StaticJsonDocument<512> doc;
    if (!deserializeJson(doc, payload)) {
      const char* status = doc["motorStatus"] | "OFF";
      bool backendLS = doc["loadShedding"] | false;
      bool backendDev = doc["deviceReady"] | false;
      const char* cardMessage = doc["cardModeMessage"] | "";

      bool turnOn =
        (strcmp(status, "RUNNING") == 0) &&
        !backendLS &&
        !ls &&
        dev &&
        backendDev;

      setMotor(turnOn);
      lastSuccess = millis();

      lcd.setCursor(0, 0);
      lcd.print("M:");
      lcd.print(turnOn ? "ON " : "OFF");
      lcd.print(" L:");
      lcd.print(ls ? "Y" : "N");
      lcd.print(" D:");
      lcd.print(dev ? "Y" : "N");

      lcd.setCursor(0, 1);
      if (uid.length()) {
        lcd.print(String(cardMessage).substring(0, 16));
      } else {
        lcd.print(modem.isGprsConnected() ? "NET OK " : "NET FAIL");
        lcd.print(" ");
        lcd.print(backendLS ? "LS" : "OK");
      }
    }
  }

  http.end();
}

void failSafe() {
  if (millis() - lastSuccess > FAIL_TIMEOUT) {
    setMotor(false);
  }
}

// =========================
// SETUP
// =========================
void setup() {
  Serial.begin(115200);

  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(LOAD_PIN, INPUT_PULLUP);
  pinMode(DEVICE_PIN, INPUT_PULLUP);

  pinMode(LED_MOTOR, OUTPUT);
  pinMode(LED_LOAD, OUTPUT);
  pinMode(LED_DEVICE, OUTPUT);
  pinMode(LED_NET_OK, OUTPUT);
  pinMode(LED_NET_FAIL, OUTPUT);

  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  lcdMessage("PumpPilot", "Booting...");

  digitalWrite(MOTOR_PIN, LOW);
  digitalWrite(LED_MOTOR, LOW);
  digitalWrite(LED_LOAD, LOW);
  digitalWrite(LED_DEVICE, LOW);
  digitalWrite(LED_NET_OK, LOW);
  digitalWrite(LED_NET_FAIL, LOW);

  WiFiManager wm;
  wm.autoConnect("ESP32-Setup");

  Serial.println("WiFi Connected");
  lcdMessage("WiFi Connected");

  SPI.begin(RFID_SCK_PIN, RFID_MISO_PIN, RFID_MOSI_PIN, RFID_SS_PIN);
  rfid.PCD_Init();
}

// =========================
// LOOP
// =========================
void loop() {
  updateNetLED();

  String uid = readRFID();
  if (uid.length() && millis() - lastRFID > RFID_DEBOUNCE_MS) {
    lastRFID = millis();
    Serial.println("RFID: " + uid);
    lcdMessage("RFID", uid.substring(0, 16));
    pollServer(uid);
  }

  if (millis() - lastPoll > POLL_INTERVAL) {
    lastPoll = millis();
    pollServer();
  }

  failSafe();
}
