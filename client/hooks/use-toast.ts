import { toast } from "sonner"

export function useToast() {
  return {
    toast: {
      // Basic toast methods
      success: (message: string, options?: any) => toast.success(message, options),
      error: (message: string, options?: any) => toast.error(message, options),
      info: (message: string, options?: any) => toast.info(message, options),
      warning: (message: string, options?: any) => toast.warning(message, options),
      
      // Custom method to match your existing API
      custom: ({ title, description, variant = "default" }: { 
        title: string; 
        description?: string; 
        variant?: "default" | "destructive" 
      }) => {
        if (variant === "destructive") {
          return toast.error(title, { description })
        }
        return toast(title, { description })
      }
    },
    dismiss: toast.dismiss
  }
}