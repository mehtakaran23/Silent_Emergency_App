"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const { google } = require("googleapis");

const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];
const credentialsDirectory = path.resolve(__dirname, "..", "credentials");
const defaultCredentialsPath = path.join(
  credentialsDirectory,
  "gmail-oauth-client.json"
);

const readCredentials = () => {
  const configuredPath = process.env.GMAIL_OAUTH_CREDENTIALS;
  const credentialsPath = configuredPath
    ? path.resolve(process.cwd(), configuredPath)
    : defaultCredentialsPath;

  if (fs.existsSync(credentialsPath)) {
    return {
      credentials: JSON.parse(fs.readFileSync(credentialsPath, "utf8")),
      credentialsPath,
    };
  }

  if (!configuredPath && fs.existsSync(credentialsDirectory)) {
    const localJsonFiles = fs
      .readdirSync(credentialsDirectory)
      .filter((fileName) => fileName.endsWith(".json"));

    if (localJsonFiles.length === 1) {
      const fallbackPath = path.join(credentialsDirectory, localJsonFiles[0]);
      return {
        credentials: JSON.parse(fs.readFileSync(fallbackPath, "utf8")),
        credentialsPath: fallbackPath,
      };
    }
  }

  throw new Error(
    `OAuth credentials were not found. Place the Desktop credentials JSON at ${defaultCredentialsPath} or set GMAIL_OAUTH_CREDENTIALS.`
  );
};

const getDesktopCredentials = (credentials) => {
  const desktopCredentials = credentials.installed || credentials.web;
  if (!desktopCredentials?.client_id || !desktopCredentials.client_secret) {
    throw new Error("The credentials file is not a valid Desktop OAuth client file.");
  }
  return desktopCredentials;
};

const getErrorDetails = (error) => ({
  name: error?.name,
  message: error?.message,
  code: error?.code,
});

const askToContinue = (authorizationUrl) =>
  new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const requestUrl = new URL(request.url, "http://localhost");
      if (requestUrl.pathname !== "/oauth2callback") {
        response.writeHead(404);
        response.end("Not found.");
        return;
      }

      if (requestUrl.searchParams.get("error")) {
        response.writeHead(400, { "Content-Type": "text/plain" });
        response.end("Gmail authorization was denied. You can close this tab.");
        server.close(() =>
          reject(new Error("Gmail authorization was denied or cancelled."))
        );
        return;
      }

      const code = requestUrl.searchParams.get("code");
      if (!code) {
        response.writeHead(400, { "Content-Type": "text/plain" });
        response.end("No authorization code was received.");
        server.close(() => reject(new Error("No OAuth authorization code received.")));
        return;
      }

      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end("Gmail authorization completed. You can close this tab.");
      server.close(() => resolve(code));
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const redirectUri = `http://localhost:${address.port}/oauth2callback`;
      const oauth2Client = askToContinue.oauth2Client;
      oauth2Client.redirectUri = redirectUri;

      const url = oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: SCOPES,
      });

      console.log("Open this URL in the Gmail account that will send app email:");
      console.log(url);
      console.log(
        "After approval, Google will redirect to the local callback automatically."
      );
    });
  });

const main = async () => {
  const { credentials, credentialsPath } = readCredentials();
  const desktopCredentials = getDesktopCredentials(credentials);
  const oauth2Client = new google.auth.OAuth2(
    desktopCredentials.client_id,
    desktopCredentials.client_secret
  );
  askToContinue.oauth2Client = oauth2Client;

  console.log(`Using OAuth credentials from ${credentialsPath}`);
  const code = await askToContinue();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Revoke this app access in the Gmail account and run the command again."
    );
  }

  console.log("\nGmail OAuth authorization succeeded.");
  console.log("Refresh token (store it only in Render environment variables):");
  console.log(tokens.refresh_token);
  console.log("\nThe token was not written to disk.");
};

main().catch((error) => {
  console.error("Gmail OAuth authorization failed:", getErrorDetails(error));
  process.exitCode = 1;
});
