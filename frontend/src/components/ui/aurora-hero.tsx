"use client";

import React from "react";

export function AuroraHero({
  title = "People",
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { title?: string }) {
  return (
    <section className={`aurora-wrap relative size-full overflow-hidden ${className}`} {...props}>
      <style>{`
        .aurora-wrap { background: #08040f; }

        /* ── The aurora: violet pools that drift slowly ── */
        .aurora-field {
          position: absolute;
          inset: -25%;
          filter: blur(70px) saturate(135%);
          background:
            radial-gradient(38% 46% at 22% 26%, #7c3aed 0%, transparent 62%),
            radial-gradient(34% 42% at 74% 16%, #a855f7 0%, transparent 60%),
            radial-gradient(42% 48% at 64% 74%, #6d28d9 0%, transparent 62%),
            radial-gradient(32% 40% at 14% 82%, #9333ea 0%, transparent 58%),
            radial-gradient(30% 38% at 92% 58%, #8b5cf6 0%, transparent 55%);
          animation: auroraDrift 34s ease-in-out infinite alternate;
        }
        @keyframes auroraDrift {
          0%   { transform: translate3d(0,0,0) scale(1); }
          50%  { transform: translate3d(4%, -3%, 0) scale(1.09); }
          100% { transform: translate3d(-4%, 3%, 0) scale(1.04); }
        }

        /* ── Fluted glass: vertical ribs refracting the aurora ── */
        .aurora-flutes {
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            to right,
            rgba(255,255,255,0.10) 0px,
            rgba(255,255,255,0.02) 5px,
            rgba(0,0,0,0.30) 12px,
            rgba(0,0,0,0.10) 20px,
            rgba(255,255,255,0.10) 26px
          );
          mix-blend-mode: overlay;
          opacity: 0.85;
        }
        /* A second, wider rib pass gives the glass real thickness. */
        .aurora-flutes-2 {
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            to right,
            rgba(255,255,255,0.06) 0px,
            transparent 3px,
            transparent 44px,
            rgba(255,255,255,0.06) 48px
          );
          mix-blend-mode: soft-light;
        }

        /* Keeps the panel grounded and the copy readable. */
        .aurora-veil {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(to top, rgba(8,4,15,0.92) 0%, rgba(8,4,15,0.25) 45%, transparent 70%),
            radial-gradient(120% 90% at 50% 30%, transparent 40%, rgba(8,4,15,0.75) 100%);
        }

        /* Wordmark sits inside the glass rather than on top of it. */
        .aurora-title {
          position: absolute;
          left: 0; right: 0;
          top: 50%;
          transform: translateY(-50%);
          text-align: center;
          font-size: clamp(3rem, 9vw, 6.5rem);
          font-weight: 700;
          letter-spacing: -0.03em;
          line-height: 1;
          color: transparent;
          background: linear-gradient(180deg, rgba(255,255,255,0.34), rgba(255,255,255,0.06));
          -webkit-background-clip: text;
          background-clip: text;
          user-select: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .aurora-field { animation: none; }
        }
      `}</style>

      <div className="aurora-field" />
      <div className="aurora-flutes" />
      <div className="aurora-flutes-2" />
      <div className="aurora-veil" />
      <div className="aurora-title">{title}</div>

      {children && <div className="relative z-10 size-full">{children}</div>}
    </section>
  );
}
