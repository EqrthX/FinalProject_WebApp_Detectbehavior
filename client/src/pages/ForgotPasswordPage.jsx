import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, Mail } from "lucide-react";
import AuthPanel from "../components/AuthPanel";
import { supabase } from "../config/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const sending = useRef(false);
  const successRef = useRef(null);

  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => { if (sentEmail) successRef.current?.focus(); }, [sentEmail]);

  const sendLink = async (targetEmail) => {
    if (sending.current || cooldown > 0) return;
    sending.current = true;
    setLoading(true);
    setError("");
    try {
      const { error: requestError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: new URL("/reset-password", window.location.origin).href,
      });
      if (requestError) {
        if (requestError.status === 429 || requestError.code === "over_email_send_rate_limit") {
          setCooldown(60);
          setError("ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองอีกครั้ง");
        } else {
          setError("ยังส่งคำขอไม่ได้ กรุณาลองอีกครั้ง หากยังไม่ได้ให้ติดต่อผู้ดูแลระบบ");
        }
        return;
      }
      // ไม่ยืนยันว่ามีบัญชีนี้อยู่ เพื่อไม่เปิดเผยรายชื่อผู้ใช้
      setSentEmail(targetEmail);
      setCooldown(60);
    } catch {
      setError("เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง");
    } finally {
      sending.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthPanel title={sentEmail ? "ตรวจสอบอีเมลของคุณ" : "ลืมรหัสผ่าน?"} description={sentEmail ? "เปิดลิงก์ในอีเมลเพื่อตั้งรหัสผ่านใหม่ แล้วกลับมาเข้าสู่ระบบได้ตามปกติ" : "กรอกอีเมลที่ผูกกับบัญชีของคุณ เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้"}>
      {sentEmail ? (
        <div className="space-y-5">
          <div ref={successRef} tabIndex={-1} role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-7 text-emerald-900 focus:outline-none">
            <CheckCircle2 className="mb-2" size={24} aria-hidden="true" />
            หากมีบัญชีที่ใช้อีเมล <strong className="break-all">{sentEmail}</strong> คุณจะได้รับลิงก์สำหรับตั้งรหัสผ่านใหม่
          </div>
          <p className="text-sm leading-6 text-slate-500">ยังไม่พบอีเมล? ตรวจสอบโฟลเดอร์สแปมหรือจดหมายขยะ และรอสักครู่ก่อนขอลิงก์ใหม่</p>
          <button type="button" disabled={loading || cooldown > 0} onClick={() => sendLink(sentEmail)} className="w-full rounded-lg bg-blue-700 px-4 py-3 font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "กำลังส่งคำขอ..." : cooldown > 0 ? `ส่งอีกครั้งได้ใน ${cooldown} วินาที` : "ส่งลิงก์อีกครั้ง"}
          </button>
          <button type="button" disabled={loading} onClick={() => { setSentEmail(""); setError(""); }} className="w-full rounded-lg py-2 text-sm text-blue-700 hover:underline disabled:opacity-50">ใช้อีเมลอื่น</button>
        </div>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); void sendLink(email.trim()); }} className="space-y-5" aria-busy={loading}>
          <div>
            <label htmlFor="reset-email" className="mb-2 block text-sm font-medium text-slate-700">อีเมลที่ใช้กับบัญชี</label>
            <div className="relative">
              <Mail size={19} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" aria-hidden="true" />
              <input id="reset-email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} disabled={loading} placeholder="name@example.com" aria-describedby="email-help" className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50" />
            </div>
            <p id="email-help" className="mt-2 text-xs leading-5 text-slate-500">ใช้อีเมลที่ลงทะเบียนไว้ ไม่ใช่รหัสประจำตัวอาจารย์ หากจำไม่ได้ให้ติดต่อผู้ดูแลระบบ</p>
          </div>
          <button disabled={loading || cooldown > 0} type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
            {loading && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
            {loading ? "กำลังส่งคำขอ..." : cooldown > 0 ? `ส่งอีกครั้งได้ใน ${cooldown} วินาที` : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}
          </button>
        </form>
      )}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</p>}
    </AuthPanel>
  );
}
