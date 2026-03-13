"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ReaderClient from "./ReaderClient";

function ReaderParamsWrapper() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  if (!id) {
    return (
      <div className="h-screen bg-[#0b0b0e] flex items-center justify-center text-red-500 font-mono text-xs tracking-widest uppercase">
        Error: No_ID_Provided
      </div>
    );
  }

  return <ReaderClient id={id} />;
}

export default function ReaderPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[#0b0b0e] flex items-center justify-center text-gray-700 font-mono text-xs tracking-widest uppercase">
        Initializing_Context...
      </div>
    }>
      <ReaderParamsWrapper />
    </Suspense>
  );
}