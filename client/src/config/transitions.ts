import { Variants } from "framer-motion";

interface TransitionConfig {
  variants: Variants;
  transition: {
    duration?: number;
    type?: string;
    ease?: string | number[];
    stiffness?: number;
    damping?: number;
  };
}

// Map of route combinations to their specific transitions
export const routeTransitions: Record<string, TransitionConfig> = {
  "chat-to-settings": {
    variants: {
      initial: { opacity: 0, x: "100%" },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: "-100%" },
    },
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
    },
  },
  
  "login-to-onboarding": {
    variants: {
      initial: { opacity: 0, y: 50 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -50 },
    },
    transition: {
      duration: 0.4,
      ease: "easeOut",
    },
  },
  
  "login-to-chat": {
    variants: {
      initial: { opacity: 0, x: 30 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -30 },
    },
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 35,
    },
  },
  
  "onboarding-to-chat": {
    variants: {
      initial: { opacity: 0, x: "100%" },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: "-30%" },
    },
    transition: {
      type: "spring",
      stiffness: 350,
      damping: 32,
    },
  },
};

// Helper function to determine which transition to use
export function getTransition(from: string, to: string): TransitionConfig {
  const key = `${from}-to-${to}`;
  return routeTransitions[key] || defaultTransition;
}

// Default transition for routes without specific configurations
export const defaultTransition: TransitionConfig = {
  variants: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  transition: {
    duration: 0.3,
    ease: "easeInOut",
  },
}; 