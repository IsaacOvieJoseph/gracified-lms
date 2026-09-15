import React, { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Lock, Mail, ArrowRight, Loader2 } from "lucide-react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo.jpg";
import { validateEmail } from "../utils/validation";
import api from "../utils/api";
import ThemeToggle from "../components/ThemeToggle";
import SplashScreen from "../components/SplashScreen";
const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const redirectRef = useRef("/dashboard");
  const { login, setAuthData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }
    try {
      const result = await login(email, password);
      if (result.success) {
        const params = new URLSearchParams(location.search);
        redirectRef.current = params.get("redirect") || "/dashboard";
        setShowSplash(true);
      } else if (result.requiresVerification) {
        setTempToken(result.tempToken);
        setShow2FAModal(true);
        setError("");
      } else if (result.redirectToVerify && result.email) {
        navigate("/verify-email", { state: { email: result.email } });
      } else if (result.trialExpired) {
        navigate("/subscription-management", { state: { email } });
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };
  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setError("");
    setOtpLoading(true);
    try {
      const response = await api.post("/auth/verify-2fa-login", { tempToken, otp }, { skipLoader: true });
      const { token, user, trialExpired, subscriptionExpired } = response.data;
      const cleanedUser = {
        ...user,
        schoolId: user.schoolId || [],
        tutorialId: user.tutorialId || null
      };
      setAuthData(token, cleanedUser, trialExpired, subscriptionExpired);
      const params = new URLSearchParams(location.search);
      redirectRef.current = params.get("redirect") || "/dashboard";
      setShowSplash(true);
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed. Please check your code.");
    } finally {
      setOtpLoading(false);
    }
  };
  return /* @__PURE__ */ React.createElement("div", { className: "h-screen bg-background text-foreground flex font-inter relative overflow-hidden transition-colors duration-300" }, showSplash && /* @__PURE__ */ React.createElement(SplashScreen, { onFinish: () => navigate(redirectRef.current) }), /* @__PURE__ */ React.createElement("div", { className: "absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full " }), /* @__PURE__ */ React.createElement("div", { className: "absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full " }), /* @__PURE__ */ React.createElement("div", { className: "hidden lg:flex flex-1 items-center justify-center p-12 bg-card border-r border-border relative z-10" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-md text-center" }, /* @__PURE__ */ React.createElement("img", { src: logo, alt: "Gracified", className: "w-24 h-24 mx-auto rounded-xl shadow-none mb-8" }), /* @__PURE__ */ React.createElement("h2", { className: "text-4xl font-extrabold text-foreground mb-4 tracking-tight" }, "Elevate Your ", /* @__PURE__ */ React.createElement("span", { className: "text-primary italic" }, "Learning Experience")), /* @__PURE__ */ React.createElement("p", { className: "text-muted-foreground text-lg leading-relaxed" }, "The most intuitive management system for modern educational environments."), /* @__PURE__ */ React.createElement("div", { className: "mt-12 grid grid-cols-2 gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "p-4 rounded-xl bg-muted border border-border" }, /* @__PURE__ */ React.createElement("div", { className: "text-2xl font-semibold text-foreground" }, "10k+"), /* @__PURE__ */ React.createElement("div", { className: "text-xs font-semibold tracking-wider text-muted-foreground" }, "Students")), /* @__PURE__ */ React.createElement("div", { className: "p-4 rounded-xl bg-muted border border-border" }, /* @__PURE__ */ React.createElement("div", { className: "text-2xl font-semibold text-foreground" }, "99.9%"), /* @__PURE__ */ React.createElement("div", { className: "text-xs font-semibold tracking-wider text-muted-foreground" }, "Uptime"))), /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("p", { className: "mt-8 text-center text-muted-foreground/60 text-xs font-medium" }, "\xA9 ", (/* @__PURE__ */ new Date()).getFullYear(), " Gracified LMS. All rights reserved."))), /* @__PURE__ */ React.createElement("div", { className: "flex-1 flex items-center justify-center p-6 lg:p-12 relative z-10" }, /* @__PURE__ */ React.createElement("div", { className: "w-full max-w-lg animate-slide-up" }, /* @__PURE__ */ React.createElement("div", { className: "lg:hidden text-center mb-8 relative" }, /* @__PURE__ */ React.createElement("div", { className: "absolute top-0 right-0" }), /* @__PURE__ */ React.createElement("img", { src: logo, alt: "Gracified", className: "w-16 h-16 mx-auto rounded-xl shadow-none mb-4" }), /* @__PURE__ */ React.createElement("h1", { className: "text-2xl font-semibold text-foreground" }, "Gracified LMS")), /* @__PURE__ */ React.createElement("div", { className: "card-premium p-10 md:p-14 bg-card max-h-[calc(100vh-4rem)] overflow-y-auto shadow-none relative" }, /* @__PURE__ */ React.createElement("div", { className: "hidden lg:flex absolute top-6 right-6" }), /* @__PURE__ */ React.createElement("div", { className: "mb-10 text-center lg:text-left" }, /* @__PURE__ */ React.createElement("h1", { className: "text-3xl font-extrabold text-foreground mb-3 tracking-tight" }, "Welcome back"), /* @__PURE__ */ React.createElement("p", { className: "text-muted-foreground text-base" }, "Enter your credentials to access your account")), !show2FAModal ? /* @__PURE__ */ React.createElement("form", { onSubmit: handleSubmit, className: "space-y-7" }, /* @__PURE__ */ React.createElement("div", { className: "space-y-1.5" }, /* @__PURE__ */ React.createElement("label", { className: "block text-sm font-semibold text-foreground/80 mb-1.5 ml-1" }, "Email Address"), /* @__PURE__ */ React.createElement("div", { className: "relative group" }, /* @__PURE__ */ React.createElement("div", { className: "absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors" }, /* @__PURE__ */ React.createElement(Mail, { className: "w-5 h-5" })), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "email",
      value: email,
      onChange: (e) => setEmail(e.target.value),
      className: "w-full pl-11 bg-muted dark:bg-muted border-border focus:bg-background dark:focus:bg-background",
      placeholder: "name@example.com",
      required: true
    }
  ))), /* @__PURE__ */ React.createElement("div", { className: "space-y-1.5" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("label", { className: "block text-sm font-semibold text-foreground/80 mb-1.5 ml-1" }, "Password"), /* @__PURE__ */ React.createElement(Link, { to: "/forgot-password", title: "Recover password", className: "text-xs font-semibold text-primary hover:underline" }, "Forgot Password?")), /* @__PURE__ */ React.createElement("div", { className: "relative group" }, /* @__PURE__ */ React.createElement("div", { className: "absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors" }, /* @__PURE__ */ React.createElement(Lock, { className: "w-5 h-5" })), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: showPassword ? "text" : "password",
      value: password,
      onChange: (e) => setPassword(e.target.value),
      className: "w-full pl-11 bg-muted dark:bg-muted border-border focus:bg-background dark:focus:bg-background",
      placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
      required: true
    }
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => setShowPassword(!showPassword),
      className: "absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
    },
    showPassword ? /* @__PURE__ */ React.createElement(EyeOff, { className: "w-5 h-5" }) : /* @__PURE__ */ React.createElement(Eye, { className: "w-5 h-5" })
  ))), error && /* @__PURE__ */ React.createElement("div", { className: "p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 dark:text-red-400 text-xs font-medium" }, error), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "submit",
      disabled: loading,
      className: "btn-premium w-full mt-2"
    },
    loading ? /* @__PURE__ */ React.createElement(Loader2, { className: "w-5 h-5 animate-spin" }) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", null, "Sign In"), /* @__PURE__ */ React.createElement(ArrowRight, { className: "w-4 h-4" }))
  )) : /* @__PURE__ */ React.createElement("form", { onSubmit: handleVerify2FA, className: "space-y-7 animate-slide-up" }, /* @__PURE__ */ React.createElement("div", { className: "p-4 bg-primary/10 border border-primary/20 rounded-xl text-primary text-sm font-medium mb-6" }, "A verification code has been sent to your email. Please enter it below to complete sign in."), /* @__PURE__ */ React.createElement("div", { className: "space-y-1.5" }, /* @__PURE__ */ React.createElement("label", { className: "block text-sm font-semibold text-foreground/80 mb-1.5 ml-1" }, "Verification Code (OTP)"), /* @__PURE__ */ React.createElement("div", { className: "relative group" }, /* @__PURE__ */ React.createElement("div", { className: "absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors" }, /* @__PURE__ */ React.createElement(Lock, { className: "w-5 h-5" })), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "text",
      value: otp,
      onChange: (e) => setOtp(e.target.value),
      className: "w-full pl-11 text-center tracking-[0.5em] font-mono text-lg bg-muted dark:bg-muted border-border focus:bg-background dark:focus:bg-background",
      placeholder: "000000",
      maxLength: 6,
      required: true
    }
  ))), error && /* @__PURE__ */ React.createElement("div", { className: "p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 dark:text-red-400 text-xs font-medium" }, error), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3 mt-4" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => {
        setShow2FAModal(false);
        setOtp("");
        setError("");
      },
      disabled: otpLoading,
      className: "flex-1 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-xl transition-colors"
    },
    "Back"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "submit",
      disabled: otpLoading || otp.length < 6,
      className: "flex-[2] btn-premium"
    },
    otpLoading ? /* @__PURE__ */ React.createElement(Loader2, { className: "w-5 h-5 animate-spin mx-auto" }) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", null, "Verify Code"), /* @__PURE__ */ React.createElement(ArrowRight, { className: "w-4 h-4 ml-2 inline-block" }))
  ))), /* @__PURE__ */ React.createElement("div", { className: "mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground" }, "Don't have an account?", " ", /* @__PURE__ */ React.createElement(
    Link,
    {
      to: `/register?${new URLSearchParams(location.search).toString()}`,
      className: "font-semibold text-primary hover:underline"
    },
    "Create account"
  ))))));
};
var Login_default = Login;
export {
  Login_default as default
};
