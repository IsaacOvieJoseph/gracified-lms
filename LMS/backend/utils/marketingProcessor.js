const MarketingSendLog = require('../models/MarketingSendLog');
const MarketingCampaign = require('../models/MarketingCampaign');
const MarketingTemplate = require('../models/MarketingTemplate');
const MarketingContact = require('../models/MarketingContact');
const MarketingHoliday = require('../models/MarketingHoliday');
const MarketingJob = require('../models/MarketingJob');
const Notification = require('../models/Notification');
const { sendEmail } = require('./email');

function renderWithContact(template, contact) {
  const safe = (v) => (v === null || v === undefined ? '' : String(v));
  return template
    .replace(/\{\{\s*firstName\s*\}\}/gi, safe(contact.firstName))
    .replace(/\{\{\s*lastName\s*\}\}/gi, safe(contact.lastName))
    .replace(/\{\{\s*email\s*\}\}/gi, safe(contact.email))
    .replace(/\{\{\s*company\s*\}\}/gi, safe(contact.company))
    .replace(/\{\{\s*title\s*\}\}/gi, safe(contact.title));
}

function buildUnsubscribeHtml(contact) {
  const base = (process.env.BACKEND_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const url = `${base}/api/marketing/unsubscribe/${contact.unsubscribeToken}`;
  return `
    <div style="margin-top: 18px; padding-top: 12px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
      <p style="margin: 0 0 6px 0;">If you do not want to receive these emails, you can unsubscribe:</p>
      <a href="${url}" style="color: #4f46e5; text-decoration: underline;">Unsubscribe</a>
    </div>
  `;
}

async function queueDailyGreetings() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const year = now.getFullYear();
  const at = (h, m) => new Date(year, month - 1, day, h, m, 0, 0);

  // Most recent birthday / anniversary template
  const [birthdayTpl, anniversaryTpl] = await Promise.all([
    MarketingTemplate.findOne({ kind: 'birthday' }).sort({ createdAt: -1 }),
    MarketingTemplate.findOne({ kind: 'anniversary' }).sort({ createdAt: -1 }),
  ]);

  const ops = [];

  if (birthdayTpl) {
    const contacts = await MarketingContact.find({
      unsubscribed: false,
      birthDate: { $ne: null },
      $expr: { $and: [{ $eq: [{ $month: '$birthDate' }, month] }, { $eq: [{ $dayOfMonth: '$birthDate' }, day] }] },
    }).select('_id');

    for (const c of contacts) {
      ops.push({
        updateOne: {
          filter: { type: 'birthday', contactId: c._id, dedupeKey: `birthday:${year}` },
          update: {
            $setOnInsert: {
              type: 'birthday',
              contactId: c._id,
              templateId: birthdayTpl._id,
              scheduledAt: at(8, 0),
              status: 'queued',
              dedupeKey: `birthday:${year}`,
            },
          },
          upsert: true,
        },
      });
    }
  }

  if (anniversaryTpl) {
    const contacts = await MarketingContact.find({
      unsubscribed: false,
      anniversaryDate: { $ne: null },
      $expr: {
        $and: [
          { $eq: [{ $month: '$anniversaryDate' }, month] },
          { $eq: [{ $dayOfMonth: '$anniversaryDate' }, day] },
        ],
      },
    }).select('_id');

    for (const c of contacts) {
      ops.push({
        updateOne: {
          filter: { type: 'anniversary', contactId: c._id, dedupeKey: `anniversary:${year}` },
          update: {
            $setOnInsert: {
              type: 'anniversary',
              contactId: c._id,
              templateId: anniversaryTpl._id,
              scheduledAt: at(8, 10),
              status: 'queued',
              dedupeKey: `anniversary:${year}`,
            },
          },
          upsert: true,
        },
      });
    }
  }

  const holidays = await MarketingHoliday.find({ enabled: true, month, day }).select('_id templateId name');
  if (holidays.length) {
    const contacts = await MarketingContact.find({ unsubscribed: false }).select('_id');
    for (const h of holidays) {
      for (const c of contacts) {
        ops.push({
          updateOne: {
            filter: { type: 'festive', contactId: c._id, dedupeKey: `festive:${h._id}:${year}` },
            update: {
              $setOnInsert: {
                type: 'festive',
                contactId: c._id,
                templateId: h.templateId,
                scheduledAt: at(8, 20),
                status: 'queued',
                dedupeKey: `festive:${h._id}:${year}`,
              },
            },
            upsert: true,
          },
        });
      }
    }
  }

  if (ops.length) {
    await MarketingSendLog.bulkWrite(ops, { ordered: false });
  }
  return { queued: ops.length };
}

async function processMarketingQueue({ limit = 50 } = {}) {
  const now = new Date();
  const logs = await MarketingSendLog.find({ status: 'queued', scheduledAt: { $lte: now } })
    .sort({ scheduledAt: 1 })
    .limit(limit)
    .populate('contactId')
    .populate('templateId')
    .populate('campaignId');

  let processed = 0;
  for (const log of logs) {
    processed++;
    const contact = log.contactId;
    const template = log.templateId;

    if (!contact || contact.unsubscribed) {
      await MarketingSendLog.updateOne({ _id: log._id }, { $set: { status: 'skipped', sentAt: new Date(), error: 'unsubscribed' } });
      continue;
    }

    if (log.type === 'campaign_step') {
      const campaign = log.campaignId;
      if (!campaign || campaign.status !== 'active') {
        await MarketingSendLog.updateOne(
          { _id: log._id },
          { $set: { status: 'skipped', sentAt: new Date(), error: 'campaign_not_active' } }
        );
        continue;
      }
    }

    try {
      const subject = renderWithContact(template.subject, contact);
      let html = renderWithContact(template.html, contact) + buildUnsubscribeHtml(contact);

      await sendEmail({
        to: contact.email,
        subject,
        html,
        isSystemEmail: true,
      });

      await MarketingSendLog.updateOne({ _id: log._id }, { $set: { status: 'sent', sentAt: new Date(), error: '' } });
      await MarketingContact.updateOne({ _id: contact._id }, { $set: { lastEmailedAt: new Date() } });

      // If campaign step, schedule next step
      if (log.type === 'campaign_step' && log.campaignId) {
        const campaign = await MarketingCampaign.findById(log.campaignId);
        const idx = typeof log.stepIndex === 'number' ? log.stepIndex : 0;
        const nextIdx = idx + 1;
        const nextStep = campaign?.steps?.[nextIdx];
        if (campaign && nextStep) {
          const prevScheduled = log.scheduledAt ? new Date(log.scheduledAt) : new Date();
          const scheduledAt = new Date(prevScheduled.getTime() + (Number(nextStep.delayDays || 0) * 24 * 60 * 60 * 1000));
          await MarketingSendLog.updateOne(
            { type: 'campaign_step', campaignId: campaign._id, contactId: contact._id, stepIndex: nextIdx },
            {
              $setOnInsert: {
                type: 'campaign_step',
                campaignId: campaign._id,
                contactId: contact._id,
                templateId: nextStep.templateId,
                stepIndex: nextIdx,
                scheduledAt,
                status: 'queued',
              },
            },
            { upsert: true }
          );
        }
      }
    } catch (e) {
      await MarketingSendLog.updateOne(
        { _id: log._id },
        { $set: { status: 'failed', sentAt: new Date(), error: e.message || 'send_failed' } }
      );
    }
  }

  return { processed };
}

module.exports = { processMarketingQueue, queueDailyGreetings };

async function resolveRecipientsFromIds(recipientIds) {
  const User = require('../models/User');

  const emails = [];
  for (const raw of recipientIds || []) {
    const id = (raw || '').toString();
    if (!id) continue;
    if (id.startsWith('user:')) {
      const userId = id.slice('user:'.length);
      const u = await User.findById(userId).select('email');
      if (u?.email) emails.push(u.email.toLowerCase().trim());
    } else {
      const c = await MarketingContact.findById(id).select('email');
      if (c?.email) emails.push(c.email.toLowerCase().trim());
    }
  }
  return Array.from(new Set(emails));
}

async function ensureMarketingContactForEmail(email) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  if (!normalizedEmail) return null;

  let contact = await MarketingContact.findOne({ email: normalizedEmail });
  if (contact) return contact;

  const User = require('../models/User');
  const u = await User.findOne({ email: normalizedEmail })
    .populate('schoolId', 'name')
    .populate('tutorialId', 'name')
    .select('email name role schoolId tutorialId');

  const schoolName = Array.isArray(u?.schoolId) ? u.schoolId.map((s) => s?.name).filter(Boolean).join(', ') : u?.schoolId?.name || '';
  const tutorialName = u?.tutorialId?.name || '';
  const [firstName, ...rest] = (u?.name || '').split(' ').filter(Boolean);

  contact = await MarketingContact.create({
    email: normalizedEmail,
    firstName: firstName || '',
    lastName: rest.join(' '),
    company: schoolName || tutorialName || '',
    title: u?.role || '',
    source: 'lms_user',
  });
  return contact;
}

async function processMarketingJobs({ maxRecipientsPerTick = 20 } = {}) {
  const job = await MarketingJob.findOne({ status: { $in: ['queued', 'running'] } }).sort({ createdAt: 1 });
  if (!job) return { processedJobs: 0 };

  if (job.status === 'queued') {
    job.status = 'running';
    await job.save();
  }

  try {
    const template = await MarketingTemplate.findById(job.payload.templateId);
    if (!template) throw new Error('Template not found');

    const allEmails = await resolveRecipientsFromIds(job.payload.recipientIds || []);
    if (!job.progress.total) {
      job.progress.total = allEmails.length;
    }

    // Process next chunk
    const startIdx = job.progress.processed;
    const chunk = allEmails.slice(startIdx, startIdx + maxRecipientsPerTick);

    for (const email of chunk) {
      try {
        const contact = await ensureMarketingContactForEmail(email);
        if (!contact || contact.unsubscribed) {
          job.progress.skipped += 1;
          job.progress.processed += 1;
          continue;
        }

        const subject = renderWithContact(template.subject, contact);
        const html = renderWithContact(template.html, contact) + buildUnsubscribeHtml(contact);
        await sendEmail({ to: email, subject, html, isSystemEmail: true });
        job.progress.sent += 1;
        job.progress.processed += 1;
      } catch (e) {
        job.progress.failed += 1;
        job.progress.processed += 1;
        job.progress.lastError = e.message || 'send_failed';
      }
    }

    // Job completion
    if (job.progress.processed >= job.progress.total) {
      job.status = 'completed';
      await Notification.create({
        userId: job.createdBy,
        type: 'marketing_job',
        message: `Marketing bulk send completed. Sent ${job.progress.sent}, skipped ${job.progress.skipped}, failed ${job.progress.failed}.`,
        entityRef: 'User',
        entityId: job.createdBy,
      });
    }

    await job.save();
    return { processedJobs: 1, jobId: job._id, status: job.status };
  } catch (e) {
    job.status = 'failed';
    job.progress.lastError = e.message || 'job_failed';
    await job.save();
    await Notification.create({
      userId: job.createdBy,
      type: 'marketing_job',
      message: `Marketing bulk send failed: ${job.progress.lastError}`,
      entityRef: 'User',
      entityId: job.createdBy,
    });
    return { processedJobs: 1, jobId: job._id, status: 'failed' };
  }
}

module.exports.processMarketingJobs = processMarketingJobs;

