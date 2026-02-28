"use client";

import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion, useScroll, useTransform, useMotionValue, useSpring } from "framer-motion";
import { ArrowRight, Zap, Shield, Globe, Repeat, Heart, UserPlus, Sparkles } from "lucide-react";
import { SiX } from "react-icons/si";
import { useRef, useEffect, useState } from "react";
import { TransparentLogo } from "@/components/TransparentLogo";
import { ConnectWallet } from "@/components/ConnectWallet";

function GlowOrb({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <motion.div
      className={`absolute rounded-full pointer-events-none ${className}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: [0.15, 0.3, 0.15],
        scale: [0.8, 1.1, 0.8],
        x: [0, 30, -20, 0],
        y: [0, -20, 30, 0],
      }}
      transition={{
        duration: 12,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
    />
  );
}

function FloatingParticle({ delay, x, y }: { delay: number; x: string; y: string }) {
  return (
    <motion.div
      className="absolute w-1 h-1 rounded-full bg-foreground/20 pointer-events-none"
      style={{ left: x, top: y }}
      animate={{
        y: [0, -40, 0],
        opacity: [0, 0.6, 0],
      }}
      transition={{
        duration: 4 + Math.random() * 2,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
    />
  );
}

function GridPattern() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
}

const heroStagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const heroItem = {
  hidden: { opacity: 0, y: 40, filter: "blur(10px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  },
};

const slideUp = {
  hidden: { opacity: 0, y: 60 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.95]);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 30;
      const y = (e.clientY / window.innerHeight - 0.5) * 30;
      mouseX.set(x);
      mouseY.set(y);
    };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, [mouseX, mouseY]);

  const serviceTypes = [
    { icon: Repeat, label: "Reposts", desc: "Amplify reach on X with targeted reposts" },
    { icon: Heart, label: "Likes", desc: "Boost engagement on your X posts" },
    { icon: UserPlus, label: "Follows", desc: "Grow your X audience organically" },
    { icon: Sparkles, label: "Content", desc: "Keyword-verified posts and threads on X" },
  ];

  const [particles, setParticles] = useState<{ delay: number; x: string; y: string }[]>([]);

  useEffect(() => {
    setParticles(
      Array.from({ length: 20 }, (_, i) => ({
        delay: i * 0.3,
        x: `${Math.random() * 100}%`,
        y: `${Math.random() * 100}%`,
      }))
    );
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <GridPattern />

        <GlowOrb className="w-[500px] h-[500px] -top-32 -left-32 bg-foreground/5 blur-[120px]" delay={0} />
        <GlowOrb className="w-[600px] h-[600px] -bottom-40 -right-40 bg-foreground/5 blur-[120px]" delay={3} />
        <GlowOrb className="w-[300px] h-[300px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-foreground/3 blur-[100px]" delay={6} />

        {particles.map((p, i) => (
          <FloatingParticle key={i} delay={p.delay} x={p.x} y={p.y} />
        ))}

        <motion.div
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="relative z-10"
        >
          <motion.div
            style={{ x: springX, y: springY }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
              animate={{ opacity: 0.04, scale: 1, rotate: 0 }}
              transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
            >
              <div className="w-[400px] h-[400px] md:w-[500px] md:h-[500px]">
                <TransparentLogo className="w-full h-full object-contain opacity-60" />
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            variants={heroStagger}
            initial="hidden"
            animate="visible"
            className="container mx-auto px-6 text-center max-w-5xl relative"
          >
            <motion.div variants={heroItem} className="mb-8">
              <span
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full border text-xs font-medium tracking-widest uppercase text-muted-foreground"
                data-testid="badge-platform"
              >
                <SiX className="h-3 w-3" />
                On-Chain X Marketplace
              </span>
            </motion.div>

            <motion.h1
              variants={heroItem}
              className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] xl:text-[6.5rem] font-black tracking-[-0.04em] leading-[0.9] mb-8"
              data-testid="text-hero-title"
            >
              The X Layer
              <br />
              <span className="text-muted-foreground">of Web3</span>
            </motion.h1>

            <motion.p
              variants={heroItem}
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-14 leading-relaxed"
              data-testid="text-hero-subtitle"
            >
              The trustless marketplace for X influence. Content creation,
              reposts, likes, and follows &mdash; all settled on-chain.
            </motion.p>

            <motion.div variants={heroItem} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <ConnectWallet size="lg" className="rounded-full font-semibold tracking-wide" />
              <Link href="/marketplace">
                <Button variant="outline" size="lg" className="rounded-full font-semibold tracking-wide" data-testid="button-enter-marketplace">
                  Enter Marketplace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center pt-2"
            data-testid="scroll-indicator"
          >
            <motion.div className="w-1 h-2 rounded-full bg-muted-foreground/50" />
          </motion.div>
        </motion.div>
      </section>

      <section className="py-24 md:py-32 border-t relative overflow-hidden">
        <div className="container mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={heroStagger}
            className="text-center mb-16"
          >
            <motion.span variants={heroItem} className="inline-block text-xs font-medium tracking-widest uppercase text-muted-foreground mb-4">
              What You Can Trade
            </motion.span>
            <motion.h2 variants={heroItem} className="text-3xl md:text-5xl lg:text-6xl font-black tracking-[-0.03em] mb-5" data-testid="text-services-title">
              Every Type of X Influence
            </motion.h2>
            <motion.p variants={heroItem} className="text-muted-foreground max-w-lg mx-auto text-lg">
              From quick X engagements to ongoing content contracts.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {serviceTypes.map((s) => (
              <motion.div
                key={s.label}
                variants={slideUp}
                className="flex items-start gap-4 p-6 rounded-md border bg-card hover-elevate"
                data-testid={`card-service-type-${s.label.toLowerCase()}`}
              >
                <div className="p-3 rounded-md bg-foreground text-background shrink-0">
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-bold text-foreground mb-1">{s.label}</p>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-28 md:py-36 relative overflow-hidden">
        <GlowOrb className="w-[400px] h-[400px] top-0 right-0 bg-foreground/3 blur-[100px]" delay={2} />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={heroStagger}
            className="text-center mb-20"
          >
            <motion.span variants={heroItem} className="inline-block text-xs font-medium tracking-widest uppercase text-muted-foreground mb-4">
              The Protocol
            </motion.span>
            <motion.h2 variants={heroItem} className="text-3xl md:text-5xl lg:text-6xl font-black tracking-[-0.03em] mb-5" data-testid="text-features-title">
              How It Works
            </motion.h2>
            <motion.p variants={heroItem} className="text-muted-foreground max-w-lg mx-auto text-lg">
              A trustless protocol connecting brands with X influencers.
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {[
              { icon: <Zap className="h-6 w-6" />, title: "Instant Settlement", desc: "Smart contracts ensure creators get paid immediately upon completion. No delays, no disputes.", step: "01" },
              { icon: <Shield className="h-6 w-6" />, title: "Trustless Escrow", desc: "Funds are held securely on-chain until requirements are met. Zero middlemen involved.", step: "02" },
              { icon: <Globe className="h-6 w-6" />, title: "Global X Network", desc: "Access a worldwide network of X influencers and creators without boundaries or gatekeepers.", step: "03" },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 50, filter: "blur(10px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.15, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="group relative p-8 md:p-10 rounded-md border bg-card hover-elevate transition-all duration-500 h-full" data-testid={`card-feature-${i}`}>
                  <div className="absolute top-6 right-6 text-5xl font-black text-muted-foreground/10 font-mono select-none">{feature.step}</div>
                  <div className="p-3 rounded-md bg-foreground text-background inline-flex mb-6">{feature.icon}</div>
                  <h3 className="text-xl font-bold mb-3 tracking-tight">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-sm">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-28 md:py-36 border-t relative overflow-hidden">
        <GlowOrb className="w-[500px] h-[500px] bottom-0 left-0 bg-foreground/3 blur-[120px]" delay={4} />
        <GridPattern />
        <div className="container mx-auto px-6 text-center relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={heroStagger}>
            <motion.span variants={heroItem} className="inline-block text-xs font-medium tracking-widest uppercase text-muted-foreground mb-4">
              Get Started
            </motion.span>
            <motion.h2 variants={heroItem} className="text-3xl md:text-5xl lg:text-6xl font-black tracking-[-0.03em] mb-6" data-testid="text-cta-title">
              Ready to Monetize<br />Your Influence?
            </motion.h2>
            <motion.p variants={heroItem} className="text-muted-foreground max-w-md mx-auto mb-12 text-lg">
              Join the decentralized marketplace where X influence meets blockchain.
            </motion.p>
            <motion.div variants={heroItem}>
              <Link href="/marketplace">
                <Button size="lg" className="rounded-full font-semibold tracking-wide" data-testid="button-cta-marketplace">
                  Explore Marketplace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <footer className="py-10 border-t mt-auto">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <TransparentLogo className="h-7 w-auto opacity-50" />
          </div>
          <p className="text-xs text-muted-foreground" data-testid="text-copyright">2026 Wolo. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
