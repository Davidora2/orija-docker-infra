import { auth } from "@/auth";
import { google } from "googleapis";

export async function getAccessToken(): Promise<string> {
  const session = await auth();
  if (!session?.accessToken) {
    throw new Error("Unauthorized");
  }
  if (session.error === "RefreshAccessTokenError") {
    throw new Error("Session expired. Please sign in again.");
  }
  return session.accessToken;
}

export async function getOAuth2Client() {
  const accessToken = await getAccessToken();
  const client = new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
  );
  client.setCredentials({ access_token: accessToken });
  return client;
}

export async function getDriveClient() {
  const authClient = await getOAuth2Client();
  return google.drive({ version: "v3", auth: authClient });
}
