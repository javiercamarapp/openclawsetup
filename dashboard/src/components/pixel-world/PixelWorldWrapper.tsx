"use client";

import dynamic from "next/dynamic";

const PixelWorldPixi = dynamic(
  () => import("@/components/pixel-world/PixelWorldPixi"),
  { ssr: false },
);

export default function PixelWorldWrapper() {
  return <PixelWorldPixi />;
}
