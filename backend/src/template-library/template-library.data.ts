export type LibraryTemplateType = 'UTILITY' | 'AUTHENTICATION';

export interface LibraryTemplate {
  id: string;
  name: string;
  type: LibraryTemplateType;
  language: string;
  industry: string[];
  topic: string[];
  useCase: string[];
  header?: string;
  body: string;
  footer?: string;
  buttonLabel?: string;
}

export const TEMPLATE_LIBRARY: LibraryTemplate[] = [
  // ── UTILITY ──────────────────────────────────────────────
  {
    id: 'account_creation_confirmation_3', name: 'Finalize account set-up', type: 'UTILITY', language: 'en_US',
    industry: ['E-commerce', 'Financial services'], topic: ['Account update'], useCase: ['Account creation confirmation'],
    body: 'Hi {{1}},\n\nYour new account has been created successfully.\n\nPlease verify your email address to complete your profile.',
    buttonLabel: 'Verify account',
  },
  {
    id: 'address_update', name: 'Address update', type: 'UTILITY', language: 'en_US',
    industry: ['E-commerce'], topic: ['Account update', 'Order management'], useCase: ['Order confirmation'],
    body: 'Hi {{1}}, your delivery address has been successfully updated to {{2}}. Contact {{3}} for any inquiries.',
  },
  {
    id: 'appointment_cancellation_1', name: 'Your appointment was canceled', type: 'UTILITY', language: 'en_US',
    industry: ['Financial services'], topic: ['Order management'], useCase: ['Order or transaction cancel'],
    body: 'Hello {{1}},\n\nYour upcoming appointment with {{2}} on {{3}} at {{4}} has been canceled.\n\nLet us know if you have any questions or need to reschedule.',
    buttonLabel: 'View details',
  },
  {
    id: 'appointment_cancelled', name: 'Appointment cancelled', type: 'UTILITY', language: 'en_US',
    industry: ['Financial services'], topic: ['Order management'], useCase: ['Order or transaction cancel'],
    body: 'Hi {{1}},\n\nYour appointment on {{2}} has been cancelled. We hope to see you another time.',
  },
  {
    id: 'appointment_confirmation_1', name: 'Your appointment is booked', type: 'UTILITY', language: 'en_US',
    industry: ['Financial services'], topic: ['Order management'], useCase: ['Order confirmation'],
    body: 'Hello {{1}},\n\nThank you for booking with {{2}}.\n\nYour appointment for {{3}} on {{4}} at {{5}} is confirmed.',
    buttonLabel: 'View details',
  },
  {
    id: 'appointment_confirmed', name: 'Appointment confirmed', type: 'UTILITY', language: 'en_US',
    industry: ['Financial services'], topic: ['Order management'], useCase: ['Order confirmation'],
    body: 'Hi {{1}},\n\nYour appointment is scheduled for {{2}}.\n\nService: {{3}}\nConfirmation number: {{4}}\n\nWe\'re looking forward to your visit.',
  },
  {
    id: 'appointment_reminder', name: 'Upcoming technician visit', type: 'UTILITY', language: 'en_US',
    industry: ['E-commerce'], topic: ['Order management'], useCase: ['Order action needed'],
    body: 'Reminder: Our technician will visit your location on {{1}} at {{2}} for your broadband installation. Please be available.',
  },
  {
    id: 'appointment_reminder_2', name: 'You have an upcoming appointment', type: 'UTILITY', language: 'en_US',
    industry: ['Financial services'], topic: ['Order management'], useCase: ['Order action needed'],
    body: 'Hello {{1}},\n\nThis is a reminder about your upcoming appointment with {{2}} on {{3}} at {{4}}.\n\nWe look forward to seeing you!',
    buttonLabel: 'View details',
  },
  {
    id: 'appointment_reschedule_1', name: 'Your appointment was rescheduled', type: 'UTILITY', language: 'en_US',
    industry: ['Financial services'], topic: ['Order management'], useCase: ['Order action needed'],
    body: 'Hello {{1}},\n\nYour upcoming appointment with {{2}} has been rescheduled for {{3}} at {{4}}.\n\nWe look forward to seeing you!',
    buttonLabel: 'View details',
  },
  {
    id: 'appointment_rescheduled', name: 'Appointment rescheduled', type: 'UTILITY', language: 'en_US',
    industry: ['Financial services'], topic: ['Order management'], useCase: ['Order action needed'],
    body: 'Hi {{1}},\n\nYour appointment has been rescheduled to {{2}}.\n\nService: {{3}}\nConfirmation number: {{4}}\n\nWe\'re looking forward to your visit.',
  },
  {
    id: 'appointment_scheduling', name: 'Technician visit', type: 'UTILITY', language: 'en_US',
    industry: ['E-commerce'], topic: ['Order management'], useCase: ['Order action needed'],
    body: 'Hi {{1}}, we\'re scheduling a technician visit for your {{2}} on {{3}} between {{4}} and {{5}}. Please confirm if this time slot works for you.',
    buttonLabel: 'Confirm',
  },
  {
    id: 'appointment_scheduling_address', name: 'Technician visit', type: 'UTILITY', language: 'en_US',
    industry: ['E-commerce'], topic: ['Order management'], useCase: ['Order action needed'],
    body: 'Hi {{1}}, we\'re scheduling a technician visit to {{2}} on {{3}} between {{4}} and {{5}}. Please confirm if this time slot works for you.',
    buttonLabel: 'Confirm',
  },
  {
    id: 'delivery_confirmation', name: 'Delivery confirmation', type: 'UTILITY', language: 'en_US',
    industry: ['E-commerce'], topic: ['Order management'], useCase: ['Delivery confirmation'],
    body: 'Hi {{1}}, your order {{2}} has been delivered. We hope you love it! Let us know if anything is wrong with your order.',
  },
  {
    id: 'delivery_failed', name: 'Delivery failed', type: 'UTILITY', language: 'en_US',
    industry: ['E-commerce'], topic: ['Order management'], useCase: ['Delivery failed'],
    body: 'Hi {{1}}, we were unable to deliver your order {{2}} today. We\'ll attempt delivery again on {{3}}.',
  },
  {
    id: 'delivery_update', name: 'Delivery update', type: 'UTILITY', language: 'en_US',
    industry: ['E-commerce'], topic: ['Order management'], useCase: ['Delivery update'],
    body: 'Hi {{1}}, your order {{2}} is on the way and expected to arrive by {{3}}.',
  },
  {
    id: 'order_confirmation', name: 'Order confirmed', type: 'UTILITY', language: 'en_US',
    industry: ['E-commerce'], topic: ['Order management'], useCase: ['Order confirmation'],
    body: 'Hi {{1}}, thanks for your order! Order {{2}} for {{3}} has been confirmed and will ship soon.',
  },
  {
    id: 'order_delay', name: 'Order delay', type: 'UTILITY', language: 'en_US',
    industry: ['E-commerce'], topic: ['Order management'], useCase: ['Order delay'],
    body: 'Hi {{1}}, we\'re sorry — your order {{2}} is delayed and now expected by {{3}}. Thanks for your patience.',
  },
  {
    id: 'order_or_transaction_cancel', name: 'Order cancelled', type: 'UTILITY', language: 'en_US',
    industry: ['E-commerce', 'Financial services'], topic: ['Order management'], useCase: ['Order or transaction cancel'],
    body: 'Hi {{1}}, your order/transaction {{2}} has been cancelled as requested. Refunds (if applicable) will be processed within {{3}} business days.',
  },
  {
    id: 'low_balance_warning', name: 'Low balance warning', type: 'UTILITY', language: 'en_US',
    industry: ['Financial services'], topic: ['Payments'], useCase: ['Low balance warning'],
    body: 'Hi {{1}}, your account balance is currently {{2}}, which is below your alert threshold of {{3}}. Please top up to avoid service interruption.',
  },
  {
    id: 'auto_pay_reminder', name: 'Auto pay reminder', type: 'UTILITY', language: 'en_US',
    industry: ['Financial services'], topic: ['Payments'], useCase: ['Auto pay reminder'],
    body: 'Hi {{1}}, a payment of {{2}} will be auto-debited from your account on {{3}} for your {{4}} plan.',
  },
  {
    id: 'fraud_alert', name: 'Fraud alert', type: 'UTILITY', language: 'en_US',
    industry: ['Financial services'], topic: ['Payments'], useCase: ['Fraud alert'],
    body: 'Hi {{1}}, we noticed a suspicious transaction of {{2}} on your account ending in {{3}}. If this wasn\'t you, please contact us immediately.',
  },
  {
    id: 'feedback_survey', name: 'Feedback survey', type: 'UTILITY', language: 'en_US',
    industry: ['E-commerce'], topic: ['Customer feedback'], useCase: ['Feedback survey'],
    body: 'Hi {{1}}, thanks for your recent purchase! We\'d love to hear your feedback — it only takes a minute.',
    buttonLabel: 'Share feedback',
  },
  {
    id: 'delivery_code_1', name: 'Order arriving — verification code', type: 'UTILITY', language: 'en_US',
    industry: ['E-commerce'], topic: ['Order management'], useCase: ['Delivery update'],
    body: 'Your order is arriving soon. *{{1}}* is your verification code. Please show this to the delivery associate.',
  },
];

export const TEMPLATE_LIBRARY_AUTH: LibraryTemplate[] = [
  {
    id: 'delivery_code_1', name: 'delivery_code_1', type: 'AUTHENTICATION', language: 'en_US',
    industry: ['E-commerce'], topic: ['Order management'], useCase: ['Delivery update'],
    body: 'Your order is arriving soon. *{{1}}* is your verification code. Please show this to the delivery associate.',
  },
  {
    id: 'delivery_code_2', name: 'delivery_code_2', type: 'AUTHENTICATION', language: 'en_US',
    industry: ['E-commerce'], topic: ['Order management'], useCase: ['Delivery update'],
    body: 'Hi {{1}},\n\nYour {{2}} order is currently pending shipment. The estimated delivery date is {{3}}, with delivery scheduled between {{4}} and {{5}}.\n\nPlease note, the delivery person may ask for your delivery code {{6}} upon arrival.',
  },
  {
    id: 'delivery_code_3', name: 'delivery_code_3', type: 'AUTHENTICATION', language: 'en_US',
    industry: ['E-commerce'], topic: ['Order management'], useCase: ['Delivery update'],
    body: 'Your order is on its way and scheduled to arrive at {{1}}. Please show verification code *{{2}}* to receive your order.',
    buttonLabel: 'Confirm',
  },
  {
    id: 'delivery_code_4', name: 'delivery_code_4', type: 'AUTHENTICATION', language: 'en_US',
    industry: ['E-commerce'], topic: ['Order management'], useCase: ['Delivery update'],
    body: 'Please share code *{{1}}* with delivery agent after verifying the package.',
  },
  {
    id: 'delivery_code_5', name: 'delivery_code_5', type: 'AUTHENTICATION', language: 'en_US',
    industry: ['E-commerce'], topic: ['Order management'], useCase: ['Delivery update'],
    body: 'Your order of {{1}} items (Order ID: {{2}}) is out for delivery today.\n\nPlease provide the code *{{3}}* to the delivery agent to receive your order.',
  },
  {
    id: 'delivery_code_6', name: 'delivery_code_6', type: 'AUTHENTICATION', language: 'en_US',
    industry: ['E-commerce'], topic: ['Order management'], useCase: ['Delivery update'],
    body: 'Your order {{1}} is on its way and scheduled to arrive {{2}}. Please show verification code {{3}} to receive your order.',
  },
  {
    id: 'in_person_banking_user_verification', name: 'in_person_banking_user_verification', type: 'AUTHENTICATION', language: 'en_US',
    industry: ['Financial services'], topic: ['Account update'], useCase: ['Account update'],
    body: 'Your personal data will be updated, provide the account executive with the verification code: {{1}}',
    footer: 'For your security, do not share this code with anyone.',
  },
  {
    id: 'login_code', name: 'login_code', type: 'AUTHENTICATION', language: 'en_US',
    industry: ['Financial services'], topic: ['Account update'], useCase: ['Account update'],
    body: 'Your login code is {{1}}. No further action is needed if you didn\'t request this.',
    footer: 'This code expires in 10 minutes.',
  },
];

export const INDUSTRIES = ['E-commerce', 'Financial services'];
export const TOPICS = [
  'Account update', 'Customer feedback', 'Order management', 'Payments',
];
export const USE_CASES = [
  'Account creation confirmation', 'Auto pay reminder', 'Delivery confirmation',
  'Delivery failed', 'Delivery update', 'Feedback survey', 'Fraud alert',
  'Low balance warning', 'Order action needed', 'Order confirmation',
  'Order delay', 'Order or transaction cancel',
];
