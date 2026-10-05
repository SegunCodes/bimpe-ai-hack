import { env } from "../config/env";

/**
 * Transactional email through Resend (https://resend.com/docs/api-reference/emails/send-email).
 * Without RESEND_API_KEY nothing is sent: the email is logged (without its body) and the
 * caller carries on, so local development works without an email account.
 */
export async function sendEmail(input: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
  if (!env.email.resendApiKey) {
    // No subject in the log: it can contain a sign-in code.
    console.warn(`RESEND_API_KEY is not set: email to ${input.to} not sent`);
    return false;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.email.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.email.from,
        to: [input.to],
        reply_to: env.email.replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text
      })
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      console.error(`Resend refused "${input.subject}" (${response.status}): ${body.message || "no details"}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Could not send "${input.subject}":`, error);
    return false;
  }
}

const APP_URL = () => env.appUrl || "https://www.usetellero.com";

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** One simple, email-client-safe layout: logo, heading, paragraphs, optional button. */
function layout(opts: { heading: string; paragraphs: string[]; button?: { label: string; url: string }; big?: string }): string {
  const paragraphs = opts.paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#3b4557">${p}</p>`).join("");
  const big = opts.big
    ? `<p style="margin:8px 0 22px;font-size:34px;font-weight:700;letter-spacing:8px;color:#0b1220;font-family:ui-monospace,Menlo,monospace">${opts.big}</p>`
    : "";
  const button = opts.button
    ? `<p style="margin:22px 0 6px"><a href="${opts.button.url}" style="display:inline-block;background:#ffc20e;color:#0b1220;text-decoration:none;font-weight:700;font-size:16px;padding:13px 22px;border-radius:999px">${opts.button.label}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f5f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f8;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;padding:32px 28px">
<tr><td>
<p style="margin:0 0 24px;font-size:18px;font-weight:700;color:#0b1220"><span style="display:inline-block;background:#ffc20e;border-radius:8px;padding:2px 8px;margin-right:6px">&#9742;</span>Tellero <span style="background:#ffc20e;border-radius:4px;padding:0 4px;font-size:14px">AI</span></p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0b1220">${opts.heading}</h1>
${big}${paragraphs}${button}
</td></tr></table>
<p style="margin:18px 0 0;font-size:13px;color:#5d6678">Tellero AI · Delivery calls, handled · <a href="mailto:${env.email.replyTo}" style="color:#5d6678">${env.email.replyTo}</a></p>
</td></tr></table></body></html>`;
}

export const emails = {
  verificationCode(to: string, name: string, code: string) {
    return sendEmail({
      to,
      subject: `${code} is your Tellero AI code`,
      html: layout({
        heading: "Confirm your email",
        big: code,
        paragraphs: [`Hi ${escape(name)}, enter this code in Tellero AI to confirm your email. It expires in 15 minutes.`, "If you didn’t create a Tellero AI account, you can ignore this email."]
      }),
      text: `Hi ${name}, your Tellero AI code is ${code}. It expires in 15 minutes. If you didn't create an account, ignore this email.`
    });
  },

  passwordResetCode(to: string, name: string, code: string) {
    return sendEmail({
      to,
      subject: `${code} is your Tellero AI password reset code`,
      html: layout({
        heading: "Reset your password",
        big: code,
        paragraphs: [
          `Hi ${escape(name)}, enter this code in Tellero AI to choose a new password. It expires in 15 minutes.`,
          "If you didn’t ask to reset your password, ignore this email. Your password stays the same."
        ]
      }),
      text: `Hi ${name}, your Tellero AI password reset code is ${code}. It expires in 15 minutes. If you didn't ask for this, ignore this email.`
    });
  },

  welcome(to: string, name: string, business: string) {
    return sendEmail({
      to,
      subject: "Welcome to Tellero AI: one step left",
      html: layout({
        heading: `Welcome, ${escape(name)}`,
        paragraphs: [
          `Your email is confirmed and <b>${escape(business)}</b> is set up on Tellero AI.`,
          "One step left: upload your CAC registration certificate so we can confirm you’re a registered business. Once we approve it, you can choose a plan and Tellero AI starts calling your customers."
        ],
        button: { label: "Upload your CAC certificate", url: `${APP_URL()}/dashboard/onboarding` }
      }),
      text: `Welcome, ${name}. Your email is confirmed. Next, upload your CAC certificate at ${APP_URL()}/dashboard/onboarding so we can approve ${business}.`
    });
  },

  documentReceived(to: string, name: string) {
    return sendEmail({
      to,
      subject: "We’ve got your CAC certificate",
      html: layout({
        heading: "Thanks, we’re checking it",
        paragraphs: [`Hi ${escape(name)}, we’ve received your CAC certificate. We’ll review it and email you as soon as it’s approved, usually within one working day.`, "You can add customers and orders in the meantime."]
      }),
      text: `Hi ${name}, we've received your CAC certificate and will email you once it's reviewed (usually within one working day).`
    });
  },

  adminNewDocument(business: string, owner: string, email: string) {
    return sendEmail({
      to: env.email.adminInbox,
      subject: `CAC to review: ${business}`,
      html: layout({
        heading: "A business uploaded its CAC certificate",
        paragraphs: [`<b>${escape(business)}</b> (${escape(owner)}, ${escape(email)}) is waiting for approval.`],
        button: { label: "Review on /admin", url: `${APP_URL()}/admin` }
      }),
      text: `${business} (${owner}, ${email}) uploaded a CAC certificate. Review it at ${APP_URL()}/admin`
    });
  },

  approved(to: string, name: string, business: string) {
    return sendEmail({
      to,
      subject: `${business} is approved on Tellero AI`,
      html: layout({
        heading: "You’re approved",
        paragraphs: [`Hi ${escape(name)}, we’ve checked your CAC certificate and <b>${escape(business)}</b> is approved.`, "Choose a plan and Tellero AI will start calling your customers at the times you set."],
        button: { label: "Choose a plan", url: `${APP_URL()}/dashboard/billing` }
      }),
      text: `Hi ${name}, ${business} is approved. Choose a plan at ${APP_URL()}/dashboard/billing to start calls.`
    });
  },

  rejected(to: string, name: string, reason: string) {
    return sendEmail({
      to,
      subject: "Please upload your CAC certificate again",
      html: layout({
        heading: "We couldn’t approve your certificate",
        paragraphs: [`Hi ${escape(name)}, we couldn’t approve the CAC certificate you uploaded.`, `<b>Reason:</b> ${escape(reason)}`, "Please upload a clear copy of your CAC registration certificate and we’ll check it again."],
        button: { label: "Upload again", url: `${APP_URL()}/dashboard/onboarding` }
      }),
      text: `Hi ${name}, we couldn't approve your CAC certificate. Reason: ${reason}. Please upload it again at ${APP_URL()}/dashboard/onboarding`
    });
  },

  accountSuspended(to: string, name: string, business: string) {
    return sendEmail({
      to,
      subject: `Your Tellero AI account for ${business} is suspended`,
      html: layout({
        heading: "Your account is suspended",
        paragraphs: [
          `Hi ${escape(name)}, we’ve suspended the Tellero AI account for <b>${escape(business)}</b>.`,
          "While it’s suspended you can’t log in and Tellero AI won’t call your customers. Your data hasn’t been deleted.",
          `If you think this is a mistake, reply to this email or write to <a href="mailto:${env.email.replyTo}">${env.email.replyTo}</a>.`
        ]
      }),
      text: `Hi ${name}, we've suspended the Tellero AI account for ${business}. You can't log in and no calls will be made while it's suspended. Your data hasn't been deleted. If you think this is a mistake, email ${env.email.replyTo}.`
    });
  },

  accountRestored(to: string, name: string, business: string) {
    return sendEmail({
      to,
      subject: `Your Tellero AI account for ${business} is active again`,
      html: layout({
        heading: "Your account is active again",
        paragraphs: [`Hi ${escape(name)}, the suspension on <b>${escape(business)}</b> has been lifted. You can log in and Tellero AI can call your customers again.`],
        button: { label: "Log in", url: `${APP_URL()}/login` }
      }),
      text: `Hi ${name}, the suspension on ${business} has been lifted. You can log in again at ${APP_URL()}/login`
    });
  },

  accountDeleted(to: string, name: string, business: string) {
    return sendEmail({
      to,
      subject: `Your Tellero AI account for ${business} has been deleted`,
      html: layout({
        heading: "Your account has been deleted",
        paragraphs: [
          `Hi ${escape(name)}, the Tellero AI account for <b>${escape(business)}</b> has been permanently deleted.`,
          "Your data has been completely removed from Tellero AI, with nothing left behind: your login, business details, CAC certificate, customers, orders, call transcripts and the name and email on your payment records. This can’t be undone.",
          "Payment receipts held by our payment provider are kept by them as the law requires.",
          `Questions? Write to <a href="mailto:${env.email.replyTo}">${env.email.replyTo}</a>.`
        ]
      }),
      text: `Hi ${name}, the Tellero AI account for ${business} has been permanently deleted. Your data has been completely removed from Tellero AI, with nothing left behind: your login, business details, CAC certificate, customers, orders, call transcripts and the name and email on your payment records. Payment receipts held by our payment provider are kept by them as the law requires. Questions? ${env.email.replyTo}`
    });
  },

  planActive(to: string, name: string, plan: string, calls: number) {
    return sendEmail({
      to,
      subject: `Your ${plan} plan is active`,
      html: layout({
        heading: "Payment received",
        paragraphs: [`Hi ${escape(name)}, your <b>${escape(plan)}</b> payment went through and ${calls} calls have been added. Tellero AI is ready to call your customers.`],
        button: { label: "Open your dashboard", url: `${APP_URL()}/dashboard` }
      }),
      text: `Hi ${name}, your ${plan} payment went through and ${calls} calls have been added.`
    });
  }
};
