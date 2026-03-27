import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import Image from "next/image";
import { ThemedImage } from "@/components/landing/themed-image";

export const mdxComponents: MDXComponents = {
  ThemedImage,
  a: ({ href, children, ...props }) => {
    if (href?.startsWith("/")) {
      return (
        <Link href={href} {...props}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
  img: ({ src, alt, ...props }) => {
    if (!src) return null;
    return (
      <Image
        src={src}
        alt={alt || ""}
        width={800}
        height={450}
        className="rounded-lg"
        {...props}
      />
    );
  },
};
