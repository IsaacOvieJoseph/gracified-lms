import React, { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import Select from 'react-select';
import { Mail, Users, List as ListIcon, FileText, Calendar, Play, Pause, Upload, RefreshCw, Send, Filter, X } from 'lucide-react';

const tabs = [
  { key: 'contacts', label: 'Contacts', icon: Users },
  { key: 'lists', label: 'Lists', icon: ListIcon },
  { key: 'templates', label: 'Templates', icon: FileText },
  { key: 'campaigns', label: 'Campaigns', icon: Mail },
  { key: 'holidays', label: 'Festive Days', icon: Calendar },
  { key: 'logs', label: 'Logs', icon: RefreshCw },
];

const inputClass =
  'w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30';

const btnClass =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest border border-border bg-card hover:bg-muted transition';

const primaryBtnClass =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest bg-primary text-primary-foreground hover:opacity-90 transition';

export default function Marketing() {
  const [activeTab, setActiveTab] = useState('contacts');
  const [loading, setLoading] = useState(false);

  const [contacts, setContacts] = useState([]);
  const [lists, setLists] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [logs, setLogs] = useState([]);

  const contactOptions = useMemo(
    () =>
      contacts.map((c) => ({
        value: c._id,
        label: `${c.email}${c.firstName || c.lastName ? ` — ${[c.firstName, c.lastName].filter(Boolean).join(' ')}` : ''}${
          c.user?.role ? ` (${c.user.role})` : ''
        }`,
      })),
    [contacts]
  );

  const templateOptions = useMemo(
    () =>
      templates.map((t) => ({
        value: t._id,
        label: `${t.name} (${t.kind})`,
      })),
    [templates]
  );

  const listOptions = useMemo(
    () =>
      lists.map((l) => ({
        value: l._id,
        label: l.name,
      })),
    [lists]
  );

  const refreshAll = async () => {
    setLoading(true);
    try {
      const [c1, c2, c3, c4, c5, c6] = await Promise.all([
        api.get('/marketing/contacts', { skipLoader: true }),
        api.get('/marketing/lists', { skipLoader: true }),
        api.get('/marketing/templates', { skipLoader: true }),
        api.get('/marketing/campaigns', { skipLoader: true }),
        api.get('/marketing/holidays', { skipLoader: true }),
        api.get('/marketing/logs', { skipLoader: true }),
      ]);
      setContacts(c1.data.contacts || []);
      setLists(c2.data.lists || []);
      setTemplates(c3.data.templates || []);
      setCampaigns(c4.data.campaigns || []);
      setHolidays(c5.data.holidays || []);
      setLogs(c6.data.logs || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load marketing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  // ----------------------
  // Contacts form
  // ----------------------
  const [newContact, setNewContact] = useState({
    email: '',
    firstName: '',
    lastName: '',
    company: '',
    title: '',
    tags: '',
    birthDate: '',
    anniversaryDate: '',
  });

  const createContact = async () => {
    if (!newContact.email) return toast.error('Email is required');
    try {
      await api.post('/marketing/contacts', {
        ...newContact,
        tags: newContact.tags ? newContact.tags.split(/[;,]/).map((t) => t.trim()).filter(Boolean) : [],
      });
      toast.success('Contact saved');
      setNewContact({ email: '', firstName: '', lastName: '', company: '', title: '', tags: '', birthDate: '', anniversaryDate: '' });
      refreshAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save contact');
    }
  };

  const importContactsCsv = async (file) => {
    try {
      const form = new FormData();
      form.append('csvFile', file);
      await api.post('/marketing/contacts/import-csv', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('CSV processed');
      refreshAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'CSV import failed');
    }
  };

  // ----------------------
  // Contacts table + filters + bulk send
  // ----------------------
  const [contactSearch, setContactSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [showUnsubscribed, setShowUnsubscribed] = useState(false);

  const filteredContacts = useMemo(() => {
    const s = contactSearch.trim().toLowerCase();
    return (contacts || [])
      .filter((c) => (showUnsubscribed ? true : !c.unsubscribed))
      .filter((c) => {
        if (!s) return true;
        const hay = [
          c.email,
          c.firstName,
          c.lastName,
          c.company,
          c.user?.name,
          c.user?.role,
          c.user?.school,
          c.user?.tutorial,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(s);
      })
      .filter((c) => {
        if (roleFilter === 'all') return true;
        return (c.user?.role || '').toLowerCase() === roleFilter;
      })
      .filter((c) => {
        if (sourceFilter === 'all') return true;
        return (c.source || '').toLowerCase() === sourceFilter;
      });
  }, [contacts, contactSearch, roleFilter, sourceFilter, showUnsubscribed]);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const selectedCount = selectedIds.size;

  const toggleRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    const visibleIds = filteredContacts.map((c) => c._id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendTemplate, setSendTemplate] = useState(null);
  const [sendToSingleId, setSendToSingleId] = useState(null);

  const openSendSingle = (id) => {
    setSendToSingleId(id);
    setSendTemplate(null);
    setSendModalOpen(true);
  };

  const openSendBulk = () => {
    if (selectedCount === 0) return toast.error('Select at least 1 recipient');
    setSendToSingleId(null);
    setSendTemplate(null);
    setSendModalOpen(true);
  };

  const sendNow = async () => {
    if (!sendTemplate) return toast.error('Select a template');
    try {
      const recipientIds = sendToSingleId ? [sendToSingleId] : Array.from(selectedIds);
      const res = await api.post('/marketing/send', {
        templateId: sendTemplate.value,
        recipientIds,
      });
      const r = res.data?.results;
      toast.success(`Sent: ${r?.sent ?? 0}, Skipped: ${r?.skipped ?? 0}, Failed: ${r?.failed ?? 0}`);
      setSendModalOpen(false);
      setSendToSingleId(null);
      clearSelection();
      refreshAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to send');
    }
  };

  // ----------------------
  // List form
  // ----------------------
  const [newList, setNewList] = useState({ name: '', description: '', contactIds: [] });

  const createList = async () => {
    if (!newList.name) return toast.error('List name is required');
    try {
      await api.post('/marketing/lists', {
        name: newList.name,
        description: newList.description,
        contactIds: (newList.contactIds || []).map((o) => o.value),
      });
      toast.success('List created');
      setNewList({ name: '', description: '', contactIds: [] });
      refreshAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to create list');
    }
  };

  // ----------------------
  // Template form
  // ----------------------
  const [newTemplate, setNewTemplate] = useState({ name: '', kind: 'cold', subject: '', html: '' });

  const createTemplate = async () => {
    if (!newTemplate.name || !newTemplate.subject || !newTemplate.html) return toast.error('Template name, subject and HTML are required');
    try {
      await api.post('/marketing/templates', newTemplate);
      toast.success('Template created');
      setNewTemplate({ name: '', kind: 'cold', subject: '', html: '' });
      refreshAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to create template');
    }
  };

  // ----------------------
  // Campaign form
  // ----------------------
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    description: '',
    listId: null,
    steps: [{ templateId: null, delayDays: 0 }],
    startAt: '',
  });

  const createCampaign = async () => {
    if (!newCampaign.name || !newCampaign.listId) return toast.error('Campaign name and list are required');
    const steps = (newCampaign.steps || [])
      .filter((s) => s.templateId)
      .map((s) => ({ templateId: s.templateId.value, delayDays: Number(s.delayDays || 0) }));
    if (!steps.length) return toast.error('Add at least one step with a template');

    try {
      await api.post('/marketing/campaigns', {
        name: newCampaign.name,
        description: newCampaign.description,
        listId: newCampaign.listId.value,
        steps,
        startAt: newCampaign.startAt || null,
      });
      toast.success('Campaign created');
      setNewCampaign({ name: '', description: '', listId: null, steps: [{ templateId: null, delayDays: 0 }], startAt: '' });
      refreshAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to create campaign');
    }
  };

  const startCampaign = async (id) => {
    try {
      await api.post(`/marketing/campaigns/${id}/start`);
      toast.success('Campaign started');
      refreshAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to start campaign');
    }
  };

  const pauseCampaign = async (id) => {
    try {
      await api.post(`/marketing/campaigns/${id}/pause`);
      toast.success('Campaign paused');
      refreshAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to pause campaign');
    }
  };

  // ----------------------
  // Holiday form
  // ----------------------
  const [newHoliday, setNewHoliday] = useState({ name: '', month: 1, day: 1, templateId: null, enabled: true });

  const createHoliday = async () => {
    if (!newHoliday.name || !newHoliday.templateId) return toast.error('Holiday name and template are required');
    try {
      await api.post('/marketing/holidays', {
        name: newHoliday.name,
        month: Number(newHoliday.month),
        day: Number(newHoliday.day),
        templateId: newHoliday.templateId.value,
        enabled: newHoliday.enabled,
      });
      toast.success('Festive day saved');
      setNewHoliday({ name: '', month: 1, day: 1, templateId: null, enabled: true });
      refreshAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save festive day');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Marketing</h1>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-60 mt-1">
              Cold emails, follow-ups, and automated greetings
            </p>
          </div>
          <button className={btnClass} onClick={refreshAll} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-widest transition ${
                activeTab === t.key ? 'bg-primary text-primary-foreground border-primary/30' : 'bg-card border-border hover:bg-muted'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'contacts' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-3xl p-6 space-y-4">
              <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground">Add contact</h3>
              <input className={inputClass} placeholder="Email *" value={newContact.email} onChange={(e) => setNewContact((s) => ({ ...s, email: e.target.value }))} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className={inputClass} placeholder="First name" value={newContact.firstName} onChange={(e) => setNewContact((s) => ({ ...s, firstName: e.target.value }))} />
                <input className={inputClass} placeholder="Last name" value={newContact.lastName} onChange={(e) => setNewContact((s) => ({ ...s, lastName: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className={inputClass} placeholder="Company" value={newContact.company} onChange={(e) => setNewContact((s) => ({ ...s, company: e.target.value }))} />
                <input className={inputClass} placeholder="Title" value={newContact.title} onChange={(e) => setNewContact((s) => ({ ...s, title: e.target.value }))} />
              </div>
              <input
                className={inputClass}
                placeholder="Tags (comma-separated)"
                value={newContact.tags}
                onChange={(e) => setNewContact((s) => ({ ...s, tags: e.target.value }))}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className={inputClass} type="date" value={newContact.birthDate} onChange={(e) => setNewContact((s) => ({ ...s, birthDate: e.target.value }))} />
                <input className={inputClass} type="date" value={newContact.anniversaryDate} onChange={(e) => setNewContact((s) => ({ ...s, anniversaryDate: e.target.value }))} />
              </div>
              <div className="flex flex-wrap gap-2">
                <button className={primaryBtnClass} onClick={createContact}>
                  Save
                </button>
                <label className={btnClass}>
                  <Upload className="w-4 h-4" /> Import CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && importContactsCsv(e.target.files[0])}
                  />
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Template variables you can use: <span className="font-mono">{'{{firstName}} {{lastName}} {{email}} {{company}} {{title}}'}</span>
              </p>
            </div>

            <div className="bg-card border border-border rounded-3xl p-6">
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground">Contacts</h3>
                  <span className="text-xs font-black text-muted-foreground">{filteredContacts.length}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="relative">
                    <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                    <input
                      className={`${inputClass} pl-10`}
                      placeholder="Search (email, name, school, role...)"
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                    />
                  </div>
                  <select className={inputClass} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                    <option value="all">All roles</option>
                    <option value="student">student</option>
                    <option value="teacher">teacher</option>
                    <option value="school_admin">school_admin</option>
                    <option value="personal_teacher">personal_teacher</option>
                    <option value="root_admin">root_admin</option>
                  </select>
                  <select className={inputClass} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                    <option value="all">All sources</option>
                    <option value="manual">manual</option>
                    <option value="csv">csv</option>
                    <option value="lms_user">lms_user</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                    <input type="checkbox" checked={showUnsubscribed} onChange={(e) => setShowUnsubscribed(e.target.checked)} />
                    Show unsubscribed
                  </label>

                  <div className="flex items-center gap-2">
                    {selectedCount > 0 && (
                      <button className={btnClass} onClick={clearSelection}>
                        <X className="w-4 h-4" /> Clear ({selectedCount})
                      </button>
                    )}
                    <button className={primaryBtnClass} onClick={openSendBulk} disabled={selectedCount === 0}>
                      <Send className="w-4 h-4" /> Send bulk
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-border rounded-2xl">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-left">
                      <th className="p-3 w-10">
                        <input
                          type="checkbox"
                          onChange={toggleAllVisible}
                          checked={filteredContacts.length > 0 && filteredContacts.every((c) => selectedIds.has(c._id))}
                        />
                      </th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">School/Tutorial</th>
                      <th className="p-3">Last active</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContacts.map((c) => (
                      <tr key={c._id} className="border-t border-border hover:bg-muted/20">
                        <td className="p-3">
                          <input type="checkbox" checked={selectedIds.has(c._id)} onChange={() => toggleRow(c._id)} />
                        </td>
                        <td className="p-3 font-bold">{c.email}</td>
                        <td className="p-3">
                          <div className="font-semibold">{[c.firstName, c.lastName].filter(Boolean).join(' ') || c.user?.name || '—'}</div>
                          <div className="text-[11px] text-muted-foreground">{c.source || '—'}</div>
                        </td>
                        <td className="p-3">{c.user?.role || '—'}</td>
                        <td className="p-3">{c.user?.school || c.user?.tutorial || c.company || '—'}</td>
                        <td className="p-3">{c.user?.lastActiveAt ? new Date(c.user.lastActiveAt).toLocaleString() : '—'}</td>
                        <td className="p-3">
                          {c.unsubscribed ? (
                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                              Unsubscribed
                            </span>
                          ) : (
                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button className={primaryBtnClass} onClick={() => openSendSingle(c._id)} disabled={c.unsubscribed}>
                            <Send className="w-4 h-4" /> Send
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredContacts.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-10 text-center text-muted-foreground">
                          <Users className="w-10 h-10 mx-auto opacity-20 mb-2" />
                          <p className="font-bold">No contacts match your filters</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'lists' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-3xl p-6 space-y-4">
              <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground">Create list</h3>
              <input className={inputClass} placeholder="List name *" value={newList.name} onChange={(e) => setNewList((s) => ({ ...s, name: e.target.value }))} />
              <input className={inputClass} placeholder="Description" value={newList.description} onChange={(e) => setNewList((s) => ({ ...s, description: e.target.value }))} />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Contacts</p>
                <Select
                  isMulti
                  value={newList.contactIds}
                  onChange={(v) => setNewList((s) => ({ ...s, contactIds: v || [] }))}
                  options={contactOptions}
                />
              </div>
              <button className={primaryBtnClass} onClick={createList}>
                Save list
              </button>
            </div>

            <div className="bg-card border border-border rounded-3xl p-6">
              <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground mb-4">Lists</h3>
              <div className="space-y-2 max-h-[520px] overflow-y-auto custom-scrollbar pr-2">
                {lists.map((l) => (
                  <div key={l._id} className="p-4 rounded-2xl border border-border bg-background/40">
                    <p className="font-bold">{l.name}</p>
                    <p className="text-xs text-muted-foreground">{l.description || '—'}</p>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-2">
                      {Array.isArray(l.contactIds) ? `${l.contactIds.length} contacts` : '—'}
                    </p>
                  </div>
                ))}
                {lists.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    <ListIcon className="w-10 h-10 mx-auto opacity-20 mb-2" />
                    <p className="font-bold">No lists yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-3xl p-6 space-y-4">
              <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground">Create template</h3>
              <input className={inputClass} placeholder="Template name *" value={newTemplate.name} onChange={(e) => setNewTemplate((s) => ({ ...s, name: e.target.value }))} />
              <select className={inputClass} value={newTemplate.kind} onChange={(e) => setNewTemplate((s) => ({ ...s, kind: e.target.value }))}>
                {['cold', 'followup', 'birthday', 'anniversary', 'festive', 'general'].map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <input className={inputClass} placeholder="Subject *" value={newTemplate.subject} onChange={(e) => setNewTemplate((s) => ({ ...s, subject: e.target.value }))} />
              <textarea
                className={`${inputClass} min-h-[220px] font-mono text-xs`}
                placeholder="HTML body *"
                value={newTemplate.html}
                onChange={(e) => setNewTemplate((s) => ({ ...s, html: e.target.value }))}
              />
              <button className={primaryBtnClass} onClick={createTemplate}>
                Save template
              </button>
            </div>

            <div className="bg-card border border-border rounded-3xl p-6">
              <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground mb-4">Templates</h3>
              <div className="space-y-2 max-h-[520px] overflow-y-auto custom-scrollbar pr-2">
                {templates.map((t) => (
                  <div key={t._id} className="p-4 rounded-2xl border border-border bg-background/40">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold truncate">{t.name}</p>
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {t.kind}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">{t.subject}</p>
                  </div>
                ))}
                {templates.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto opacity-20 mb-2" />
                    <p className="font-bold">No templates yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'campaigns' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-3xl p-6 space-y-4">
              <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground">Create campaign</h3>
              <input className={inputClass} placeholder="Campaign name *" value={newCampaign.name} onChange={(e) => setNewCampaign((s) => ({ ...s, name: e.target.value }))} />
              <input className={inputClass} placeholder="Description" value={newCampaign.description} onChange={(e) => setNewCampaign((s) => ({ ...s, description: e.target.value }))} />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">List *</p>
                <Select value={newCampaign.listId} onChange={(v) => setNewCampaign((s) => ({ ...s, listId: v }))} options={listOptions} />
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Steps</p>
                {newCampaign.steps.map((s, idx) => (
                  <div key={idx} className="p-4 rounded-2xl border border-border bg-background/40 space-y-2">
                    <Select
                      value={s.templateId}
                      onChange={(v) =>
                        setNewCampaign((prev) => {
                          const next = [...prev.steps];
                          next[idx] = { ...next[idx], templateId: v };
                          return { ...prev, steps: next };
                        })
                      }
                      options={templateOptions}
                      placeholder="Choose template"
                    />
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      placeholder="Delay days after previous step"
                      value={s.delayDays}
                      onChange={(e) =>
                        setNewCampaign((prev) => {
                          const next = [...prev.steps];
                          next[idx] = { ...next[idx], delayDays: e.target.value };
                          return { ...prev, steps: next };
                        })
                      }
                    />
                    <div className="flex gap-2">
                      <button
                        className={btnClass}
                        onClick={() =>
                          setNewCampaign((prev) => ({ ...prev, steps: prev.steps.filter((_, i) => i !== idx) || [{ templateId: null, delayDays: 0 }] }))
                        }
                        disabled={newCampaign.steps.length <= 1}
                      >
                        Remove step
                      </button>
                      {idx === newCampaign.steps.length - 1 && (
                        <button className={btnClass} onClick={() => setNewCampaign((prev) => ({ ...prev, steps: [...prev.steps, { templateId: null, delayDays: 2 }] }))}>
                          Add step
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <input
                className={inputClass}
                type="datetime-local"
                value={newCampaign.startAt}
                onChange={(e) => setNewCampaign((s) => ({ ...s, startAt: e.target.value }))}
              />
              <button className={primaryBtnClass} onClick={createCampaign}>
                Save campaign
              </button>
            </div>

            <div className="bg-card border border-border rounded-3xl p-6">
              <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground mb-4">Campaigns</h3>
              <div className="space-y-2 max-h-[520px] overflow-y-auto custom-scrollbar pr-2">
                {campaigns.map((c) => (
                  <div key={c._id} className="p-4 rounded-2xl border border-border bg-background/40">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.listId?.name ? `List: ${c.listId.name}` : '—'}</p>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                        {c.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className={primaryBtnClass} onClick={() => startCampaign(c._id)} disabled={c.status === 'active'}>
                        <Play className="w-4 h-4" /> Start
                      </button>
                      <button className={btnClass} onClick={() => pauseCampaign(c._id)} disabled={c.status !== 'active'}>
                        <Pause className="w-4 h-4" /> Pause
                      </button>
                    </div>
                  </div>
                ))}
                {campaigns.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    <Mail className="w-10 h-10 mx-auto opacity-20 mb-2" />
                    <p className="font-bold">No campaigns yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'holidays' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-3xl p-6 space-y-4">
              <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground">Add festive day</h3>
              <input className={inputClass} placeholder="Name * (e.g., Christmas)" value={newHoliday.name} onChange={(e) => setNewHoliday((s) => ({ ...s, name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <input className={inputClass} type="number" min={1} max={12} value={newHoliday.month} onChange={(e) => setNewHoliday((s) => ({ ...s, month: e.target.value }))} />
                <input className={inputClass} type="number" min={1} max={31} value={newHoliday.day} onChange={(e) => setNewHoliday((s) => ({ ...s, day: e.target.value }))} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Template *</p>
                <Select value={newHoliday.templateId} onChange={(v) => setNewHoliday((s) => ({ ...s, templateId: v }))} options={templateOptions} />
              </div>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" checked={!!newHoliday.enabled} onChange={(e) => setNewHoliday((s) => ({ ...s, enabled: e.target.checked }))} />
                Enabled
              </label>
              <button className={primaryBtnClass} onClick={createHoliday}>
                Save festive day
              </button>
            </div>

            <div className="bg-card border border-border rounded-3xl p-6">
              <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground mb-4">Festive days</h3>
              <div className="space-y-2 max-h-[520px] overflow-y-auto custom-scrollbar pr-2">
                {holidays.map((h) => (
                  <div key={h._id} className="p-4 rounded-2xl border border-border bg-background/40">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold truncate">{h.name}</p>
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {String(h.month).padStart(2, '0')}/{String(h.day).padStart(2, '0')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{h.enabled ? 'Enabled' : 'Disabled'}</p>
                  </div>
                ))}
                {holidays.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    <Calendar className="w-10 h-10 mx-auto opacity-20 mb-2" />
                    <p className="font-bold">No festive days yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-card border border-border rounded-3xl p-6">
            <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground mb-4">Latest logs</h3>
            <div className="space-y-2 max-h-[650px] overflow-y-auto custom-scrollbar pr-2">
              {logs.map((l) => (
                <div key={l._id} className="p-4 rounded-2xl border border-border bg-background/40">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold truncate">
                        {l.contactId?.email || '—'}{' '}
                        <span className="text-xs text-muted-foreground font-black uppercase tracking-widest">({l.type})</span>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {l.templateId?.name ? `Template: ${l.templateId.name}` : '—'} {l.campaignId?.name ? `• Campaign: ${l.campaignId.name}` : ''}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${
                        l.status === 'sent'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : l.status === 'failed'
                          ? 'bg-red-500/10 text-red-500 border-red-500/20'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}
                    >
                      {l.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Scheduled: {l.scheduledAt ? new Date(l.scheduledAt).toLocaleString() : '—'} {l.error ? `• Error: ${l.error}` : ''}
                  </p>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="p-10 text-center text-muted-foreground">
                  <RefreshCw className="w-10 h-10 mx-auto opacity-20 mb-2" />
                  <p className="font-bold">No logs yet</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {sendModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSendModalOpen(false)} />
          <div className="relative w-full max-w-xl bg-card border border-border rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-black">Send email</h3>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-70 mt-1">
                  {sendToSingleId ? 'Single recipient' : `Bulk: ${selectedCount} recipients`}
                </p>
              </div>
              <button className={btnClass} onClick={() => setSendModalOpen(false)}>
                <X className="w-4 h-4" /> Close
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Template</p>
              <Select value={sendTemplate} onChange={setSendTemplate} options={templateOptions} placeholder="Choose a template" />
              <div className="flex justify-end gap-2 pt-3">
                <button className={btnClass} onClick={() => setSendModalOpen(false)}>
                  Cancel
                </button>
                <button className={primaryBtnClass} onClick={sendNow}>
                  <Send className="w-4 h-4" /> Send now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

