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
            className={`transition-all duration-300 !py-2.5 !px-4 !pr-8 !rounded-xl !border-white/[0.08] !bg-zinc-900/95 !backdrop-blur-xl !shadow-2xl !shadow-black/40 ${open === false ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}`}>
            <div className="flex items-center gap-2">
              {title && <ToastTitle className="!text-xs !font-medium !text-white/90">{title}</ToastTitle>}
              {title && description && <span className="text-white/20 text-xs">·</span>}
              {description && (
                <ToastDescription className="!text-xs !text-white/50 truncate max-w-[200px]">{description}</ToastDescription>
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