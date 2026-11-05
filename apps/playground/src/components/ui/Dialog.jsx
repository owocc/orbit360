import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react";

export function Dialog({ open, onOpenChange, children }) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </BaseDialog.Root>
  );
}

export function DialogTrigger({ className = "", children }) {
  return <BaseDialog.Trigger className={className}>{children}</BaseDialog.Trigger>;
}

export function DialogPortal({ children }) {
  return <BaseDialog.Portal>{children}</BaseDialog.Portal>;
}

export function DialogOverlay({ className = "" }) {
  return (
    <BaseDialog.Backdrop
      className={`fixed inset-0 z-50 bg-black/75 backdrop-blur-sm transition-opacity duration-200 ${className}`}
    />
  );
}

export function DialogContent({ className = "", children }) {
  return (
    <BaseDialog.Portal>
      <DialogOverlay />
      <BaseDialog.Popup
        className={`fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 border border-neutral-800 bg-neutral-950 p-6 shadow-2xl duration-200 focus:outline-none rounded-lg text-neutral-200 ${className}`}
      >
        {children}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

export function DialogTitle({ className = "", children }) {
  return (
    <BaseDialog.Title
      className={`text-base font-semibold tracking-tight text-white mb-2 ${className}`}
    >
      {children}
    </BaseDialog.Title>
  );
}

export function DialogDescription({ className = "", children }) {
  return (
    <BaseDialog.Description className={`text-xs text-neutral-400 leading-relaxed ${className}`}>
      {children}
    </BaseDialog.Description>
  );
}

export function DialogClose({ className = "", children }) {
  return <BaseDialog.Close className={className}>{children}</BaseDialog.Close>;
}
