import crypto from 'crypto';
import { Request, Response } from 'express';
import { queueEmail } from '../../services/Email/emailQueueService.js';
import SupportInquiry, { SupportCategory, SupportUrgency, SupportDeliveryStatus } from '../../models/SupportInquiry.js';

const SUPPORT_CATEGORIES: SupportCategory[] = ['general', 'billing', 'technical', 'account', 'feature'];
const SUPPORT_URGENCIES: SupportUrgency[] = ['low', 'normal', 'high', 'urgent'];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const supportInbox =
  process.env.SUPPORT_EMAIL ||
  process.env.SUPPORT_INBOX_EMAIL ||
  'support@cognitospeak.com';

const sanitizeText = (value: unknown, fallback = ''): string => {
  if (typeof value !== 'string') {
    return fallback;
  }

  return value
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const buildTicketNumber = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CS-${datePart}-${randomPart}`;
};

const buildSupportEmailHtml = (ticket: any) => `
  <div style="font-family: Arial, sans-serif; line-height:1.6; color:#0f172a; background:#f8fafc; padding:24px;">
    <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:20px; overflow:hidden;">
      <div style="background:linear-gradient(135deg,#10b981,#14b8a6,#0ea5e9); padding:28px 32px; color:#fff;">
        <div style="font-size:12px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; opacity:.9;">New Support Ticket</div>
        <h1 style="margin:8px 0 0; font-size:26px; line-height:1.2;">${ticket.ticketNumber}</h1>
        <p style="margin:8px 0 0; opacity:.95;">${ticket.subject}</p>
      </div>
      <div style="padding:32px;">
        <p style="margin:0 0 16px; font-size:16px;">A new support request was submitted from the landing page.</p>
        <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%; border-collapse:collapse; margin:0 0 24px;">
          <tr><td style="padding:8px 0; color:#64748b; width:160px;">Name</td><td style="padding:8px 0; font-weight:600;">${ticket.name}</td></tr>
          <tr><td style="padding:8px 0; color:#64748b;">Email</td><td style="padding:8px 0; font-weight:600;">${ticket.email}</td></tr>
          <tr><td style="padding:8px 0; color:#64748b;">Category</td><td style="padding:8px 0; font-weight:600;">${ticket.category}</td></tr>
          <tr><td style="padding:8px 0; color:#64748b;">Urgency</td><td style="padding:8px 0; font-weight:600;">${ticket.urgency}</td></tr>
          <tr><td style="padding:8px 0; color:#64748b;">Source</td><td style="padding:8px 0; font-weight:600;">${ticket.source || 'landing-page-faq'}</td></tr>
          <tr><td style="padding:8px 0; color:#64748b;">Page</td><td style="padding:8px 0; font-weight:600;">${ticket.pageUrl || 'unknown'}</td></tr>
        </table>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:20px;">
          <div style="font-size:13px; font-weight:700; text-transform:uppercase; color:#64748b; margin-bottom:10px;">Message</div>
          <div style="white-space:pre-wrap; color:#1e293b;">${ticket.message}</div>
        </div>
      </div>
    </div>
  </div>
`;

const buildAcknowledgementEmailHtml = (ticket: any) => `
  <div style="font-family: Arial, sans-serif; line-height:1.6; color:#0f172a; background:#f8fafc; padding:24px;">
    <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:20px; overflow:hidden;">
      <div style="background:linear-gradient(135deg,#10b981,#14b8a6,#0ea5e9); padding:28px 32px; color:#fff;">
        <div style="font-size:12px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; opacity:.9;">Support request received</div>
        <h1 style="margin:8px 0 0; font-size:26px; line-height:1.2;">We have your ticket ${ticket.ticketNumber}</h1>
      </div>
      <div style="padding:32px;">
        <p style="margin:0 0 16px; font-size:16px;">Thanks for reaching out. Our support team has received your request and will review it as soon as possible.</p>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:20px; margin:24px 0;">
          <div style="font-size:13px; font-weight:700; text-transform:uppercase; color:#64748b; margin-bottom:10px;">Ticket details</div>
          <div style="margin-bottom:8px;"><strong>Ticket:</strong> ${ticket.ticketNumber}</div>
          <div style="margin-bottom:8px;"><strong>Category:</strong> ${ticket.category}</div>
          <div style="margin-bottom:8px;"><strong>Urgency:</strong> ${ticket.urgency}</div>
          <div><strong>Subject:</strong> ${ticket.subject}</div>
        </div>
        <p style="margin:0; color:#475569;">If your issue is urgent, reply to this email and include the ticket number in the subject line.</p>
      </div>
    </div>
  </div>
`;

export class SupportController {
  async submitContactRequest(req: Request, res: Response) {
    try {
      const name = sanitizeText(req.body?.name);
      const email = sanitizeText(req.body?.email).toLowerCase();
      const subjectInput = sanitizeText(req.body?.subject);
      const message = sanitizeText(req.body?.message);
      const categoryInput = sanitizeText(req.body?.category, 'general').toLowerCase() as SupportCategory;
      const urgencyInput = sanitizeText(req.body?.urgency, 'normal').toLowerCase() as SupportUrgency;
      const source = sanitizeText(req.body?.source, 'landing-page-faq');
      const pageUrl = sanitizeText(req.body?.pageUrl);
      const referrer = sanitizeText(req.body?.referrer);
      const userAgent = sanitizeText(req.body?.userAgent);
      const browserLanguage = sanitizeText(req.body?.browserLanguage);

      const subject = subjectInput || 'Support request from CognitoSpeak';

      if (!name || name.length < 2) {
        return res.status(400).json({ success: false, message: 'Please enter your name.' });
      }

      if (!email || !EMAIL_REGEX.test(email)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
      }

      if (!message || message.length < 20) {
        return res.status(400).json({ success: false, message: 'Please provide a message with at least 20 characters.' });
      }

      if (!SUPPORT_CATEGORIES.includes(categoryInput)) {
        return res.status(400).json({ success: false, message: 'Invalid support category.' });
      }

      if (!SUPPORT_URGENCIES.includes(urgencyInput)) {
        return res.status(400).json({ success: false, message: 'Invalid support urgency.' });
      }

      const ticketNumber = buildTicketNumber();
      const inquiry = await SupportInquiry.create({
        ticketNumber,
        name,
        email,
        subject: subject.slice(0, 160),
        message: message.slice(0, 5000),
        category: categoryInput,
        urgency: urgencyInput,
        source,
        pageUrl: pageUrl || undefined,
        referrer: referrer || undefined,
        userAgent: userAgent || undefined,
        browserLanguage: browserLanguage || undefined,
        metadata: {
          ip: req.ip,
          createdVia: 'landing-page-faq',
        },
      });

      const supportEmailStatus: { inbox: SupportDeliveryStatus; acknowledgement: SupportDeliveryStatus } = {
        inbox: 'queued',
        acknowledgement: 'queued',
      };

      try {
        await queueEmail({
          to: supportInbox,
          subject: `[${ticketNumber}] ${subject}`,
          html: buildSupportEmailHtml(inquiry.toObject()),
          text: `New support request ${ticketNumber}\n\nName: ${name}\nEmail: ${email}\nCategory: ${categoryInput}\nUrgency: ${urgencyInput}\nPage: ${pageUrl || 'unknown'}\n\nMessage:\n${message}`,
          priority: 'high',
        });
        supportEmailStatus.inbox = 'sent';
      } catch (emailError) {
        console.error('Failed to queue support inbox email:', emailError);
        supportEmailStatus.inbox = 'failed';
      }

      if (email !== supportInbox.toLowerCase()) {
        try {
          await queueEmail({
            to: email,
            subject: `We received your CognitoSpeak support request (${ticketNumber})`,
            html: buildAcknowledgementEmailHtml(inquiry.toObject()),
            text: `Thanks for contacting CognitoSpeak support. We received ticket ${ticketNumber} regarding: ${subject}.`,
            priority: 'normal',
          });
          supportEmailStatus.acknowledgement = 'sent';
        } catch (emailError) {
          console.error('Failed to queue support acknowledgement email:', emailError);
          supportEmailStatus.acknowledgement = 'failed';
        }
      } else {
        supportEmailStatus.acknowledgement = 'sent';
      }

      await SupportInquiry.findByIdAndUpdate(inquiry._id, {
        deliveryStatus: supportEmailStatus.inbox === 'failed' ? 'failed' : 'sent',
      });

      return res.status(201).json({
        success: true,
        message: 'Your support request has been submitted successfully.',
        data: {
          ticketNumber,
          status: inquiry.status,
          category: inquiry.category,
          urgency: inquiry.urgency,
          deliveryStatus: supportEmailStatus,
        },
      });
    } catch (error) {
      console.error('Support request submission error:', error);
      return res.status(500).json({
        success: false,
        message: 'Unable to submit your support request right now. Please try again later.',
      });
    }
  }
}

export const supportController = new SupportController();
