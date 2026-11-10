"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useSyncExternalStore } from "react";

const easeOut = [0.22, 1, 0.36, 1];
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(callback) {
  const mediaQuery = window.matchMedia(reducedMotionQuery);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(reducedMotionQuery).matches;
}

function getServerReducedMotionSnapshot() {
  return false;
}

export function useReducedMotionPreference() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotionSnapshot,
  );
}

export const motionPresets = {
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3, ease: easeOut } },
  },
  fadeUp: {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: easeOut } },
  },
  scaleIn: {
    hidden: { opacity: 0, scale: 0.98 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.32, ease: easeOut } },
  },
  staggerContainer: {
    hidden: {},
    visible: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
  },
  staggerChild: {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: easeOut } },
  },
};

function useVariants(variant) {
  const reducedMotion = useReducedMotionPreference();
  if (!reducedMotion) return motionPresets[variant];

  return {
    hidden: { opacity: 1 },
    visible: { opacity: 1, transition: { duration: 0 } },
  };
}

export function FadeIn({ children, className, as = "div" }) {
  const variants = useVariants("fadeIn");
  const MotionElement = motion[as] || motion.div;
  return (
    <MotionElement className={className} variants={variants} initial="hidden" animate="visible">
      {children}
    </MotionElement>
  );
}

export function FadeUp({ children, className, as = "div" }) {
  const variants = useVariants("fadeUp");
  const MotionElement = motion[as] || motion.div;
  return (
    <MotionElement className={className} variants={variants} initial="hidden" animate="visible">
      {children}
    </MotionElement>
  );
}

export function ScaleIn({ children, className, as = "div" }) {
  const variants = useVariants("scaleIn");
  const MotionElement = motion[as] || motion.div;
  return (
    <MotionElement className={className} variants={variants} initial="hidden" animate="visible">
      {children}
    </MotionElement>
  );
}

export function StaggerContainer({ children, className }) {
  const variants = useVariants("staggerContainer");
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }) {
  const variants = useVariants("staggerChild");
  return <motion.div className={className} variants={variants}>{children}</motion.div>;
}

export function HoverLift({ children, className }) {
  const reducedMotion = useReducedMotionPreference();
  return (
    <motion.div
      className={className}
      whileHover={reducedMotion ? undefined : { y: -3 }}
      transition={{ duration: 0.2, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}

export function TapScale({ children, className, ...props }) {
  const reducedMotion = useReducedMotionPreference();
  return (
    <motion.div
      className={className}
      whileTap={reducedMotion ? undefined : { scale: 0.98 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function PageTransition({ children, className }) {
  return <FadeIn className={className}>{children}</FadeIn>;
}

export function ScrollReveal({
  children,
  className,
  variant = "fadeUp",
  delay = 0,
  as = "div",
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.16, margin: "0px 0px -48px 0px" });
  const reducedMotion = useReducedMotionPreference();
  const MotionElement = motion[as] || motion.div;
  const preset = motionPresets[variant] || motionPresets.fadeUp;
  const variants = reducedMotion
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
    : preset;

  return (
    <MotionElement
      ref={ref}
      className={className}
      variants={variants}
      initial="hidden"
      animate={isInView || reducedMotion ? "visible" : "hidden"}
      transition={{ delay }}
    >
      {children}
    </MotionElement>
  );
}

export function ScrollStagger({ children, className, as = "div" }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.12 });
  const reducedMotion = useReducedMotionPreference();
  const MotionElement = motion[as] || motion.div;

  return (
    <MotionElement
      ref={ref}
      className={className}
      variants={reducedMotion ? { hidden: {}, visible: {} } : motionPresets.staggerContainer}
      initial="hidden"
      animate={isInView || reducedMotion ? "visible" : "hidden"}
    >
      {children}
    </MotionElement>
  );
}

export function ScrollStaggerItem({ children, className, as = "div" }) {
  const reducedMotion = useReducedMotionPreference();
  const MotionElement = motion[as] || motion.div;

  return (
    <MotionElement
      className={className}
      variants={reducedMotion ? { hidden: { opacity: 1 }, visible: { opacity: 1 } } : motionPresets.staggerChild}
    >
      {children}
    </MotionElement>
  );
}
