export function AdminFirmwareCodeSection({
  espCodeType,
  onEspCodeTypeChange,
  onCopyCode,
  codeCopied,
  esp32Code,
}: {
  espCodeType: "arduino" | "micropython" | "esp8266" | "ttgo" | "stm32";
  onEspCodeTypeChange: (value: "arduino" | "micropython" | "esp8266" | "ttgo" | "stm32") => void;
  onCopyCode: () => void;
  codeCopied: boolean;
  esp32Code: string;
}) {
  return (
    <section className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl shadow-slate-950/40">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-slate-400">Motor Control Program</div>
          <div className="text-xs text-slate-500">Admin-based config with your ADMIN_ID</div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={espCodeType}
            onChange={(e) =>
              onEspCodeTypeChange(e.target.value as "arduino" | "micropython" | "esp8266" | "ttgo" | "stm32")
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
            onClick={onCopyCode}
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
  );
}
