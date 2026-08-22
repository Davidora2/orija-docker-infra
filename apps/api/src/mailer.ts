import nodemailer from 'nodemailer';
import type { AppConfig } from './config.js';
import {
  getEmailDeliveryBlockReason,
  type EmailDeliveryPurpose,
} from './email-guard.js';

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  purpose?: EmailDeliveryPurpose;
};

export type MailSendResult = {
  delivered: boolean;
  mode: string;
  blocked?: boolean;
  blockReason?: string;
};

export type Mailer = {
  send: (message: MailMessage) => Promise<MailSendResult>;
};

export function createMailer(config: AppConfig): Mailer {
  return {
    async send(message) {
      const purpose = message.purpose ?? 'auth';
      const blockReason = await getEmailDeliveryBlockReason(
        message.to,
        config,
        purpose,
      );
      if (blockReason) {
        console.info('[life-os-mail] blocked delivery', {
          to: message.to,
          subject: message.subject,
          purpose,
          reason: blockReason,
        });
        return {
          delivered: false,
          mode: blockReason === 'skip_env' ? 'skipped' : 'blocked',
          blocked: true,
          blockReason,
        };
      }

      // Prefer Gmail / generic SMTP with app password
      if (config.smtpUser && config.smtpAppPassword) {
        const transporter = nodemailer.createTransport({
          host: config.smtpHost,
          port: config.smtpPort,
          secure: config.smtpPort === 465,
          auth: {
            user: config.smtpUser,
            pass: config.smtpAppPassword,
          },
        });

        await transporter.sendMail({
          from: config.emailFrom,
          to: message.to,
          subject: message.subject,
          text: message.text,
        });
        return { delivered: true, mode: 'smtp' };
      }

      if (config.resendApiKey) {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: config.emailFrom,
            to: [message.to],
            subject: message.subject,
            text: message.text,
          }),
        });
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`Email send failed: ${response.status} ${body}`);
        }
        return { delivered: true, mode: 'resend' };
      }

      // Console / test fallback
      console.info('[life-os-mail]', {
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
      return { delivered: config.nodeEnv !== 'production', mode: 'console' };
    },
  };
}

export function generateNumericCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += String(Math.floor(Math.random() * 10));
  }
  return code;
}
