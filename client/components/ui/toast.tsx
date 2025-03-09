"use client"

import { Toaster as SonnerToaster } from "sonner"

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        duration: 5000,
        className: "border border-border bg-background text-foreground",
      }}
    />
  )
}

export { toast } from "sonner"