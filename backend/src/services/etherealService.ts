import nodemailer, { Transporter } from 'nodemailer';

let etherealTransporter: Transporter | null = null;
let etherealAccount: nodemailer.TestAccount | null = null;

export async function getTransporter(): Promise<Transporter> {
  // If custom SMTP credentials are provided, use them
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Otherwise create/reuse an Ethereal test account
  if (!etherealTransporter) {
    try {
      etherealAccount = await nodemailer.createTestAccount();
      console.log(`[Ethereal SMTP] Initialized test account: ${etherealAccount.user}`);

      etherealTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: etherealAccount.user,
          pass: etherealAccount.pass,
        },
      });
    } catch (err: any) {
      console.error('[Ethereal SMTP] Failed to create test account:', err.message);
      throw err;
    }
  }

  return etherealTransporter;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
}

export async function sendEmailViaEthereal(params: {
  senderEmail: string;
  senderName?: string;
  recipientEmail: string;
  subject: string;
  body: string;
}): Promise<SendEmailResult> {
  const transporter = await getTransporter();

  const senderDisplay = params.senderName 
    ? `"${params.senderName}" <${params.senderEmail}>`
    : params.senderEmail;

  const info = await transporter.sendMail({
    from: senderDisplay,
    to: params.recipientEmail,
    subject: params.subject,
    text: params.body,
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; padding: 20px;">
      <h2 style="color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">${params.subject}</h2>
      <div style="margin-top: 16px; white-space: pre-wrap;">${params.body}</div>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 24px;" />
      <p style="font-size: 12px; color: #64748b;">Sent via ReachInbox Email Scheduler • Sender: ${params.senderEmail}</p>
    </div>`,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log(`[Ethereal SMTP] Email sent to ${params.recipientEmail}. Preview URL: ${previewUrl}`);

  return {
    messageId: info.messageId,
    previewUrl: previewUrl || false,
  };
}
