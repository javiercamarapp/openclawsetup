"use client";

import dynamic from "next/dynamic";

const PixelWorld = dynamic(
  () => import("@/components/pixel-world/PixelWorld"),
  { ssr: false },
);

export default function PixelWorldWrapper() {
  return <PixelWorld />;
}
