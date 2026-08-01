import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, FileText, Lock, Mail, ShieldCheck } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import logo from '../assets/logo.jpg';

const LAST_UPDATED = 'August 1, 2026';
const SUPPORT_EMAIL = 'gracifiedlms@gmail.com';

const privacySections = [
  {
    title: '1. Information we collect',
    content: 'We collect information you provide when you create an account, use the platform, contact us, or make a payment. This may include your name, email address, school or organisation details, role, profile information, and learning records such as classroom activity, assignments, assessments, and submissions. We also collect limited technical information, including device, browser, log, and usage data needed to operate and secure the service.',
  },
  {
    title: '2. How we use information',
    content: 'We use information to provide and improve Gracified, create and manage accounts, deliver learning features, process subscriptions and payments, communicate about the service, provide support, protect against fraud or misuse, and meet legal obligations. We do not sell personal information.',
  },
  {
    title: '3. How information is shared',
    content: 'We may share information with service providers that help us run the platform, such as hosting, payment, email, video, and analytics providers. We may also share information when required by law, to protect rights and safety, or as part of a business transfer. Schools and teachers may access information about the learners and classes they administer.',
  },
  {
    title: '4. Cookies and similar technologies',
    content: 'We use cookies, local storage, and similar technologies to keep you signed in, remember preferences, understand platform performance, and protect the service. You can control cookies through your browser settings, though some features may not work correctly if essential cookies are disabled.',
  },
  {
    title: '5. Data retention and security',
    content: 'We keep information for as long as needed to provide the service, comply with legal obligations, resolve disputes, and enforce our agreements. We use reasonable technical and organisational safeguards designed to protect information, but no online service can guarantee absolute security.',
  },
  {
    title: '6. Your choices and rights',
    content: 'Depending on where you live, you may have rights to access, correct, delete, or receive a copy of your personal information, or to object to or restrict certain processing. Account owners can update much of their information in the platform. To make a privacy request, contact us using the email below. We may need to verify your identity before responding.',
  },
  {
    title: '7. Children and school users',
    content: 'Gracified is designed for use by educational communities. Where a school, parent, or guardian provides access for a learner, that organisation or adult is responsible for obtaining any permissions required for the learner’s use. If you believe a child has provided information to us improperly, please contact us so we can review the request.',
  },
  {
    title: '8. Changes and contact',
    content: `We may update this policy as our services or legal requirements change. We will post the updated version here and revise the “Last updated” date. For questions or privacy requests, email ${SUPPORT_EMAIL}.`,
  },
];

const termsSections = [
  {
    title: '1. Acceptance of these terms',
    content: 'By accessing or using Gracified Learning Platform, you agree to these Terms and Conditions and our Privacy Policy. If you use the service for a school, organisation, or another person, you confirm that you are authorised to accept these terms on their behalf.',
  },
  {
    title: '2. Accounts and acceptable use',
    content: 'Provide accurate account information and keep your login credentials secure. You are responsible for activity under your account. Do not use the platform to break the law, infringe another person’s rights, upload harmful code, interfere with the service, impersonate others, or share content that is abusive, unsafe, or inappropriate for an educational setting.',
  },
  {
    title: '3. Schools, educators, and learners',
    content: 'School administrators and educators are responsible for how they create classrooms, invite users, manage learning content, and supervise learner use. They must ensure they have the appropriate authority and permissions to provide user information and learning materials through the platform.',
  },
  {
    title: '4. Content and intellectual property',
    content: 'You retain ownership of content you submit to Gracified. You grant us a limited licence to host, process, display, and transmit that content only as needed to operate and improve the service. Gracified and its branding, software, and platform content are protected by applicable intellectual-property laws and may not be copied or used without permission.',
  },
  {
    title: '5. Subscriptions and payments',
    content: 'Paid features, fees, billing periods, trials, and renewal terms are presented when you select a plan. You agree to provide valid payment information and authorise applicable charges. Unless required by law or stated otherwise at purchase, payments are non-refundable. We may change plan pricing or features with reasonable notice where required.',
  },
  {
    title: '6. Availability and third-party services',
    content: 'We work to keep the platform available and reliable, but do not guarantee uninterrupted or error-free service. Some features rely on third-party providers, including payment and video tools. Their services are governed by their own terms and policies, and we are not responsible for their availability or content.',
  },
  {
    title: '7. Suspension and termination',
    content: 'You may stop using Gracified at any time. We may suspend or terminate access if we reasonably believe these terms have been violated, the platform is at risk, payment is overdue, or we are required to do so by law. On termination, your right to use the service ends, subject to any applicable data-retention requirements.',
  },
  {
    title: '8. Disclaimers and limitation of liability',
    content: 'The service is provided on an “as is” and “as available” basis to the extent permitted by law. We do not guarantee particular educational outcomes. To the maximum extent permitted by law, Gracified will not be liable for indirect, incidental, special, consequential, or punitive damages, or loss of data, profits, or goodwill arising from use of the service.',
  },
  {
    title: '9. Changes and contact',
    content: `We may revise these terms from time to time. Continued use after an update takes effect means you accept the revised terms. If you have questions, contact us at ${SUPPORT_EMAIL}.`,
  },
];

export default function Legal() {
  const { pathname } = useLocation();
  const isPrivacy = pathname === '/privacy';
  const title = isPrivacy ? 'Privacy Policy' : 'Terms & Conditions';
  const description = isPrivacy
    ? 'How Gracified collects, uses, and protects information across our learning platform.'
    : 'The rules and expectations for using Gracified Learning Platform.';
  const sections = isPrivacy ? privacySections : termsSections;
  const Icon = isPrivacy ? Lock : FileText;

  useEffect(() => window.scrollTo(0, 0), [pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <nav className="border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <img src={logo} alt="Gracified" className="w-9 h-9 rounded-xl shadow-lg" />
            <span className="font-outfit font-bold text-foreground text-base sm:text-xl truncate">Gracified Learning Platform</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <ThemeToggle />
            <Link to="/" className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to home
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden border-b border-border bg-card/50 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 left-1/4 w-80 h-80 bg-primary/10 rounded-full blur-[110px]" />
            <div className="absolute -bottom-32 right-1/4 w-72 h-72 bg-blue-400/10 rounded-full blur-[100px]" />
          </div>
          <div className="relative max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-2 text-sm font-semibold mb-6">
              <Icon className="w-4 h-4" /> Gracified legal
            </div>
            <h1 className="font-outfit text-4xl sm:text-5xl font-black tracking-tight text-foreground mb-4">{title}</h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">{description}</p>
            <p className="mt-6 text-sm font-medium text-muted-foreground">Last updated: {LAST_UPDATED}</p>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <article className="max-w-3xl mx-auto">
            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5 sm:p-6 mb-8 flex gap-4">
              <ShieldCheck className="w-6 h-6 text-primary shrink-0 mt-0.5" />
              <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                Please read this page carefully. It explains important information about your use of Gracified Learning Platform.
              </p>
            </div>
            <div className="space-y-8 sm:space-y-10">
              {sections.map((section) => (
                <section key={section.title}>
                  <h2 className="font-outfit text-xl sm:text-2xl font-bold text-foreground mb-3">{section.title}</h2>
                  <p className="text-muted-foreground leading-7 sm:leading-8">{section.content}</p>
                </section>
              ))}
            </div>
            <div className="mt-12 rounded-2xl border border-border bg-card p-6 sm:p-8 text-center">
              <Mail className="w-6 h-6 text-primary mx-auto mb-3" />
              <h2 className="text-xl font-bold mb-2">Questions?</h2>
              <p className="text-muted-foreground text-sm mb-4">We&apos;re happy to help clarify this {isPrivacy ? 'privacy policy' : 'agreement'}.</p>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary font-semibold hover:underline">{SUPPORT_EMAIL}</a>
            </div>
          </article>
        </section>
      </main>

      <footer className="border-t border-border bg-card/80 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} Gracified Learning Platform.</span>
          <div className="flex items-center gap-5">
            <Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-primary transition-colors">Terms &amp; Conditions</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
