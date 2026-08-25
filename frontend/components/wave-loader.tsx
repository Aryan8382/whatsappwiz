"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function WaveLoader({ ready = false }: { ready?: boolean }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setVisible(false), 600);
    return () => clearTimeout(t);
  }, [ready]);

  if (!visible) return null;

  return (
    <div
      aria-label="Loading"
      aria-live="polite"
      style={{
        position:             "fixed",
        inset:                0,
        zIndex:               9999,
        display:              "flex",
        flexDirection:        "column",
        alignItems:           "center",
        justifyContent:       "center",
        gap:                  0,
        /* layered gradient — rich green glass */
        background: `
          radial-gradient(ellipse 80% 60% at 50% 0%,   rgba(34,197,94,0.18) 0%, transparent 70%),
          radial-gradient(ellipse 60% 80% at 80% 100%, rgba(18,140,126,0.14) 0%, transparent 60%),
          radial-gradient(ellipse 60% 80% at 20% 80%,  rgba(22,163,74,0.10) 0%, transparent 60%),
          rgba(240,253,244,0.82)
        `,
        backdropFilter:       "blur(32px) saturate(220%) brightness(1.04)",
        WebkitBackdropFilter: "blur(32px) saturate(220%) brightness(1.04)",
        opacity:              ready ? 0 : 1,
        pointerEvents:        ready ? "none" : "all",
        transition:           "opacity 540ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* ── Card ── */}
      <div
        style={{
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          gap:            "32px",
          padding:        "48px 56px",
          borderRadius:   "28px",
          background:     "rgba(255,255,255,0.62)",
          border:         "1px solid rgba(255,255,255,0.90)",
          boxShadow: `
            0 0 0 1px rgba(34,197,94,0.08),
            0 8px 32px rgba(18,140,126,0.10),
            0 2px 8px  rgba(0,0,0,0.06),
            inset 0 1px 0 rgba(255,255,255,0.95)
          `,
          backdropFilter:       "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          animation:            "cardIn 0.5s cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        {/* Logo */}
        <Image
          src="/logo.png"
          alt="WhatsApp Wiz"
          width={148}
          height={48}
          priority
          unoptimized
          style={{ height: "40px", width: "auto", objectFit: "contain" }}
        />

        {/* ── Morphing dot pulse (3 dots) ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                width:           "11px",
                height:          "11px",
                borderRadius:    "50%",
                background:      "linear-gradient(135deg,#25d366 0%,#128C7E 100%)",
                boxShadow:       "0 2px 8px rgba(37,211,102,0.50)",
                animation:       "dotBounce 1.3s ease-in-out infinite",
                animationDelay:  `${i * 0.18}s`,
              }}
            />
          ))}
        </div>

        {/* ── Thin progress track ── */}
        <div
          style={{
            width:        "120px",
            height:       "3px",
            borderRadius: "99px",
            background:   "rgba(34,197,94,0.12)",
            overflow:     "hidden",
            marginTop:    "-14px",
          }}
        >
          <div
            style={{
              height:      "100%",
              borderRadius:"99px",
              background:  "linear-gradient(90deg,#25d366,#128C7E)",
              animation:   "trackSlide 1.6s ease-in-out infinite",
              boxShadow:   "0 0 8px rgba(37,211,102,0.60)",
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes cardIn {
          from { opacity:0; transform:translateY(16px) scale(0.96); }
          to   { opacity:1; transform:translateY(0)    scale(1);    }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: scale(0.7) translateY(0);  opacity: 0.4; }
          40%            { transform: scale(1.2) translateY(-8px); opacity: 1;   }
        }
        @keyframes trackSlide {
          0%   { width:0%;    margin-left:0%;    }
          50%  { width:70%;   margin-left:15%;   }
          100% { width:0%;    margin-left:100%;  }
        }
      `}</style>
    </div>
  );
}
