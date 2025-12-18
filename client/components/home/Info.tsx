/**
 * Info.tsx
 * This is the info component for the home page
 * @AshokSaravanan222 & @siladiea
 * 11/21/2025
 */

"use client";

import { GlowLogo } from "@/components/common/layout/GlowLogo";
import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
} from "framer-motion";
import { BarChart3, FilePlus, Layers, MessageSquare } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function Info() {
  const containerRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const licensingRef = useRef<HTMLDivElement>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isOverBlueSection, setIsOverBlueSection] = useState(false);
  const carouselItems = 4;

  const nextCarousel = () => {
    setCarouselIndex((prev) => (prev + 1) % carouselItems);
  };

  const prevCarousel = () => {
    setCarouselIndex((prev) => (prev - 1 + carouselItems) % carouselItems);
  };

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 0.3], [0, -50]);

  // Track scroll position to detect when logo/button are over blue sections
  useEffect(() => {
    const handleScroll = () => {
      const logoTop = 24; // top-6 = 24px from top of viewport
      const logoBottom = logoTop + 60; // Approximate logo height

      // Check if logo is over carousel section (blue)
      const carouselRect = carouselRef.current?.getBoundingClientRect();
      const isOverCarousel = carouselRect
        ? logoBottom >= carouselRect.top && logoTop <= carouselRect.bottom
        : false;

      // Check if logo is over licensing section (blue)
      const licensingRect = licensingRef.current?.getBoundingClientRect();
      const isOverLicensing = licensingRect
        ? logoBottom >= licensingRect.top && logoTop <= licensingRect.bottom
        : false;

      setIsOverBlueSection(isOverCarousel || isOverLicensing);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Check initial position

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Animation variants
  const fadeInUp = {
    initial: { opacity: 0, y: 60 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: [0.6, -0.05, 0.01, 0.99] },
  };

  const staggerContainer = {
    initial: {},
    animate: {
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const cardVariants = {
    initial: { opacity: 0, y: 40, scale: 0.95 },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: "easeOut" as const,
      },
    },
    hover: {
      y: -8,
      scale: 1.02,
      transition: { duration: 0.3 },
    },
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-white overflow-x-hidden">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="fixed top-6 left-6 z-50"
      >
        <GlowLogo
          mobileIconOnly={true}
          clickable={true}
          onClick={() => {
            // Stay on same page, no navigation
          }}
          size="lg"
          invertColors={isOverBlueSection}
        />
      </motion.div>

      {/* Navigation */}
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="fixed top-6 right-6 z-50"
      >
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-transparent"
          >
            <Link
              href="/login"
              className={`px-6 py-2 rounded-lg font-semibold transition-all duration-300 border-2 ${
                isOverBlueSection
                  ? "bg-white/10 backdrop-blur-sm border-white text-white hover:bg-white/20 shadow-lg"
                  : "border-transparent text-white"
              }`}
              style={
                !isOverBlueSection
                  ? {
                      background:
                        "linear-gradient(to bottom right, rgb(147, 197, 253), rgb(96, 165, 250))",
                      boxShadow: "none",
                      textDecoration: "none",
                    }
                  : {
                      textDecoration: "none",
                    }
              }
              onMouseEnter={(e) => {
                if (!isOverBlueSection) {
                  e.currentTarget.style.background =
                    "linear-gradient(to bottom right, rgb(96, 165, 250), rgb(59, 130, 246))";
                }
              }}
              onMouseLeave={(e) => {
                if (!isOverBlueSection) {
                  e.currentTarget.style.background =
                    "linear-gradient(to bottom right, rgb(147, 197, 253), rgb(96, 165, 250))";
                }
              }}
            >
              Login
            </Link>
          </motion.div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-blue-50 min-h-screen flex items-center justify-center py-16">
        {/* Animated geometric background */}
        <div className="absolute inset-0 overflow-hidden">
          <svg
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="none"
            viewBox="0 0 1200 800"
          >
            <defs>
              <linearGradient
                id="gradient1"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#9ca3af" stopOpacity="0.1" />
                <stop offset="50%" stopColor="#9ca3af" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#9ca3af" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <motion.path
              d="M0,400 Q300,200 600,400 T1200,400 L1200,800 L0,800 Z"
              fill="url(#gradient1)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: 1,
                opacity: 1,
                d: [
                  "M0,400 Q300,200 600,400 T1200,400 L1200,800 L0,800 Z",
                  "M0,450 Q300,250 600,450 T1200,450 L1200,800 L0,800 Z",
                  "M0,400 Q300,200 600,400 T1200,400 L1200,800 L0,800 Z",
                ],
              }}
              transition={{
                pathLength: { duration: 2, ease: "easeInOut" },
                opacity: { duration: 1 },
                d: { duration: 8, repeat: Infinity, ease: "easeInOut" },
              }}
            />
            <motion.path
              d="M0,500 Q400,300 800,500 T1200,500 L1200,800 L0,800 Z"
              fill="url(#gradient1)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: 1,
                opacity: 0.7,
                d: [
                  "M0,500 Q400,300 800,500 T1200,500 L1200,800 L0,800 Z",
                  "M0,450 Q400,250 800,450 T1200,450 L1200,800 L0,800 Z",
                  "M0,500 Q400,300 800,500 T1200,500 L1200,800 L0,800 Z",
                ],
              }}
              transition={{
                pathLength: { duration: 2, delay: 0.5, ease: "easeInOut" },
                opacity: { duration: 1, delay: 0.5 },
                d: { duration: 10, repeat: Infinity, ease: "easeInOut" },
              }}
            />
          </svg>
          {/* Animated grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `linear-gradient(to right, #9ca3af 1px, transparent 1px),
                                linear-gradient(to bottom, #9ca3af 1px, transparent 1px)`,
                backgroundSize: "60px 60px",
              }}
            >
              <motion.div
                className="absolute inset-0"
                animate={{
                  backgroundPosition: ["0px 0px", "60px 60px"],
                }}
                transition={{
                  duration: 20,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            </div>
          </div>
          {/* Floating geometric shapes */}
          {[...Array(6)].map((_, i) => {
            const colorMap = {
              0: "rgb(156 163 175)", // gray-400
              1: "rgb(156 163 175)", // gray-400
              2: "rgb(156 163 175)", // gray-400
            };
            const backgroundColor = colorMap[(i % 3) as keyof typeof colorMap];
            return (
              <motion.div
                key={i}
                className="absolute"
                style={{
                  width: `${20 + i * 10}px`,
                  height: `${20 + i * 10}px`,
                  left: `${10 + i * 15}%`,
                  top: `${20 + (i % 3) * 25}%`,
                  backgroundColor,
                  opacity: 0.1,
                  borderRadius: i % 2 === 0 ? "50%" : "20%",
                }}
                animate={{
                  y: [0, -30, 0],
                  rotate: [i * 45, i * 45 + 360],
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 4 + i,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.5,
                }}
              />
            );
          })}
        </div>

        <motion.div
          style={{ opacity, y }}
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10"
        >
          <motion.div
            initial="initial"
            animate="animate"
            variants={staggerContainer}
            className="text-center"
          >
            <motion.h1
              variants={fadeInUp}
              className="text-5xl md:text-6xl font-bold text-gray-900 mb-8 leading-tight"
            >
              <span className="block mb-2">Master Office Hours</span>
              <span className="bg-gradient-to-r from-blue-300 via-blue-400 to-blue-500 bg-clip-text text-transparent">
                Through AI-Powered Practice
              </span>
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed"
            >
              Train your Teaching Assistants with dynamic and diverse scenarios.
              Practice realistic conversations, receive intelligent hints, and
              get personalized feedback.
            </motion.p>

            {/* Stats Cards */}
            <motion.div
              initial="initial"
              animate="animate"
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mt-12"
            >
              {[
                { number: "200+", label: "Students", color: "yellow" },
                {
                  number: "25,000+",
                  label: "Minutes Practiced",
                  color: "gold",
                },
                {
                  number: "Pilot",
                  label: "at Top-Tier R1 University",
                  color: "sun",
                },
              ].map((stat, index) => (
                <motion.div
                  key={index}
                  variants={cardVariants}
                  whileHover="hover"
                  className="text-center p-6 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-lg"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      delay: index * 0.2,
                      type: "spring",
                      stiffness: 200,
                    }}
                    className={`text-5xl font-bold bg-gradient-to-r ${
                      stat.color === "yellow"
                        ? "from-blue-300 to-blue-400"
                        : stat.color === "gold"
                          ? "from-blue-400 to-blue-500"
                          : "from-blue-400 to-blue-300"
                    } bg-clip-text text-transparent mb-3`}
                  >
                    {stat.number}
                  </motion.div>
                  <div className="text-lg text-gray-600 font-medium">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent"></div>
      </section>

      {/* Comprehensive Training Features - Carousel Section */}
      <section
        ref={carouselRef}
        className="pb-28 bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-[180px] -mt-16 pt-32 relative z-10"
      >
        {/* Decorative star shapes */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          {/* Top area star - above images */}
          <svg
            className="absolute top-16 left-16 w-12 h-12 text-white"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          {/* Left side star - avoiding center image area */}
          <svg
            className="absolute top-1/3 left-4 w-14 h-14 text-white"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          {/* Right side star - avoiding center image area */}
          <svg
            className="absolute top-1/3 right-4 w-12 h-12 text-white"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          {/* Bottom area star - below images */}
          <svg
            className="absolute bottom-16 left-1/3 w-11 h-11 text-white"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-4"
          >
            <AnimatePresence mode="wait">
              <motion.div key={carouselIndex}>
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="text-5xl font-bold text-white mb-3"
                >
                  {carouselIndex === 0 && "Monitor TA performance"}
                  {carouselIndex === 1 && "Create Custom Scenarios"}
                  {carouselIndex === 2 &&
                    "TA's Practice Realistic Conversations"}
                  {carouselIndex === 3 && "Receive Personalized Feedback"}
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="text-lg text-white/90 max-w-2xl mx-auto mb-4"
                >
                  {carouselIndex === 0 &&
                    "View comprehensive statistics and analytics to track TA performance across all training sessions."}
                  {carouselIndex === 1 &&
                    "Design tailored scenarios with customizable locations, student types, and difficulty levels for effective training."}
                  {carouselIndex === 2 &&
                    "Engage in realistic text-based conversations with AI-powered student simulations to practice office hour interactions."}
                  {carouselIndex === 3 &&
                    "Get detailed, personalized feedback with rubric-based assessments to improve your teaching assistant skills."}
                </motion.p>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Image Carousel */}
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
              {/* Left Chevron */}
              <motion.button
                onClick={prevCarousel}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full border border-white/40 transition-all"
                aria-label="Previous image"
              >
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </motion.button>

              {/* Image Container */}
              <div className="flex-1 overflow-hidden rounded-2xl">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={carouselIndex}
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.5 }}
                    className="aspect-video relative w-full rounded-2xl overflow-hidden"
                  >
                    <Image
                      src={`/Image${carouselIndex + 1}.png`}
                      alt={
                        carouselIndex === 0
                          ? "Faculty Dashboard - TA Statistics"
                          : carouselIndex === 1
                            ? "Faculty Scenario Setup Page"
                            : carouselIndex === 2
                              ? "TA Conversation Simulation Area"
                              : "TA Specialized Feedback & Rubric"
                      }
                      fill
                      className="object-cover object-[center_5%] rounded-2xl"
                      priority={carouselIndex === 0}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Right Chevron */}
              <motion.button
                onClick={nextCarousel}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full border border-white/40 transition-all"
                aria-label="Next image"
              >
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </motion.button>
            </div>

            {/* Carousel Navigation Dots */}
            <div className="flex justify-center gap-3 mt-6">
              {[0, 1, 2, 3].map((index) => (
                <button
                  key={index}
                  onClick={() => setCarouselIndex(index)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    carouselIndex === index ? "bg-white w-8" : "bg-white/40"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-28 bg-gradient-to-b from-white to-gray-50 relative overflow-hidden">
        {/* Animated diagonal lines background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: "rotate(-45deg)",
            transformOrigin: "center",
            width: "200%",
            height: "200%",
            left: "-50%",
            top: "-50%",
          }}
        >
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{
                width: "3px",
                height: "200%",
                left: `${10 + i * 12}%`,
                top: "-50%",
                background: `linear-gradient(to bottom, transparent, rgba(156, 163, 175, 0.5), transparent)`,
                boxShadow: "0 0 6px rgba(156, 163, 175, 0.4)",
              }}
              animate={{
                y: [0, -200, 0],
                opacity: [0.3, 0.7, 0.3],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 7 + i * 0.6,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.5,
              }}
            />
          ))}
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl font-bold text-gray-900 mb-6">
              How It Works
            </h2>
          </motion.div>

          <div className="max-w-5xl mx-auto">
            <motion.div
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="space-y-12"
            >
              {[
                {
                  num: 1,
                  title: "Create Individual Scenarios",
                  desc: "Faculty members create multiple individual scenarios, each representing a single student simulation. Configure location, student type (angry, happy, confused, or passive), difficulty level (1-10), and upload relevant class documents. Each scenario is a focused practice opportunity for one student interaction.",
                  icon: FilePlus,
                },
                {
                  num: 2,
                  title: "Combine Scenarios into Simulations",
                  desc: "Simulations are created by combining multiple scenarios that Teaching Assistants need to accomplish within a given time period. These comprehensive simulations test GTAs' ability to manage multiple student interactions consecutively.",
                  icon: Layers,
                },
                {
                  num: 3,
                  title: "GTAs Practice with AI Students",
                  desc: "As a Graduate Teaching Assistant, engage in realistic conversations through text-to-text interactions with AI-powered students. Receive hints when needed, and practice adapting your communication style in real-time across multiple scenarios.",
                  icon: MessageSquare,
                },
                {
                  num: 4,
                  title: "Receive AI-Powered Feedback",
                  desc: "After each practice session, receive comprehensive AI-generated feedback including performance grades, specific strengths in your approach, and actionable recommendations tailored to your improvement areas. Track your progress over time and see how you handle multiple scenarios effectively.",
                  icon: BarChart3,
                },
              ].map((step, index) => {
                const IconComponent = step.icon;
                return (
                  <motion.div
                    key={index}
                    variants={cardVariants}
                    className="flex flex-col md:flex-row gap-8 items-start bg-white p-8 rounded-2xl shadow-xl border border-gray-100"
                  >
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      whileInView={{ scale: 1, rotate: 0 }}
                      viewport={{ once: true }}
                      transition={{
                        delay: index * 0.2,
                        type: "spring",
                        stiffness: 200,
                      }}
                      className="flex-shrink-0"
                    >
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-300 to-blue-500 text-white rounded-2xl flex items-center justify-center shadow-lg">
                        <IconComponent className="w-10 h-10" />
                      </div>
                    </motion.div>
                    <div className="flex-1">
                      <h3 className="text-3xl font-bold text-gray-900 mb-4">
                        {step.num}. {step.title}
                      </h3>
                      <p className="text-gray-600 text-lg leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Advanced AI Features Section - Commented Out */}
      {/*
      <section className="py-28 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl font-bold text-gray-900 mb-6">
              Features
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Experience the future of GTA training with our sophisticated AI technology that adapts to your learning style
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-7 mb-14">
            <motion.div
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              variants={cardVariants}
              whileHover="hover"
              className="bg-white p-9 rounded-2xl shadow-xl border border-gray-100 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100 rounded-full -mr-16 -mt-16 opacity-20 group-hover:opacity-30 transition-opacity"></div>
              <div className="relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6 shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Text-to-Text Conversation</h3>
                <p className="text-gray-600 leading-relaxed text-lg">
                  Engage in realistic written conversations with AI-powered students. Practice crafting clear, 
                  empathetic responses that address student concerns effectively. The AI adapts to your communication style 
                  and provides context-aware interactions.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              variants={cardVariants}
              whileHover="hover"
              className="bg-white p-10 rounded-2xl shadow-xl border border-gray-100 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100 rounded-full -mr-16 -mt-16 opacity-20 group-hover:opacity-30 transition-opacity"></div>
              <div className="relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-6 shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Voice-to-Voice Conversation</h3>
                <p className="text-gray-600 leading-relaxed text-lg">
                  Master verbal communication through real-time voice interactions. Practice tone, pacing, and clarity 
                  as you speak directly with AI students. Experience authentic office hour conversations with natural 
                  speech patterns and emotional nuances.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              variants={cardVariants}
              whileHover="hover"
              className="bg-white p-10 rounded-2xl shadow-xl border border-gray-100 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-100 rounded-full -mr-16 -mt-16 opacity-20 group-hover:opacity-30 transition-opacity"></div>
              <div className="relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-6 shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Intelligent Hints System</h3>
                <p className="text-gray-600 leading-relaxed text-lg">
                  Receive context-aware hints when you need guidance. Our AI analyzes your conversation flow and 
                  suggests effective strategies in real-time. Learn when to ask clarifying questions, when to show empathy, 
                  and how to guide students to solutions.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              variants={cardVariants}
              whileHover="hover"
              className="bg-white p-10 rounded-2xl shadow-xl border border-gray-100 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100 rounded-full -mr-16 -mt-16 opacity-20 group-hover:opacity-30 transition-opacity"></div>
              <div className="relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mb-6 shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">AI Scenario Generation</h3>
                <p className="text-gray-600 leading-relaxed text-lg">
                  Faculty can leverage AI to generate unlimited, varied scenarios automatically. The system creates 
                  diverse student personalities, difficulty levels, and contexts. Each scenario is unique, ensuring 
                  comprehensive practice opportunities that cover every possible office hour situation.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
      */}

      {/* Licensing Section */}
      <section
        ref={licensingRef}
        className="py-32 md:py-40 lg:py-48 xl:py-56 bg-gradient-to-r from-blue-500 to-blue-600 relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -ml-48 -mt-48"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full -mr-48 -mb-48"></div>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, type: "spring" }}
              className="w-16 h-16 md:w-20 md:h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-6 md:mb-8"
            >
              <svg
                className="w-8 h-8 md:w-10 md:h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
            </motion.div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 md:mb-6">
              Contact
            </h2>
            <p className="text-lg md:text-xl text-white mb-6 md:mb-8 max-w-2xl mx-auto leading-relaxed px-4">
              For more information, please contact PIs{" "}
              <a
                href="https://www.cs.purdue.edu/homes/dickeye/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-blue-100 transition-colors"
              >
                Ethan Dickey
              </a>{" "}
              and{" "}
              <a
                href="https://andresbejarano.name/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-blue-100 transition-colors"
              >
                Andres Bejarano
              </a>
              . Tool originally created in Summer 2025 under their guidance by{" "}
              <a
                href="https://www.linkedin.com/in/ashok-saravanan"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-blue-100 transition-colors"
              >
                Ashok Saravanan
              </a>{" "}
              and{" "}
              <a
                href="https://www.linkedin.com/in/alexander-siladie"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-blue-100 transition-colors"
              >
                Alex Siladie
              </a>{" "}
              and initially piloted in Purdue's GTA program in Fall 2025.
              Results pending.
            </p>
            <div className="mt-8 pt-8 border-t border-white/20">
              <p className="text-sm text-white/90">
                &copy; {new Date().getFullYear()} GLOW. All rights reserved.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      {/*
      <section className="py-32 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-8">
              Ready to Transform Your Office Hours?
            </h2>
            <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
              Join over 200 students at Purdue University who are already mastering their office hour interactions 
              with our advanced AI-powered platform. Start practicing today and become a more effective Teaching Assistant.
            </p>
            <div className="flex justify-center items-center max-w-3xl mx-auto">
              <div className="relative flex items-center w-full max-w-2xl">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="w-full px-6 py-6 pr-16 border-2 border-gray-300 rounded-xl font-medium text-lg text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="absolute right-3 p-2 text-gray-600 hover:text-blue-600 transition-colors"
                  aria-label="Send"
                >
                  <svg className="w-6 h-6 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
      */}
    </div>
  );
}
