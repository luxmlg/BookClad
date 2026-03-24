"use client";

import Image from "next/image";
import { motion } from "motion/react";

interface HeroCoverFanProps {
  covers: [string, string, string];
}

const fanConfig = [
  { rotate: -6, x: 20, scale: 0.92, zIndex: 10 },
  { rotate: 0, x: 0, scale: 1, zIndex: 20 },
  { rotate: 6, x: -20, scale: 0.92, zIndex: 10 },
] as const;

export function HeroCoverFan({ covers }: HeroCoverFanProps) {
  return (
    <div className="relative mx-auto mt-14 flex items-center justify-center">
      {covers.map((src, i) => (
        <motion.div
          key={i}
          className="relative"
          style={{
            zIndex: fanConfig[i].zIndex,
            marginLeft: i === 0 ? 0 : -24,
          }}
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.7,
            delay: 0.5 + i * 0.1,
            ease: "easeOut",
          }}
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{
              duration: 3.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.3,
            }}
            style={{
              rotate: fanConfig[i].rotate,
              scale: fanConfig[i].scale,
              x: fanConfig[i].x,
            }}
          >
            <Image
              src={src}
              alt=""
              width={200}
              height={320}
              priority
              className="rounded-xl shadow-2xl ring-1 ring-foreground/10"
            />
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}
