"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.body);
}
