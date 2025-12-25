const SibApiV3Sdk = require('sib-api-v3-sdk');
const defaultClient = SibApiV3Sdk.ApiClient.instance;

// Set your API key from environment variable for security
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.EmailCampaignsApi();

async function createEmailCampaign({ name, subject, sender, htmlContent, listIds, scheduledAt }) {
  const emailCampaigns = new SibApiV3Sdk.CreateEmailCampaign();
  emailCampaigns.name = name;
  emailCampaigns.subject = subject;
  emailCampaigns.sender = sender;
  emailCampaigns.type = "classic";
  emailCampaigns.htmlContent = htmlContent;
  emailCampaigns.recipients = { listIds };
  emailCampaigns.scheduledAt = scheduledAt;

  try {
    const data = await apiInstance.createEmailCampaign(emailCampaigns);
    console.log('API called successfully. Returned data:', data);
    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

module.exports = { createEmailCampaign };