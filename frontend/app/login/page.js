"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmPasswordReset, confirmSignUp, isCognitoConfigured, requestPasswordReset, signIn, signUp } from "@/lib/cognito";
import { registerUser } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

export default function LoginPage() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState("");
  const [resetRequested, setResetRequested] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const router = useRouter();
  const { profile, refreshProfile } = useAuth();

  useEffect(() => {
    if (!profile) return;
    router.replace(profile.role === "ADMIN" ? "/admin/dashboard" : "/supplier/dashboard");
  }, [profile, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!isCognitoConfigured) {
      setError("AWS Cognito is not configured. Set the AWS region and Cognito app client ID.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        const result = await signUp(email, password);
        if (result.UserConfirmed) {
          const session = await signIn(email, password);
          await registerUser(session.idToken, { company_name: companyName, role: "SUPPLIER" });
          await refreshProfile();
        } else {
          setConfirmationRequired(true);
          setNotice("Check your email for the AWS Cognito confirmation code.");
        }
      } else {
        const session = await signIn(email, password);
        await registerUser(session.idToken, { company_name: email.split("@")[0], role: "SUPPLIER" });
        await refreshProfile();
      }
    } catch (err) {
      setError(mapCognitoError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    setError("");
    setNotice("");
    if (!isCognitoConfigured) {
      setError("AWS Cognito is not configured. Set the AWS region and Cognito app client ID.");
      return;
    }
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    try {
      await requestPasswordReset(email.trim());
      setResetRequested(true);
      setNotice("If an account exists for this email, AWS Cognito has sent a password reset code.");
    } catch (err) {
      setError(mapCognitoError(err));
    }
  };

  const handleConfirmPasswordReset = async (e) => {
    e.preventDefault(); setError(""); setSubmitting(true);
    try {
      await confirmPasswordReset(email, resetCode, newPassword);
      setResetRequested(false); setNotice("Password updated. You can now sign in.");
    } catch (err) { setError(mapCognitoError(err)); }
    finally { setSubmitting(false); }
  };

  const handleConfirmation = async (e) => {
    e.preventDefault(); setError(""); setSubmitting(true);
    try {
      await confirmSignUp(email, confirmationCode);
      const session = await signIn(email, password);
      await registerUser(session.idToken, { company_name: companyName, role: "SUPPLIER" });
      await refreshProfile();
    } catch (err) { setError(mapCognitoError(err)); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-white">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-brandgreen-500 text-lg font-bold text-navy-950">
            PF
          </span>
          <h1 className="text-xl font-semibold">PO Finance Platform</h1>
          <p className="mt-1 text-sm text-navy-300">Supply-chain financing, done right.</p>
        </div>

        <div className="card p-6">
          <div className="mb-6 flex rounded-md border border-slate-200 bg-slate-100 p-1 text-sm font-medium">
            <button
              className={`flex-1 rounded-md py-1.5 transition-colors ${
                mode === "signin" ? "bg-white shadow-sm text-navy-900" : "text-slate-500"
              }`}
              onClick={() => setMode("signin")}
              type="button"
            >
              Sign in
            </button>
            <button
              className={`flex-1 rounded-md py-1.5 transition-colors ${
                mode === "signup" ? "bg-white shadow-sm text-navy-900" : "text-slate-500"
              }`}
              onClick={() => setMode("signup")}
              type="button"
            >
              Supplier sign up
            </button>
          </div>

          {resetRequested ? <form onSubmit={handleConfirmPasswordReset} className="space-y-4">
            <p className="text-sm text-slate-600">Enter the reset code sent to {email}, then choose a new password.</p>
            <input className="input-field" value={resetCode} onChange={(e) => setResetCode(e.target.value)} required placeholder="Password reset code" />
            <input type="password" minLength={8} className="input-field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="New password" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="btn-primary w-full" disabled={submitting}>{submitting ? "Please wait..." : "Reset password"}</button>
          </form> : confirmationRequired ? <form onSubmit={handleConfirmation} className="space-y-4">
            <p className="text-sm text-slate-600">Enter the confirmation code sent to {email}.</p>
            <input className="input-field" value={confirmationCode} onChange={(e) => setConfirmationCode(e.target.value)} required placeholder="Email confirmation code" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="btn-primary w-full" disabled={submitting}>{submitting ? "Please wait..." : "Confirm email"}</button>
          </form> : <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-navy-800">Company name</label>
                <input
                  className="input-field"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  placeholder="Acme Manufacturing Ltd."
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-navy-800">Email</label>
              <input
                type="email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-navy-800">Password</label>
              <input
                type="password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="••••••••"
              />
            </div>

            {mode === "signin" && (
              <div className="text-right">
                <button type="button" className="text-sm font-medium text-brandgreen-700 hover:underline" onClick={handlePasswordReset}>
                  Forgot password?
                </button>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            {notice && <p className="text-sm text-green-700">{notice}</p>}

            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>}
        </div>

        <p className="mt-4 text-center text-xs text-navy-400">
          Administrator accounts are provisioned internally and use the same sign-in form.
        </p>
      </div>
    </div>
  );
}

function mapCognitoError(err) {
  const code = err?.code || "";
  if (code.includes("UsernameExists")) return "An account with this email already exists.";
  if (code.includes("NotAuthorized") || code.includes("UserNotFound")) return "Invalid email or password.";
  if (code.includes("UserNotConfirmed")) return "Confirm your email using the code AWS Cognito sent you.";
  if (code.includes("InvalidPassword")) return "Password must be at least 8 characters and meet your Cognito password policy.";
  return err?.message || "Something went wrong. Please try again.";
}
