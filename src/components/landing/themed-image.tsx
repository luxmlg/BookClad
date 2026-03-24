"use client";

import { useState, useEffect } from "react";
import Image, { type ImageProps } from "next/image";
import { useTheme } from "next-themes";

interface ThemedImageProps {
  lightSrc: ImageProps["src"];
  darkSrc: ImageProps["src"];
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
}

export function ThemedImage({
  lightSrc,
  darkSrc,
  alt,
  width,
  height,
  priority,
  className,
}: ThemedImageProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div className={`relative ${className ?? ""}`}>
      <Image
        src={lightSrc}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className={`transition-opacity duration-300 ${isDark ? "opacity-0" : "opacity-100"}`}
      />
      <Image
        src={darkSrc}
        alt={`${alt} (dark)`}
        width={width}
        height={height}
        priority={priority}
        className={`absolute inset-0 transition-opacity duration-300 ${isDark ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
