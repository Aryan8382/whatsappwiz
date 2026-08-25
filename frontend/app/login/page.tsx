"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { login, getToken } from "@/lib/api";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("admin@demo.com");
  const [password, setPassword] = useState("Admin@123");
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  if (getToken()) {
    router.replace("/");
    return null;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 relative select-none"
      style={{
        backgroundImage: "url('/loginbg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
        backgroundColor: "#dff2e8",
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div className="w-full max-w-[440px] relative z-10 flex flex-col items-center animate-slide-up">
        
        {/* ── Brand Header with Logo ── */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="transition-transform duration-300 hover:scale-105 filter drop-shadow-sm flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="WhatsApp Wiz"
              width={220}
              height={75}
              priority
              unoptimized
              className="object-contain h-12 sm:h-14 w-auto max-w-[220px]"
            />
          </div>
          <p
            className="text-[13px] mt-2 font-semibold tracking-tight"
            style={{ color: "#365140" }}
          >
            WhatsApp Business Platform
          </p>
        </div>

        {/* ── Main Deep Liquid Glass Card ── */}
        <div
          className="w-full rounded-[34px] p-7 sm:p-8"
          style={{
            background: "linear-gradient(135deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.06) 50%, rgba(255, 255, 255, 0.18) 100%)",
            border: "1.5px solid rgba(255, 255, 255, 0.75)",
            boxShadow: `
              0 35px 80px rgba(10, 40, 25, 0.14),
              0 12px 28px rgba(0, 0, 0, 0.06),
              0 2px 6px rgba(0, 0, 0, 0.04),
              inset 0 2.5px 3px rgba(255, 255, 255, 0.95),
              inset 0 -3px 8px rgba(0, 0, 0, 0.06),
              inset 2px 0 6px rgba(255, 255, 255, 0.40),
              inset -2px 0 6px rgba(0, 0, 0, 0.04)
            `,
            backdropFilter: "blur(40px) saturate(220%) contrast(106%) brightness(105%)",
            WebkitBackdropFilter: "blur(40px) saturate(220%) contrast(106%) brightness(105%)",
          }}
        >
          <h2
            className="text-[22px] font-extrabold mb-1 tracking-tight"
            style={{ color: "#0a1f14", letterSpacing: "-0.03em" }}
          >
            Sign in
          </h2>
          <p
            className="text-[13.5px] mb-7 font-medium"
            style={{ color: "#365140" }}
          >
            Manage your WhatsApp conversations
          </p>

          <form onSubmit={submit} className="space-y-4">
            {/* Email Field */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-[11px] font-bold tracking-[0.08em] uppercase"
                style={{ color: "#2c4435" }}
              >
                EMAIL
              </label>
              <div className="relative group">
                <div
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none"
                  style={{ color: "#547160" }}
                >
                  <Mail size={16} strokeWidth={2.2} />
                </div>
                <input
                  className="w-full pl-10 pr-4 py-3 rounded-[14px] text-[13.5px] font-semibold outline-none transition-all placeholder:text-gray-500/70"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@demo.com"
                  required
                  style={{
                    background: "rgba(255, 255, 255, 0.18)",
                    border: "1px solid rgba(255, 255, 255, 0.50)",
                    color: "#0a1f14",
                    boxShadow: `
                      inset 0 2px 4px rgba(0, 0, 0, 0.05),
                      inset 0 -1px 2px rgba(255, 255, 255, 0.70),
                      0 1px 1px rgba(255, 255, 255, 0.40)
                    `,
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.35)";
                    e.currentTarget.style.borderColor = "rgba(34, 197, 94, 0.70)";
                    e.currentTarget.style.boxShadow = "0 0 0 3.5px rgba(34, 197, 94, 0.22), inset 0 1px 2px rgba(255, 255, 255, 0.95)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.18)";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.50)";
                    e.currentTarget.style.boxShadow = "inset 0 2px 4px rgba(0, 0, 0, 0.05), inset 0 -1px 2px rgba(255, 255, 255, 0.70), 0 1px 1px rgba(255, 255, 255, 0.40)";
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-[11px] font-bold tracking-[0.08em] uppercase"
                style={{ color: "#2c4435" }}
              >
                PASSWORD
              </label>
              <div className="relative group">
                <div
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none"
                  style={{ color: "#547160" }}
                >
                  <Lock size={16} strokeWidth={2.2} />
                </div>
                <input
                  className="w-full pl-10 pr-10 py-3 rounded-[14px] text-[13.5px] font-semibold outline-none transition-all placeholder:text-gray-500/70 tracking-widest"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    background: "rgba(255, 255, 255, 0.18)",
                    border: "1px solid rgba(255, 255, 255, 0.50)",
                    color: "#0a1f14",
                    boxShadow: `
                      inset 0 2px 4px rgba(0, 0, 0, 0.05),
                      inset 0 -1px 2px rgba(255, 255, 255, 0.70),
                      0 1px 1px rgba(255, 255, 255, 0.40)
                    `,
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.35)";
                    e.currentTarget.style.borderColor = "rgba(34, 197, 94, 0.70)";
                    e.currentTarget.style.boxShadow = "0 0 0 3.5px rgba(34, 197, 94, 0.22), inset 0 1px 2px rgba(255, 255, 255, 0.95)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.18)";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.50)";
                    e.currentTarget.style.boxShadow = "inset 0 2px 4px rgba(0, 0, 0, 0.05), inset 0 -1px 2px rgba(255, 255, 255, 0.70), 0 1px 1px rgba(255, 255, 255, 0.40)";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity opacity-60 hover:opacity-100 cursor-pointer p-1"
                  style={{ color: "#2c4435" }}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={16} strokeWidth={2.2} /> : <Eye size={16} strokeWidth={2.2} />}
                </button>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div
                className="text-[12.5px] px-3.5 py-2.5 rounded-[12px] font-semibold text-center animate-shake"
                style={{
                  background: "rgba(239, 68, 68, 0.14)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  color: "#991b1b",
                  backdropFilter: "blur(12px)",
                }}
              >
                {error}
              </div>
            )}

            {/* Sign in Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-[16px] text-[15px] font-bold text-white transition-all transform hover:brightness-110 active:scale-[0.98] mt-3 flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden group select-none"
              style={{
                background: "linear-gradient(180deg, rgba(34, 197, 94, 0.92) 0%, rgba(22, 163, 74, 0.96) 50%, rgba(21, 128, 61, 0.98) 100%)",
                border: "1px solid rgba(255, 255, 255, 0.45)",
                boxShadow: `
                  0 16px 34px rgba(22, 163, 74, 0.45),
                  0 4px 12px rgba(0, 0, 0, 0.08),
                  inset 0 2.5px 2px rgba(255, 255, 255, 0.85),
                  inset 0 1px 0 rgba(255, 255, 255, 0.95),
                  inset 0 -3.5px 6px rgba(0, 0, 0, 0.28),
                  inset 1.5px 0 3px rgba(255, 255, 255, 0.40),
                  inset -1.5px 0 3px rgba(0, 0, 0, 0.15)
                `,
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.25)",
              }}
            >
              {/* Top glass gloss reflection sheen */}
              <span
                className="absolute inset-x-0 top-0 h-[48%] pointer-events-none rounded-t-[15px]"
                style={{
                  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.38) 0%, rgba(255, 255, 255, 0.03) 100%)",
                }}
              />

              {loading ? (
                <span className="relative z-10 flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                <span className="relative z-10 tracking-wide font-bold">Sign in</span>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
