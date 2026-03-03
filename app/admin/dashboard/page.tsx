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
  const [codeCopied, setCodeCopied] = useState(false);
  const [espCodeType, setEspCodeType] = useState<"arduino" | "micropython" | "esp8266">("arduino");

  const isAdmin = session?.user?.role === "admin";
  const adminId = session?.user?.adminId ?? "";

  const esp32ArduinoCode = `#include <WiFiManager.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#define MOTOR_PIN 23
#define LOAD_PIN 34

#define POLL_INTERVAL_MS 5000
#define HTTP_TIMEOUT_MS 6000

const char* ADMIN_ID = "${adminId || "REPLACE_ADMIN_ID"}";
const char* API_HOST = "https://pms-two-kappa.vercel.app";

unsigned long lastPoll = 0;

void setMotor(bool on) {
  digitalWrite(MOTOR_PIN, on ? HIGH : LOW);
  Serial.printf("[LED] %s\\n", on ? "ON" : "OFF");
}

void ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.reconnect();

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 8000) {
    delay(200);
    Serial.print(".");
  }
  Serial.println();
}

void pollServer() {
  if (WiFi.status() != WL_CONNECTED) return;

  bool localLS = (digitalRead(LOAD_PIN) == HIGH);

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  String url = String(API_HOST) + "/api/esp32/poll?adminId=" + ADMIN_ID + "&ls=" + (localLS ? "1" : "0");

  http.setTimeout(HTTP_TIMEOUT_MS);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

  if (!http.begin(client, url)) {
    Serial.println("[HTTP] begin failed");
    return;
  }

  int code = http.GET();

  if (code != HTTP_CODE_OK) {
    String location = http.header("Location");
    Serial.printf("[HTTP] code=%d", code);
    if (location.length() > 0) {
      Serial.printf(" redirect=%s", location.c_str());
    }
    Serial.println();
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
  const char* adminName = doc["adminName"] | "unknown";

  Serial.printf("[POLL] admin=%s status=%s ls=%d localLS=%d\\n",
                adminName, status, loadShedding, localLS);

  bool turnOn = (strcmp(status, "RUNNING") == 0) && !loadShedding && !localLS;
  setMotor(turnOn);
}

void setup() {
  Serial.begin(115200);

  pinMode(MOTOR_PIN, OUTPUT);
  digitalWrite(MOTOR_PIN, LOW);

  pinMode(LOAD_PIN, INPUT_PULLUP);

  WiFiManager wm;
  wm.setConfigPortalTimeout(180);
  if (!wm.autoConnect("SmartPump-Setup")) {
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

  const esp32MicroPythonCode = `import network
import time
import machine
import urequests
import ujson

# ========== CONFIG ==========
WIFI_SSID = "YOUR_WIFI_NAME"
WIFI_PASS = "YOUR_WIFI_PASSWORD"

MOTOR_PIN = 23
LOAD_PIN = 34

POLL_INTERVAL_MS = 5000
HTTP_TIMEOUT_MS = 6  # seconds

ADMIN_ID = "${adminId || "REPLACE_ADMIN_ID"}"
API_HOST = "https://pms-two-kappa.vercel.app"

# ========== SETUP ==========
motor = machine.Pin(MOTOR_PIN, machine.Pin.OUT)
load_pin = machine.Pin(LOAD_PIN, machine.Pin.IN, machine.Pin.PULL_UP)

last_poll = 0


# ========== FUNCTIONS ==========

def set_motor(on):
    motor.value(1 if on else 0)
    print("[LED]", "ON" if on else "OFF")


def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)

    if not wlan.isconnected():
        print("Connecting to WiFi...")
        wlan.connect(WIFI_SSID, WIFI_PASS)

        timeout = 8
        start = time.time()

        while not wlan.isconnected():
            if time.time() - start > timeout:
                print("WiFi Failed. Restarting...")
                machine.reset()
            time.sleep(0.2)

    print("WiFi Connected:", wlan.ifconfig())
    return wlan


def ensure_wifi(wlan):
    if not wlan.isconnected():
        wlan.disconnect()
        wlan.connect(WIFI_SSID, WIFI_PASS)


def poll_server(wlan):
    if not wlan.isconnected():
        return

    local_ls = (load_pin.value() == 1)

    url = "{}/api/esp32/poll?adminId={}&ls={}".format(
        API_HOST,
        ADMIN_ID,
        "1" if local_ls else "0"
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
        admin_name = doc.get("adminName", "unknown")

        print("[POLL] admin={} status={} ls={} localLS={}".format(
            admin_name,
            status,
            load_shedding,
            local_ls
        ))

        turn_on = (status == "RUNNING") and (not load_shedding) and (not local_ls)
        set_motor(turn_on)

    except Exception as e:
        print("[ERROR]", e)


# ========== MAIN ==========
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

#define MOTOR_PIN 23
#define LOAD_PIN 34

#define POLL_INTERVAL_MS 5000
#define HTTP_TIMEOUT_MS 6000

const char* ADMIN_ID = "${adminId || "REPLACE_ADMIN_ID"}";
const char* API_HOST = "https://pms-two-kappa.vercel.app";

unsigned long lastPoll = 0;

void setMotor(bool on) {
  digitalWrite(MOTOR_PIN, on ? HIGH : LOW);
  Serial.printf("[LED] %s\\n", on ? "ON" : "OFF");
}

void ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  WiFi.reconnect();

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 8000) {
    delay(200);
    Serial.print(".");
  }
  Serial.println();
}

void pollServer() {
  if (WiFi.status() != WL_CONNECTED) return;

  bool localLS = (digitalRead(LOAD_PIN) == HIGH);

  std::unique_ptr<BearSSL::WiFiClientSecure> client(new BearSSL::WiFiClientSecure);
  client->setInsecure();

  HTTPClient http;

  String url = String(API_HOST) + "/api/esp32/poll?adminId=" + ADMIN_ID +
               "&ls=" + (localLS ? "1" : "0");

  http.setTimeout(HTTP_TIMEOUT_MS);

  if (!http.begin(*client, url)) {
    Serial.println("[HTTP] begin failed");
    return;
  }

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
    Serial.println("[JSON] parse error");
    return;
  }

  const char* status = doc["motorStatus"] | "OFF";
  bool loadShedding = doc["loadShedding"] | false;
  const char* adminName = doc["adminName"] | "unknown";

  Serial.printf("[POLL] admin=%s status=%s ls=%d localLS=%d\\n",
                adminName, status, loadShedding, localLS);

  bool turnOn = (strcmp(status, "RUNNING") == 0) && !loadShedding && !localLS;

  setMotor(turnOn);
}

void setup() {
  Serial.begin(115200);

  pinMode(MOTOR_PIN, OUTPUT);
  digitalWrite(MOTOR_PIN, LOW);

  pinMode(LOAD_PIN, INPUT_PULLUP);

  WiFiManager wm;
  wm.setConfigPortalTimeout(180);

  if (!wm.autoConnect("SmartPump-Setup")) {
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

  const esp32Code =
    espCodeType === "arduino"
      ? esp32ArduinoCode
      : espCodeType === "micropython"
        ? esp32MicroPythonCode
        : esp8266Code;

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
      const usersJson = await usersRes.json();
      const activityJson = await activityRes.json();
      const statusJson = await statusRes.json();
      const reqJson = await reqRes.json();
      setUsers(usersJson.users ?? []);
      setQueue(activityJson.queue ?? []);
      if (statusRes.ok && statusJson.admin?.loadShedding !== undefined) {
        setLoadShedding(!!statusJson.admin.loadShedding);
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

  const handleCreateUser = async () => {
    setCreateLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const json = await res.json();
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
      const json = await res.json();
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
    const json = await res.json();
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
    const json = await res.json();
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
    const json = await res.json();
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
      const json = await res.json();
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
    const json = await res.json();
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
    const json = await res.json();
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
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">SmartPump Pro</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">Admin Dashboard</h1>
            <p className="text-sm text-slate-300">
              Manage users, wallet recharges, load shedding, and queue.
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-cyan-400 hover:text-cyan-200"
          >
            Logout
          </button>
        </header>

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
                  <td className="px-2 py-2">{u.motorStatus}</td>
                  <td className="px-2 py-2">{u.motorRunningTime ?? 0} m</td>
                  <td className="px-2 py-2">
                    {u.status ?? "active"}
                    {u.suspendReason ? ` (${u.suspendReason})` : ""}
                  </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => handleStopResetMotor(u._id)}
                        disabled={stopResetLoadingUserId === u._id}
                        className="rounded-lg border border-cyan-500 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-800/50 disabled:opacity-60"
                      >
                        {stopResetLoadingUserId === u._id ? "Processing..." : "Stop/Reset"}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u._id)}
                        className="ml-2 rounded-lg border border-red-600 px-2 py-1 text-xs text-red-200 hover:bg-red-800/50"
                      >
                        Delete
                      </button>
                      {u.status === "suspended" ? (
                        <button
                          onClick={() => handleUnsuspendUser(u._id)}
                          className="ml-2 rounded-lg border border-emerald-500 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-800/50"
                        >
                          Unsuspend
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSuspendUser(u._id)}
                          className="ml-2 rounded-lg border border-amber-500 px-2 py-1 text-xs text-amber-200 hover:bg-amber-800/50"
                        >
                          Suspend
                        </button>
                      )}
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
                        <span className="text-xs uppercase text-cyan-200">{q.status}</span>
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
                          className="rounded-lg border border-red-600 px-3 py-2 text-xs text-red-200 hover:bg-red-800/50"
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
                      setEspCodeType(e.target.value as "arduino" | "micropython" | "esp8266")
                    }
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                  >
                    <option value="arduino">ESP32 Arduino code</option>
                    <option value="micropython">ESP32 MicroPython code</option>
                    <option value="esp8266">ESP8266 Arduino code</option>
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
