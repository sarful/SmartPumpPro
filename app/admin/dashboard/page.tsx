"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";

type UserRow = {
  _id: string;
  username: string;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newUser, setNewUser] = useState({ username: "", password: "" });
  const [createLoading, setCreateLoading] = useState(false);
  const [rechargeTarget, setRechargeTarget] = useState<string>("");
  const [rechargeMinutes, setRechargeMinutes] = useState(0);
  const [rechargeLoading, setRechargeLoading] = useState(false);
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

  const esp32ArduinoCode = `#include <WiFiManager.h>
#include <WiFiClient.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// =========================
// PumpPilot ESP32 Firmware
// =========================

// ---- PIN CONFIG ----
#define MOTOR_PIN 2
#define LOAD_PIN 4
#define DEVICE_PIN 5

// ---- SIGNAL POLARITY TOGGLES ----
// Set 1 if signal is ACTIVE LOW, else 0
#define LOAD_ACTIVE_LOW 0
#define DEVICE_READY_ACTIVE_LOW 1

// ---- TIMING ----
#define POLL_INTERVAL_MS 5000
#define HTTP_TIMEOUT_MS 8000

// ---- SERVER CONFIG ----
// Admin-based config with your ADMIN_ID
const char* ADMIN_ID = "${adminId || "REPLACE_ADMIN_ID"}";
const char* API_HOST = "https://pms-two-kappa.vercel.app";

unsigned long lastPoll = 0;

bool readLoadSheddingPin() {
  int raw = digitalRead(LOAD_PIN);
  return LOAD_ACTIVE_LOW ? (raw == LOW) : (raw == HIGH);
}

bool readDeviceReadyPin() {
  int raw = digitalRead(DEVICE_PIN);
  return DEVICE_READY_ACTIVE_LOW ? (raw == LOW) : (raw == HIGH);
}

void setMotor(bool on) {
  digitalWrite(MOTOR_PIN, on ? HIGH : LOW);
  Serial.printf("[LED] %s\\n", on ? "ON" : "OFF");
}

void ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println("[WiFi] Reconnecting...");
  WiFi.reconnect();

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();
}

void pollServer() {
  if (WiFi.status() != WL_CONNECTED) return;

  bool localLS = readLoadSheddingPin();
  bool localDeviceReady = readDeviceReadyPin();

  Serial.printf("[PIN] loadRaw=%d devRaw=%d ls=%d dev=%d\\n",
                digitalRead(LOAD_PIN),
                digitalRead(DEVICE_PIN),
                localLS,
                localDeviceReady);

  WiFiClient client;

  HTTPClient http;
  String url = String(API_HOST) +
               "/api/esp32/poll?adminId=" + ADMIN_ID +
               "&ls=" + (localLS ? "1" : "0") +
               "&dev=" + (localDeviceReady ? "1" : "0");

  http.setConnectTimeout(HTTP_TIMEOUT_MS);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

  if (!http.begin(client, url)) {
    Serial.println("[HTTP] begin failed");
    return;
  }

  int code = http.GET();
  if (code != HTTP_CODE_OK) {
    Serial.printf("[HTTP] code=%d err=%s\\n", code, http.errorToString(code).c_str());
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
  bool loadShedding = doc["loadShedding"] | false;
  bool backendDeviceReady = doc["deviceReady"] | false;
  const char* adminName = doc["adminName"] | "unknown";

  Serial.printf("[POLL] admin=%s status=%s ls=%d localLS=%d dev=%d backendDev=%d\\n",
                adminName, status, loadShedding, localLS, localDeviceReady, backendDeviceReady);

  bool turnOn =
      (strcmp(status, "RUNNING") == 0) &&
      !loadShedding &&
      !localLS &&
      localDeviceReady;

  setMotor(turnOn);
}

void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(MOTOR_PIN, OUTPUT);
  digitalWrite(MOTOR_PIN, LOW);

  pinMode(LOAD_PIN, INPUT_PULLUP);
  pinMode(DEVICE_PIN, INPUT_PULLUP);

  WiFi.setSleep(false);

  WiFiManager wm;
  wm.setConfigPortalTimeout(180);
  if (!wm.autoConnect("PumpPilot-Setup")) {
    Serial.println("[WiFi] Config timeout. Restarting...");
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

  delay(10);
}`;

  const esp32MicroPythonCode = `import network
import time
import machine
import urequests
import ujson

# =========================
# PumpPilot ESP32 MicroPython
# =========================

# ---------- CONFIG ----------
WIFI_SSID = "YOUR_WIFI_NAME"
WIFI_PASS = "YOUR_WIFI_PASSWORD"

MOTOR_PIN = 2
LOAD_PIN = 4
DEVICE_PIN = 5

# Set 1 if signal is ACTIVE LOW, else 0
LOAD_ACTIVE_LOW = 0
DEVICE_READY_ACTIVE_LOW = 1

POLL_INTERVAL_MS = 5000
HTTP_TIMEOUT_MS = 6  # seconds

ADMIN_ID = "${adminId || "REPLACE_ADMIN_ID"}"
API_HOST = "https://pms-two-kappa.vercel.app"

# ---------- SETUP ----------
motor = machine.Pin(MOTOR_PIN, machine.Pin.OUT)
load_pin = machine.Pin(LOAD_PIN, machine.Pin.IN, machine.Pin.PULL_UP)
device_pin = machine.Pin(DEVICE_PIN, machine.Pin.IN, machine.Pin.PULL_UP)

last_poll = 0

# ---------- FUNCTIONS ----------

def set_motor(on):
    motor.value(1 if on else 0)
    print("[LED]", "ON" if on else "OFF")

def read_load_shedding():
    raw = load_pin.value()
    return (raw == 0) if LOAD_ACTIVE_LOW else (raw == 1)

def read_device_ready():
    raw = device_pin.value()
    return (raw == 0) if DEVICE_READY_ACTIVE_LOW else (raw == 1)


def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)

    if not wlan.isconnected():
        print("Connecting to WiFi...")
        wlan.connect(WIFI_SSID, WIFI_PASS)

        timeout_sec = 10
        start = time.time()

        while not wlan.isconnected():
            if (time.time() - start) > timeout_sec:
                print("WiFi Failed. Restarting...")
                machine.reset()
            time.sleep(0.25)

    print("WiFi Connected:", wlan.ifconfig())
    return wlan


def ensure_wifi(wlan):
    if not wlan.isconnected():
        print("[WiFi] reconnecting...")
        wlan.disconnect()
        wlan.connect(WIFI_SSID, WIFI_PASS)
        t0 = time.time()
        while not wlan.isconnected() and (time.time() - t0) < 10:
            time.sleep(0.25)
        print("[WiFi] ok" if wlan.isconnected() else "[WiFi] reconnect failed")


def poll_server(wlan):
    if not wlan.isconnected():
        return

    raw_ls = load_pin.value()
    raw_dev = device_pin.value()
    local_ls = read_load_shedding()
    local_dev = read_device_ready()

    print("[PIN] loadRaw={} devRaw={} ls={} dev={}".format(raw_ls, raw_dev, local_ls, local_dev))

    url = "{}/api/esp32/poll?adminId={}&ls={}&dev={}".format(
        API_HOST,
        ADMIN_ID,
        "1" if local_ls else "0",
        "1" if local_dev else "0",
    )

    try:
        response = urequests.get(url, timeout=HTTP_TIMEOUT_MS)

        if response.status_code != 200:
            print("[HTTP] code=", response.status_code)
            response.close()
            return

        payload = response.text
        response.close()

        doc = ujson.loads(payload)

        status = doc.get("motorStatus", "OFF")
        load_shedding = doc.get("loadShedding", False)
        backend_dev = doc.get("deviceReady", False)
        admin_name = doc.get("adminName", "unknown")

        print("[POLL] admin={} status={} ls={} localLS={} dev={} backendDev={}".format(
            admin_name,
            status,
            load_shedding,
            local_ls,
            local_dev,
            backend_dev
        ))

        turn_on = (status == "RUNNING") and (not load_shedding) and (not local_ls) and local_dev
        set_motor(turn_on)

    except Exception as e:
        print("[ERROR]", e)


# ---------- MAIN ----------
wlan = connect_wifi()

while True:
    ensure_wifi(wlan)

    now = time.ticks_ms()

    if time.ticks_diff(now, last_poll) >= POLL_INTERVAL_MS:
        last_poll = now
        poll_server(wlan)

    time.sleep_ms(10)`;

  const esp8266Code = `#include <ESP8266WiFi.h>
#include <WiFiManager.h>
#include <WiFiClientSecureBearSSL.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>

// =========================
// PumpPilot ESP8266 Firmware
// =========================

// NodeMCU example:
// D4=GPIO2, D2=GPIO4, D1=GPIO5
#define MOTOR_PIN 2
#define LOAD_PIN 4
#define DEVICE_PIN 5

// Set 1 if signal is ACTIVE LOW, else 0
#define LOAD_ACTIVE_LOW 0
#define DEVICE_READY_ACTIVE_LOW 1

#define POLL_INTERVAL_MS 5000
#define HTTP_TIMEOUT_MS 8000

const char* ADMIN_ID = "${adminId || "REPLACE_ADMIN_ID"}";
const char* API_HOST = "https://pms-two-kappa.vercel.app";

unsigned long lastPoll = 0;

bool readLoadSheddingPin() {
  int raw = digitalRead(LOAD_PIN);
  return LOAD_ACTIVE_LOW ? (raw == LOW) : (raw == HIGH);
}

bool readDeviceReadyPin() {
  int raw = digitalRead(DEVICE_PIN);
  return DEVICE_READY_ACTIVE_LOW ? (raw == LOW) : (raw == HIGH);
}

void setMotor(bool on) {
  digitalWrite(MOTOR_PIN, on ? HIGH : LOW);
  Serial.printf("[LED] %s\\n", on ? "ON" : "OFF");
}

void ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println("[WiFi] Reconnecting...");
  WiFi.reconnect();

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();
}

void pollServer() {
  if (WiFi.status() != WL_CONNECTED) return;

  bool localLS = readLoadSheddingPin();
  bool localDeviceReady = readDeviceReadyPin();

  Serial.printf("[PIN] loadRaw=%d devRaw=%d ls=%d dev=%d\\n",
                digitalRead(LOAD_PIN),
                digitalRead(DEVICE_PIN),
                localLS,
                localDeviceReady);

  std::unique_ptr<BearSSL::WiFiClientSecure> client(new BearSSL::WiFiClientSecure);
  client->setInsecure(); // quick test; use certificate pinning for hardened security

  HTTPClient http;

  String url = String(API_HOST) +
               "/api/esp32/poll?adminId=" + ADMIN_ID +
               "&ls=" + (localLS ? "1" : "0") +
               "&dev=" + (localDeviceReady ? "1" : "0");

  http.setConnectTimeout(HTTP_TIMEOUT_MS);
  http.setTimeout(HTTP_TIMEOUT_MS);

  if (!http.begin(*client, url)) {
    Serial.println("[HTTP] begin failed");
    return;
  }

  int code = http.GET();

  if (code != HTTP_CODE_OK) {
    Serial.printf("[HTTP] code=%d err=%s\\n", code, http.errorToString(code).c_str());
    http.end();
    return;
  }

  String payload = http.getString();
  http.end();

  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, payload);

  if (err) {
    Serial.println("[JSON] parse error");
    return;
  }

  const char* status = doc["motorStatus"] | "OFF";
  bool loadShedding = doc["loadShedding"] | false;
  bool backendDeviceReady = doc["deviceReady"] | false;
  const char* adminName = doc["adminName"] | "unknown";

  Serial.printf("[POLL] admin=%s status=%s ls=%d localLS=%d dev=%d backendDev=%d\\n",
                adminName, status, loadShedding, localLS, localDeviceReady, backendDeviceReady);

  bool turnOn = (strcmp(status, "RUNNING") == 0) && !loadShedding && !localLS && localDeviceReady;

  setMotor(turnOn);
}

void setup() {
  Serial.begin(115200);

  pinMode(MOTOR_PIN, OUTPUT);
  digitalWrite(MOTOR_PIN, LOW);

  pinMode(LOAD_PIN, INPUT_PULLUP);
  pinMode(DEVICE_PIN, INPUT_PULLUP);

  WiFiManager wm;
  wm.setConfigPortalTimeout(180);

  if (!wm.autoConnect("PumpPilot-Setup")) {
    delay(2000);
    ESP.restart();
  }

  Serial.print("WiFi Connected. IP: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  ensureWiFi();

  unsigned long now = millis();
  if (now - lastPoll >= POLL_INTERVAL_MS) {
    lastPoll = now;
    pollServer();
  }

  delay(10);
}`;

  const ttgoTCallCode = `#define TINY_GSM_MODEM_SIM800
#define TINY_GSM_RX_BUFFER 1024

#include <TinyGsmClient.h>
#include <ArduinoJson.h>

#define SerialMon Serial
#define SerialAT  Serial1

// ---------- TTGO T-Call pins ----------
#define MODEM_TX       27
#define MODEM_RX       26
#define MODEM_PWRKEY   4
#define MODEM_POWER_ON 23
#define MODEM_RST      5

// ---------- Motor / Input pins ----------
#define MOTOR_PIN   25
#define LOAD_PIN    34
#define DEVICE_PIN  35

// ---------- Signal polarity ----------
#define LOAD_ACTIVE_LOW          0
#define DEVICE_READY_ACTIVE_LOW  1

#define POLL_INTERVAL_MS 5000UL

const char apn[]      = "internet"; // update for your SIM operator APN
const char gprsUser[] = "";
const char gprsPass[] = "";

// ---------- Admin-based config ----------
const char* ADMIN_ID = "${adminId || "REPLACE_ADMIN_ID"}";
const char* SERVER   = "pms-two-kappa.vercel.app";
const int   PORT     = 80;

TinyGsm modem(SerialAT);
TinyGsmClient client(modem);

unsigned long lastPoll = 0;

bool readLoadShedding() {
  int raw = digitalRead(LOAD_PIN);
  return LOAD_ACTIVE_LOW ? (raw == LOW) : (raw == HIGH);
}

bool readDeviceReady() {
  int raw = digitalRead(DEVICE_PIN);
  return DEVICE_READY_ACTIVE_LOW ? (raw == LOW) : (raw == HIGH);
}

void setMotor(bool on) {
  digitalWrite(MOTOR_PIN, on ? HIGH : LOW);
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

bool readHttpResponseBody(String& bodyOut) {
  unsigned long t = millis();
  while (client.connected() && !client.available()) {
    if (millis() - t > 15000UL) {
      SerialMon.println("[HTTP] Timeout waiting response");
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
    SerialMon.println("[HTTP] JSON not found");
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
                "&ls=" + String(localLS ? "1" : "0") +
                "&dev=" + String(localDev ? "1" : "0");

  SerialMon.printf("[HTTP] GET %s\\n", path.c_str());

  if (!client.connect(SERVER, PORT)) {
    SerialMon.println("[HTTP] Connect failed");
    return;
  }

  client.print(String("GET ") + path + " HTTP/1.1\\r\\n");
  client.print(String("Host: ") + SERVER + "\\r\\n");
  client.print("Connection: close\\r\\n\\r\\n");

  String body;
  if (!readHttpResponseBody(body)) return;

  StaticJsonDocument<768> doc;
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    SerialMon.printf("[JSON] Parse error: %s\\n", err.c_str());
    return;
  }

  const char* motorStatus = doc["motorStatus"] | "OFF";
  bool backendLS = doc["loadShedding"] | false;
  bool backendDev = doc["deviceReady"] | false;
  const char* adminName = doc["adminName"] | "unknown";

  SerialMon.printf("[POLL] admin=%s status=%s ls=%d localLS=%d dev=%d backendDev=%d\\n",
                   adminName, motorStatus, backendLS, localLS, localDev, backendDev);

  bool turnOn = (strcmp(motorStatus, "RUNNING") == 0) &&
                !backendLS &&
                !localLS &&
                localDev &&
                backendDev;

  setMotor(turnOn);
}

void powerOnModem() {
  pinMode(MODEM_POWER_ON, OUTPUT);
  pinMode(MODEM_PWRKEY, OUTPUT);
  pinMode(MODEM_RST, OUTPUT);

  digitalWrite(MODEM_POWER_ON, HIGH);
  digitalWrite(MODEM_RST, HIGH);

  digitalWrite(MODEM_PWRKEY, LOW);
  delay(1000);
  digitalWrite(MODEM_PWRKEY, HIGH);
  delay(2000);
  digitalWrite(MODEM_PWRKEY, LOW);
}

void setup() {
  SerialMon.begin(115200);
  delay(300);

  pinMode(MOTOR_PIN, OUTPUT);
  digitalWrite(MOTOR_PIN, LOW);
  pinMode(LOAD_PIN, INPUT_PULLUP);
  pinMode(DEVICE_PIN, INPUT_PULLUP);

  powerOnModem();

  SerialAT.begin(9600, SERIAL_8N1, MODEM_RX, MODEM_TX);
  delay(3000);

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
  delay(20);
}`;

  const stm32Sim800lCode = `#define TINY_GSM_MODEM_SIM800
#define TINY_GSM_RX_BUFFER 1024

#include <TinyGsmClient.h>
#include <ArduinoJson.h>

// =========================
// PumpPilot STM32 + SIM800L
// (STM32 Arduino Core)
// =========================

// ---------- Serial ----------
#define SerialMon Serial
#define SerialAT  Serial1   // map TX/RX in your STM32 variant

// ---------- Motor / Input pins ----------
#define MOTOR_PIN   PA8
#define LOAD_PIN    PB0
#define DEVICE_PIN  PB1

// ---------- Signal polarity ----------
#define LOAD_ACTIVE_LOW          0
#define DEVICE_READY_ACTIVE_LOW  1

// ---------- Timing ----------
#define POLL_INTERVAL_MS 5000UL

// ---------- GSM ----------
const char apn[]      = "internet"; // update APN
const char gprsUser[] = "";
const char gprsPass[] = "";

// ---------- Admin-based config ----------
const char* ADMIN_ID = "${adminId || "REPLACE_ADMIN_ID"}";
const char* SERVER   = "pms-two-kappa.vercel.app";
const int   PORT     = 80;

TinyGsm modem(SerialAT);
TinyGsmClient client(modem);
unsigned long lastPoll = 0;

bool readLoadShedding() {
  int raw = digitalRead(LOAD_PIN);
  return LOAD_ACTIVE_LOW ? (raw == LOW) : (raw == HIGH);
}

bool readDeviceReady() {
  int raw = digitalRead(DEVICE_PIN);
  return DEVICE_READY_ACTIVE_LOW ? (raw == LOW) : (raw == HIGH);
}

void setMotor(bool on) {
  digitalWrite(MOTOR_PIN, on ? HIGH : LOW);
  SerialMon.printf("[MOTOR] %s\\n", on ? "ON" : "OFF");
}

bool connectGprsIfNeeded() {
  if (modem.isGprsConnected()) return true;

  SerialMon.println("[NET] Waiting network...");
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
  unsigned long t = millis();
  while (client.connected() && !client.available()) {
    if (millis() - t > 15000UL) {
      SerialMon.println("[HTTP] Timeout");
      return false;
    }
    delay(10);
  }

  String response;
  while (client.available()) response += client.readString();
  client.stop();

  int codeStart = response.indexOf("HTTP/1.1 ");
  if (codeStart < 0) codeStart = response.indexOf("HTTP/1.0 ");
  int statusCode = -1;
  if (codeStart >= 0) statusCode = response.substring(codeStart + 9, codeStart + 12).toInt();
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
  const char* adminName = doc["adminName"] | "unknown";

  SerialMon.printf("[POLL] admin=%s status=%s ls=%d localLS=%d dev=%d backendDev=%d\\n",
                   adminName, motorStatus, backendLS, localLS, localDev, backendDev);

  bool turnOn = (strcmp(motorStatus, "RUNNING") == 0) &&
                !backendLS &&
                !localLS &&
                localDev &&
                backendDev;
  setMotor(turnOn);
}

void setup() {
  SerialMon.begin(115200);
  delay(300);

  pinMode(MOTOR_PIN, OUTPUT);
  digitalWrite(MOTOR_PIN, LOW);
  pinMode(LOAD_PIN, INPUT_PULLUP);
  pinMode(DEVICE_PIN, INPUT_PULLUP);

  // set your modem baud / serial mapping as per STM32 board
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

  const loadData = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
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
      }
      if (reqRes.ok) setRequests(reqJson.requests ?? []);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && isAdmin) {
      loadData();
    }
  }, [status, isAdmin]);

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
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Create failed");
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
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Recharge failed");
    } finally {
      setRechargeLoading(false);
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
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Failed to stop/reset motor");
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
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Failed to start motor");
    } finally {
      setStartLoadingUserId(null);
    }
  };

  const handleSuspendUser = async (userId: string) => {
    setError(null);
    setSuspendError(null);
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
          <div className="flex items-center gap-2">
            <a
              href="/api/history?format=csv&download=1&limit=100"
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-cyan-400 hover:text-cyan-200"
            >
              Download History
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

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-900/40 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        )}
        {suspendError && (
          <div className="rounded-lg border border-red-500/40 bg-red-900/40 px-3 py-2 text-sm text-red-100">
            {suspendError}
          </div>
        )}
        {statusMessage && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-900/40 px-3 py-2 text-sm text-emerald-100">
            {statusMessage}
          </div>
        )}

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
          <div className="text-sm text-slate-300">Loading data...</div>
        ) : (
          <>
            <section className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-xl shadow-slate-950/40">
                <div className="text-sm text-slate-400">Create User</div>
                <input
                  className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                  placeholder="username"
                  value={newUser.username}
                  onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
                />
                <input
                  type="password"
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                  placeholder="password (min 6)"
                  value={newUser.password}
                  onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                />
                <button
                  onClick={handleCreateUser}
                  disabled={createLoading}
                  className="mt-3 w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-900/30 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {createLoading ? "Creating..." : "Create User"}
                </button>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-xl shadow-slate-950/40">
                <div className="text-sm text-slate-400">Recharge Minutes</div>
                <select
                  className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  value={rechargeTarget}
                  onChange={(e) => setRechargeTarget(e.target.value)}
                >
                  <option value="">Select user</option>
                  {users.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.username} (bal {u.availableMinutes}m)
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  placeholder="minutes to add"
                  value={rechargeMinutes}
                  onChange={(e) => setRechargeMinutes(Math.max(0, Number(e.target.value)))}
                />
                <button
                  onClick={handleRecharge}
                  disabled={rechargeLoading || !rechargeTarget || rechargeMinutes <= 0}
                  className="mt-3 w-full rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-cyan-900/30 hover:bg-cyan-300 disabled:opacity-60"
                >
                  {rechargeLoading ? "Recharging..." : "Recharge"}
                </button>
              </div>
            </section>

            <section className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl shadow-slate-950/40">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-400">Users</div>
                <div className="text-lg font-semibold text-slate-100">Your tenant</div>
              </div>
            </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-2 py-2 text-left">Username</th>
                  <th className="px-2 py-2 text-left">Admin</th>
                  <th className="px-2 py-2 text-left">Available</th>
                  <th className="px-2 py-2 text-left">Motor</th>
                  <th className="px-2 py-2 text-left">Running Time</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-100">
                {users.map((u) => (
                  <tr key={u._id}>
                    <td className="px-2 py-2">{u.username}</td>
                  <td className="px-2 py-2">{u.adminName ?? "You"}</td>
                  <td className="px-2 py-2">{u.availableMinutes} m</td>
                  <td className="px-2 py-2">
                    {u.motorStatus === "RUNNING" && effectiveRuntimeHold ? "HOLD" : u.motorStatus}
                  </td>
                  <td className="px-2 py-2">{u.motorRunningTime ?? 0} m</td>
                  <td className="px-2 py-2">
                    {u.status ?? "active"}
                    {u.suspendReason ? ` (${u.suspendReason})` : ""}
                  </td>
                    <td className="px-2 py-2">
                      <div className="flex min-w-[260px] flex-wrap gap-2">
                        <button
                          onClick={() => handleStartMotor(u._id, (u.motorRunningTime && u.motorRunningTime > 0) ? u.motorRunningTime : 5)}
                          disabled={
                            startLoadingUserId === u._id ||
                            adminStatus !== "active" ||
                            Boolean(loadShedding) ||
                            deviceReady === false ||
                            !internetOnline ||
                            u.status === "suspended"
                          }
                          className="rounded-lg border border-emerald-500 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-800/50 disabled:opacity-60"
                        >
                          {startLoadingUserId === u._id ? "Starting..." : "Start Motor"}
                        </button>
                        <button
                          onClick={() => handleStopResetMotor(u._id)}
                          disabled={stopResetLoadingUserId === u._id}
                          className="rounded-lg border border-cyan-500 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-800/50 disabled:opacity-60"
                        >
                          {stopResetLoadingUserId === u._id ? "Processing..." : "Stop/Reset"}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u._id)}
                          className="rounded-lg border border-red-500 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                        {u.status === "suspended" ? (
                          <button
                            onClick={() => handleUnsuspendUser(u._id)}
                            className="rounded-lg border border-emerald-500 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                          >
                            Unsuspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSuspendUser(u._id)}
                            className="rounded-lg border border-amber-500 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50"
                          >
                            Suspend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                  {users.length === 0 && (
                    <tr>
                      <td className="px-2 py-3 text-slate-400" colSpan={6}>
                        No users yet.
                      </td>
                    </tr>
                  )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl shadow-slate-950/40">
              <div className="text-sm text-slate-400">Queue / Activity</div>
              <div className="mt-2 text-lg font-semibold text-slate-100">Running & Waiting</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {queue.map((q) => {
                  const userMap = Object.fromEntries(users.map((u) => [u._id, u.username]));
                  const uname = getName(q.userId, userMap);
                  return (
                    <div
                      key={q._id}
                      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-100"
                    >
                      <div className="flex items-center justify-between">
                        <span>Pos #{q.position}</span>
                        <span className="text-xs uppercase text-cyan-200">
                          {q.status === "RUNNING" && effectiveRuntimeHold ? "HOLD" : q.status}
                        </span>
                      </div>
                      <div className="mt-2 text-slate-300">User: {uname}</div>
                      <div className="text-slate-400">Req: {q.requestedMinutes}m</div>
                    </div>
                  );
                })}
                {queue.length === 0 && (
                  <div className="text-sm text-slate-400">No active queue.</div>
                )}
              </div>
            </section>

            <section className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl shadow-slate-950/40">
              <div className="text-sm text-slate-400">Minute Requests</div>
              <div className="mt-3 text-xs text-slate-400">
                Pending requests from your users
              </div>
              <div className="mt-4 space-y-3">
                {requests.length === 0 && <p className="text-sm text-slate-300">No pending requests.</p>}
                {requests.map((r) => {
                  const userMap = Object.fromEntries(users.map((u) => [u._id, u.username]));
                  const uname = getName(r.userId, userMap);
                  return (
                    <div
                      key={r._id}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-100"
                    >
                      <div>
                        <div>User: {uname}</div>
                        <div className="text-slate-400">Minutes: {r.minutes}</div>
                        <div className="text-slate-500 text-xs">
                          {new Date(r.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveRequest(r._id)}
                          className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDeclineRequest(r._id)}
                          className="rounded-lg border border-red-500 px-3 py-2 text-xs text-red-700 hover:bg-red-50"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl shadow-slate-950/40">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-400">Motor Control Program</div>
                  <div className="text-xs text-slate-500">
                    Admin-based config with your ADMIN_ID
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={espCodeType}
                    onChange={(e) =>
                      setEspCodeType(e.target.value as "arduino" | "micropython" | "esp8266" | "ttgo" | "stm32")
                    }
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                  >
                    <option value="arduino">ESP32 Arduino code</option>
                    <option value="micropython">ESP32 MicroPython code</option>
                    <option value="esp8266">ESP8266 Arduino code</option>
                    <option value="ttgo">TTGO T-Call AM-036 (SIM800)</option>
                    <option value="stm32">STM32 + SIM800L code</option>
                  </select>
                  <button
                    onClick={copyEsp32Code}
                    className="rounded-lg border border-cyan-500 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-800/40"
                  >
                    {codeCopied ? "Copied" : "Copy Code"}
                  </button>
                </div>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-700 bg-black p-3 text-xs text-green-300">
{esp32Code}
              </pre>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
