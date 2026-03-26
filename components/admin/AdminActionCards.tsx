type UserRow = {
  _id: string;
  username: string;
  rfidUid?: string;
  availableMinutes: number;
};

export function AdminActionCards({
  newUser,
  createLoading,
  onNewUserChange,
  onCreateUser,
  users,
  rechargeTarget,
  rechargeMinutes,
  rechargeLoading,
  onRechargeTargetChange,
  onRechargeMinutesChange,
  onRecharge,
  rfidTarget,
  rfidUid,
  rfidLoading,
  rfidMessage,
  rfidError,
  onRfidTargetChange,
  onRfidUidChange,
  onAssignRfid,
}: {
  newUser: { username: string; password: string };
  createLoading: boolean;
  onNewUserChange: (value: { username: string; password: string }) => void;
  onCreateUser: () => void;
  users: UserRow[];
  rechargeTarget: string;
  rechargeMinutes: number;
  rechargeLoading: boolean;
  onRechargeTargetChange: (value: string) => void;
  onRechargeMinutesChange: (value: number) => void;
  onRecharge: () => void;
  rfidTarget: string;
  rfidUid: string;
  rfidLoading: boolean;
  rfidMessage: string | null;
  rfidError: string | null;
  onRfidTargetChange: (value: string) => void;
  onRfidUidChange: (value: string) => void;
  onAssignRfid: (clearOnly?: boolean) => void;
}) {
  return (
    <section className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-xl shadow-slate-950/40">
        <div className="text-sm text-slate-400">Create User</div>
        <input
          className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
          placeholder="username"
          value={newUser.username}
          onChange={(e) => onNewUserChange({ ...newUser, username: e.target.value })}
        />
        <input
          type="password"
          className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
          placeholder="password (min 6)"
          value={newUser.password}
          onChange={(e) => onNewUserChange({ ...newUser, password: e.target.value })}
        />
        <button
          onClick={onCreateUser}
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
          onChange={(e) => onRechargeTargetChange(e.target.value)}
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
          onChange={(e) => onRechargeMinutesChange(Math.max(0, Number(e.target.value)))}
        />
        <button
          onClick={onRecharge}
          disabled={rechargeLoading || !rechargeTarget || rechargeMinutes <= 0}
          className="mt-3 w-full rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-cyan-900/30 hover:bg-cyan-300 disabled:opacity-60"
        >
          {rechargeLoading ? "Recharging..." : "Recharge"}
        </button>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-xl shadow-slate-950/40">
        <div className="text-sm text-slate-400">RFID Card Registration</div>
        <select
          className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          value={rfidTarget}
          onChange={(e) => onRfidTargetChange(e.target.value)}
        >
          <option value="">Select user</option>
          {users.map((u) => (
            <option key={u._id} value={u._id}>
              {u.username}
              {u.rfidUid ? ` (${u.rfidUid})` : ""}
            </option>
          ))}
        </select>
        <input
          className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 uppercase"
          placeholder="RFID UID (UPPERCASE)"
          value={rfidUid}
          onChange={(e) => onRfidUidChange(e.target.value.toUpperCase())}
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onAssignRfid(false)}
            disabled={rfidLoading || !rfidTarget || !rfidUid.trim()}
            className="flex-1 rounded-xl bg-indigo-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-indigo-900/30 hover:bg-indigo-300 disabled:opacity-60"
          >
            {rfidLoading ? "Assigning..." : "Assign"}
          </button>
          <button
            onClick={() => onAssignRfid(true)}
            disabled={rfidLoading || !rfidTarget}
            className="flex-1 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800/40 disabled:opacity-60"
          >
            Clear
          </button>
        </div>
        {rfidMessage ? <div className="mt-2 text-xs text-emerald-300">{rfidMessage}</div> : null}
        {rfidError ? <div className="mt-2 text-xs text-rose-300">{rfidError}</div> : null}
      </div>
    </section>
  );
}
