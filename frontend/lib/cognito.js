const region = process.env.NEXT_PUBLIC_AWS_REGION;
const clientId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export const isMockMode = !clientId || clientId.includes("your_cognito_app_client_id") || clientId === "mock";
export const isCognitoConfigured = true; // always true — mock mode has real auth now

// ---------------------------------------------------------------------------
// Mock-mode: calls the backend /api/auth/* endpoints which enforce
// real password hashing, email uniqueness, and OTP verification.
// ---------------------------------------------------------------------------

async function mockAuthRequest(path, body) {
  const res = await fetch(`${API_BASE}/api/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.detail || "Request failed.");
    // Map HTTP status to Cognito-style error codes so mapCognitoError works
    if (res.status === 409) error.code = "UsernameExistsException";
    if (res.status === 401) error.code = "NotAuthorizedException";
    if (res.status === 403) error.code = "UserNotConfirmedException";
    throw error;
  }
  return data;
}

async function cognitoRequest(target, payload) {
  if (!isCognitoConfigured) throw new Error("AWS Cognito is not configured. Set the AWS region and Cognito app client ID.");
  const response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-amz-json-1.1", "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}` },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || "AWS Cognito request failed.");
    error.code = data.__type?.split("#").pop();
    throw error;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Sign-up: in mock mode sends OTP via backend; in Cognito mode uses SDK.
// Returns { needsVerification: true } when OTP confirmation is required.
// ---------------------------------------------------------------------------
export async function signUp(email, password, companyName = "") {
  if (isMockMode) {
    await mockAuthRequest("signup", {
      email: email.trim().toLowerCase(),
      password,
      company_name: companyName || email.split("@")[0],
    });
    // Signup succeeded — OTP sent to console; caller must call confirmSignUp
    return { UserConfirmed: false, needsVerification: true };
  }
  return cognitoRequest("SignUp", {
    ClientId: clientId, Username: email.trim().toLowerCase(), Password: password,
    UserAttributes: [{ Name: "email", Value: email.trim().toLowerCase() }],
  });
}

// ---------------------------------------------------------------------------
// Confirm sign-up with OTP
// ---------------------------------------------------------------------------
export async function confirmSignUp(email, code) {
  if (isMockMode) {
    await mockAuthRequest("verify-email", {
      email: email.trim().toLowerCase(),
      otp: code.trim(),
    });
    return {};
  }
  return cognitoRequest("ConfirmSignUp", {
    ClientId: clientId, Username: email.trim().toLowerCase(), ConfirmationCode: code.trim(),
  });
}

// ---------------------------------------------------------------------------
// Resend OTP
// ---------------------------------------------------------------------------
export async function resendOtp(email) {
  if (isMockMode) {
    return mockAuthRequest("resend-otp", { email: email.trim().toLowerCase() });
  }
  return cognitoRequest("ResendConfirmationCode", {
    ClientId: clientId, Username: email.trim().toLowerCase(),
  });
}

// ---------------------------------------------------------------------------
// Sign-in: mock mode validates password + verified status server-side.
// ---------------------------------------------------------------------------
export async function signIn(email, password) {
  if (isMockMode) {
    const data = await mockAuthRequest("signin", {
      email: email.trim().toLowerCase(),
      password,
    });
    const session = { idToken: data.id_token, accessToken: data.id_token, refreshToken: "mock-refresh" };
    sessionStorage.setItem("cognito-session", JSON.stringify(session));
    return session;
  }

  const result = await cognitoRequest("InitiateAuth", {
    ClientId: clientId, AuthFlow: "USER_PASSWORD_AUTH",
    AuthParameters: { USERNAME: email.trim().toLowerCase(), PASSWORD: password },
  });
  if (!result.AuthenticationResult?.IdToken) throw new Error("Additional sign-in verification is required. Configure Cognito MFA as optional or disabled for this MVP.");
  const session = { idToken: result.AuthenticationResult.IdToken, accessToken: result.AuthenticationResult.AccessToken, refreshToken: result.AuthenticationResult.RefreshToken };
  sessionStorage.setItem("cognito-session", JSON.stringify(session));
  return session;
}

export async function getIdToken() {
  const session = getSession();
  if (!session?.idToken) throw new Error("Your session has expired. Please sign in again.");
  if (isMockMode) return session.idToken;

  try {
    const encoded = session.idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(encoded));
    if (payload.exp * 1000 > Date.now() + 60_000) return session.idToken;
  } catch {}
  if (!session.refreshToken) throw new Error("Your session has expired. Please sign in again.");
  const result = await cognitoRequest("InitiateAuth", {
    ClientId: clientId, AuthFlow: "REFRESH_TOKEN_AUTH", AuthParameters: { REFRESH_TOKEN: session.refreshToken },
  });
  if (!result.AuthenticationResult?.IdToken) throw new Error("Your session has expired. Please sign in again.");
  const renewed = { ...session, idToken: result.AuthenticationResult.IdToken, accessToken: result.AuthenticationResult.AccessToken };
  sessionStorage.setItem("cognito-session", JSON.stringify(renewed));
  return renewed.idToken;
}

export const getSession = () => {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(sessionStorage.getItem("cognito-session") || "null"); } catch { return null; }
};
export const signOut = () => { if (typeof window !== "undefined") sessionStorage.removeItem("cognito-session"); };
export const requestPasswordReset = (email) => cognitoRequest("ForgotPassword", { ClientId: clientId, Username: email.trim().toLowerCase() });
export const confirmPasswordReset = (email, code, password) => cognitoRequest("ConfirmForgotPassword", {
  ClientId: clientId, Username: email.trim().toLowerCase(), ConfirmationCode: code.trim(), Password: password,
});
