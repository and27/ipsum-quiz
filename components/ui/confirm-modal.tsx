"use client";

import { BaseModal } from "@/components/ui/base-modal";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface ConfirmModalProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  disabled?: boolean;
  busy?: boolean;
  triggerLabel: string;
  triggerVariant?: "default" | "outline" | "secondary" | "destructive";
  onConfirm: () => Promise<void> | void;
}

export function ConfirmModal({
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  destructive = false,
  disabled = false,
  busy = false,
  triggerLabel,
  triggerVariant = "outline",
  onConfirm,
}: ConfirmModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <BaseModal
      open={open}
      onOpenChange={setOpen}
      title={title}
      description={description}
      trigger={
        <Button type="button" variant={triggerVariant} disabled={disabled || busy}>
          {triggerLabel}
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={destructive ? "destructive" : "default"}
          disabled={busy}
          onClick={async () => {
            await onConfirm();
            setOpen(false);
          }}
        >
          {busy ? "Procesando..." : confirmLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          {cancelLabel}
        </Button>
      </div>
    </BaseModal>
  );
}
