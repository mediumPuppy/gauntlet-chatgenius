import { Link } from 'react-router-dom';
import { motion, useAnimation } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useEffect } from 'react';

const FloatingShapes = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <motion.div
      className="absolute top-20 left-20 w-20 h-20 rounded-lg bg-gradient-to-r from-primary-300/60 to-primary-400/60"
      animate={{
        y: [0, 20, 0],
        rotate: [0, 10, 0],
        scale: [1, 1.1, 1],
      }}
      transition={{
        duration: 5,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
    <motion.div
      className="absolute top-40 right-40 w-16 h-16 rounded-full bg-gradient-to-r from-primary-400/60 to-primary-500/60"
      animate={{
        y: [0, -20, 0],
        x: [0, 15, 0],
        scale: [1, 1.05, 1],
      }}
      transition={{
        duration: 7,
        repeat: Infinity,
        ease: [0.4, 0, 0.6, 1],
        times: [0, 0.5, 1]
      }}
    />
    <motion.div
      className="absolute bottom-40 left-1/3 w-24 h-24 rounded-lg bg-gradient-to-r from-primary-200 to-primary-300"
      animate={{
        rotate: [0, 360],
        scale: [1, 1.2, 1],
      }}
      transition={{
        duration: 10,
        repeat: Infinity,
        ease: "linear"
      }}
    />
  </div>
);

const ParticleStream = () => (
  <motion.div 
    className="absolute inset-0 pointer-events-none"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 1 }}
  >
    {[...Array(35)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-2 h-2 rounded-full bg-primary-300"
        initial={{ 
          x: Math.random() * window.innerWidth,
          y: -20,
          opacity: 0 
        }}
        animate={{
          y: window.innerHeight + 20,
          opacity: [0, 0.9, 0],
        }}
        transition={{
          duration: 3 + Math.random() * 2,
          repeat: Infinity,
          delay: Math.random() * 2,
          ease: [0.4, 0, 0.6, 1]
        }}
      />
    ))}
  </motion.div>
);

const ChatIllustration = () => (
  <svg className="w-full h-full" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="250" cy="250" r="200" fill="url(#gradient)" fillOpacity="0.1"/>
    <path d="M150 150h200v120c0 11.046-8.954 20-20 20H170c-11.046 0-20-8.954-20-20V150z" fill="#0070cc" fillOpacity="0.2"/>
    <path d="M180 200h140M180 250h80" stroke="#0070cc" strokeWidth="20" strokeLinecap="round"/>
    <circle cx="320" cy="320" r="60" fill="#0c8ee3"/>
    <path d="M300 320h40M320 300v40" stroke="white" strokeWidth="8" strokeLinecap="round"/>
    <defs>
      <linearGradient id="gradient" x1="0" y1="0" x2="500" y2="500" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0070cc"/>
        <stop offset="1" stopColor="#00396b"/>
      </linearGradient>
    </defs>
  </svg>
);

export default function LandingPage() {
  const controls = useAnimation();
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1
  });

  useEffect(() => {
    if (inView) {
      controls.start('visible');
    }
  }, [controls, inView]);

  return (
    <div className="min-h-screen bg-primary-50 relative overflow-hidden">
      <FloatingShapes />
      <ParticleStream />
      
      {/* Navigation */}
      <motion.nav 
        className="bg-white/80 backdrop-blur-md border-b border-primary-100 sticky top-0 z-50"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <motion.div 
              className="flex items-center"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <span className="text-xl font-bold bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
                ChatGenius
              </span>
            </motion.div>
            <div className="flex items-center space-x-4">
              <motion.div whileHover={{ scale: 1.05 }}>
                <Link
                  to="/login"
                  className="text-primary-600 hover:text-primary-700 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Login
                </Link>
              </motion.div>
              <motion.div 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link
                  to="/signup"
                  className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg hover:shadow-xl"
                >
                  Sign Up
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            ref={ref}
            initial="hidden"
            animate={controls}
            variants={{
              hidden: { opacity: 0, x: -50 },
              visible: {
                opacity: 1,
                x: 0,
                transition: {
                  duration: 0.8,
                  ease: "easeOut"
                }
              }
            }}
          >
            <motion.h1 
              className="text-6xl font-bold text-primary-900 leading-tight mb-6"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: {
                    delay: 0.2,
                    duration: 0.8
                  }
                }
              }}
            >
              Connect and Chat
              <motion.span 
                className="block text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-primary-700"
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: {
                      delay: 0.4,
                      duration: 0.8
                    }
                  }
                }}
              >
                with Intelligence
              </motion.span>
            </motion.h1>
            <motion.p 
              className="text-xl text-primary-600 mb-8 leading-relaxed"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: {
                    delay: 0.6,
                    duration: 0.8
                  }
                }
              }}
            >
              Experience the next generation of messaging with AI-powered features, 
              real-time communication, and seamless collaboration tools.
            </motion.p>
            <motion.div 
              className="flex gap-4"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: {
                    delay: 0.8,
                    duration: 0.8
                  }
                }
              }}
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link
                  to="/signup"
                  className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-8 py-4 rounded-lg text-lg font-medium hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg hover:shadow-xl inline-flex items-center"
                >
                  Get Started
                  <motion.svg 
                    className="ml-2 w-5 h-5" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </motion.svg>
                </Link>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link
                  to="/about"
                  className="text-primary-500 px-8 py-4 rounded-lg text-lg font-medium hover:text-primary-600 transition-colors inline-flex items-center border border-primary-200 hover:border-primary-300 bg-white/50 backdrop-blur-sm"
                >
                  Learn More
                  <motion.svg 
                    className="ml-2 w-5 h-5" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7-7 7" />
                  </motion.svg>
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
          <motion.div 
            className="relative"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <motion.div 
              className="absolute inset-0 bg-gradient-to-r from-primary-200 to-primary-300 opacity-50 rounded-3xl"
              animate={{
                rotate: [3, 5, 3],
                scale: [1, 1.02, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div 
              className="relative"
              animate={{
                rotate: [-3, -5, -3],
                scale: [1, 1.02, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <ChatIllustration />
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-primary-900 mb-4">
            Intelligent Features for Modern Teams
          </h2>
          <p className="text-xl text-primary-600 max-w-2xl mx-auto">
            Experience the next level of team collaboration with our AI-powered features
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            {
              title: "Real-time Chat",
              description: "Instant messaging with real-time updates and typing indicators",
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              )
            },
            {
              title: "AI Assistance",
              description: "Smart suggestions and automated responses powered by AI",
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              )
            },
            {
              title: "Team Collaboration",
              description: "Organize conversations by teams, projects, and topics",
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              )
            },
            {
              title: "Smart Automation",
              description: "Automate routine tasks and streamline workflows",
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )
            }
          ].map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              whileHover={{ y: -5 }}
              className="bg-white/80 backdrop-blur-md p-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              <motion.div
                className="w-12 h-12 bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg flex items-center justify-center text-white mb-4"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                {feature.icon}
              </motion.div>
              <h3 className="text-xl font-semibold text-primary-900 mb-2">{feature.title}</h3>
              <p className="text-primary-600">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
} 