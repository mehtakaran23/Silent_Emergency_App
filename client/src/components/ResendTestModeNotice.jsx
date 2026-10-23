import React from "react";

const ResendTestModeNotice = () => (
  <div className="alert-banner alert-banner-info" role="status">
    Email demo mode is active: Resend sends notifications only to the configured
    test recipient, not to every saved emergency contact.
  </div>
);

export default ResendTestModeNotice;
