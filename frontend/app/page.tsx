"use client";

import { ArrowRight, BriefcaseBusiness, Droplets, Flame, HardHat, LineChart, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogoMark } from "@/components/layout/Logo";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { markIntroPlayed, ROLE_META, setRole, useRole, type Role } from "@/lib/prefs";
import { cn } from "@/lib/utils";

const GlobeHero = dynamic(() => import("@/components/landing/GlobeHero"), { ssr: false, loading: () => <div className="absolute inset-0 bg-[#05060b]" /> });

const ROLE_ICON: Record<Role, typeof HardHat> = { field: HardHat, analyst: LineChart, manager: BriefcaseBusiness };

const FLOATERS = [
  { icon: Droplets, color: "#0ea5e9", title: "Mud loss window", sub: "3,150 m · 2 offsets · 85% conf.", pos: "right-[13%] top-[22%]", delay: 0.9 },
  { icon: Lock, color: "#d946ef", title: "Stuck pipe risk", sub: "3,380 m · Kopili shale", pos: "right-[30%] top-[58%]", delay: 1.15 },
  { icon: Flame, color: "#ef4444", title: "Kick · critical", sub: "3,580 m · drilling break + SPP drop", pos: "right-[8%] bottom-[16%]", delay: 1.4 },
];

/** Welcome — pick a role, dive from orbit into the field. */
export default function Welcome() {
  const router = useRouter();
  const role = useRole();
  const [flying, setFlying] = useState(false);
  const kb = useAsync(() => api.state(), []);
  const counts = kb.data?.knowledge_base;

  const enter = (r: Role) => {
    setRole(r);
    markIntroPlayed();
    setFlying(true);
    setTimeout(() => router.push(ROLE_META[r].home), 2300);
  };

  return (
    <div className="relative h-screen overflow-hidden bg-[#05060b] text-white">
      <GlobeHero flying={flying} />
      {/* legibility gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#05060b_0%,rgb(5_6_11/0.92)_30%,rgb(5_6_11/0.35)_58%,transparent_75%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#05060b] to-transparent" />
      <motion.div className="pointer-events-none absolute inset-0 bg-[#05060b]" initial={{ opacity: 0 }} animate={{ opacity: flying ? 1 : 0 }} transition={{ delay: flying ? 1.7 : 0, duration: 0.6 }} />

      {/* decorative insight cards floating over the globe */}
      {!flying &&
        FLOATERS.map((f) => (
          <motion.div key={f.title} className={cn("pointer-events-none absolute hidden lg:block", f.pos)} initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: f.delay, type: "spring", stiffness: 120, damping: 16 }}>
            <div className="animate-float flex items-center gap-3 rounded-[4px] border border-white/15 bg-white/10 px-3.5 py-2.5 shadow-2xl backdrop-blur-xl" style={{ animationDelay: `${f.delay}s` }}>
              <span className="flex h-9 w-9 items-center justify-center rounded-[3px]" style={{ background: f.color }}>
                <f.icon size={17} />
              </span>
              <div>
                <div className="text-[13.5px] font-extrabold">{f.title}</div>
                <div className="text-[12.5px] text-white/70">{f.sub}</div>
              </div>
            </div>
          </motion.div>
        ))}

      <div className="relative z-10 flex h-full max-w-[720px] flex-col justify-center px-10 lg:px-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: flying ? 0 : 1, y: 0 }} transition={{ duration: 0.6 }} className="flex items-center gap-3">
          <LogoMark size={48} animated />
          <div>
            <div className="text-[20px] font-extrabold tracking-[-0.02em]">NWIS</div>
            <div className="text-[13px] font-medium text-white/60">Nearby Wells Intelligence System</div>
          </div>
          <span className="ml-2 rounded-[2px] border border-white/15 bg-white/10 px-3 py-1 text-[12.5px] font-bold text-white/80 backdrop-blur">SIH26121 · Oil India Limited</span>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: flying ? 0 : 1, y: 0 }} transition={{ delay: 0.15, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }} className="mt-10 text-[64px] font-extrabold leading-[0.98] tracking-[-0.045em]">
          Know what&rsquo;s below
          <br />
          <span className="text-[#f2a60c]">before you drill it.</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: flying ? 0 : 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }} className="mt-6 max-w-[540px] text-[17px] leading-relaxed text-white/70">
          NWIS sits beside the real-time monitor and connects your bit depth to everything nearby wells learned at that depth — the losses, the stuck pipe, the kicks — with
          explainable alerts and the report page that proves each one.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: flying ? 0 : 1, y: 0 }} transition={{ delay: 0.45, duration: 0.6 }} className="mt-9">
          <div className="mb-3 text-[13px] font-bold text-white/60">Choose how you work</div>
          <div className="grid grid-cols-3 gap-3">
            {(Object.keys(ROLE_META) as Role[]).map((r, i) => {
              const Icon = ROLE_ICON[r];
              const on = role === r;
              return (
                <motion.button
                  key={r}
                  onClick={() => enter(r)}
                  disabled={flying}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 + 0.08 * i }}
                  whileHover={{ y: -4 }}
                  className={cn("group relative overflow-hidden rounded-[4px] border p-4 text-left backdrop-blur-xl transition-colors", on ? "border-[#8b7dff] bg-[#5b4bff]/25" : "border-white/12 bg-white/[0.07] hover:border-white/30 hover:bg-white/[0.12]")}
                >
                  <span className={cn("flex h-10 w-10 items-center justify-center rounded-[3px]", on ? "aurora" : "bg-white/12")}>
                    <Icon size={19} />
                  </span>
                  <div className="mt-3 text-[14.5px] font-extrabold">{ROLE_META[r].label}</div>
                  <div className="mt-1 text-[12.5px] leading-snug text-white/60">{ROLE_META[r].blurb}</div>
                  <ArrowRight size={16} className="absolute right-4 top-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </motion.button>
              );
            })}
          </div>
          <button
            onClick={() => enter(role)}
            disabled={flying}
            className="aurora animate-aurora mt-5 inline-flex h-13 items-center gap-2.5 rounded-[4px] px-7 py-3.5 text-[15px] font-extrabold transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            <Sparkles size={17} /> {flying ? "Diving into the field…" : `Enter as ${ROLE_META[role].label.toLowerCase()}`} <ArrowRight size={17} />
          </button>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: flying ? 0 : 1 }} transition={{ delay: 0.8 }} className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-white/55">
          {[
            [counts?.wells ?? 15, "wells"],
            [counts?.events ?? 36, "drilling events"],
            [counts?.documents ?? 26, "reports"],
            [counts?.chunks ?? 84, "indexed pages"],
          ].map(([v, l]) => (
            <span key={String(l)}>
              <b className="text-[15px] font-extrabold text-white">{v}</b> {l}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={14} /> Demo dataset: realistic synthetic wells on real Upper Assam stratigraphy — not Oil India records
          </span>
        </motion.div>
      </div>
    </div>
  );
}
