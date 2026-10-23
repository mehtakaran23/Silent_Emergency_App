"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildRawGmailMessage,
  sendWithGmail,
  sendGmailMessagesToContacts,
} = require("../services/emailService");

test("buildRawGmailMessage encodes the Gmail multipart message", () => {
  const raw = buildRawGmailMessage({
    from: "sender@example.com",
    to: "contact@example.com",
    subject: "Emergency alert",
    text: "Alert details",
    html: "<p>Alert details</p>",
  });
  const decoded = Buffer.from(raw, "base64url").toString("utf8");

  assert.match(decoded, /From: sender@example\.com/);
  assert.match(decoded, /To: contact@example\.com/);
  assert.match(decoded, /Subject: Emergency alert/);
  assert.match(decoded, /Alert details/);
  assert.match(decoded, /<p>Alert details<\/p>/);
});

test("sendWithGmail sends one message through the mocked Gmail API", async () => {
  const calls = [];
  const gmailClient = {
    users: {
      messages: {
        send: async (request) => {
          calls.push(request);
          return { data: { id: "mock-gmail-message-id" } };
        },
      },
    },
  };

  const messageId = await sendWithGmail(gmailClient, {
    from: "sender@example.com",
    to: "contact@example.com",
    subject: "Emergency alert",
    text: "Alert details",
    html: "<p>Alert details</p>",
  });

  test("sendGmailMessagesToContacts attempts each eligible recipient independently", async () => {
    const recipients = [];
    const gmailClient = {
      users: {
        messages: {
          send: async ({ requestBody }) => {
            const decoded = Buffer.from(requestBody.raw, "base64url").toString("utf8");
            recipients.push(decoded.match(/^To: (.+)$/m)[1]);
            return { data: { id: `mock-${recipients.length}` } };
          },
        },
      },
    };
    const mail = (to) => ({
      from: "sender@example.com",
      to,
      subject: "Emergency alert",
      text: "Alert details",
      html: "<p>Alert details</p>",
    });

    const results = await sendGmailMessagesToContacts(gmailClient, [
      mail("first-contact@example.com"),
      mail("second-contact@example.com"),
    ]);

    assert.deepEqual(recipients, [
      "first-contact@example.com",
      "second-contact@example.com",
    ]);
    assert.deepEqual(results.map((result) => result.messageId), [
      "mock-1",
      "mock-2",
    ]);
    assert.equal(results.filter((result) => result.error).length, 0);
  });

  assert.equal(messageId, "mock-gmail-message-id");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].userId, "me");
  assert.ok(calls[0].requestBody.raw);
  assert.doesNotMatch(calls[0].requestBody.raw, /refresh|secret|token/i);
});
