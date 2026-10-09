"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getIdToken, getSession, signOut as cognitoSignOut } from "./cognito";
import { fetchMyProfile } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [cognitoUser, setCognitoUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const refreshProfile = async () => {
    const session = getSession();
    if (!session?.idToken) { setCognitoUser(null); setProfile(null); return; }
    const current = ++requestId.current;
    setCognitoUser({ getIdToken });
    const token = await getIdToken();
    const me = await fetchMyProfile(token);
    if (current === requestId.current) setProfile(me);
  };

  useEffect(() => {
    refreshProfile().catch(() => { cognitoSignOut(); setCognitoUser(null); setProfile(null); }).finally(() => setLoading(false));
  }, []);

  const signOut = async () => {
    requestId.current += 1;
    cognitoSignOut(); setCognitoUser(null); setProfile(null);
  };

  return <AuthContext.Provider value={{ cognitoUser, profile, loading, signOut, refreshProfile }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
