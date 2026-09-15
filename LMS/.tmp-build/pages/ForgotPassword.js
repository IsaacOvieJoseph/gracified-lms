import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Mail, Key, Eye, EyeOff } from "lucide-react";
import api from "../utils/api";
import { validateEmail, validatePassword, passwordRequirements } from "../utils/validation";
import OTPInput from "../components/OTPInput";
import ThemeToggle from "../components/ThemeToggle";
const ForgotPassword = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }
    try {
      const response = await api.post("/auth/forgot-password", { email }, { skipLoader: true });
      setMessage(response.data.message);
      setStep(2);
      sessionStorage.setItem("resetPasswordEmail", email);
    } catch (err) {
      console.error("Forgot password error:", err);
      setError(err.response?.data?.message || "Failed to send reset OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    const emailToUse = email || sessionStorage.getItem("resetPasswordEmail");
    try {
      const response = await api.post("/auth/verify-reset-otp", { email: emailToUse, otp }, { skipLoader: true });
      setMessage(response.data.message);
      setStep(3);
    } catch (err) {
      console.error("Verify OTP error:", err);
      setError(err.response?.data?.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }
    if (!validatePassword(newPassword)) {
      setError(passwordRequirements);
      setLoading(false);
      return;
    }
    const emailToUse = email || sessionStorage.getItem("resetPasswordEmail");
    try {
      const response = await api.post("/auth/reset-password", {
        email: emailToUse,
        otp,
        newPassword
      }, { skipLoader: true });
      setMessage(response.data.message);
      sessionStorage.removeItem("resetPasswordEmail");
      setTimeout(() => {
        navigate("/login");
      }, 2e3);
    } catch (err) {
      console.error("Reset password error:", err);
      setError(err.response?.data?.message || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  React.useEffect(() => {
    const savedEmail = sessionStorage.getItem("resetPasswordEmail");
    if (savedEmail && step > 1) {
      setEmail(savedEmail);
    }
  }, [step]);
  return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen bg-background text-foreground flex items-center justify-center p-4 md:p-6 font-inter relative overflow-hidden transition-colors duration-300" }, /* @__PURE__ */ React.createElement("div", { className: "absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full  pointer-events-none" }), /* @__PURE__ */ React.createElement("div", { className: "absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full  pointer-events-none" }), /* @__PURE__ */ React.createElement("div", { className: "absolute top-4 right-4 z-20" }), /* @__PURE__ */ React.createElement("div", { className: "w-full max-w-md relative z-10 animate-slide-up" }, /* @__PURE__ */ React.createElement("div", { className: "card-premium p-8 md:p-10 bg-card" }, /* @__PURE__ */ React.createElement("div", { className: "text-center mb-8" }, /* @__PURE__ */ React.createElement("div", { className: "inline-flex p-3 rounded-xl bg-primary/10 mb-4" }, /* @__PURE__ */ React.createElement(Lock, { className: "w-8 h-8 text-primary" })), /* @__PURE__ */ React.createElement("h1", { className: "font-serif text-3xl font-semibold text-foreground mb-2" }, "Reset Password"), /* @__PURE__ */ React.createElement("p", { className: "text-muted-foreground" }, step === 1 && "Enter your email to receive a reset code", step === 2 && "Enter the OTP sent to your email", step === 3 && "Create your new password")), step === 1 && /* @__PURE__ */ React.createElement("form", { onSubmit: handleRequestOTP, className: "space-y-4" }, /* @__PURE__ */ React.createElement("div", { className: "space-y-1.5" }, /* @__PURE__ */ React.createElement("label", { className: "block text-sm font-semibold text-foreground/80 ml-1" }, "Email Address"), /* @__PURE__ */ React.createElement("div", { className: "relative group" }, /* @__PURE__ */ React.createElement("div", { className: "absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors" }, /* @__PURE__ */ React.createElement(Mail, { className: "w-5 h-5" })), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "email",
      value: email,
      onChange: (e) => setEmail(e.target.value),
      className: "w-full pl-11 py-2.5 bg-muted dark:bg-muted border border-border rounded-xl text-foreground placeholder-muted-foreground transition-all focus:bg-background dark:focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none",
      placeholder: "name@example.com",
      required: true
    }
  ))), error && /* @__PURE__ */ React.createElement("div", { className: "p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-500 dark:text-red-400 font-medium" }, error), message && /* @__PURE__ */ React.createElement("div", { className: "p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-600 dark:text-emerald-400 font-medium" }, message), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "submit",
      disabled: loading,
      className: "w-full btn-premium mt-6 disabled:opacity-60 disabled:cursor-not-allowed"
    },
    loading ? "Sending..." : "Send Reset Code"
  )), step === 2 && /* @__PURE__ */ React.createElement("form", { onSubmit: handleVerifyOTP, className: "space-y-4" }, /* @__PURE__ */ React.createElement("div", { className: "space-y-1.5" }, /* @__PURE__ */ React.createElement("label", { className: "block text-sm font-semibold text-foreground/80 ml-1" }, "Enter OTP"), /* @__PURE__ */ React.createElement("div", { className: "flex justify-center mb-4" }, /* @__PURE__ */ React.createElement(
    OTPInput,
    {
      length: 6,
      value: otp,
      onChange: setOtp
    }
  )), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-muted-foreground text-center ml-1" }, "OTP sent to ", email || sessionStorage.getItem("resetPasswordEmail"))), error && /* @__PURE__ */ React.createElement("div", { className: "p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-500 dark:text-red-400 font-medium" }, error), message && /* @__PURE__ */ React.createElement("div", { className: "p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-600 dark:text-emerald-400 font-medium" }, message), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "submit",
      disabled: loading,
      className: "w-full btn-premium mt-6 disabled:opacity-60 disabled:cursor-not-allowed"
    },
    loading ? "Verifying..." : "Verify OTP"
  ), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-center mt-4 pt-2 border-t border-border" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => setStep(1),
      className: "text-primary hover:text-primary/80 text-xs font-semibold transition-colors"
    },
    "Change Email"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: async () => {
        setError("");
        setMessage("");
        setLoading(true);
        const emailToUse = email || sessionStorage.getItem("resetPasswordEmail");
        try {
          const response = await api.post("/auth/resend-reset-otp", { email: emailToUse }, { skipLoader: true });
          setMessage(response.data.message);
        } catch (err) {
          setError(err.response?.data?.message || "Failed to resend OTP");
        } finally {
          setLoading(false);
        }
      },
      disabled: loading,
      className: "text-primary hover:text-primary/80 text-xs font-semibold disabled:opacity-50 transition-colors"
    },
    "Resend OTP"
  ))), step === 3 && /* @__PURE__ */ React.createElement("form", { onSubmit: handleResetPassword, className: "space-y-4" }, /* @__PURE__ */ React.createElement("div", { className: "space-y-1.5" }, /* @__PURE__ */ React.createElement("label", { className: "block text-sm font-semibold text-foreground/80 ml-1" }, "New Password"), /* @__PURE__ */ React.createElement("div", { className: "relative group" }, /* @__PURE__ */ React.createElement("div", { className: "absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors" }, /* @__PURE__ */ React.createElement(Lock, { className: "w-5 h-5" })), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: showNewPassword ? "text" : "password",
      value: newPassword,
      onChange: (e) => setNewPassword(e.target.value),
      className: "w-full pl-11 py-2.5 bg-muted dark:bg-muted border border-border rounded-xl text-foreground placeholder-muted-foreground transition-all focus:bg-background dark:focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none pr-10",
      placeholder: "Enter new password",
      required: true,
      minLength: "6"
    }
  ), /* @__PURE__ */ React.createElement("button", { type: "button", className: "absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground transition-colors", onClick: () => setShowNewPassword(!showNewPassword) }, showNewPassword ? /* @__PURE__ */ React.createElement(EyeOff, { className: "w-5 h-5" }) : /* @__PURE__ */ React.createElement(Eye, { className: "w-5 h-5" })))), /* @__PURE__ */ React.createElement("div", { className: "space-y-1.5" }, /* @__PURE__ */ React.createElement("label", { className: "block text-sm font-semibold text-foreground/80 ml-1" }, "Confirm Password"), /* @__PURE__ */ React.createElement("div", { className: "relative group" }, /* @__PURE__ */ React.createElement("div", { className: "absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors" }, /* @__PURE__ */ React.createElement(Lock, { className: "w-5 h-5" })), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: showConfirmPassword ? "text" : "password",
      value: confirmPassword,
      onChange: (e) => setConfirmPassword(e.target.value),
      className: "w-full pl-11 py-2.5 bg-muted dark:bg-muted border border-border rounded-xl text-foreground placeholder-muted-foreground transition-all focus:bg-background dark:focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none pr-10",
      placeholder: "Confirm new password",
      required: true,
      minLength: "6"
    }
  ), /* @__PURE__ */ React.createElement("button", { type: "button", className: "absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground transition-colors", onClick: () => setShowConfirmPassword(!showConfirmPassword) }, showConfirmPassword ? /* @__PURE__ */ React.createElement(EyeOff, { className: "w-5 h-5" }) : /* @__PURE__ */ React.createElement(Eye, { className: "w-5 h-5" })))), error && /* @__PURE__ */ React.createElement("div", { className: "p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-500 dark:text-red-400 font-medium" }, error), message && /* @__PURE__ */ React.createElement("div", { className: "p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-600 dark:text-emerald-400 font-medium" }, message), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "submit",
      disabled: loading,
      className: "w-full btn-premium mt-6 disabled:opacity-60 disabled:cursor-not-allowed"
    },
    loading ? "Resetting..." : "Reset Password"
  ), message && /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500 text-center animate-pulse" }, "Redirecting to login page...")), /* @__PURE__ */ React.createElement("div", { className: "mt-8 pt-6 border-t border-border" }, /* @__PURE__ */ React.createElement("p", { className: "text-center text-muted-foreground text-sm" }, /* @__PURE__ */ React.createElement(Link, { to: "/login", className: "font-semibold text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1" }, "\u2190 Back to Login"))))));
};
var ForgotPassword_default = ForgotPassword;
export {
  ForgotPassword_default as default
};
