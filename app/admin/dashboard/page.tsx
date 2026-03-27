"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { DashboardMessage } from "@/components/DashboardMessage";
import { getErrorMessage } from "@/lib/error-message";
import { AdminActionCards } from "@/components/admin/AdminActionCards";
import { AdminFirmwareCodeSection } from "@/components/admin/AdminFirmwareCodeSection";
import { AdminMinuteRequestsSection } from "@/components/admin/AdminMinuteRequestsSection";
import { AdminQueueSection } from "@/components/admin/AdminQueueSection";
import { AdminUsersTable } from "@/components/admin/AdminUsersTable";

type UserRow = {
  _id: string;
  username: string;
  rfidUid?: string;
  availableMinutes: number;
  motorStatus: string;
  motorRunningTime?: number;
  adminName?: string;
  status?: string;
  suspendReason?: string;
};

type QueueEntry = {
  _id: string;
  userId: string | { _id: string; username: string };
  position: number;
  status: string;
  requestedMinutes: number;
};

const getName = (idOrObj: string | { _id: string; username: string }, userMap: Record<string, string>) => {
  if (!idOrObj) return "Unknown";
  if (typeof idOrObj === "string") return userMap[idOrObj] || idOrObj;
  return idOrObj.username || idOrObj._id;
};

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loadShedding, setLoadShedding] = useState<boolean | null>(null);
  const [deviceReady, setDeviceReady] = useState<boolean | null>(null);
  const [adminStatus, setAdminStatus] = useState<string>("active");
  const [adminSuspendReason, setAdminSuspendReason] = useState<string | null>(null);
  const [cardModeActive, setCardModeActive] = useState(false);
  const [cardActiveUserId, setCardActiveUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newUser, setNewUser] = useState({ username: "", password: "" });
  const [createLoading, setCreateLoading] = useState(false);
  const [rechargeTarget, setRechargeTarget] = useState<string>("");
  const [rechargeMinutes, setRechargeMinutes] = useState(0);
  const [rechargeLoading, setRechargeLoading] = useState(false);
  const [rfidTarget, setRfidTarget] = useState<string>("");
  const [rfidUid, setRfidUid] = useState<string>("");
  const [rfidLoading, setRfidLoading] = useState(false);
  const [rfidMessage, setRfidMessage] = useState<string | null>(null);
  const [rfidError, setRfidError] = useState<string | null>(null);
  const [requests, setRequests] = useState<
    { _id: string; userId: string | { _id: string; username: string }; minutes: number; createdAt: string }[]
  >([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [suspendError, setSuspendError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [stopResetLoadingUserId, setStopResetLoadingUserId] = useState<string | null>(null);
  const [startLoadingUserId, setStartLoadingUserId] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [espCodeType, setEspCodeType] = useState<"arduino" | "micropython" | "esp8266" | "ttgo" | "stm32">("arduino");
  const [internetOnline, setInternetOnline] = useState(true);

  const isAdmin = session?.user?.role === "admin";
  const adminId = session?.user?.adminId ?? "";
  const displayLoadShedding = Boolean(loadShedding) || deviceReady === false;
  const displayInternetOnline = internetOnline && deviceReady !== false;
  const effectiveRuntimeHold = displayLoadShedding || !displayInternetOnline;

  const esp32ArduinoCode = `/*
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

#include <WiFiManager.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SPI.h>
#include <MFRC522.h>

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
#define HTTP_TIMEOUT_MS    15000UL

#define LOAD_ACTIVE_LOW         1
#define DEVICE_READY_ACTIVE_LOW 0

const char* API_URL = "https://pms.mechatronicslab.net/api/esp32/poll";
const char* ADMIN_ID = "${adminId || "REPLACE_ADMIN_ID"}";
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
  client.setInsecure(); // production এ পরে setCACert use করবে

  client.setTimeout(15);

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
  if (uid.length() && (lastRFID == 0 || millis() - lastRFID > RFID_DEBOUNCE_MS)) {
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
}`;

  const esp32MicroPythonCode = `"""
===========================================================
HARDWARE WIRING TABLE (ESP32 + RFID + LED + MOTOR)
===========================================================

WIFI
----
Set WIFI_SSID / WIFI_PASS below.

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

INPUT SIGNALS
-------------
Load Pin         -> GPIO32
Device Ready     -> GPIO33

OUTPUT
------
Motor Relay      -> GPIO25

Requires:
- urequests
- mfrc522.py driver on the board filesystem
===========================================================
"""

import network
import time
from machine import Pin, SPI
import urequests
import ujson
from mfrc522 import MFRC522

# =========================
# CONFIG
# =========================
WIFI_SSID = "YOUR_WIFI_NAME"
WIFI_PASS = "YOUR_WIFI_PASSWORD"

API_URL = "https://pms.mechatronicslab.net/api/esp32/poll"
ADMIN_ID = "${adminId || "REPLACE_ADMIN_ID"}"
DEVICE_KEY = "spm_9Kx2vQ7mLp4Tn8YzR1cH6uBw3Fd0Js5"

POLL_INTERVAL_MS = 5000
FAIL_TIMEOUT_MS = 20000
RFID_DEBOUNCE_MS = 3000
HTTP_TIMEOUT_SEC = 8

# =========================
# PIN CONFIG
# =========================
MOTOR_PIN = 25
LOAD_PIN = 32
DEVICE_PIN = 33

LED_MOTOR = 16
LED_LOAD = 17
LED_DEVICE = 4
LED_NET_OK = 2
LED_NET_FAIL = 15

RFID_SS_PIN = 5
RFID_RST_PIN = 13
RFID_SCK_PIN = 18
RFID_MISO_PIN = 19
RFID_MOSI_PIN = 23

# =========================
# HARDWARE
# =========================
motor_pin = Pin(MOTOR_PIN, Pin.OUT)
load_pin = Pin(LOAD_PIN, Pin.IN)
device_pin = Pin(DEVICE_PIN, Pin.IN)

led_motor = Pin(LED_MOTOR, Pin.OUT)
led_load = Pin(LED_LOAD, Pin.OUT)
led_device = Pin(LED_DEVICE, Pin.OUT)
led_net_ok = Pin(LED_NET_OK, Pin.OUT)
led_net_fail = Pin(LED_NET_FAIL, Pin.OUT)

spi = SPI(
    2,
    baudrate=1000000,
    polarity=0,
    phase=0,
    sck=Pin(RFID_SCK_PIN),
    mosi=Pin(RFID_MOSI_PIN),
    miso=Pin(RFID_MISO_PIN),
)
rfid = MFRC522(spi=spi, gpioRst=RFID_RST_PIN, gpioCs=RFID_SS_PIN)

last_poll = 0
last_success = 0
last_rfid = 0
last_uid = ""
net_fail_state = 0
net_fail_blink_at = 0


def set_motor(on):
    value = 1 if on else 0
    motor_pin.value(value)
    led_motor.value(value)


def read_load():
    return load_pin.value() == 1


def read_device():
    return device_pin.value() == 1


def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)

    if not wlan.isconnected():
        print("[WiFi] Connecting...")
        wlan.connect(WIFI_SSID, WIFI_PASS)
        start = time.ticks_ms()
        while not wlan.isconnected():
            if time.ticks_diff(time.ticks_ms(), start) > 15000:
                print("[WiFi] Failed. Restarting...")
                time.sleep_ms(1000)
                raise RuntimeError("WiFi connection failed")
            time.sleep_ms(250)

    print("[WiFi] Connected:", wlan.ifconfig())
    return wlan


def ensure_wifi(wlan):
    if wlan.isconnected():
        return

    print("[WiFi] Reconnecting...")
    wlan.disconnect()
    wlan.connect(WIFI_SSID, WIFI_PASS)

    start = time.ticks_ms()
    while not wlan.isconnected() and time.ticks_diff(time.ticks_ms(), start) < 10000:
        time.sleep_ms(250)


def update_net_led(wlan):
    global net_fail_state, net_fail_blink_at

    if wlan.isconnected():
        led_net_ok.value(1)
        led_net_fail.value(0)
        return

    led_net_ok.value(0)
    now = time.ticks_ms()
    if time.ticks_diff(now, net_fail_blink_at) > 500:
        net_fail_blink_at = now
        net_fail_state = 0 if net_fail_state else 1
        led_net_fail.value(net_fail_state)


def read_rfid():
    stat, _ = rfid.request(rfid.REQIDL)
    if stat != rfid.OK:
        return ""

    stat, raw_uid = rfid.anticoll()
    if stat != rfid.OK:
        return ""

    uid = "".join("{:02X}".format(part) for part in raw_uid)
    return uid


def poll_server(uid=""):
    global last_success

    if wlan.isconnected() is False:
        return

    ls = read_load()
    dev = read_device()

    led_load.value(1 if ls else 0)
    led_device.value(1 if dev else 0)

    url = "{}?adminId={}&ls={}&dev={}".format(
        API_URL,
        ADMIN_ID,
        "1" if ls else "0",
        "1" if dev else "0",
    )
    if uid:
        url += "&uid={}".format(uid)

    response = None
    try:
        response = urequests.get(
            url,
            headers={"x-device-key": DEVICE_KEY},
            timeout=HTTP_TIMEOUT_SEC,
        )

        if response.status_code != 200:
            print("[HTTP] code=", response.status_code)
            return

        payload = response.text
        doc = ujson.loads(payload)

        status = doc.get("motorStatus", "OFF")
        backend_ls = doc.get("loadShedding", False)

        turn_on = (status == "RUNNING") and (not backend_ls) and (not ls) and dev
        set_motor(turn_on)
        last_success = time.ticks_ms()

        print("[POLL] status={} ls={} dev={} uid={}".format(status, backend_ls, dev, uid or "-"))

    except Exception as exc:
        print("[ERROR]", exc)
    finally:
        if response is not None:
            response.close()


def fail_safe():
    if time.ticks_diff(time.ticks_ms(), last_success) > FAIL_TIMEOUT_MS:
        set_motor(False)


wlan = connect_wifi()

while True:
    ensure_wifi(wlan)
    update_net_led(wlan)

    uid = read_rfid()
    now = time.ticks_ms()

    if uid and (uid != last_uid or time.ticks_diff(now, last_rfid) > RFID_DEBOUNCE_MS):
        last_uid = uid
        last_rfid = now
        print("RFID:", uid)
        poll_server(uid)

    if time.ticks_diff(now, last_poll) >= POLL_INTERVAL_MS:
        last_poll = now
        poll_server()

    fail_safe()
    time.sleep_ms(25)`;

  const esp8266Code = `#include <ESP8266WiFi.h>
#include <WiFiManager.h>
#include <WiFiClientSecureBearSSL.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>

/*
===========================================================
HARDWARE WIRING TABLE (ESP8266 / NodeMCU + MOTOR)
===========================================================

WIFI
----
Uses WiFiManager (auto config portal)
SSID: ESP8266-Setup

RECOMMENDED NODEMCU PINS
------------------------
Motor Relay      -> D1 (GPIO5)
Load Pin         -> D2 (GPIO4)
Device Ready Pin -> D5 (GPIO14)
Status LED       -> D4 (GPIO2, built-in LED on many boards)

NOTES
-----
- Adjust pins if your board wiring is different
- GPIO2 is often active-low on built-in LED boards
- This template does not include RFID because ESP8266 GPIO is tight

===========================================================
*/

#define MOTOR_PIN 5
#define LOAD_PIN 4
#define DEVICE_PIN 14
#define STATUS_LED_PIN 2

#define STATUS_LED_ACTIVE_LOW 1
#define POLL_INTERVAL_MS 5000UL
#define FAILSAFE_TIMEOUT_MS 20000UL
#define HTTP_TIMEOUT_MS 8000UL

const char* ADMIN_ID = "${adminId || "REPLACE_ADMIN_ID"}";
const char* API_HOST = "https://pms.mechatronicslab.net";
const char* DEVICE_KEY = "spm_9Kx2vQ7mLp4Tn8YzR1cH6uBw3Fd0Js5";

unsigned long lastPoll = 0;
unsigned long lastSuccess = 0;

void writeStatusLed(bool on) {
  digitalWrite(STATUS_LED_PIN, STATUS_LED_ACTIVE_LOW ? (on ? LOW : HIGH) : (on ? HIGH : LOW));
}

bool readLoadPin() {
  return digitalRead(LOAD_PIN) == HIGH;
}

bool readDeviceReadyPin() {
  return digitalRead(DEVICE_PIN) == HIGH;
}

void setMotor(bool on) {
  digitalWrite(MOTOR_PIN, on ? HIGH : LOW);
  writeStatusLed(on);
  Serial.printf("[MOTOR] %s\\n", on ? "ON" : "OFF");
}

void ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println("[WiFi] Reconnecting...");
  WiFi.reconnect();

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    delay(250);
  }
}

void pollServer() {
  if (WiFi.status() != WL_CONNECTED) return;

  bool localLS = readLoadPin();
  bool localDeviceReady = readDeviceReadyPin();

  std::unique_ptr<BearSSL::WiFiClientSecure> client(new BearSSL::WiFiClientSecure);
  client->setInsecure();

  HTTPClient http;
  String url = String(API_HOST) +
               "/api/esp32/poll?adminId=" + ADMIN_ID +
               "&ls=" + (localLS ? "1" : "0") +
               "&dev=" + (localDeviceReady ? "1" : "0");

  http.setConnectTimeout(HTTP_TIMEOUT_MS);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.setReuse(false);

  if (!http.begin(*client, url)) {
    Serial.println("[HTTP] begin failed");
    return;
  }

  http.addHeader("x-device-key", DEVICE_KEY);
  int code = http.GET();

  if (code != HTTP_CODE_OK) {
    Serial.printf("[HTTP] code=%d\\n", code);
    http.end();
    return;
  }

  String payload = http.getString();
  http.end();

  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, payload);
  if (err) {
    Serial.printf("[JSON] parse error: %s\\n", err.c_str());
    return;
  }

  const char* status = doc["motorStatus"] | "OFF";
  bool backendLoadShedding = doc["loadShedding"] | false;

  bool turnOn =
    (strcmp(status, "RUNNING") == 0) &&
    !backendLoadShedding &&
    !localLS &&
    localDeviceReady;

  setMotor(turnOn);
  lastSuccess = millis();

  Serial.printf("[POLL] status=%s ls=%d dev=%d\\n", status, backendLoadShedding, localDeviceReady);
}

void failSafe() {
  if (millis() - lastSuccess > FAILSAFE_TIMEOUT_MS) {
    setMotor(false);
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(LOAD_PIN, INPUT_PULLUP);
  pinMode(DEVICE_PIN, INPUT_PULLUP);
  pinMode(STATUS_LED_PIN, OUTPUT);

  digitalWrite(MOTOR_PIN, LOW);
  writeStatusLed(false);

  WiFiManager wm;
  wm.setConfigPortalTimeout(180);

  if (!wm.autoConnect("ESP8266-Setup")) {
    delay(2000);
    ESP.restart();
  }

  Serial.print("[WiFi] Connected. IP: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  ensureWiFi();

  unsigned long now = millis();
  if (now - lastPoll >= POLL_INTERVAL_MS) {
    lastPoll = now;
    pollServer();
  }

  failSafe();
  delay(10);
}`;

  const ttgoTCallCode = `#define TINY_GSM_MODEM_SIM800

/*
===========================================================
HARDWARE WIRING TABLE (TTGO T-CALL + LCD + RFID + SAFE PINS)
===========================================================

MODEM (AUTO CONNECTED)
----------------------
GPIO27 -> TX
GPIO26 -> RX
GPIO23 -> POWER
GPIO5  -> RESET
GPIO4  -> PWKEY

DO NOT USE ABOVE PINS

LCD 16x2 (I2C)
--------------
SDA -> GPIO21
SCL -> GPIO22
VCC -> 5V
GND -> GND

RFID RC522 (SPI)
----------------
SDA  -> GPIO15
SCK  -> GPIO18
MOSI -> GPIO14
MISO -> GPIO19
RST  -> GPIO13
VCC  -> 3.3V

SAFE LED MAP
------------
Motor LED      -> GPIO16
Load LED       -> GPIO17
Device LED     -> LCD only
NET OK LED     -> LCD only
NET FAIL LED   -> LCD only

INPUT
-----
LOAD   -> GPIO32
DEVICE -> GPIO33

OUTPUT
------
MOTOR -> GPIO25

NOTES
-----
- GPIO23 stays reserved for SIM800 power control
- RFID MOSI moved to GPIO14 to avoid the modem conflict
- Device and network status are shown on the LCD instead of risky extra LED pins
===========================================================
*/

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <HardwareSerial.h>
#include <TinyGsmClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

#define MODEM_RST 5
#define MODEM_PWKEY 4
#define MODEM_POWER_ON 23
#define MODEM_TX 27
#define MODEM_RX 26

#define MOTOR_PIN 25
#define LOAD_PIN 32
#define DEVICE_PIN 33

#define RFID_SS 15
#define RFID_RST 13
#define RFID_SCK 18
#define RFID_MISO 19
#define RFID_MOSI 14

#define LED_MOTOR 16
#define LED_LOAD 17
#define LED_DEVICE -1
#define LED_NET_OK -1
#define LED_NET_FAIL -1

#define POLL_INTERVAL_MS 5000UL
#define RFID_DEBOUNCE_MS 3000UL
#define FAILSAFE_TIMEOUT_MS 15000UL
#define LOAD_ACTIVE_LOW 1
#define DEVICE_READY_ACTIVE_LOW 1

const char APN[] = "internet";
const char* API_HOST = "pms.mechatronicslab.net";
const int API_PORT = 443;
const char* API_PATH = "/api/esp32/poll";
const char* ADMIN_ID = "${adminId || "REPLACE_ADMIN_ID"}";
const char* DEVICE_KEY = "spm_9Kx2vQ7mLp4Tn8YzR1cH6uBw3Fd0Js5";

HardwareSerial SerialAT(1);
TinyGsm modem(SerialAT);
TinyGsmClientSecure client(modem);
MFRC522 rfid(RFID_SS, RFID_RST);

unsigned long lastPoll = 0;
unsigned long lastRFID = 0;
unsigned long lastSuccess = 0;

void lcdMessage(const String& line1, const String& line2 = "") {
  lcd.clear();
  lcd.setCursor(0, 0);
  String row1 = line1.substring(0, 16);
  while (row1.length() < 16) row1 += " ";
  lcd.print(row1);
  lcd.setCursor(0, 1);
  String row2 = line2.substring(0, 16);
  while (row2.length() < 16) row2 += " ";
  lcd.print(row2);
}

void writeOptionalPin(int pin, bool on) {
  if (pin < 0) return;
  digitalWrite(pin, on ? HIGH : LOW);
}

void setupModem() {
  pinMode(MODEM_POWER_ON, OUTPUT);
  pinMode(MODEM_PWKEY, OUTPUT);
  pinMode(MODEM_RST, OUTPUT);

  digitalWrite(MODEM_POWER_ON, HIGH);
  delay(100);
  digitalWrite(MODEM_PWKEY, HIGH);
  delay(1000);
  digitalWrite(MODEM_PWKEY, LOW);
}

bool connectGSM() {
  lcdMessage("Connecting GSM", "Please wait");

  modem.restart();
  if (!modem.waitForNetwork(60000L)) {
    lcdMessage("GSM Network", "Failed");
    return false;
  }
  if (!modem.gprsConnect(APN, "", "")) {
    lcdMessage("GPRS", "Failed");
    return false;
  }

  lcdMessage("GSM Connected");
  delay(800);
  return true;
}

void setMotor(bool on) {
  digitalWrite(MOTOR_PIN, on ? HIGH : LOW);
  writeOptionalPin(LED_MOTOR, on);
}

String httpGET(const String& url, int& code) {
  code = -1;

  if (!client.connect(API_HOST, API_PORT)) {
    return "";
  }

  client.print(String("GET ") + url + " HTTP/1.1\\r\\n");
  client.print(String("Host: ") + API_HOST + "\\r\\n");
  client.print(String("x-device-key: ") + DEVICE_KEY + "\\r\\n");
  client.print("Connection: close\\r\\n\\r\\n");

  unsigned long start = millis();
  while (!client.available() && millis() - start < 10000UL) {
    delay(10);
  }

  String statusLine = client.readStringUntil('\\n');
  int firstSpace = statusLine.indexOf(' ');
  code = statusLine.substring(firstSpace + 1).toInt();

  while (client.connected()) {
    String line = client.readStringUntil('\\n');
    if (line == "\\r") break;
  }

  String body = client.readString();
  client.stop();
  return body;
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

void sendRFID(const String& uid) {
  bool ls = LOAD_ACTIVE_LOW ? (digitalRead(LOAD_PIN) == LOW) : (digitalRead(LOAD_PIN) == HIGH);
  bool dev = DEVICE_READY_ACTIVE_LOW ? (digitalRead(DEVICE_PIN) == LOW) : (digitalRead(DEVICE_PIN) == HIGH);

  String url = String(API_PATH) +
               "?adminId=" + String(ADMIN_ID) +
               "&ls=" + (ls ? "1" : "0") +
               "&dev=" + (dev ? "1" : "0") +
               "&uid=" + uid;

  int code;
  String body = httpGET(url, code);

  lcdMessage("RFID:", uid.substring(0, 8));

  if (code != 200) {
    lcdMessage("RFID Send Fail", String(code));
    return;
  }

  StaticJsonDocument<512> doc;
  if (deserializeJson(doc, body)) {
    lcdMessage("RFID Parse", "Failed");
    return;
  }

  const char* message = doc["cardModeMessage"] | "RFID done";
  lcdMessage("RFID Result", String(message));
}

void pollServer() {
  bool ls = LOAD_ACTIVE_LOW ? (digitalRead(LOAD_PIN) == LOW) : (digitalRead(LOAD_PIN) == HIGH);
  bool dev = DEVICE_READY_ACTIVE_LOW ? (digitalRead(DEVICE_PIN) == LOW) : (digitalRead(DEVICE_PIN) == HIGH);

  writeOptionalPin(LED_LOAD, ls);
  writeOptionalPin(LED_DEVICE, dev);

  String url = String(API_PATH) +
               "?adminId=" + String(ADMIN_ID) +
               "&ls=" + (ls ? "1" : "0") +
               "&dev=" + (dev ? "1" : "0");

  int code;
  String body = httpGET(url, code);
  if (code != 200) {
    lcdMessage("HTTP Error", String(code));
    return;
  }

  StaticJsonDocument<512> doc;
  if (deserializeJson(doc, body)) return;

  const char* status = doc["motorStatus"] | "OFF";
  bool backendLS = doc["loadShedding"] | false;
  bool backendDev = doc["deviceReady"] | false;

  bool turnOn =
    (strcmp(status, "RUNNING") == 0) &&
    !backendLS &&
    !ls &&
    dev &&
    backendDev;

  setMotor(turnOn);
  lastSuccess = millis();

  lcd.setCursor(0, 0);
  lcd.print("Motor:");
  lcd.print(turnOn ? "ON " : "OFF");
  lcd.print(" LS:");
  lcd.print(ls ? "Y" : "N");

  lcd.setCursor(0, 1);
  lcd.print("Dev:");
  lcd.print(dev ? "OK" : "NO");
  lcd.print(" Net:");
  lcd.print(modem.isGprsConnected() ? "OK" : "NO");
}

void failSafe() {
  if (millis() - lastSuccess > FAILSAFE_TIMEOUT_MS) {
    setMotor(false);
  }
}

void updateNetLED() {
  if (modem.isGprsConnected()) {
    writeOptionalPin(LED_NET_OK, true);
    writeOptionalPin(LED_NET_FAIL, false);
  } else {
    writeOptionalPin(LED_NET_OK, false);
    static bool state = false;
    static unsigned long lastBlink = 0;
    if (millis() - lastBlink > 500) {
      lastBlink = millis();
      state = !state;
      writeOptionalPin(LED_NET_FAIL, state);
    }
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(LOAD_PIN, INPUT_PULLUP);
  pinMode(DEVICE_PIN, INPUT_PULLUP);

  pinMode(LED_MOTOR, OUTPUT);
  pinMode(LED_LOAD, OUTPUT);
  if (LED_DEVICE >= 0) pinMode(LED_DEVICE, OUTPUT);
  if (LED_NET_OK >= 0) pinMode(LED_NET_OK, OUTPUT);
  if (LED_NET_FAIL >= 0) pinMode(LED_NET_FAIL, OUTPUT);

  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  lcdMessage("PumpPilot", "Booting...");

  setupModem();
  SerialAT.begin(9600, SERIAL_8N1, MODEM_RX, MODEM_TX);

  SPI.begin(RFID_SCK, RFID_MISO, RFID_MOSI, RFID_SS);
  rfid.PCD_Init();

  connectGSM();
}

void loop() {
  if (!modem.isGprsConnected()) {
    connectGSM();
  }

  updateNetLED();

  String uid = readRFID();
  if (uid.length() && (lastRFID == 0 || millis() - lastRFID > RFID_DEBOUNCE_MS)) {
    lastRFID = millis();
    sendRFID(uid);
  }

  if (millis() - lastPoll > POLL_INTERVAL_MS) {
    lastPoll = millis();
    pollServer();
  }

  failSafe();
}`;

  const stm32Sim800lCode = `#define TINY_GSM_MODEM_SIM800
#define TINY_GSM_RX_BUFFER 1024

#include <TinyGsmClient.h>
#include <ArduinoJson.h>

/*
===========================================================
HARDWARE WIRING TABLE (STM32 + SIM800L + MOTOR)
===========================================================

SERIAL
------
SerialMon -> USB serial
SerialAT  -> SIM800L serial pins (map per board)

RECOMMENDED STM32 EXAMPLE PINS
------------------------------
Motor Relay      -> PA8
Load Pin         -> PB0
Device Ready Pin -> PB1
Status LED       -> PC13 (adjust if your board differs)

NOTES
-----
- Update APN / GPRS credentials for your SIM
- Update SerialAT mapping for your STM32 board
- This template is GSM-based and does not include RFID

===========================================================
*/

#define SerialMon Serial
#define SerialAT  Serial1

#define MOTOR_PIN      PA8
#define LOAD_PIN       PB0
#define DEVICE_PIN     PB1
#define STATUS_LED_PIN PC13

#define STATUS_LED_ACTIVE_LOW 1
#define POLL_INTERVAL_MS 5000UL
#define FAILSAFE_TIMEOUT_MS 20000UL
#define HTTP_WAIT_TIMEOUT_MS 15000UL

const char apn[]      = "internet";
const char gprsUser[] = "";
const char gprsPass[] = "";

const char* ADMIN_ID = "${adminId || "REPLACE_ADMIN_ID"}";
const char* SERVER   = "pms.mechatronicslab.net";
const int   PORT     = 80;
const char* DEVICE_KEY = "spm_9Kx2vQ7mLp4Tn8YzR1cH6uBw3Fd0Js5";

TinyGsm modem(SerialAT);
TinyGsmClient client(modem);
unsigned long lastPoll = 0;
unsigned long lastSuccess = 0;

void writeStatusLed(bool on) {
  digitalWrite(STATUS_LED_PIN, STATUS_LED_ACTIVE_LOW ? (on ? LOW : HIGH) : (on ? HIGH : LOW));
}

bool readLoadShedding() {
  return digitalRead(LOAD_PIN) == HIGH;
}

bool readDeviceReady() {
  return digitalRead(DEVICE_PIN) == HIGH;
}

void setMotor(bool on) {
  digitalWrite(MOTOR_PIN, on ? HIGH : LOW);
  writeStatusLed(on);
  SerialMon.printf("[MOTOR] %s\\n", on ? "ON" : "OFF");
}

bool connectGprsIfNeeded() {
  if (modem.isGprsConnected()) return true;

  SerialMon.println("[NET] Waiting for network...");
  if (!modem.waitForNetwork(60000L)) {
    SerialMon.println("[NET] Network failed");
    return false;
  }

  SerialMon.println("[NET] Connecting GPRS...");
  if (!modem.gprsConnect(apn, gprsUser, gprsPass)) {
    SerialMon.println("[NET] GPRS failed");
    return false;
  }

  SerialMon.println("[NET] GPRS connected");
  return true;
}

bool readHttpJson(String& bodyOut) {
  unsigned long start = millis();
  while (client.connected() && !client.available()) {
    if (millis() - start > HTTP_WAIT_TIMEOUT_MS) {
      SerialMon.println("[HTTP] Timeout");
      client.stop();
      return false;
    }
    delay(10);
  }

  String response;
  while (client.available()) {
    response += client.readString();
  }
  client.stop();

  int codeStart = response.indexOf("HTTP/1.1 ");
  if (codeStart < 0) codeStart = response.indexOf("HTTP/1.0 ");
  int statusCode = -1;
  if (codeStart >= 0) {
    statusCode = response.substring(codeStart + 9, codeStart + 12).toInt();
  }
  if (statusCode != 200) {
    SerialMon.printf("[HTTP] Non-200: %d\\n", statusCode);
    return false;
  }

  int jsonStart = response.indexOf('{');
  if (jsonStart < 0) {
    SerialMon.println("[HTTP] JSON missing");
    return false;
  }

  bodyOut = response.substring(jsonStart);
  return true;
}

void pollServer() {
  if (!connectGprsIfNeeded()) return;

  bool localLS = readLoadShedding();
  bool localDev = readDeviceReady();

  String path = "/api/esp32/poll?adminId=" + String(ADMIN_ID) +
                "&ls=" + (localLS ? "1" : "0") +
                "&dev=" + (localDev ? "1" : "0");

  if (!client.connect(SERVER, PORT)) {
    SerialMon.println("[HTTP] Connect failed");
    return;
  }

  client.print(String("GET ") + path + " HTTP/1.1\\r\\n");
  client.print(String("Host: ") + SERVER + "\\r\\n");
  client.print(String("x-device-key: ") + DEVICE_KEY + "\\r\\n");
  client.print("Connection: close\\r\\n\\r\\n");

  String body;
  if (!readHttpJson(body)) return;

  StaticJsonDocument<768> doc;
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    SerialMon.printf("[JSON] Parse error: %s\\n", err.c_str());
    return;
  }

  const char* motorStatus = doc["motorStatus"] | "OFF";
  bool backendLS = doc["loadShedding"] | false;
  bool backendDev = doc["deviceReady"] | false;

  bool turnOn = (strcmp(motorStatus, "RUNNING") == 0) &&
                !backendLS &&
                !localLS &&
                localDev &&
                backendDev;

  setMotor(turnOn);
  lastSuccess = millis();

  SerialMon.printf("[POLL] status=%s ls=%d localLS=%d dev=%d backendDev=%d\\n",
                   motorStatus, backendLS, localLS, localDev, backendDev);
}

void failSafe() {
  if (millis() - lastSuccess > FAILSAFE_TIMEOUT_MS) {
    setMotor(false);
  }
}

void setup() {
  SerialMon.begin(115200);
  delay(300);

  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(LOAD_PIN, INPUT_PULLUP);
  pinMode(DEVICE_PIN, INPUT_PULLUP);
  pinMode(STATUS_LED_PIN, OUTPUT);

  digitalWrite(MOTOR_PIN, LOW);
  writeStatusLed(false);

  SerialAT.begin(9600);
  delay(2000);

  SerialMon.println("[MODEM] Restarting...");
  modem.restart();
  connectGprsIfNeeded();
}

void loop() {
  unsigned long now = millis();
  if (now - lastPoll >= POLL_INTERVAL_MS) {
    lastPoll = now;
    pollServer();
  }

  failSafe();
  delay(20);
}`;

  const esp32Code =
    espCodeType === "arduino"
      ? esp32ArduinoCode
      : espCodeType === "micropython"
        ? esp32MicroPythonCode
        : espCodeType === "esp8266"
          ? esp8266Code
          : espCodeType === "ttgo"
            ? ttgoTCallCode
            : stm32Sim800lCode;

  const readJson = async (res: Response) => {
    const raw = await res.text();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return { error: raw };
    }
  };

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!isAdmin) return;
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const [usersRes, activityRes, statusRes, reqRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/activity"),
        fetch("/api/admin/status"),
        fetch("/api/admin/minute-requests"),
      ]);
      const usersJson = await readJson(usersRes);
      const activityJson = await readJson(activityRes);
      const statusJson = await readJson(statusRes);
      const reqJson = await readJson(reqRes);
      setUsers(usersJson.users ?? []);
      setQueue(activityJson.queue ?? []);
      if (statusRes.ok && statusJson.admin) {
        setLoadShedding(!!statusJson.admin.loadShedding);
        setDeviceReady(Boolean(statusJson.admin.deviceReady));
        setAdminStatus(statusJson.admin.status ?? "active");
        setAdminSuspendReason(statusJson.admin.suspendReason ?? null);
        setCardModeActive(Boolean(statusJson.admin.cardModeActive));
        setCardActiveUserId(statusJson.admin.cardActiveUserId ?? null);
      }
      if (reqRes.ok) setRequests(reqJson.requests ?? []);
    } catch (err) {
      if (!silent) {
        setError(getErrorMessage(err, "Failed to load data"));
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [isAdmin]);

  useEffect(() => {
    if (status === "authenticated" && isAdmin) {
      loadData();
    }
  }, [status, isAdmin, loadData]);

  useEffect(() => {
    if (status !== "authenticated" || !isAdmin) return;
    const intervalId = setInterval(() => {
      loadData({ silent: true });
    }, 5000);
    return () => clearInterval(intervalId);
  }, [status, isAdmin, loadData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateOnline = () => setInternetOnline(window.navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  const handleCreateUser = async () => {
    setCreateLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const json = await readJson(res);
      if (!res.ok) throw new Error(json.error || "Create failed");
      setNewUser({ username: "", password: "" });
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Create failed"));
    } finally {
      setCreateLoading(false);
    }
  };

  const handleRecharge = async () => {
    setRechargeLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: rechargeTarget, minutes: rechargeMinutes }),
      });
      const json = await readJson(res);
      if (!res.ok) throw new Error(json.error || "Recharge failed");
      setRechargeMinutes(0);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Recharge failed"));
    } finally {
      setRechargeLoading(false);
    }
  };

  const handleAssignRfid = async (clearOnly = false) => {
    setRfidLoading(true);
    setError(null);
    setRfidMessage(null);
    setRfidError(null);
    try {
      const payload = {
        userId: rfidTarget,
        rfidUid: clearOnly ? null : rfidUid.trim(),
      };
      const res = await fetch("/api/admin/users/rfid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await readJson(res);
      if (!res.ok) throw new Error(json.error || "RFID update failed");
      if (clearOnly) {
        setRfidMessage("RFID cleared");
        setRfidUid("");
      } else {
        setRfidMessage("RFID assigned");
      }
      await loadData();
    } catch (err) {
      const message = getErrorMessage(err, "RFID update failed");
      setRfidError(message);
      setError(message);
    } finally {
      setRfidLoading(false);
    }
  };

  const handleApproveRequest = async (id: string) => {
    const res = await fetch("/api/admin/minute-requests/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: id }),
    });
    const json = await readJson(res);
    if (!res.ok) {
      setError(json.error || "Approve failed");
      return;
    }
    await loadData();
  };

  const handleDeclineRequest = async (id: string) => {
    const res = await fetch("/api/admin/minute-requests/decline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: id }),
    });
    const json = await readJson(res);
    if (!res.ok) {
      setError(json.error || "Decline failed");
      return;
    }
    await loadData();
  };

  const handleDeleteUser = async (userId: string) => {
    setError(null);
    if (!window.confirm("Delete this user permanently?")) return;
    const res = await fetch(`/api/admin/users?userId=${userId}`, {
      method: "DELETE",
    });
    const json = await readJson(res);
    if (!res.ok) {
      setError(json.error || "Delete failed");
      return;
    }
    await loadData();
  };

  const handleStopResetMotor = async (userId: string) => {
    setError(null);
    setStatusMessage(null);
    if (!window.confirm("Stop and reset this user's motor session?")) return;
    setStopResetLoadingUserId(userId);
    try {
      const res = await fetch("/api/motor/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await readJson(res);
      if (!res.ok) {
        setError(json.error || "Failed to stop/reset motor");
        return;
      }
      setStatusMessage("User motor stopped/reset successfully");
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to stop/reset motor"));
    } finally {
      setStopResetLoadingUserId(null);
    }
  };

  const handleStartMotor = async (userId: string, requestedMinutes: number) => {
    setError(null);
    setStatusMessage(null);
    if (!internetOnline) {
      setError("Internet offline. Motor start is blocked.");
      return;
    }
    setStartLoadingUserId(userId);
    try {
      const res = await fetch("/api/motor/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, requestedMinutes }),
      });
      const json = await readJson(res);
      if (!res.ok) {
        setError(json.error || "Failed to start motor");
        return;
      }
      if (json.status === "WAITING") {
        setStatusMessage(`User queued at position #${json.queuePosition ?? "-"}`);
      } else {
        setStatusMessage("User motor started");
      }
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to start motor"));
    } finally {
      setStartLoadingUserId(null);
    }
  };

  const handleSuspendUser = async (userId: string) => {
    setError(null);
    setSuspendError(null);
    if (!window.confirm("Suspend this user?")) return;
    const reasonPrompt = prompt("Suspend reason?");
    if (reasonPrompt === null) return;
    const reason = reasonPrompt.trim() || undefined;
    const res = await fetch("/api/admin/users/suspend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, reason }),
    });
    const json = await readJson(res);
    if (!res.ok) {
      setSuspendError(json.error || "Suspend failed");
      return;
    }
    setStatusMessage("User suspended");
    await loadData();
  };

  const handleUnsuspendUser = async (userId: string) => {
    setError(null);
    setSuspendError(null);
    const res = await fetch("/api/admin/users/unsuspend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const json = await readJson(res);
    if (!res.ok) {
      setSuspendError(json.error || "Unsuspend failed");
      return;
    }
    setStatusMessage("User reactivated");
    await loadData();
  };

  const copyEsp32Code = async () => {
    try {
      await navigator.clipboard.writeText(esp32Code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    } catch {
      setError("Failed to copy ESP32 code");
    }
  };

  if (status === "loading") {
    return <div className="p-6 text-slate-200">Loading session...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
        <div className="mx-auto max-w-lg rounded-xl border border-slate-800 bg-slate-900/70 p-6 text-center">
          <p className="text-lg font-semibold">Admin access required.</p>
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="mt-4 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Go to Admin Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto mt-2 flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col items-center gap-2 text-center">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">PumpPilot</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">Admin Dashboard</h1>
            <p className="text-sm text-slate-300">
              Admin: {session?.user?.username || "-"}
            </p>
            <p className="text-sm text-slate-300">
              Manage users, wallet recharges, load shedding, and queue.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <a
              href="/api/history?format=csv&download=1&limit=100"
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-cyan-400 hover:text-cyan-200"
            >
              Download History
            </a>
            <a
              href="/admin/change-password"
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-cyan-400 hover:text-cyan-200"
            >
              Change Password
            </a>
            <button
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-cyan-400 hover:text-cyan-200"
            >
              Logout
            </button>
          </div>
        </header>

        <section className="mx-auto w-full max-w-5xl rounded-xl border border-slate-800 bg-slate-950/70 p-4 shadow-lg shadow-slate-950/40">
          <div className="text-sm font-semibold text-slate-200">System Readiness</div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200">
              Device:{" "}
              <span className={`inline-flex items-center gap-1.5 font-semibold ${deviceReady === false ? "text-red-300" : "text-emerald-300"}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${deviceReady === false ? "bg-red-500" : "bg-emerald-500"}`} />
                {deviceReady === false ? "Not Ready" : "Ready"}
              </span>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200">
              Loadshedding:{" "}
              <span className={`inline-flex items-center gap-1.5 font-semibold ${displayLoadShedding ? "text-red-300" : "text-emerald-300"}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${displayLoadShedding ? "bg-red-500" : "bg-emerald-500"}`} />
                {displayLoadShedding ? "Yes" : "No"}
              </span>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200">
              Internet:{" "}
              <span className={`inline-flex items-center gap-1.5 font-semibold ${displayInternetOnline ? "text-emerald-300" : "text-red-300"}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${displayInternetOnline ? "bg-emerald-500" : "bg-red-500"}`} />
                {displayInternetOnline ? "Online" : "Offline"}
              </span>
            </div>
          </div>
        </section>

        {error ? <DashboardMessage variant="error" title="Dashboard error" message={error} actionLabel="Retry" onAction={loadData} /> : null}
        {suspendError ? <DashboardMessage variant="error" title="User action failed" message={suspendError} actionLabel="Retry" onAction={loadData} /> : null}
        {statusMessage ? <DashboardMessage variant="success" message={statusMessage} /> : null}

        {loadShedding && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-900/30 px-4 py-3 text-sm text-amber-100 shadow-lg shadow-amber-900/30">
            Warning: load shedding active. Some actions are paused.
          </div>
        )}
        {!loadShedding && deviceReady === false && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-900/30 px-4 py-3 text-sm text-amber-100 shadow-lg shadow-amber-900/30">
            Device status LOW: your ESP32 device is not ready.
          </div>
        )}
        {adminStatus === "suspended" && (
          <div className="rounded-xl border border-red-500/40 bg-red-900/30 px-4 py-3 text-sm text-red-100 shadow-lg shadow-red-900/30">
            You are suspended{adminSuspendReason ? `: ${adminSuspendReason}` : ""}.
          </div>
        )}

        {loading ? (
          <DashboardMessage
            variant="info"
            title="Loading dashboard"
            message="We are syncing users, queue status, and pending requests."
          />
        ) : (
          <>
            <AdminActionCards
              newUser={newUser}
              createLoading={createLoading}
              onNewUserChange={setNewUser}
              onCreateUser={handleCreateUser}
              users={users}
              rechargeTarget={rechargeTarget}
              rechargeMinutes={rechargeMinutes}
              rechargeLoading={rechargeLoading}
              onRechargeTargetChange={setRechargeTarget}
              onRechargeMinutesChange={setRechargeMinutes}
              onRecharge={handleRecharge}
              rfidTarget={rfidTarget}
              rfidUid={rfidUid}
              rfidLoading={rfidLoading}
              rfidMessage={rfidMessage}
              rfidError={rfidError}
              onRfidTargetChange={setRfidTarget}
              onRfidUidChange={setRfidUid}
              onAssignRfid={handleAssignRfid}
            />

            <AdminUsersTable
              users={users}
              effectiveRuntimeHold={effectiveRuntimeHold}
              cardModeActive={cardModeActive}
              cardActiveUserId={cardActiveUserId}
              startLoadingUserId={startLoadingUserId}
              stopResetLoadingUserId={stopResetLoadingUserId}
              adminStatus={adminStatus}
              loadShedding={loadShedding}
              deviceReady={deviceReady}
              internetOnline={internetOnline}
              onStartMotor={handleStartMotor}
              onStopResetMotor={handleStopResetMotor}
              onDeleteUser={handleDeleteUser}
              onSuspendUser={handleSuspendUser}
              onUnsuspendUser={handleUnsuspendUser}
            />

            <AdminQueueSection
              queue={queue}
              users={users}
              effectiveRuntimeHold={effectiveRuntimeHold}
              getName={getName}
            />

            <AdminMinuteRequestsSection
              requests={requests}
              users={users}
              onApproveRequest={handleApproveRequest}
              onDeclineRequest={handleDeclineRequest}
              getName={getName}
            />

            <AdminFirmwareCodeSection
              espCodeType={espCodeType}
              onEspCodeTypeChange={setEspCodeType}
              onCopyCode={copyEsp32Code}
              codeCopied={codeCopied}
              esp32Code={esp32Code}
            />
          </>
        )}
      </div>
    </div>
  );
}
