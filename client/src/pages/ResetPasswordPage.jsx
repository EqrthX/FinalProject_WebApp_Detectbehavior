import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, EyeOff, LoaderCircle, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import AuthPanel from "../components/AuthPanel";
import { supabase } from "../config/supabase";

// อ่านก่อน Supabase นำ fragment ของลิงก์ recovery ออกจาก URL
const linkParams = new URLSearchParams(window.location.hash.slice(1));
const searchParams = new URLSearchParams(window.location.search);
const recoveryToken = linkParams.get("access_token");
const recoveryLink = linkParams.get("type") === "recovery" && Boolean(recoveryToken);
const linkHasError = linkParams.has("error") || linkParams.has("error_code") || searchParams.has("error") || searchParams.has("error_code");
const recoveryKey = "behavior-password-recovery";

function rememberRecovery(session) {
  if (!session?.user?.id || !session.expires_at) return;
  try {
    sessionStorage.setItem(recoveryKey, JSON.stringify({ userId: session.user.id, expiresAt: session.expires_at * 1000 }));
  } catch { /* การปิด storage ไม่ควรขัดขวางการใช้ลิงก์ในหน้านี้ */ }
}

function matchesRecovery(session) {
  try {
    const recovery = JSON.parse(sessionStorage.getItem(recoveryKey));
    return Boolean(session?.user?.id && recovery?.userId === session.user.id && recovery.expiresAt > Date.now());
  } catch { return false; }
}

export default function ResetPasswordPage() {
  const [linkState, setLinkState] = useState("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const successRef = useRef(null);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" && session && !linkHasError) {
        rememberRecovery(session);
        setLinkState("ready");
      } else if (event === "SIGNED_OUT") {
        setLinkState("invalid");
      }
    });
    const checkLink = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (!active) return;
        const session = data?.session;
        const validContext = recoveryLink ? session?.access_token === recoveryToken : matchesRecovery(session);
        if (linkHasError || sessionError || !session || !validContext) {
          setLinkState("invalid");
          return;
        }
        rememberRecovery(session);
        setLinkState("ready");
      } catch {
        if (active) setLinkState("invalid");
      }
    };
    void checkLink();
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => { if (saved) successRef.current?.focus(); }, [saved]);

  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current || linkState !== "ready") return;
    setError("");
    if (password.length < 8) { setError("ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร"); return; }
    if (password !== confirmation) { setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง"); return; }
    submitting.current = true;
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        if (["session_not_found", "refresh_token_not_found", "refresh_token_already_used", "bad_jwt"].includes(updateError.code) || updateError.status === 401 || updateError.status === 403) {
          setLinkState("invalid");
        } else if (updateError.code === "same_password") {
          setError("กรุณาเลือกรหัสผ่านใหม่ที่ต่างจากรหัสผ่านเดิม");
        } else if (updateError.code === "weak_password") {
          setError("รหัสผ่านยังไม่ผ่านเงื่อนไขของระบบ ลองใช้รหัสที่ยาวขึ้นและผสมตัวอักษร ตัวเลข และสัญลักษณ์");
        } else {
          setError("ยังเปลี่ยนรหัสผ่านไม่ได้ กรุณาลองอีกครั้ง หรือขอลิงก์ใหม่");
        }
        return;
      }
      setPassword("");
      setConfirmation("");
      setSaved(true);
      try { sessionStorage.removeItem(recoveryKey); } catch { /* storage อาจถูกปิด */ }
      try {
        ["token", "role", "teacher_id", "fullname", "major"].forEach((key) => localStorage.removeItem(key));
      } catch { /* รหัสผ่านถูกบันทึกแล้ว แม้ล้าง storage ไม่สำเร็จ */ }
      // เปลี่ยนรหัสผ่านสำเร็จแล้ว การออกจาก session ล้มเหลวต้องไม่แสดงว่าบันทึกล้มเหลว
      try { await supabase.auth.signOut({ scope: "local" }); } catch { /* ให้กลับไป login ใหม่ */ }
    } catch {
      setError("เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthPanel title={saved ? "ตั้งรหัสผ่านใหม่แล้ว" : "ตั้งรหัสผ่านใหม่"} description={saved ? "คุณสามารถกลับไปเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้แล้ว" : "เลือกรหัสผ่านที่คาดเดายากและไม่ได้ใช้กับบัญชีอื่น"}>
      {saved ? (
        <div ref={successRef} tabIndex={-1} className="space-y-6 focus:outline-none">
          <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"><CheckCircle2 className="mb-3" aria-hidden="true" /><p>บันทึกรหัสผ่านใหม่เรียบร้อยแล้ว</p></div>
          <Link to="/" className="block rounded-lg bg-blue-700 px-4 py-3 text-center font-medium text-white hover:bg-blue-800">กลับไปเข้าสู่ระบบ</Link>
        </div>
      ) : linkState === "checking" ? (
        <div role="status" className="flex items-center justify-center gap-3 py-10 text-sm text-slate-500"><LoaderCircle className="animate-spin" size={22} aria-hidden="true" />กำลังตรวจสอบลิงก์...</div>
      ) : linkState === "invalid" ? (
        <div className="space-y-5">
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900"><TriangleAlert className="mb-2" aria-hidden="true" /><p className="font-medium">ลิงก์นี้ยังใช้งานไม่ได้</p><p>ลิงก์อาจหมดอายุ ถูกใช้แล้ว หรือยังไม่ได้เปิดจากอีเมล กรุณาขอลิงก์ใหม่แล้วเปิดลิงก์ล่าสุด</p></div>
          <Link to="/forgot-password" className="block rounded-lg bg-blue-700 px-4 py-3 text-center font-medium text-white hover:bg-blue-800">ขอลิงก์ใหม่</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5" aria-busy={loading}>
          <div>
            <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-slate-700">รหัสผ่านใหม่</label>
            <div className="relative">
              <input id="new-password" name="new-password" type={visible ? "text" : "password"} autoComplete="new-password" required minLength={8} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} disabled={loading} aria-describedby="password-help" className="w-full rounded-lg border border-slate-300 py-3 pl-3 pr-12 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
              <button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} aria-pressed={visible} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-slate-500 focus-visible:outline-2 focus-visible:outline-blue-600">{visible ? <EyeOff size={20} /> : <Eye size={20} />}</button>
            </div>
            <p id="password-help" className="mt-2 text-xs leading-5 text-slate-500">อย่างน้อย 8 ตัวอักษร แนะนำให้ผสมตัวอักษร ตัวเลข และสัญลักษณ์</p>
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-slate-700">ยืนยันรหัสผ่านใหม่</label>
            <input id="confirm-password" name="confirm-password" type={visible ? "text" : "password"} autoComplete="new-password" required minLength={8} value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setError(""); }} disabled={loading} className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</p>}
          <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{loading && <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />}{loading ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}</button>
        </form>
      )}
    </AuthPanel>
  );
}
