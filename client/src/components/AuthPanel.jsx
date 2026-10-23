import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import BG from "../assets/backgroud.png";

export default function AuthPanel({ title, description, children }) {
  return (
    <main className="relative min-h-screen flex items-center justify-center lg:justify-end bg-cover bg-top px-4 py-10 sm:px-8 lg:px-20" style={{ backgroundImage: `url(${BG})` }}>
      <div className="absolute inset-0 bg-slate-950/25" aria-hidden="true" />
      <section aria-labelledby="auth-title" className="relative w-full max-w-lg rounded-2xl border border-white/70 bg-white p-6 shadow-2xl sm:p-10">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 rounded text-sm text-slate-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
          <ArrowLeft size={16} aria-hidden="true" /> กลับไปเข้าสู่ระบบ
        </Link>
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><ShieldCheck size={25} aria-hidden="true" /></div>
        <p className="mb-2 text-xs font-medium tracking-widest text-blue-700">BEHAVIOR DETECTION</p>
        <h1 id="auth-title" className="text-2xl font-semibold text-slate-900 sm:text-3xl">{title}</h1>
        <p className="mt-3 mb-7 text-sm leading-7 text-slate-500">{description}</p>
        {children}
      </section>
    </main>
  );
}
