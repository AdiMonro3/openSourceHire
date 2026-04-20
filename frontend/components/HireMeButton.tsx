"use client";

import { useState } from "react";
import { Button } from "./Button";
import { HireMeModal } from "./HireMeModal";

export function HireMeButton({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Hire me
      </Button>
      <HireMeModal
        username={username}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
