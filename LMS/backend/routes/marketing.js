const express = require('express');
const fs = require('fs');
const multer = require('multer');
const csv = require('csv-parser');

const { auth, authorize } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');

const MarketingContact = require('../models/MarketingContact');
const MarketingList = require('../models/MarketingList');
const MarketingTemplate = require('../models/MarketingTemplate');
const MarketingCampaign = require('../models/MarketingCampaign');
const MarketingSendLog = require('../models/MarketingSendLog');
const MarketingHoliday = require('../models/MarketingHoliday');

const router = express.Router();

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) cb(null, true);
    else cb(new Error('Only CSV files are allowed'));
  },
});

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

// =========================
// Public unsubscribe endpoint
// =========================
router.get('/unsubscribe/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const contact = await MarketingContact.findOne({ unsubscribeToken: token });
    if (!contact) return res.status(404).send('Invalid unsubscribe link.');
    if (!contact.unsubscribed) {
      contact.unsubscribed = true;
      contact.unsubscribedAt = new Date();
      await contact.save();
    }
    return res
      .status(200)
      .send('You have been unsubscribed successfully. You will no longer receive marketing emails.');
  } catch (e) {
    return res.status(500).send('An error occurred.');
  }
});

// Everything else is root_admin only
router.use(auth, authorize('root_admin'));

// =========================
// Contacts
// =========================
router.get('/contacts', async (req, res) => {
  try {
    const { search, tag, unsubscribed, includeUsers } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
      ];
    }
    if (tag) query.tags = tag;
    if (unsubscribed === 'true') query.unsubscribed = true;
    if (unsubscribed === 'false') query.unsubscribed = false;

    const MarketingContact = require('../models/MarketingContact');
    const User = require('../models/User');

    const [contactsRaw, usersRaw] = await Promise.all([
      MarketingContact.find(query).sort({ createdAt: -1 }).limit(200),
      includeUsers === 'false'
        ? Promise.resolve([])
        : User.find(
            search
              ? {
                  $or: [
                    { email: { $regex: search, $options: 'i' } },
                    { name: { $regex: search, $options: 'i' } },
                  ],
                }
              : {}
          )
            .select('name email role schoolId tutorialId lastActiveAt updatedAt createdAt')
            .populate('schoolId', 'name')
            .populate('tutorialId', 'name')
            .sort({ lastActiveAt: -1, updatedAt: -1 })
            .limit(200),
    ]);

    // Merge by email so existing users appear too, without duplicates
    const byEmail = new Map();

    for (const c of contactsRaw) {
      const email = (c.email || '').toLowerCase();
      byEmail.set(email, {
        _id: c._id,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        company: c.company,
        title: c.title,
        phone: c.phone,
        tags: c.tags,
        source: c.source,
        birthDate: c.birthDate,
        anniversaryDate: c.anniversaryDate,
        timezone: c.timezone,
        unsubscribed: c.unsubscribed,
        unsubscribedAt: c.unsubscribedAt,
        lastEmailedAt: c.lastEmailedAt,
        notes: c.notes,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        // user enrich
        isExistingUser: false,
        user: null,
      });
    }

    for (const u of usersRaw) {
      const email = (u.email || '').toLowerCase();
      const schoolName = Array.isArray(u.schoolId)
        ? u.schoolId.map((s) => s?.name).filter(Boolean).join(', ')
        : u.schoolId?.name || '';
      const tutorialName = u.tutorialId?.name || '';

      const existing = byEmail.get(email);
      const userInfo = {
        id: u._id,
        name: u.name,
        role: u.role,
        school: schoolName,
        tutorial: tutorialName,
        lastActiveAt: u.lastActiveAt || null,
      };

      if (existing) {
        byEmail.set(email, { ...existing, isExistingUser: true, user: userInfo });
      } else {
        // Represent LMS user as a contact-like entry
        const [firstName, ...rest] = (u.name || '').split(' ').filter(Boolean);
        byEmail.set(email, {
          _id: `user:${u._id}`,
          email: u.email,
          firstName: firstName || '',
          lastName: rest.join(' '),
          company: schoolName || tutorialName || '',
          title: '',
          phone: '',
          tags: [],
          source: 'lms_user',
          birthDate: null,
          anniversaryDate: null,
          timezone: 'Africa/Lagos',
          unsubscribed: false,
          unsubscribedAt: null,
          lastEmailedAt: null,
          notes: '',
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
          isExistingUser: true,
          user: userInfo,
        });
      }
    }

    const contacts = Array.from(byEmail.values()).sort((a, b) => {
      const aT = a.user?.lastActiveAt ? new Date(a.user.lastActiveAt).getTime() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
      const bT = b.user?.lastActiveAt ? new Date(b.user.lastActiveAt).getTime() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
      return bT - aT;
    });

    res.json({ contacts });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/contacts', async (req, res) => {
  try {
    const payload = req.body || {};
    const contact = await MarketingContact.create({
      email: payload.email,
      firstName: payload.firstName || '',
      lastName: payload.lastName || '',
      company: payload.company || '',
      title: payload.title || '',
      phone: payload.phone || '',
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      source: payload.source || 'manual',
      birthDate: payload.birthDate ? new Date(payload.birthDate) : null,
      anniversaryDate: payload.anniversaryDate ? new Date(payload.anniversaryDate) : null,
      timezone: payload.timezone || 'Africa/Lagos',
      notes: payload.notes || '',
    });
    res.status(201).json({ contact });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.put('/contacts/:id', async (req, res) => {
  try {
    const payload = req.body || {};
    const contact = await MarketingContact.findByIdAndUpdate(
      req.params.id,
      {
        ...payload,
        ...(payload.birthDate !== undefined ? { birthDate: payload.birthDate ? new Date(payload.birthDate) : null } : {}),
        ...(payload.anniversaryDate !== undefined
          ? { anniversaryDate: payload.anniversaryDate ? new Date(payload.anniversaryDate) : null }
          : {}),
      },
      { new: true, runValidators: true }
    );
    if (!contact) return res.status(404).json({ message: 'Contact not found' });
    res.json({ contact });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.delete('/contacts/:id', async (req, res) => {
  try {
    await MarketingContact.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/contacts/import-csv', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No CSV file uploaded' });
    const rows = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', async () => {
        const results = { created: 0, updated: 0, skipped: 0, errors: [] };
        try {
          for (let i = 0; i < rows.length; i++) {
            const r = rows[i] || {};
            const email = (r.email || r.Email || '').toString().trim().toLowerCase();
            if (!email) {
              results.skipped++;
              continue;
            }
            const tagsRaw = (r.tags || r.Tags || '').toString();
            const tags = tagsRaw
              ? tagsRaw
                  .split(/[;,]/)
                  .map((t) => t.trim())
                  .filter(Boolean)
              : [];

            const birthDate = (r.birthDate || r.BirthDate || r.birthday || '').toString().trim();
            const anniversaryDate = (r.anniversaryDate || r.AnniversaryDate || '').toString().trim();

            const update = {
              email,
              firstName: (r.firstName || r.FirstName || '').toString().trim(),
              lastName: (r.lastName || r.LastName || '').toString().trim(),
              company: (r.company || r.Company || '').toString().trim(),
              title: (r.title || r.Title || '').toString().trim(),
              phone: (r.phone || r.Phone || '').toString().trim(),
              source: 'csv',
              tags,
              birthDate: birthDate ? new Date(birthDate) : null,
              anniversaryDate: anniversaryDate ? new Date(anniversaryDate) : null,
            };

            const existing = await MarketingContact.findOne({ email });
            if (existing) {
              if (existing.unsubscribed) {
                results.skipped++;
                continue;
              }
              await MarketingContact.updateOne({ _id: existing._id }, { $set: update });
              results.updated++;
            } else {
              await MarketingContact.create(update);
              results.created++;
            }
          }
          fs.unlinkSync(req.file.path);
          return res.json({ message: `Processed ${rows.length} rows`, results });
        } catch (e) {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          return res.status(500).json({ message: e.message });
        }
      })
      .on('error', (e) => {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ message: `CSV parse error: ${e.message}` });
      });
  } catch (e) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: e.message });
  }
});

// =========================
// Lists
// =========================
router.get('/lists', async (req, res) => {
  try {
    const lists = await MarketingList.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    res.json({ lists });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/lists', async (req, res) => {
  try {
    const { name, description, contactIds } = req.body || {};
    const list = await MarketingList.create({
      name,
      description: description || '',
      contactIds: Array.isArray(contactIds) ? contactIds : [],
      createdBy: req.user._id,
    });
    res.status(201).json({ list });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.put('/lists/:id', async (req, res) => {
  try {
    const list = await MarketingList.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!list) return res.status(404).json({ message: 'List not found' });
    res.json({ list });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.delete('/lists/:id', async (req, res) => {
  try {
    await MarketingList.deleteOne({ _id: req.params.id, createdBy: req.user._id });
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// =========================
// Templates
// =========================
router.get('/templates', async (req, res) => {
  try {
    const templates = await MarketingTemplate.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    res.json({ templates });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/templates', async (req, res) => {
  try {
    const { name, subject, html, kind } = req.body || {};
    const template = await MarketingTemplate.create({
      name,
      subject,
      html,
      kind: kind || 'general',
      createdBy: req.user._id,
    });
    res.status(201).json({ template });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.put('/templates/:id', async (req, res) => {
  try {
    const template = await MarketingTemplate.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!template) return res.status(404).json({ message: 'Template not found' });
    res.json({ template });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.delete('/templates/:id', async (req, res) => {
  try {
    await MarketingTemplate.deleteOne({ _id: req.params.id, createdBy: req.user._id });
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/templates/:id/send-test', async (req, res) => {
  try {
    const template = await MarketingTemplate.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!template) return res.status(404).json({ message: 'Template not found' });
    const { to, contactId } = req.body || {};
    if (!to) return res.status(400).json({ message: '"to" is required' });

    const contact = contactId ? await MarketingContact.findById(contactId) : null;
    const renderedSubject = contact ? renderWithContact(template.subject, contact) : template.subject;
    let renderedHtml = contact ? renderWithContact(template.html, contact) : template.html;
    if (contact) renderedHtml += buildUnsubscribeHtml(contact);

    await sendEmail({
      to,
      subject: renderedSubject,
      html: renderedHtml,
      isSystemEmail: true, // no school logo lookup for cold-mail tests
    });
    res.json({ message: 'Sent' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// =========================
// Quick send (single/bulk) from contacts table
// =========================
async function ensureMarketingContact({ email, name, role, school, tutorial }) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  if (!normalizedEmail) return null;

  let contact = await MarketingContact.findOne({ email: normalizedEmail });
  if (contact) return contact;

  // Minimal contact creation for existing users so unsubscribe works
  const [firstName, ...rest] = (name || '').split(' ').filter(Boolean);
  contact = await MarketingContact.create({
    email: normalizedEmail,
    firstName: firstName || '',
    lastName: rest.join(' '),
    company: school || tutorial || '',
    title: role || '',
    source: 'lms_user',
  });
  return contact;
}

router.post('/send', async (req, res) => {
  try {
    const { templateId, recipientEmails, recipientIds } = req.body || {};
    if (!templateId) return res.status(400).json({ message: 'templateId is required' });

    const template = await MarketingTemplate.findOne({ _id: templateId, createdBy: req.user._id });
    if (!template) return res.status(404).json({ message: 'Template not found' });

    const User = require('../models/User');

    let emails = [];
    if (Array.isArray(recipientEmails)) {
      emails = recipientEmails.map((e) => (e || '').toString().toLowerCase().trim()).filter(Boolean);
    }

    // recipientIds can include real MarketingContact IDs or "user:<mongoid>"
    if (Array.isArray(recipientIds)) {
      for (const raw of recipientIds) {
        const id = (raw || '').toString();
        if (id.startsWith('user:')) {
          const userId = id.slice('user:'.length);
          const u = await User.findById(userId).populate('schoolId', 'name').populate('tutorialId', 'name').select('email name role schoolId tutorialId');
          if (u?.email) emails.push(u.email.toLowerCase().trim());
        } else {
          const c = await MarketingContact.findById(id).select('email');
          if (c?.email) emails.push(c.email.toLowerCase().trim());
        }
      }
    }

    emails = Array.from(new Set(emails));
    if (!emails.length) return res.status(400).json({ message: 'No recipients' });

    const results = { sent: 0, skipped: 0, failed: 0, details: [] };

    for (const email of emails) {
      try {
        // Try to enrich from LMS user if present
        const u = await User.findOne({ email }).populate('schoolId', 'name').populate('tutorialId', 'name').select('email name role schoolId tutorialId');
        const schoolName = Array.isArray(u?.schoolId) ? u.schoolId.map((s) => s?.name).filter(Boolean).join(', ') : u?.schoolId?.name || '';
        const tutorialName = u?.tutorialId?.name || '';

        const contact = await ensureMarketingContact({
          email,
          name: u?.name || '',
          role: u?.role || '',
          school: schoolName,
          tutorial: tutorialName,
        });

        if (!contact || contact.unsubscribed) {
          results.skipped++;
          results.details.push({ email, status: 'skipped', reason: 'unsubscribed_or_invalid' });
          continue;
        }

        const subject = renderWithContact(template.subject, contact);
        const html = renderWithContact(template.html, contact) + buildUnsubscribeHtml(contact);

        await sendEmail({ to: email, subject, html, isSystemEmail: true });

        results.sent++;
        results.details.push({ email, status: 'sent' });
      } catch (e) {
        results.failed++;
        results.details.push({ email, status: 'failed', error: e.message });
      }
    }

    res.json({ message: 'Done', results });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// =========================
// Campaigns
// =========================
router.get('/campaigns', async (req, res) => {
  try {
    const campaigns = await MarketingCampaign.find({ createdBy: req.user._id })
      .sort({ createdAt: -1 })
      .populate('listId', 'name');
    res.json({ campaigns });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/campaigns', async (req, res) => {
  try {
    const { name, description, listId, steps, fromName, fromEmail, startAt } = req.body || {};
    const campaign = await MarketingCampaign.create({
      name,
      description: description || '',
      listId,
      steps: Array.isArray(steps) ? steps : [],
      fromName: fromName || 'Gracified LMS',
      fromEmail: fromEmail || '',
      startAt: startAt ? new Date(startAt) : null,
      status: 'draft',
      createdBy: req.user._id,
    });
    res.status(201).json({ campaign });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.put('/campaigns/:id', async (req, res) => {
  try {
    const campaign = await MarketingCampaign.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    res.json({ campaign });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.post('/campaigns/:id/start', async (req, res) => {
  try {
    const campaign = await MarketingCampaign.findOne({ _id: req.params.id, createdBy: req.user._id }).populate('listId');
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    if (!campaign.steps || campaign.steps.length === 0) return res.status(400).json({ message: 'Campaign has no steps' });

    const list = await MarketingList.findById(campaign.listId?._id || campaign.listId).populate('contactIds');
    if (!list) return res.status(400).json({ message: 'List not found' });

    const startAt = campaign.startAt ? new Date(campaign.startAt) : new Date();
    const contacts = (list.contactIds || []).filter((c) => c && !c.unsubscribed);

    // queue step 0 for each contact
    const step0 = campaign.steps[0];
    const ops = contacts.map((c) => ({
      updateOne: {
        filter: { type: 'campaign_step', campaignId: campaign._id, contactId: c._id, stepIndex: 0 },
        update: {
          $setOnInsert: {
            type: 'campaign_step',
            campaignId: campaign._id,
            contactId: c._id,
            templateId: step0.templateId,
            stepIndex: 0,
            scheduledAt: startAt,
            status: 'queued',
          },
        },
        upsert: true,
      },
    }));
    if (ops.length) await MarketingSendLog.bulkWrite(ops, { ordered: false });

    campaign.status = 'active';
    if (!campaign.startAt) campaign.startAt = startAt;
    await campaign.save();

    res.json({ message: 'Campaign started', queued: contacts.length });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/campaigns/:id/pause', async (req, res) => {
  try {
    const campaign = await MarketingCampaign.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      { $set: { status: 'paused' } },
      { new: true }
    );
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    res.json({ campaign });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// =========================
// Holidays (festive greetings)
// =========================
router.get('/holidays', async (req, res) => {
  try {
    const holidays = await MarketingHoliday.find({ createdBy: req.user._id }).sort({ month: 1, day: 1 });
    res.json({ holidays });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/holidays', async (req, res) => {
  try {
    const { name, month, day, templateId, enabled } = req.body || {};
    const holiday = await MarketingHoliday.create({
      name,
      month,
      day,
      templateId,
      enabled: enabled !== false,
      createdBy: req.user._id,
    });
    res.status(201).json({ holiday });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.put('/holidays/:id', async (req, res) => {
  try {
    const holiday = await MarketingHoliday.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!holiday) return res.status(404).json({ message: 'Holiday not found' });
    res.json({ holiday });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.delete('/holidays/:id', async (req, res) => {
  try {
    await MarketingHoliday.deleteOne({ _id: req.params.id, createdBy: req.user._id });
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// =========================
// Logs
// =========================
router.get('/logs', async (req, res) => {
  try {
    const { status, type, campaignId } = req.query;
    const q = {};
    if (status) q.status = status;
    if (type) q.type = type;
    if (campaignId) q.campaignId = campaignId;

    const logs = await MarketingSendLog.find(q)
      .sort({ scheduledAt: -1 })
      .limit(300)
      .populate('contactId', 'email firstName lastName company unsubscribed')
      .populate('campaignId', 'name')
      .populate('templateId', 'name kind');

    res.json({ logs });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;

