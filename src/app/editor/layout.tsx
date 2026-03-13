import { GOOGLE_FONTS_URL } from "@/lib/fonts";

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href={GOOGLE_FONTS_URL} rel="stylesheet" />
      {children}
    </>
  );
}
