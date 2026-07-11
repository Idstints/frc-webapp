// The one cafe for now — the cafe switcher is wired for more later.
export const DEFAULT_CAFE_ID = 'a0000000-0000-4000-8000-000000000001'

export const CATEGORIES = [
  'Bicycles / scooters',
  'Clothing, fabric and textiles',
  'Household appliances (electric)',
  'Household appliances (non-electric)',
  'Clocks / alarm clocks',
  'Computers / phones / gadgets',
  'Display and sound equipment',
  'Furniture / upholstery',
  'Ornaments',
  'Jewellery',
  'Shoes',
  'Tools (electric)',
  'Tools (non-electric)',
  'Toys (electric)',
  'Toys (non-electric)',
  'Musical Instrument',
]

export const CATEGORY_ICONS = {
  'Bicycles / scooters': '🚲',
  'Clothing, fabric and textiles': '🧵',
  'Household appliances (electric)': '🔌',
  'Household appliances (non-electric)': '🫖',
  'Clocks / alarm clocks': '⏰',
  'Computers / phones / gadgets': '💻',
  'Display and sound equipment': '📺',
  'Furniture / upholstery': '🪑',
  'Ornaments': '🏺',
  'Jewellery': '💍',
  'Shoes': '👞',
  'Tools (electric)': '🛠️',
  'Tools (non-electric)': '🔨',
  'Toys (electric)': '🤖',
  'Toys (non-electric)': '🧸',
  'Musical Instrument': '🎸',
}

export const SKILLS = [
  'Electrical',
  'Electronics & IT',
  'Mechanical',
  'Bikes & scooters',
  'Sewing & textiles',
  'Furniture & woodwork',
  'Jewellery',
  'Shoes & leather',
  'Toys',
  'Musical instruments',
  'General repairs',
  'Admin & welcome team',
]

export const TIME_SLOTS = [
  '11.00 – 11.30',
  '11.30 – 12.00',
  '12.00 – 12.30',
  '12.30 – 1.00',
  '1.00 – 1.30',
]

export const CONTACT_METHODS = ['Email', 'SMS message', 'Phone call']

export const AVAILABILITY_OPTIONS = ['Yes', 'No', 'Maybe, with more information']

export const INTERESTED_REPAIRS = [
  'Small electronics',
  'Furniture',
  'Clothes',
  'Shoes',
  'Bikes',
  'Computers & IT help',
  'Toys',
  'Jewellery',
  'Musical instruments',
]

export const HEARD_ABOUT = [
  'From a friend or family member',
  'On social media',
  'Web search',
  'At an event',
  'Through Maribyrnong City Council',
  'Just walking past',
]

// Workflow — the four tracked steps shown to visitors, in order.
export const STEPS = [
  { key: 'confirmed', label: 'Appointment confirmed' },
  { key: 'assigned', label: 'Repairer assigned' },
  { key: 'in_progress', label: 'Repair in progress' },
  { key: 'completed', label: 'Repair completed' },
]

export const STATUS_META = {
  pending: { label: 'Awaiting confirmation', step: 0, chart: '#eb6834' },
  confirmed: { label: 'Appointment confirmed', step: 1, chart: '#2a78d6' },
  assigned: { label: 'Repairer assigned', step: 2, chart: '#4a3aa7' },
  in_progress: { label: 'Repair in progress', step: 3, chart: '#eda100' },
  completed: { label: 'Repair completed', step: 4, chart: '#008300' },
  cancelled: { label: 'Cancelled', step: -1, chart: '#e34948' },
}

export const OUTCOMES = [
  { value: 'fixed', label: 'Yes — fully repaired', short: 'Fixed' },
  { value: 'partially_fixed', label: 'Partially — needs more work or parts', short: 'Partially fixed' },
  { value: 'advice_given', label: 'Advice given — visitor can finish it at home', short: 'Advice given' },
  { value: 'not_repairable', label: 'No — end of life', short: 'Not repairable' },
]

export const OUTCOME_LABELS = Object.fromEntries(OUTCOMES.map((o) => [o.value, o.short]))

// A repair counts as a "success" for the fix-rate stat when it left in a
// better state than it arrived (matches how RepairMonitor reports it).
export const SUCCESS_OUTCOMES = ['fixed', 'partially_fixed', 'advice_given']
