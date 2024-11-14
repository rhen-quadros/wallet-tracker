import { useToast } from "../../contexts/ToastContext"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-lg px-4 py-3 shadow-lg animate-fade-in
            ${toast.variant === "destructive" 
              ? "bg-red-500 text-white" 
              : "bg-dark-accent text-white"}`}
        >
          {toast.description}
        </div>
      ))}
    </div>
  )
} 