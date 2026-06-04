export const CATS = [
  'Home', 'Food', 'Transport', 'Insurance', 'Subscriptions',
  'Utilities', 'Fun', 'Children', 'Pets',
] as const;

export type Category = typeof CATS[number];

export const CAT_COLORS = [
  '#1E5FA8', '#166B45', '#8A5208', '#5235A8', '#9B2525',
  '#1E7A8A', '#6B4A1A', '#9B2560', '#3A6B1E',
];

export const GRACE_FTE = 100000;
export const PPL_MONTHLY = 1373;
export const PPL_MONTHS = 4;

export const LUMPY = [
  { month: 2, name: 'Council rates',     amt: 3000, cat: 'Home' as const },
  { month: 5, name: 'Car 2 rego',        amt: 1200, cat: 'Transport' as const },
  { month: 5, name: 'Car 2 insurance',   amt: 1500, cat: 'Transport' as const },
  { month: 6, name: 'Annual holiday',    amt: 10000, cat: 'Fun' as const },
  { month: 8, name: 'Car 1 insurance',   amt: 2400, cat: 'Transport' as const },
];

export const LUMPY_KW = [
  'council', 'rates', 'rego', 'registration', 'holiday', 'annual insurance', 'car insur',
];

// [category, keywords[]] — custom rules run first; these are system fallbacks
export const CAT_RULES: [string, string[]][] = [
  ['Food',          ['woolworths','coles','iga','aldi','safeway','supermarket','metro ww','foodworks','harris farm']],
  ['Food',          ['restaurant','cafe','coffee','sushi','bakery','nando','guzman','mcdonald','kfc','domino','pizza','hungry jacks','schnitz','subway']],
  ['Fun',           ['bar ','tavern','pub ','liquorland','bws ','bottle-o','wine cellar','rooftop','cinema','ticketek','ticketmaster']],
  ['Transport',     ['uber','taxi','cab','myki','parking','wilson parking','ampol','bp ','shell ','7-eleven fuel','petrol','caltex','service station']],
  ['Insurance',     ['aami','nrma','allianz','bupa','medibank','insurance','iselect','ahm ']],
  ['Utilities',     ['vodafone','telstra','optus','electricity','agl ','origin energy','gas ','sydney water','water ','internet','aussie broadband','aussie bb']],
  ['Subscriptions', ['netflix','spotify','amazon prime','apple.com','google ','openai','chatgpt','notion','canva','microsoft','audible','adobe','icloud']],
  ['Children',      ['childcare','kinder','kindergarten','school','baby','mothercare','mamas','nappy','huggies']],
  ['Pets',          ['petbarn','petstock','vet ','animal hospital','pet food','paw','rspca']],
  ['Home',          ['bunnings','ikea','officeworks','harvey norman','jb hi-fi','hardware','mitre 10','plumbing','electrician','council','rates','mortgage','home loan']],
  ['Fun',           ['qantas','virgin au','jetstar','airbnb','booking.com','hotel','resort','holiday','travel','expedia']],
  ['Fun',           ['gym','fitness','yoga','pilates','anytime fitness','f45','crossfit']],
];
