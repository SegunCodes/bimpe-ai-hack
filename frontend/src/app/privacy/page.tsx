import type { Metadata } from 'next'
import { LegalPage } from '@/components/marketing/LegalPage'
import { SUPPORT_EMAIL } from '@/lib/plans'

export const metadata: Metadata = {
  title: 'Privacy policy · Tellero AI',
  description: 'What information Tellero AI collects, why, who processes it, and the choices you have.',
}

export default function Page() {
  return (
    <LegalPage title="Privacy policy" updated="4 October 2026">
      <p>
        Tellero AI (“we”, “us”) calls the customers of online sellers in Nigeria to confirm deliveries and collect delivery details. This policy explains what
        information we handle, why, and what you can do about it. We aim to follow the Nigeria Data Protection Act 2023.
      </p>

      <h2>Two kinds of people</h2>
      <ul>
        <li>
          <strong>Businesses</strong> that create a Tellero AI account and use the dashboard.
        </li>
        <li>
          <strong>Customers</strong> of those businesses, whom Tellero AI phones about their deliveries. For customer information, the business decides why
          and when calls are made; we process the information on the business’s behalf.
        </li>
      </ul>

      <h2>What we collect</h2>
      <p>From businesses:</p>
      <ul>
        <li>Business name and email address.</li>
        <li>A password, which we store only in a scrambled (hashed) form we can’t read.</li>
        <li>Plan and payment records: which plan you bought, when, and the amount. We never see or store your card or bank details.</li>
      </ul>
      <p>About customers, as entered by a business or collected on a call:</p>
      <ul>
        <li>Name and phone number.</li>
        <li>Order details: item, seller, delivery address, delivery time.</li>
        <li>What the customer says on the call: corrected address, landmark, preferred language, best time to call, and whether they agree to delivery calls.</li>
        <li>The call’s transcript and duration.</li>
      </ul>
      <p>If you ask Tellero AI to call you from our website, we collect your phone number (and name, if you give it) to place that call.</p>

      <h2>How we use it</h2>
      <ul>
        <li>To place the calls a business has scheduled, and to show the results on that business’s dashboard.</li>
        <li>To run accounts, take payments and count the calls used on each plan.</li>
        <li>To keep the service working and secure, and to fix problems.</li>
      </ul>
      <p>We don’t sell personal information, and we don’t use customers’ information for advertising.</p>

      <h2>On the call</h2>
      <p>
        Tellero AI is an AI voice agent and says it is calling for the business. It never asks for card details, bank details, PINs, passwords or one-time
        codes. If a customer receives a call asking for any of these, it isn’t from Tellero AI.
      </p>

      <h2>Who can see it</h2>
      <p>
        A business can see only its own customers, orders and calls. A small number of Tellero AI staff can see account and usage information to run the
        service and help with support.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep account and call information while a business has an account, so its dashboard history stays complete. A business can ask us to delete its
        account and its customers’ information at any time. When an account is deleted, everything in it is removed, and the name and email on its payment
        records are erased; only the amount and date are kept for our accounts.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Businesses can ask for a copy of their data, a correction, or deletion.</li>
        <li>
          Customers can ask the business that ordered the call, or us, to stop calls, or to see, correct or delete their information. A customer can also say “no”
          on an onboarding call when asked whether they agree to delivery calls.
        </li>
      </ul>
      <p>
        Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> for any of these. We’ll reply within 30 days.
      </p>

      <h2>Changes</h2>
      <p>If we change this policy in a way that matters, we’ll update the date at the top of this page and let businesses know in their dashboard or by email.</p>
    </LegalPage>
  )
}
