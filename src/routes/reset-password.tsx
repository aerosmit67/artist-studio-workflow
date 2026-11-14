import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import studioCss from "../studio/index.css?url";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Artist Studio" },
      { name: "description", content: "Choose a new password for your Artist Studio account." },
      { property: "og:title", content: "Reset password — Artist Studio" },
      { property: "og:description", content: "Choose a new password for your Artist Studio account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "stylesheet", href: studioCss }],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setMsg(error.message);
    else window.location.href = "/";
  };
  return (
    <div className="page auth-page">
      <h1>Choose a new password</h1>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span className="field-label">New password</span>
          <input className="input" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {msg && <p className="auth-error">{msg}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
      </form>
    </div>
  );
}
