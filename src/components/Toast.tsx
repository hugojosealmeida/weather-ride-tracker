import { AlertTriangle, Check, Info, X } from "lucide-react";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastData {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
  detail?: string;
  action?: ToastAction;
}

interface ToastProps {
  toast: ToastData;
  onClose: () => void;
}

export function Toast({ toast, onClose }: ToastProps) {
  const Icon = toast.kind === "success" ? Check : toast.kind === "error" ? AlertTriangle : Info;

  return (
    <div className={`toast is-${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
      <span className="toast-icon" aria-hidden>
        <Icon size={15} />
      </span>
      <div className="toast-text">
        <strong>{toast.message}</strong>
        {toast.detail && <span>{toast.detail}</span>}
      </div>
      {toast.action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            toast.action?.onClick();
            onClose();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className="toast-close" aria-label="Dismiss" onClick={onClose}>
        <X size={14} />
      </button>
    </div>
  );
}
