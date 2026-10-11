"use client";

import dynamic from "next/dynamic";

// The existing workspace reads browser preferences and activation URLs on mount.
const Lab = dynamic(() => import("../src/main"), { ssr: false });
export default function Page() {
  return <Lab />;
}
