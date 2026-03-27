type AdminRow = {
  _id: string;
  username: string;
  status: string;
};

type UserWithAdmin = {
  _id: string;
  username: string;
  adminId: string;
  adminName?: string;
  rfidUid?: string;
};

export function MasterManagementForms({
  newAdmin,
  onNewAdminChange,
  onCreateAdmin,
  newUser,
  admins,
  onNewUserChange,
  onCreateUser,
  rfidTarget,
  rfidUid,
  allUsers,
  rfidLoading,
  rfidMessage,
  onRfidTargetChange,
  onRfidUidChange,
  onAssignRfid,
}: {
  newAdmin: { username: string; password: string; status: string };
  onNewAdminChange: (value: { username: string; password: string; status: string }) => void;
  onCreateAdmin: () => void;
  newUser: { username: string; password: string; adminId: string };
  admins: AdminRow[];
  onNewUserChange: (value: { username: string; password: string; adminId: string }) => void;
  onCreateUser: () => void;
  rfidTarget: string;
  rfidUid: string;
  allUsers: UserWithAdmin[];
  rfidLoading: boolean;
  rfidMessage: string | null;
  onRfidTargetChange: (value: string) => void;
  onRfidUidChange: (value: string) => void;
  onAssignRfid: (clearOnly?: boolean) => void;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm text-slate-600">Create Admin</div>
        <input
          className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          placeholder="username"
          value={newAdmin.username}
          onChange={(e) => onNewAdminChange({ ...newAdmin, username: e.target.value })}
        />
        <input
          type="password"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          placeholder="password (min 6)"
          value={newAdmin.password}
          onChange={(e) => onNewAdminChange({ ...newAdmin, password: e.target.value })}
        />
        <select
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          value={newAdmin.status}
          onChange={(e) => onNewAdminChange({ ...newAdmin, status: e.target.value })}
        >
          <option value="pending">pending</option>
          <option value="active">active</option>
        </select>
        <button
          onClick={onCreateAdmin}
          className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Create Admin
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm text-slate-600">Create User</div>
        <input
          className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          placeholder="username"
          value={newUser.username}
          onChange={(e) => onNewUserChange({ ...newUser, username: e.target.value })}
        />
        <input
          type="password"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          placeholder="password (min 6)"
          value={newUser.password}
          onChange={(e) => onNewUserChange({ ...newUser, password: e.target.value })}
        />
        <select
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          value={newUser.adminId}
          onChange={(e) => onNewUserChange({ ...newUser, adminId: e.target.value })}
        >
          <option value="">Select admin</option>
          {admins.map((a) => (
            <option key={a._id} value={a._id}>
              {a.username} ({a.status})
            </option>
          ))}
        </select>
        <button
          onClick={onCreateUser}
          className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          disabled={!newUser.adminId}
        >
          Create User
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm text-slate-600">RFID Card Registration</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <select
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            value={rfidTarget}
            onChange={(e) => onRfidTargetChange(e.target.value)}
          >
            <option value="">Select user</option>
            {allUsers.map((u) => (
              <option key={u._id} value={u._id}>
                {u.username}
                {u.rfidUid ? ` [${u.rfidUid}]` : ""}
                {` (${u.adminName ?? u.adminId})`}
              </option>
            ))}
          </select>
          <input
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 uppercase"
            placeholder="RFID UID (UPPERCASE)"
            value={rfidUid}
            onChange={(e) => onRfidUidChange(e.target.value.toUpperCase())}
          />
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            onClick={() => onAssignRfid(false)}
            disabled={rfidLoading || !rfidTarget || !rfidUid.trim()}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {rfidLoading ? "Assigning..." : "Assign"}
          </button>
          <button
            onClick={() => onAssignRfid(true)}
            disabled={rfidLoading || !rfidTarget}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Clear
          </button>
          {rfidMessage && <span className="self-center text-xs text-emerald-600">{rfidMessage}</span>}
        </div>
      </div>
    </section>
  );
}
