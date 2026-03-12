/**
 * Shared Framer Motion variants used across Shopify Dev Tools.
 * Keep animations subtle, fast, and consistent.
 */

// Fade + slide up — used for page sections, cards
export const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1], delay: i * 0.08 },
  }),
};

// Fade only — light elements
export const fadeIn = {
  hidden: { opacity: 0 },
  visible: (i = 0) => ({
    opacity: 1,
    transition: { duration: 0.3, ease: "easeOut", delay: i * 0.06 },
  }),
};

// Slide in from the right — SSE events, notifications
export const slideInRight = {
  hidden: { opacity: 0, x: 16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
  exit: { opacity: 0, x: -10, transition: { duration: 0.16 } },
};

// Step transition — slides left or right depending on direction
export const stepEnter = (direction: 1 | -1 = 1) => ({
  initial: { opacity: 0, x: direction * 28 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, x: direction * -20, transition: { duration: 0.2, ease: "easeIn" } },
});

// Scale pop — success states, completion
export const scalePop = {
  hidden: { opacity: 0, scale: 0.88 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 420, damping: 22 },
  },
};

// Stagger container
export const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

// Stagger item
export const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  },
};

// Float — subtle continuous animation for logo/icon
export const float = {
  animate: {
    y: [0, -5, 0],
    transition: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
  },
};
