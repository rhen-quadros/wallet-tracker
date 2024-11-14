import React, { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext({});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback(({ description, variant = "default" }) => {
    const id = Date.now();
    setToasts((currentToasts) => [
      ...currentToasts,
      { id, description, variant },
    ]);

    setTimeout(() => {
      setToasts((currentToasts) => 
        currentToasts.filter((toast) => toast.id !== id)
      );
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast, toasts }}>
      {children}
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  return useContext(ToastContext);
}; 