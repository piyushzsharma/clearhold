"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export type ToastVariant = "success" | "error" | "warning" | "info"

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastData {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
  action?: ToastAction
}

export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastData
  onDismiss: (id: string) => void
}) {
  const variant = toast.variant ?? "info"
  const Icon = variant === "success" ? CheckIcon : variant === "error" ? AlertIcon : variant === "warning" ? WarningIcon : InfoIcon

  return (
    <div role="status" aria-live={variant === "error" ? "assertive" : "polite"} className={cn("toast-item", `toast-${variant}`)}>
      <span className="toast-icon" aria-hidden="true"><Icon /></span>
      <div className="toast-copy">
        <strong>{toast.title}</strong>
        {toast.description ? <p>{toast.description}</p> : null}
      </div>
      {toast.action ? <button type="button" className="toast-action" onClick={toast.action.onClick}>{toast.action.label}</button> : null}
      <button type="button" className="toast-dismiss" aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}><X /></button>
    </div>
  )
}

function CheckIcon() { return <svg viewBox="0 0 16 16" fill="none"><path d="m3.25 8.2 3.05 3.05 6.45-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> }
function AlertIcon() { return <svg viewBox="0 0 16 16" fill="none"><path d="M8 5.2v3.4M8 11.4h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" /></svg> }
function WarningIcon() { return <svg viewBox="0 0 16 16" fill="none"><path d="m8 2.1 6.05 11.2H1.95L8 2.1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M8 6v3M8 11.1h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg> }
function InfoIcon() { return <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" /><path d="M8 7.2v3.1M8 4.9h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg> }

export function ToastViewport({ toasts, onDismiss }: { toasts: ToastData[]; onDismiss: (id: string) => void }) {
  return <div className="toast-viewport" aria-label="Notifications">{toasts.map((toast) => <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />)}</div>
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) throw new Error("useToast must be used within ToastProvider")
  return context
}

const ToastContext = React.createContext<ToastContextValue | null>(null)
interface ToastContextValue { toast: (toast: Omit<ToastData, "id">) => string; dismiss: (id: string) => void }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastData[]>([])
  const dismiss = React.useCallback((id: string) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])
  const toast = React.useCallback((data: Omit<ToastData, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts((current) => [...current, { ...data, id }])
    window.setTimeout(() => dismiss(id), 5000)
    return id
  }, [dismiss])

  return <ToastContext.Provider value={{ toast, dismiss }}>{children}<ToastViewport toasts={toasts} onDismiss={dismiss} /></ToastContext.Provider>
}
