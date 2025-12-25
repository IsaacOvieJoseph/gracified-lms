require('dotenv').config();
const { createEmailCampaign } = require('./utils/brevo');

// Example usage for testing
async function testCampaign() {
  try {
    await createEmailCampaign({
      name: "Campaign sent via the API",
      subject: "My subject",
      sender: { name: "From name", email: "myfromemail@mycompany.com" },
      htmlContent: "Congratulations! You successfully sent this example campaign via the Brevo API.",
      listIds: [2, 7],
      scheduledAt: "2025-12-25 01:00:00"
    });
  } catch (err) {
    console.error('Failed to send campaign:', err);
  }
}

// Uncomment to test
// testCampaign();

module.exports = testCampaign;