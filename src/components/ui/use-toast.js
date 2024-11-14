import { useState, useCallback } from "react"

export function useToast() {
  const [toasts, setToasts] = useState([])

  const toast = useCallback(({ description, variant = "default" }) => {
    setToasts((currentToasts) => [
      ...currentToasts,
      { id: Date.now(), description, variant },
    ])

    // Auto dismiss after 3 seconds
    setTimeout(() => {
      setToasts((currentToasts) => 
        currentToasts.filter((toast) => toast.id !== Date.now())
      )
    }, 3000)
  }, [])

  return { toast, toasts }
} 