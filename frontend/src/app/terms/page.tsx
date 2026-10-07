import type { Metadata } from 'next'
import { LegalPage } from '@/components/marketing/LegalPage'
import { PLAN_DAYS, SUPPORT_EMAIL } from '@/lib/plans'

export const metadata: Metadata = {
  title: 'Terms of service · Tellero AI',
  description: 'The terms for businesses using Tellero AI to call their customers.',
}

export default function Page() {
  return (
    <LegalPage title="Terms of service" updated="7 October 2026">
      <p>
        These terms apply when a business creates a Tellero AI account or uses Tellero AI to call its customers. By creating an account, you agree to them. If
        you’re signing up for a company, you confirm you’re allowed to agree for it.
      </p>

      <h2>What Tellero AI does</h2>
      <p>
        Tellero AI places AI phone calls to your customers at the times you choose, to confirm deliveries, collect or correct delivery details, and onboard new
        customers. Results appear in your dashboard. Calls are made by an AI voice agent, not a person.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>Give accurate details and keep your password private. You’re responsible for what happens in your account.</li>
        <li>Tell us straight away at {SUPPORT_EMAIL} if you think someone else is using it.</li>
      </ul>

      <h2>Calling your customers</h2>
      <p>You may only ask Tellero AI to call people who are your customers and who expect to hear from you about their orders. You confirm that:</p>
      <ul>
        <li>you have a genuine reason to contact each customer about their order or account, and you’re allowed to share their details with us for that;</li>
        <li>you’ll stop calling anyone who asks not to be called;</li>
        <li>
          you won’t use Tellero AI for marketing calls, debt collection, harassment, anything misleading, or anything against Nigerian law, including the Nigeria
          Data Protection Act 2023 and the Nigerian Communications Commission’s rules.
        </li>
      </ul>
      <p>We may pause calls or close an account that breaks these rules.</p>

      <h2>Plans and payment</h2>
      <ul>
        <li>
          Plans are paid in advance and last {PLAN_DAYS} days from payment. Each plan includes a number of calls. A call only uses one of your calls if the
          person you’re calling (a customer or one of your riders) answers; calls nobody answers, and calls that fail to connect, don’t count.
        </li>
        <li>Unused calls carry over while you keep an active plan. Top-ups add calls to an active plan.</li>
        <li>Plans don’t renew automatically. There’s nothing to cancel: if you don’t pay again, calls stop when the plan ends.</li>
        <li>Prices are shown in naira on our website and in your dashboard. Payments are processed securely; we never see your card or bank details.</li>
        <li>
          Payments aren’t refundable once calls have been used. If you’re charged in error, email {SUPPORT_EMAIL} within 30 days and we’ll put it right.
        </li>
      </ul>

      <h2>Limits</h2>
      <p>
        To keep the service reliable for everyone, we limit how many calls run at the same time and may briefly pause new calls at busy moments. Paused calls
        wait and go out automatically; they aren’t lost.
      </p>

      <h2>Accuracy</h2>
      <p>
        Tellero AI does its best to understand customers and record their answers correctly, but speech recognition and AI can make mistakes, especially on
        bad lines. Check important details (such as a changed address) before you rely on them. The full transcript of every call is in your dashboard.
      </p>

      <h2>Your data</h2>
      <p>
        Your customers’ information stays yours. We use it only to provide Tellero AI to you, as described in our <a href="/privacy">privacy policy</a>.
      </p>

      <h2>Availability and liability</h2>
      <p>
        We work to keep Tellero AI running, but we can’t promise it will always be available or error-free, and calls depend on phone networks and our
        providers. As far as the law allows, we aren’t liable for indirect losses such as lost sales or failed deliveries, and our total liability to you is limited
        to what you paid us in the 3 months before the problem.
      </p>

      <h2>Ending your account</h2>
      <p>You can stop using Tellero AI at any time and ask us to delete your account. We may close accounts that break these terms.</p>

      <h2>Changes and law</h2>
      <p>
        We may update these terms; the date at the top shows the latest version. These terms are governed by the laws of the Federal Republic of Nigeria.
        Questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
