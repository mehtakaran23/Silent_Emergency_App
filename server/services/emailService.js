const nodemailer = require("nodemailer");
const User = require("../models/User");
const Contact = require("../models/Contact");
const NotificationLog = require("../models/NotificationLog");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const RESPONSE_TOKEN_TTL = process.env.CONTACT_RESPONSE_TOKEN_TTL || "7d";
const responseSecret = () => process.env.CONTACT_RESPONSE_SECRET || process.env.JWT_SECRET;

const getSMTPConfiguration = () => {
  const host = String(process.env.SMTP_HOST || "").trim();
  const portValue = String(process.env.SMTP_PORT || "587").trim();
  const port = Number(portValue);
  const secureValue = String(process.env.SMTP_SECURE || "false").trim().toLowerCase();
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "");
  const from = String(process.env.EMAIL_FROM || "").trim();
  const missing = [];
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!host) missing.push("SMTP_HOST");
  if (!Number.isInteger(port) || port < 1 || port > 65535) missing.push("SMTP_PORT");
  if (!["true", "false"].includes(secureValue)) missing.push("SMTP_SECURE");
  if (!user) missing.push("SMTP_USER");
  if (!pass) missing.push("SMTP_PASS");
  if (!from) missing.push("EMAIL_FROM");
  if (from && !emailPattern.test(from)) missing.push("EMAIL_FROM_FORMAT");
  if (user && from && from.toLowerCase() !== user.toLowerCase()) {
    missing.push("EMAIL_FROM_MUST_MATCH_SMTP_USER");
  }

  return {
    configured: missing.length === 0,
    missing,
    host,
    port,
    secure: secureValue === "true",
    user,
    pass,
    from,
  };
};

const getSafeSMTPError = (error) => {
  const details = [
    error?.message,
    error?.code ? `code=${error.code}` : null,
    error?.responseCode ? `responseCode=${error.responseCode}` : null,
    error?.command ? `command=${error.command}` : null,
    error?.response ? `response=${String(error.response).replace(/\s+/g, " ").slice(0, 500)}` : null,
  ].filter(Boolean);
  return details.join("; ") || "SMTP provider returned an unknown error.";
};

const getSafeMailOptions = (mailOptions) => ({
  from: mailOptions.from,
  to: mailOptions.to,
  subject: mailOptions.subject,
  hasText: Boolean(mailOptions.text),
  hasHtml: Boolean(mailOptions.html),
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

/**
 * Creates a Nodemailer transporter based on SMTP configuration in .env.
 */
const createTransporter = () => {
  const config = getSMTPConfiguration();
  if (!config.configured) {
    throw new Error(`SMTP configuration is incomplete. Missing: ${config.missing.join(", ")}`);
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    family: 4,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
};

const getSMTPStatusMessage = () => {
  const config = getSMTPConfiguration();
  if (config.configured) {
    return `SMTP configuration detected (${config.host}:${config.port}, secure=${config.secure}).`;
  }
  return `SMTP not configured; emergency emails will be recorded as FAILED. Missing: ${config.missing.join(", ")}.`;
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

    // 1. Fetch user to retrieve their name
    const user = await User.findById(alert.userId);
    if (!user) {
      console.error(`User not found for ID: ${alert.userId} (Alert: ${alert._id})`);
      return;
    }

    // 2. Fetch all emergency contacts for the user
    const contacts = await Contact.find({ user: alert.userId });
    if (!contacts || contacts.length === 0) {
      console.log(`No emergency contacts configured for user: ${user.name} (${user._id})`);
      return;
    }

    // 3. Check for SMTP config
    const smtpConfig = getSMTPConfiguration();
    const isSmtpConfigured = smtpConfig.configured;

    let transporter = null;
    if (isSmtpConfigured) {
      transporter = createTransporter();
      try {
        await transporter.verify();
        console.log("SMTP transporter.verify() succeeded.");
      } catch (verifyError) {
        const verifyMessage = getSafeSMTPError(verifyError);
        console.error(`SMTP transporter.verify() failed: ${verifyMessage}`);
        transporter = null;
      }
    }

    // 4. Iterate over contacts and send emails
    for (const contact of contacts) {
      if (!contact.email) {
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

      const clientBaseUrl = process.env.CLIENT_URL || process.env.SOCKET_CORS_ORIGIN;
      const responseUrl = responseToken && clientBaseUrl
        ? `${clientBaseUrl.replace(/\/$/, "")}/respond/${responseToken.token}`
        : null;
      const safeUserName = escapeHtml(user.name);
      const safeStatus = escapeHtml(alert.status);
      const mailOptions = {
        from: smtpConfig.from,
        to: contact.email,
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

      if (!isSmtpConfigured) {
        status = "FAILED";
        errorMsg = `SMTP not configured. Missing: ${smtpConfig.missing.join(", ")}.`;
        console.error(`EMAIL NOT SENT — SMTP NOT CONFIGURED (recipient: ${contact.email}; missing: ${smtpConfig.missing.join(", ")})`);
      } else if (!transporter) {
        status = "FAILED";
        errorMsg = "SMTP transporter verification failed; see server logs for the sanitized provider error.";
      } else {
        try {
          const result = await transporter.sendMail(mailOptions);
          console.log("SMTP sendMail result:", {
            accepted: result.accepted,
            rejected: result.rejected,
            response: result.response,
            messageId: result.messageId,
          });
          const accepted = Array.isArray(result.accepted) && result.accepted
            .some((recipient) => String(recipient).toLowerCase() === contact.email.toLowerCase());
          if (!accepted) {
            status = "FAILED";
            errorMsg = "SMTP accepted no recipient for delivery.";
            console.error(`EMAIL NOT SENT — SMTP accepted no recipient (recipient: ${contact.email})`);
          } else {
            console.log(`Emergency email accepted by SMTP for ${contact.email} (messageId: ${result.messageId || "unknown"}).`);
          }
        } catch (emailError) {
          status = "FAILED";
          errorMsg = getSafeSMTPError(emailError);
          console.error(`EMAIL NOT SENT — SMTP delivery failed (recipient: ${contact.email}; ${errorMsg})`);
        }
      }

      // Log the attempt in NotificationLog
      try {
        await NotificationLog.create({
          alertId: alert._id,
          contactId: contact._id,
          recipient: contact.email,
          type: "EMAIL",
          status,
          sentAt: new Date(),
          error: errorMsg,
          responseTokenHash: responseToken?.tokenHash || null,
          responseTokenExpiresAt: responseToken?.expiresAt || null,
        });
      } catch (dbError) {
        console.error(`Failed to create NotificationLog for contact ${contact.email}:`, dbError);
      }
    }
  } catch (error) {
    console.error("Critical error in sendSOSNotificationEmails service:", error);
  }
};

module.exports = {
  sendSOSNotificationEmails,
  createContactResponseToken,
  getSMTPConfiguration,
  getSMTPStatusMessage,
  getSafeSMTPError,
};
