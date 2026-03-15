import { GOOGLE_FONTS_URL } from "@/lib/fonts";

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link href={GOOGLE_FONTS_URL} rel="stylesheet" />
      {children}
    </>
  );
}
