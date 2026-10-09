const region = process.env.NEXT_PUBLIC_AWS_REGION;
const clientId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID;

export const isMockMode = !clientId || clientId.includes("your_cognito_app_client_id") || clientId === "mock";
export const isCognitoConfigured = Boolean((region && clientId) || isMockMode);

function createMockToken(email) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const cleanEmail = (email || "supplier@example.com").trim().toLowerCase();
  const sub = "mock-sub-" + btoa(cleanEmail).replace(/=/g, "");
  const payload = btoa(JSON.stringify({
    sub: sub,
    email: cleanEmail,
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 86400 * 7,
    token_use: "id",
  }));
  return `${header}.${payload}.mock-sig`;
}

async function cognitoRequest(target, payload) {
  if (isMockMode) {
    if (target === "SignUp") return { UserSub: "mock-sub-" + btoa(payload.Username || "user") };
    return {};
  }

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

export const signUp = (email, password) => cognitoRequest("SignUp", {
  ClientId: clientId, Username: email.trim().toLowerCase(), Password: password,
  UserAttributes: [{ Name: "email", Value: email.trim().toLowerCase() }],
});

export const confirmSignUp = (email, code) => cognitoRequest("ConfirmSignUp", {
  ClientId: clientId, Username: email.trim().toLowerCase(), ConfirmationCode: code.trim(),
});

export async function signIn(email, password) {
  if (isMockMode) {
    const mockToken = createMockToken(email);
    const session = { idToken: mockToken, accessToken: mockToken, refreshToken: "mock-refresh" };
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
