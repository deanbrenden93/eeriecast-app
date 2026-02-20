import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2, Lock, ArrowLeft } from "lucide-react";

import { User } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("uid") || "";
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [state, setState] = useState({
    status: "idle", // idle | loading | success | error
    message: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!uid || !token) {
      setState({
        status: "error",
        message: "Invalid reset link. Please request a new one.",
      });
      return;
    }

    if (password !== confirmPassword) {
      setState({
        status: "error",
        message: "Passwords do not match.",
      });
      return;
    }

    if (password.length < 8) {
      setState({
        status: "error",
        message: "Password must be at least 8 characters long.",
      });
      return;
    }

    setState({ status: "loading", message: "" });
    try {
      await User.confirmPasswordReset(uid, token, password);
      setState({
        status: "success",
        message: "Your password has been reset successfully.",
      });
    } catch (err) {
      setState({
        status: "error",
        message: err?.data?.detail || err?.message || "Failed to reset password. The link may have expired.",
      });
    }
  };

  if (state.status === "success") {
    return (
      <div className="min-h-screen bg-[#0a0a10] text-white relative flex items-center justify-center p-4">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[50rem] h-[40rem] rounded-full blur-[200px] opacity-[0.06] bg-gradient-to-br from-red-700 via-amber-600 to-transparent pointer-events-none" />
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-md p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Password Reset</h1>
          <p className="text-white/70 mb-8">{state.message}</p>
          <Button className="w-full bg-red-600 hover:bg-red-500" onClick={() => navigate("/")}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a10] text-white relative flex items-center justify-center p-4">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[50rem] h-[40rem] rounded-full blur-[200px] opacity-[0.06] bg-gradient-to-br from-red-700 via-amber-600 to-transparent pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-md p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-red-600/10 rounded-full flex items-center justify-center mx-auto mb-4 ring-1 ring-red-600/20">
            <Lock className="w-6 h-6 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold">Reset Password</h1>
          <p className="text-sm text-white/60 mt-2">Enter your new password below.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider font-medium text-gray-400 block">New Password</label>
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white/5 border-white/10 focus-visible:ring-red-600"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider font-medium text-gray-400 block">Confirm Password</label>
            <Input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-white/5 border-white/10 focus-visible:ring-red-600"
              placeholder="••••••••"
            />
          </div>

          {state.status === "error" && (
            <div className="flex items-start gap-2 p-3 rounded bg-red-950/30 border border-red-800/40 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{state.message}</span>
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full bg-red-600 hover:bg-red-500" 
            disabled={state.status === "loading"}
          >
            {state.status === "loading" ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Resetting...
              </span>
            ) : "Reset Password"}
          </Button>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-xs text-white/40 hover:text-white mx-auto transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to home
          </button>
        </form>
      </div>
    </div>
  );
}
