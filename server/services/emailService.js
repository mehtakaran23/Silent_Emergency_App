const { Resend } = require("resend");
const User = require("../models/User");
const Contact = require("../models/Contact");
const NotificationLog = require("../models/NotificationLog");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const RESPONSE_TOKEN_TTL = process.env.CONTACT_RESPONSE_TOKEN_TTL || "7d";
const responseSecret = () => process.env.CONTACT_RESPONSE_SECRET || process.env.JWT_SECRET;
const getClientBaseUrl = () =>
  (process.env.CLIENT_URL || process.env.SOCKET_CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .find(Boolean) || "";

const getResendConfiguration = () => {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.EMAIL_FROM || "onboarding@resend.dev").trim();
  const testRecipient = String(process.env.RESEND_TEST_RECIPIENT || "").trim().toLowerCase();
  const missing = [];
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!apiKey) missing.push("RESEND_API_KEY");
  if (from && !emailPattern.test(from)) missing.push("EMAIL_FROM_FORMAT");
  if (testRecipient && !emailPattern.test(testRecipient)) missing.push("RESEND_TEST_RECIPIENT_FORMAT");

  return {
    configured: missing.length === 0,
    missing,
    apiKey,
    from,
    testRecipient,
  };
};

const getSafeResendError = (error) => {
  const details = [
    error?.message,
    error?.name ? `name=${error.name}` : null,
    error?.statusCode ? `statusCode=${error.statusCode}` : null,
    error?.code ? `code=${error.code}` : null,
    error?.response ? `response=${String(error.response).replace(/\s+/g, " ").slice(0, 500)}` : null,
  ].filter(Boolean);
  return details.join("; ") || "Resend API returned an unknown error.";
};

const getSafeMailOptions = (mailOptions) => ({
  from: mailOptions.from,
  to: mailOptions.to,
  subject: mailOptions.subject,
  hasText: Boolean(mailOptions.text),
  hasHtml: Boolean(mailOptions.html),
});

const withTimeout = (operation, timeoutMs, operationName) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const error = new Error(`${operationName} timed out after ${timeoutMs}ms.`);
      error.code = "ETIMEDOUT";
      error.command = operationName;
      reject(error);
    }, timeoutMs);

    Promise.resolve()
      .then(operation)
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });

const createContactResponseToken = (alert, contact) => {
  const jti = crypto.randomBytes(24).toString("hex");
  const secret = responseSecret();
  if (!secret) {
    throw new Error("CONTACT_RESPONSE_SECRET or JWT_SECRET is not configured");
  }

  const token = jwt.sign(
    {
      alertId: alert._id.toString(),
      contactId: contact._id.toString(),
      userId: alert.userId.toString(),
      jti,
    },
    secret,
    { expiresIn: RESPONSE_TOKEN_TTL }
  );

  const decoded = jwt.decode(token);
  return {
    token,
    tokenHash: crypto.createHash("sha256").update(jti).digest("hex"),
    expiresAt: new Date((decoded?.exp || Math.floor(Date.now() / 1000)) * 1000),
  };
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const createResendClient = () => {
  const config = getResendConfiguration();
  if (!config.configured) {
    throw new Error(`Resend configuration is incomplete. Missing: ${config.missing.join(", ")}`);
  }

  return new Resend(config.apiKey);
};

const getResendStatusMessage = () => {
  const config = getResendConfiguration();
  if (config.configured) {
    const mode = config.testRecipient
      ? `initial test recipient ${config.testRecipient}`
      : "emergency-contact delivery";
    return `Resend configuration detected (sender=${config.from}, mode=${mode}).`;
  }
  return `Resend not configured; emergency emails will be recorded as FAILED. Missing: ${config.missing.join(", ")}.`;
};

/**
 * Sends emergency notification emails to all emergency contacts of the user.
 * This runs asynchronously and does not block the caller or bubble up errors.
 * 
 * @param {Object} alert - The active Alert document.
 */
const sendSOSNotificationEmails = async (alert) => {
  try {
    if (!alert || !alert.userId) {
      console.error("Invalid alert object passed to sendSOSNotificationEmails.");
      return;
    }

    console.log(`Starting SOS email notification flow for alert ${alert._id}.`);

    // 1. Fetch user to retrieve their name
    const user = await User.findById(alert.userId);
    if (!user) {
      console.error(`User not found for ID: ${alert.userId} (Alert: ${alert._id})`);
      return;
    }

    // 2. Fetch all emergency contacts for the user
    const contacts = await Contact.find({ user: alert.userId });
    if (!contacts || contacts.length === 0) {
      console.log(`No emergency contacts configured for alert ${alert._id}.`);
      return;
    }
    const emailContacts = contacts.filter((contact) => Boolean(contact.email));
    console.log(
      `Found ${contacts.length} emergency contact(s) for alert ${alert._id}; ` +
      `${emailContacts.length} have an email address.`
    );

    // 3. Configure the Resend HTTPS client. There is no SMTP verification step.
    const resendConfig = getResendConfiguration();
    const isResendConfigured = resendConfig.configured;
    let resendClient = null;
    if (isResendConfigured) {
      resendClient = createResendClient();
      console.log("Resend HTTPS client initialized; no SMTP connection is used.");
    } else {
      console.error(`Resend not configured: missing ${resendConfig.missing.join(", ")}.`);
    }
    const firstEmailContact = resendConfig.testRecipient ? emailContacts[0] : null;

    // 4. Iterate over contacts and send emails
    console.log(`Entering SOS email send loop for alert ${alert._id}.`);
    for (const contact of contacts) {
      if (!contact.email) {
        console.log(`Skipping emergency contact ${contact._id}: no email address configured.`);
        continue;
      }
      if (firstEmailContact && String(contact._id) !== String(firstEmailContact._id)) {
        console.log(`Skipping emergency contact ${contact._id} while Resend test mode is active.`);
        continue;
      }

      // Check if location is available
      const hasLocation =
        alert.currentLocation &&
        alert.currentLocation.latitude !== null &&
        alert.currentLocation.longitude !== null;

      const latitude = alert.currentLocation?.latitude;
      const longitude = alert.currentLocation?.longitude;
      const mapsLink = hasLocation
        ? `https://www.google.com/maps?q=${latitude},${longitude}`
        : null;

      const alertTimeStr = alert.triggeredAt
        ? new Date(alert.triggeredAt).toUTCString()
        : new Date().toUTCString();

      let responseToken = null;
      try {
        responseToken = createContactResponseToken(alert, contact);
      } catch (tokenError) {
        console.error("Could not create contact response token:", tokenError);
      }

      const clientBaseUrl = getClientBaseUrl();
      const responseUrl = responseToken && clientBaseUrl
        ? `${clientBaseUrl.replace(/\/$/, "")}/respond/${responseToken.token}`
        : null;
      const safeUserName = escapeHtml(user.name);
      const safeStatus = escapeHtml(alert.status);
      const recipient = resendConfig.testRecipient || contact.email;
      const mailOptions = {
        from: resendConfig.from,
        to: recipient,
        subject: `EMERGENCY ALERT: ${user.name} needs help`,
        text: `EMERGENCY ALERT\n\n` +
              `Your emergency contact, ${user.name}, has triggered a Silent SOS alert.\n\n` +
              `Status: ${alert.status}\n` +
              `Alert Time: ${alertTimeStr}\n` +
              (hasLocation
                ? `Location Coordinates: ${latitude}, ${longitude}\n` +
                  `Google Maps Location: ${mapsLink}\n`
                : `Location: Not Available\n`) +
              `\nPlease check on them or contact emergency services immediately.` +
              (responseUrl ? `\n\nIf you are safe to do so, acknowledge this alert: ${responseUrl}` : ""),
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 2px solid #ff4d4d; border-radius: 10px; max-width: 600px; margin: 0 auto; background-color: #fffafb;">
            <h2 style="color: #d9534f; margin-top: 0; text-transform: uppercase; border-bottom: 2px solid #ff4d4d; padding-bottom: 10px;">
              🚨 Emergency SOS Alert 🚨
            </h2>
            <p style="font-size: 16px; line-height: 1.5; color: #333;">
              Your emergency contact,               <strong>${safeUserName}</strong>, has triggered an emergency Silent SOS alert.
            </p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 15px;">
              <tr style="background-color: #f9f9f9;">
                <td style="padding: 10px; border: 1px solid #eee; font-weight: bold; width: 30%;">Status:</td>
                <td style="padding: 10px; border: 1px solid #eee; color: #d9534f; font-weight: bold;">${safeStatus}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #eee; font-weight: bold;">Alert Time:</td>
                <td style="padding: 10px; border: 1px solid #eee;">${alertTimeStr}</td>
              </tr>
              <tr style="background-color: #f9f9f9;">
                <td style="padding: 10px; border: 1px solid #eee; font-weight: bold;">Location:</td>
                <td style="padding: 10px; border: 1px solid #eee; line-height: 1.6;">
                  ${
                    hasLocation
                      ? `Coordinates: ${latitude}, ${longitude}<br/>` +
                        `<a href="${mapsLink}" style="display: inline-block; margin-top: 5px; padding: 8px 12px; background-color: #d9534f; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;" target="_blank">View on Google Maps</a>`
                      : '<span style="color: #888; font-style: italic;">Not Available</span>'
                  }
                </td>
              </tr>
            </table>
            ${responseUrl ? `<p style="font-size: 14px; background-color: #f0f7ff; padding: 15px; border-left: 4px solid #337ab7; border-radius: 4px; margin-top: 25px;"><a href="${escapeHtml(responseUrl)}" style="color: #337ab7; font-weight: bold;">Acknowledge this alert securely</a></p>` : ""}
            <p style="font-size: 14px; color: #555; background-color: #fff3f3; padding: 15px; border-left: 4px solid #d9534f; border-radius: 4px; margin-top: 25px;">
              <strong>Important:</strong> Please try contacting ${user.name} or reach out to local emergency authorities if they do not respond.
            </p>
            <p style="color: #777; font-size: 11px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; text-align: center;">
              This is an automated emergency message sent from the Silent SOS application.
            </p>
          </div>
        `,
      };

      let status = "SUCCESS";
      let errorMsg = null;
      console.log("Prepared emergency email:", getSafeMailOptions(mailOptions));

      if (!isResendConfigured) {
        status = "FAILED";
        errorMsg = `Resend not configured. Missing: ${resendConfig.missing.join(", ")}.`;
        console.error(`EMAIL NOT SENT — Resend not configured (recipient: ${resendConfig.testRecipient || "test recipient not configured"}).`);
      } else {
        try {
          console.log(`Starting Resend email for alert ${alert._id} to ${recipient}.`);
          const result = await withTimeout(
            () => resendClient.emails.send(mailOptions),
            30000,
            "Resend email send"
          );
          if (result?.error) {
            throw result.error;
          }
          const resendId = result?.data?.id;
          if (!resendId) {
            throw new Error("Resend API returned no message ID.");
          }
          console.log(`Resend email accepted for ${recipient}; id=${resendId}.`);
        } catch (emailError) {
          status = "FAILED";
          errorMsg = getSafeResendError(emailError);
          console.error(`Resend email failed for ${recipient}: ${errorMsg}`);
        }
      }

      // Log the attempt in NotificationLog
      try {
        await NotificationLog.create({
          alertId: alert._id,
          contactId: contact._id,
          recipient: mailOptions.to,
          type: "EMAIL",
          status,
          sentAt: new Date(),
          error: errorMsg,
          responseTokenHash: responseToken?.tokenHash || null,
          responseTokenExpiresAt: responseToken?.expiresAt || null,
        });
      } catch (dbError) {
        console.error(`Failed to create NotificationLog for contact ${contact.email}:`, {
          name: dbError?.name,
          message: dbError?.message,
          code: dbError?.code,
        });
      }
    }
  } catch (error) {
    console.error("Critical error in sendSOSNotificationEmails service:", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
  }
};

module.exports = {
  sendSOSNotificationEmails,
  createContactResponseToken,
  getResendConfiguration,
  getResendStatusMessage,
  getSafeResendError,
};
