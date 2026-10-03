// Sample calls for the marketing simulator. Illustrative people and orders, not real customers.

export interface Turn {
  who: 'agent' | 'customer'
  text: string
  /** Order-card changes that land once this line has been said */
  patch?: Partial<CardState>
}

export interface CardState {
  status: string
  address: string
  cleanAddress?: string
  landmark?: string
  note?: string
  language?: string
  bestTime?: string
  consent?: string
}

export interface Scenario {
  id: string
  tab: string
  title: string
  kind: 'Delivery' | 'Onboarding'
  customer: string
  phone: string
  item?: string
  seller?: string
  window?: string
  language: string
  start: CardState
  outcome: string
  turns: Turn[]
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'confirm',
    tab: 'Confirm',
    title: 'Confirm a delivery',
    kind: 'Delivery',
    customer: 'Adaeze O.',
    phone: '+234 803 ••• 4567',
    item: 'Bluetooth speaker',
    seller: 'Jumia',
    window: 'Today, 3pm – 6pm',
    language: 'English',
    start: { status: 'scheduled', address: '12 Admiralty Way, Lekki Phase 1' },
    outcome: 'confirmed',
    turns: [
      { who: 'agent', text: 'Good afternoon Adaeze, this is Tellero calling for Jumia about your Bluetooth speaker.' },
      { who: 'customer', text: 'Oh yes! I’ve been waiting for it.' },
      { who: 'agent', text: 'The rider can bring it between 3 and 6 this evening. Will you be home?' },
      { who: 'customer', text: 'Yes, I’ll be home from 4.', patch: { note: 'Home from 4pm' } },
      { who: 'agent', text: 'Perfect. Is it still 12 Admiralty Way, Lekki Phase 1?' },
      { who: 'customer', text: 'That’s the one.', patch: { status: 'confirmed' } },
    ],
  },
  {
    id: 'address',
    tab: 'Fix address',
    title: 'Fix a vague address',
    kind: 'Delivery',
    customer: 'Tunde B.',
    phone: '+234 809 ••• 3344',
    item: 'Ankara fabric, 6 yards',
    seller: 'Mama Nkechi Fabrics',
    window: 'Today, 12pm – 3pm',
    language: 'Pidgin',
    start: { status: 'scheduled', address: 'Bode Thomas, by the yellow gate' },
    outcome: 'address_updated',
    turns: [
      { who: 'agent', text: 'Good afternoon sir, na Tellero dey call from Mama Nkechi Fabrics. Your Ankara go reach today.' },
      { who: 'customer', text: 'Ah, thank God. Una go fit find the place?' },
      { who: 'agent', text: 'The address wey we get na “Bode Thomas, by the yellow gate”. Abeg, which number be the house?' },
      { who: 'customer', text: 'Plot 4, Bode Thomas Street, Surulere.', patch: { cleanAddress: 'Plot 4, Bode Thomas Street, Surulere' } },
      { who: 'agent', text: 'Any landmark wey the rider fit see?' },
      { who: 'customer', text: 'E dey opposite Mobil filling station.', patch: { landmark: 'Opposite Mobil filling station' } },
      { who: 'agent', text: 'I don write am down. Thank you sir!', patch: { status: 'address_updated' } },
    ],
  },
  {
    id: 'reschedule',
    tab: 'Reschedule',
    title: 'Move a delivery',
    kind: 'Delivery',
    customer: 'Chiamaka E.',
    phone: '+234 816 ••• 0912',
    item: 'Rice cooker',
    seller: 'Konga',
    window: 'Today, 3pm – 6pm',
    language: 'English',
    start: { status: 'scheduled', address: '5 Allen Avenue, Ikeja' },
    outcome: 'rescheduled',
    turns: [
      { who: 'agent', text: 'Hello Chiamaka, Tellero here from Konga. Your rice cooker is due between 3 and 6 today.' },
      { who: 'customer', text: 'Ah, I won’t be home today. I travelled to Ibadan.' },
      { who: 'agent', text: 'No problem. When should the rider come instead?' },
      { who: 'customer', text: 'Tomorrow morning, any time before 12.', patch: { note: 'Customer in Ibadan today' } },
      { who: 'agent', text: 'Done. Tomorrow, 9am to 12pm. Safe trip!', patch: { status: 'rescheduled', note: 'New slot: tomorrow, 9am – 12pm' } },
    ],
  },
  {
    id: 'onboard',
    tab: 'Onboard',
    title: 'Welcome a new customer',
    kind: 'Onboarding',
    customer: 'Ibrahim M.',
    phone: '+234 802 ••• 7781',
    language: 'Hausa',
    start: { status: 'new', address: 'Not given yet' },
    outcome: 'verified',
    turns: [
      { who: 'agent', text: 'Hello Ibrahim, this is Tellero. You signed up for delivery calls. Which language do you prefer?' },
      { who: 'customer', text: 'Hausa, or English is fine.', patch: { language: 'Hausa' } },
      { who: 'agent', text: 'Sannu! Where should riders bring your orders?' },
      {
        who: 'customer',
        text: '14 Ahmadu Bello Way, Victoria Island. Near the Eko Hotel roundabout.',
        patch: { cleanAddress: '14 Ahmadu Bello Way, Victoria Island', landmark: 'Near Eko Hotel roundabout' },
      },
      { who: 'agent', text: 'Got it. What’s the best time to call before a delivery?' },
      { who: 'customer', text: 'Evenings, after 5.', patch: { bestTime: 'Evenings, after 5pm' } },
      { who: 'agent', text: 'And is it okay for us to call you about future deliveries?' },
      { who: 'customer', text: 'Yes, no problem.', patch: { consent: 'Yes', status: 'verified' } },
    ],
  },
]
