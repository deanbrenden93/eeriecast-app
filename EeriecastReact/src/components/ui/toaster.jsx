import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, open, onOpenChange, ...props }) {
        return (
          <Toast key={id} open={open} onOpenChange={onOpenChange} {...props}
            className={`transition-all duration-300 ${open === false ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}`}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose onClick={() => onOpenChange?.(false)} />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
} 