import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";
import { useLocation } from "react-router-dom";

interface PageTransitionProps {
  children: ReactNode;
  transitionKey?: string;
}

export function PageTransition({ children, transitionKey }: PageTransitionProps) {
  const location = useLocation();
  const key = transitionKey || location.pathname;

  // Default transition settings
  const defaultTransition = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: {
      type: "spring",
      stiffness: 380,
      damping: 30,
    },
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        {...defaultTransition}
        // Respect user's motion preferences
        whileHover={{ scale: 1 }}
        className="page-transition-wrapper"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
} 