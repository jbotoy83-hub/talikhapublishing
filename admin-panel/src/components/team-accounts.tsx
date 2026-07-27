import { useState } from "react";

type Account = { id: string; username: string | null; display_name: string; access_views: string[]; requires_account_setup: boolean; last_signed_in_at: string | null; last_opened_at: string | null };
const standardViews = ["overview", "submissions", "authors", "studies", "reports", "certificates", "journals", "production", "media"];
const words = ["atlas", "cedar", "lumen", "narra", "river", "sinta", "tala", "verve", "woven", "yara"];
const makePassword = () => `${words[Math.floor(Math.random() * words.length)]}-${Math.random().toString(36).slice(2, 8)}-T!`;
const makeUsername = (index: number) => `${words[Math.floor(Math.random() * words.length)]}.team${index}`;

export function TeamAccounts({ isAdmin }: { isAdmin: boolean }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [credentials, setCredentials] = useState<Array<{ username: string; password: string }>>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  if (!isAdmin) return null;
  async function load() { const response = await fetch("/api/admin/accounts"); const data = await response.json().catch(() => ({})); if (response.ok) setAccounts(data.accounts || []); else setMessage(data.error || "Accounts could not be loaded."); }
  async function generateFive() {
    setLoading(true); setMessage(""); setCredentials([]);
    const created: Array<{ username: string; password: string }> = [];
    for (let index = 1; index <= 5; index += 1) {
      const username = makeUsername(index); const password = makePassword();
      const response = await fetch("/api/admin/accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, temporaryPassword: password, accessViews: standardViews }) });
      if (response.ok) created.push({ username, password });
      else { const data = await response.json().catch(() => ({})); setMessage(data.error || "Some accounts could not be created."); break; }
    }
    setCredentials(created); setLoading(false); await load();
  }
  return <section className="settings-panel" style={{ marginTop: 20 }}><div className="settings-panel__head"><div><strong>Team accounts</strong><small>Create username-only accounts. Each person chooses their displayed name and a new password at first sign-in.</small></div><div style={{ display: "flex", gap: 8 }}><button onClick={load} type="button">Refresh</button><button onClick={generateFive} type="button" disabled={loading}>{loading ? "Creating…" : "Generate 5 accounts"}</button></div></div>{message && <p className="settings-account-message">{message}</p>}{credentials.length > 0 && <div className="settings-account-credentials"><strong>Give each temporary credential privately. These passwords are shown only now.</strong>{credentials.map((item) => <p key={item.username}><code>{item.username}</code><span>{item.password}</span></p>)}</div>}<div className="settings-account-list">{accounts.length ? accounts.map((account) => <article key={account.id}><strong>{account.display_name || account.username || "Administrator"}</strong><span>{account.username || "Email administrator"}</span><small>{account.requires_account_setup ? "Awaiting first setup" : `Last opened: ${account.last_opened_at ? new Date(account.last_opened_at).toLocaleString() : "Not yet"}`}</small></article>) : <p>Load accounts to see their first sign-in and app-open status.</p>}</div></section>;
}
