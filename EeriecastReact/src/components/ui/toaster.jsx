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
      {toasts.map(function ({ id, title, description, action, open, onOpenChange, variant, ...props }) {
        const isSuccess = variant === 'success';
        return (
          <Toast key={id} open={open} onOpenChange={onOpenChange} variant={variant} {...props}
            className={`transition-all duration-300 !py-2.5 !px-4 !pr-8 !rounded-xl !backdrop-blur-xl !shadow-2xl !shadow-black/40 ${
              isSuccess
                ? '!bg-green-950/95 !border-green-500/30'
                : '!border-white/[0.08] !bg-zinc-900/95'
            } ${open === false ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}`}>
            <div className="flex items-center gap-2">
              {title && <ToastTitle className={`!text-xs !font-medium ${isSuccess ? '!text-green-300' : '!text-white/90'}`}>{title}</ToastTitle>}
              {title && description && <span className={`text-xs ${isSuccess ? 'text-green-500/40' : 'text-white/20'}`}>·</span>}
              {description && (
                <ToastDescription className={`!text-xs truncate max-w-[200px] ${isSuccess ? '!text-green-400/70' : '!text-white/50'}`}>{description}</ToastDescription>
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