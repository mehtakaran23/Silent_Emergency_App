const nodemailer = require("nodemailer");
const User = require("../models/User");
const Contact = require("../models/Contact");
const NotificationLog = require("../models/NotificationLog");

/**
 * Creates a Nodemailer transporter based on SMTP configuration in .env.
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
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
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    const isSmtpConfigured = !!(smtpHost && smtpUser && smtpPass);

    let transporter = null;
    if (isSmtpConfigured) {
      transporter = createTransporter();
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

      const mailOptions = {
        from: process.env.EMAIL_FROM || smtpUser || "no-reply@silent-sos.com",
        to: contact.email,
        subject: `EMERGENCY ALERT: ${user.name} is in danger!`,
        text: `EMERGENCY ALERT\n\n` +
              `Your emergency contact, ${user.name}, has triggered a Silent SOS alert.\n\n` +
              `Status: ${alert.status}\n` +
              `Alert Time: ${alertTimeStr}\n` +
              (hasLocation
                ? `Location Coordinates: ${latitude}, ${longitude}\n` +
                  `Google Maps Location: ${mapsLink}\n`
                : `Location: Not Available\n`) +
              `\nPlease check on them or contact emergency services immediately.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 2px solid #ff4d4d; border-radius: 10px; max-width: 600px; margin: 0 auto; background-color: #fffafb;">
            <h2 style="color: #d9534f; margin-top: 0; text-transform: uppercase; border-bottom: 2px solid #ff4d4d; padding-bottom: 10px;">
              🚨 Emergency SOS Alert 🚨
            </h2>
            <p style="font-size: 16px; line-height: 1.5; color: #333;">
              Your emergency contact, <strong>${user.name}</strong>, has triggered an emergency Silent SOS alert.
            </p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 15px;">
              <tr style="background-color: #f9f9f9;">
                <td style="padding: 10px; border: 1px solid #eee; font-weight: bold; width: 30%;">Status:</td>
                <td style="padding: 10px; border: 1px solid #eee; color: #d9534f; font-weight: bold;">${alert.status}</td>
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

      if (!isSmtpConfigured) {
        status = "FAILED";
        errorMsg = "SMTP parameters are not configured in environment variables (.env).";
        console.error(`SMTP config missing. Could not send email to ${contact.email}.`);
      } else {
        try {
          await transporter.sendMail(mailOptions);
          console.log(`Emergency email successfully sent to ${contact.email} for user ${user.name}.`);
        } catch (emailError) {
          status = "FAILED";
          errorMsg = emailError.message || String(emailError);
          console.error(`Failed to send emergency email to ${contact.email}:`, emailError);
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
};
