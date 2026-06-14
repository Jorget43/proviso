export const CATS = [
  'Home', 'Food', 'Transport', 'Insurance', 'Subscriptions',
  'Utilities', 'Fun', 'Children', 'Pets',
  'Eating Out', 'Travel', 'Shopping',
] as const;

export type Category = typeof CATS[number];

export const CAT_COLORS = [
  '#1E5FA8', '#166B45', '#8A5208', '#5235A8', '#9B2525',
  '#1E7A8A', '#6B4A1A', '#9B2560', '#3A6B1E',
  '#C44B00', '#0E7490', '#855E0C',
];

export const GRACE_FTE = 100000;
export const PPL_MONTHLY = 1373;
export const PPL_MONTHS = 4;


export const LUMPY_KW = [
  'council', 'rates', 'rego', 'registration', 'holiday', 'annual insurance', 'car insur',
  'insurance renewal', 'annual fee', 'membership renewal', 'car service', 'roadside',
  'body corp', 'strata levy', 'water rate', 'land tax',
];

// [category, keywords[]] — custom rules run first; these are system fallbacks.
// All keywords are matched case-insensitively against the full transaction description.
export const CAT_RULES: [string, string[]][] = [
  // ── Food: supermarkets & grocers ────────────────────────────────────────
  ['Food', ['woolworths','coles','iga','aldi','safeway','supermarket','metro ww','foodworks','harris farm','drakes supermarket','spar ','bio-nature','about life','costco']],
  // ── Eating Out: restaurants, cafes, fast food ───────────────────────────
  ['Eating Out', ['restaurant','cafe','coffee','sushi','bakery','nando','guzman','mcdonald','kfc','domino','pizza','hungry jacks','schnitz','subway','oporto','red rooster','soul origin','sumo salad','roll\'d','zambrero','grill\'d','betty\'s burger','lord of fries','ribs & burgers','the chicken','fish & chips','thai ','vietnamese','indian ','chinese ','japanese ','kebab','falafel','boost juice','chatime','gong cha','share tea','hey tea','san churro','the cheesecake']],
  // ── Eating Out: delivery platforms ──────────────────────────────────────
  ['Eating Out', ['uber eats','doordash','menulog','deliveroo']],
  // ── Fun: bars, pubs & alcohol ───────────────────────────────────────────
  ['Fun', ['bar ','tavern','pub ','liquorland','bws ','bottle-o','wine cellar','rooftop','dans murphy','first choice liquor']],
  // ── Fun: entertainment & events ─────────────────────────────────────────
  ['Fun', ['ticketek','ticketmaster','eventbrite','moshtix','hoyts','village cinema','event cinema','palace cinema','dendy','roxy','reading cinema']],
  // ── Fun: fitness & sport ────────────────────────────────────────────────
  ['Fun', ['gym','fitness','yoga','pilates','anytime fitness','f45','crossfit','ufc gym','plus fitness','snap fitness','bikram','peloton','rebel sport','decathlon','running','swimming club','tennis','golf ']],
  // ── Travel: flights, accommodation & holidays ────────────────────────────
  ['Travel', ['qantas','virgin au','jetstar','airbnb','booking.com','hotel','resort','holiday','expedia','wotif','agoda','trivago','tripadvisor','cruise','airfare','flight centre','webjet','skyscanner']],
  // ── Transport: ride-share & taxis ───────────────────────────────────────
  ['Transport', ['uber ','ola ','didi ','taxi','cab ','13cabs','silver top']],
  // ── Transport: public transit ────────────────────────────────────────────
  ['Transport', ['myki','opal ','go card','translink','metrocard','myway','transit systems']],
  // ── Transport: fuel ─────────────────────────────────────────────────────
  ['Transport', ['ampol','bp ','shell ','7-eleven fuel','petrol','caltex','service station','liberty oil','puma energy','metro fuel','speedway fuel','budget petrol','unleaded','diesel']],
  // ── Transport: parking ──────────────────────────────────────────────────
  ['Transport', ['parking','wilson parking','secure parking','care park','ace parking','upark','carpark','park & ride']],
  // ── Insurance ──────────────────────────────────────────────────────────
  ['Insurance', ['aami','nrma','allianz','bupa','medibank','insurance','iselect','ahm ','hcf ','nib ','racq','racv','rac ','youi','budget direct','real insur','suncorp insur','cgu ','qbe ','comminsure','auto & general']],
  // ── Utilities: telco ────────────────────────────────────────────────────
  ['Utilities', ['vodafone','telstra','optus','amaysim','kogan mobile','belong mobile','dodo ','catch connect','southern phone','aussie broadband','aussie bb','spintel']],
  // ── Utilities: energy ───────────────────────────────────────────────────
  ['Utilities', ['electricity','agl ','origin energy','energy australia','simply energy','powershop','lumo energy','click energy','momentum energy','alinta','red energy']],
  // ── Utilities: water & council ──────────────────────────────────────────
  ['Utilities', ['gas ','sydney water','sa water','urban utilities','yarra valley water','south east water','melbourne water','water corporation','water ','internet ']],
  // ── Subscriptions: streaming, software, recurring services ───────────────
  // Must come BEFORE Shopping — 'amazon prime' here prevents "AMAZON PRIME" landing in Shopping
  ['Subscriptions', ['netflix','spotify','amazon prime','apple.com','google one','openai','chatgpt','notion','canva','microsoft','audible','adobe','icloud','disney+','paramount+','stan ','binge ','kayo ','foxtel','github','dropbox','slack ','zoom ','linkedin','claude.ai','midjourney','1password','bitwarden','lastpass','headspace','calm ','duolingo','youtube premium']],
  // ── Children ────────────────────────────────────────────────────────────
  ['Children', ['childcare','kinder','kindergarten','school','baby','mothercare','mamas','nappy','huggies','baby bunting','cotton on kids','smiggle','toyworld','lego store','kids sports','swimming lesson','dance school','music lesson','tutoring','junior','little']],
  // ── Children: general kids retail ───────────────────────────────────────
  ['Children', ['big w','target ','kmart ']],
  // ── Pets ─────────────────────────────────────────────────────────────────
  ['Pets', ['petbarn','petstock','greencross','vets now','vet ','animal hospital','pet food','paw ','rspca','pet circle','city farmers','animates','lost dogs home','lort smith']],
  // ── Home: hardware & furniture ──────────────────────────────────────────
  ['Home', ['bunnings','ikea','officeworks','harvey norman','jb hi-fi','hardware','mitre 10','total tools','beacon lighting','freedom furniture','nick scali','fantastic furniture','the good guys','temple & webster','adairs','spotlight','lincraft','godfreys']],
  // ── Home: maintenance & services ────────────────────────────────────────
  ['Home', ['plumb','electrician','pest control','locksmith','garden','landscap','pool service','cleaning service','handyman','tradesman']],
  // ── Home: property costs ─────────────────────────────────────────────────
  ['Home', ['council','rates','mortgage','home loan','strata','body corp','real estate','property manage','rent ','rental']],
  // ── Shopping: general retail — must come AFTER Subscriptions ─────────────
  // 'amazon prime' already matched in Subscriptions; plain 'amazon' transactions land here
  ['Shopping', ['david jones','myer ','amazon','ebay','catch.com','kogan.com','the iconic','asos ','glue store','cotton on','factorie','uniqlo','h&m ','zara ','city beach','harbor town','dfo ','marketplace']],
];
