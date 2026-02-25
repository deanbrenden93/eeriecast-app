import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { User as UserAPI } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";

function getErrorDetail(err) {
  if (err?.data?.detail) return String(err.data.detail);
  if (err?.message) return String(err.message);
  return "Something went wrong while confirming your email change.";
}

export default function ConfirmEmailChange() {
  const navigate = useNavigate();
  const { isAuthenticated, fetchUser } = useUser();
  const [searchParams] = useSearchParams();
  const [token] = useState(() => searchParams.get("token") || "");

  const [state, setState] = useState({
    status: "loading",
    message: "",
  });

  const hasAttemptedRef = useRef(false);

  const confirm = async () => {
    if (!token) {
      setState({
        status: "error",
        message: "This confirmation link is missing a token.",
      });
      return;
    }

    setState({ status: "loading", message: "" });
    try {
      await UserAPI.confirmEmailChange(token);
      if (isAuthenticated) {
        await fetchUser();
      }
      setState({
        status: "success",
        message: "Your email has been updated.",
      });
    } catch (err) {
      setState({
        status: "error",
        message: getErrorDetail(err),
      });
    }
  };

  useEffect(() => {
    if (token && searchParams.get("token")) {
      navigate("/confirm-email-change", { replace: true });
    }

    if (hasAttemptedRef.current) return;
    hasAttemptedRef.current = true;
    confirm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, searchParams, navigate]);

  const primaryDestination = isAuthenticated ? "/profile" : "/home";
  const primaryLabel = isAuthenticated ? "Go to Profile" : "Go to Home";

  return (
    <div className="min-h-screen bg-[#0a0a10] text-white relative overflow-y-auto">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[50rem] h-[40rem] rounded-full blur-[200px] opacity-[0.06] bg-gradient-to-br from-red-700 via-amber-600 to-transparent pointer-events-none" />

      <div className="relative z-10 max-w-xl mx-auto px-4 sm:px-6 py-10">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-md p-6 sm:p-8">
          <div className="flex items-start gap-3">
            {state.status === "loading" ? (
              <Loader2 className="w-6 h-6 text-white/80 animate-spin mt-0.5" />
            ) : state.status === "success" ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="w-6 h-6 text-amber-300 mt-0.5" />
            )}

            <div className="flex-1">
              <h1 className="text-xl font-semibold tracking-tight">
                {state.status === "loading"
                  ? "Confirming your email change"
                  : state.status === "success"
                    ? "Email updated"
                    : "Confirmation failed"}
              </h1>

              <p className="mt-2 text-sm text-white/70 leading-relaxed">
                {state.status === "loading"
                  ? "Please wait while we confirm your new email."
                  : state.message || ""}
              </p>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                {state.status === "error" && (
                  <Button onClick={confirm} variant="secondary">
                    Try again
                  </Button>
                )}

                <Button onClick={() => navigate(primaryDestination)}>
                  {primaryLabel}
                </Button>

                <Button onClick={() => navigate("/")} variant="ghost">
                  Back
                </Button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
