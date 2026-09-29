export interface Laboratory {
  id: string;
  name: string;
  shortName?: string;
  country: string; // ISO 3166-1 alpha-2, 'LT'
  city?: string;
  website?: string;
  description?: string;
}

export interface CountryOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export const COUNTRIES: CountryOption[] = [
  { code: 'LT', name: 'Lithuania', nativeName: 'Lietuva', flag: '🇱🇹' },
];

export const LABORATORIES: Laboratory[] = [
  // ==========================================
  // LITHUANIA (LT) - Accredited Blood Laboratories
  // ==========================================
  {
    id: 'anteja',
    name: 'Antėja',
    shortName: 'Antėja',
    country: 'LT',
    city: 'Visa Lietuva (25+ miestų)',
    website: 'https://anteja.lt',
    description: 'Vienas didžiausių laboratorinės diagnostikos tinklų Lietuvoje su modernia centrine baze.',
  },
  {
    id: 'synlab-lt',
    name: 'Synlab Lietuva',
    shortName: 'Synlab',
    country: 'LT',
    city: 'Vilnius, Kaunas, Klaipėda',
    website: 'https://synlab.lt',
    description: 'Tarptautinis medicininių laboratorinių tyrimų lyderis Europoje, turintis akredituotas laboratorijas Lietuvoje.',
  },
  {
    id: 'medicina-practica',
    name: 'Medicina Practica',
    shortName: 'Medicina Practica',
    country: 'LT',
    city: 'Visa Lietuva (30+ padalinių)',
    website: 'https://medicinapractica.lt',
    description: 'Vienas pirmųjų ir didžiausių privačių medicinos laboratorijų tinklų Lietuvoje.',
  },
  {
    id: 'rezus-lt',
    name: 'Rezus.lt',
    shortName: 'Rezus',
    country: 'LT',
    city: 'Vilnius, Kaunas, Šiauliai, Panevėžys ir kt.',
    website: 'https://rezus.lt',
    description: 'Specializuotas kraujo tyrimų laboratorijų tinklas su greitais tyrimų rezultatais ir konsultacijomis.',
  },
  {
    id: 'affidea-lt',
    name: 'Affidea Lietuva',
    shortName: 'Affidea',
    country: 'LT',
    city: 'Vilnius, Kaunas, Klaipėda, Šiauliai',
    website: 'https://affidea.lt',
    description: 'Diagnostikos ir laboratorinių tyrimų centrai visoje Lietuvoje (apima Endemik laboratorinę bazę).',
  },
  {
    id: 'hila',
    name: 'Hila',
    shortName: 'Hila',
    country: 'LT',
    city: 'Vilnius',
    website: 'https://hila.lt',
    description: 'Medicinos diagnostikos ir gydymo centras – aukščiausio lygio akredituota laboratorija.',
  },
  {
    id: 'meliva',
    name: 'Meliva (InMedica / Kardiolita)',
    shortName: 'Meliva',
    country: 'LT',
    city: 'Visa Lietuva',
    website: 'https://meliva.lt',
    description: 'Didžiausias privačių klinikų ir laboratorinės diagnostikos tinklas Lietuvoje (buvusios InMedica ir Kardiolitos klinikos).',
  },
  {
    id: 'santaros-klinikos',
    name: 'VUL Santaros klinikos',
    shortName: 'Santaros klinikos',
    country: 'LT',
    city: 'Vilnius',
    website: 'https://santa.lt',
    description: 'Laboratorinės medicinos centras – Vilniaus universiteto ligoninės akademinė laboratorija.',
  },
  {
    id: 'kauno-klinikos',
    name: 'LSMU Kauno klinikos',
    shortName: 'Kauno klinikos',
    country: 'LT',
    city: 'Kaunas',
    website: 'https://kaunoklinikos.lt',
    description: 'Laboratorinės medicinos klinika – Lietuvos sveikatos mokslų universiteto ligoninė.',
  },
  {
    id: 'baltijos-amerikos-klinika',
    name: 'Baltijos-Amerikos Klinika',
    shortName: 'BAK',
    country: 'LT',
    city: 'Vilnius',
    website: 'https://bak.lt',
    description: 'Tarptautinė privati ligoninė su visapuse laboratorinės diagnostikos baze.',
  },
  {
    id: 'nvspl',
    name: 'NVSPL',
    shortName: 'NVSPL',
    country: 'LT',
    city: 'Vilnius',
    website: 'https://nvspl.lt',
    description: 'Nacionalinė visuomenės sveikatos priežiūros laboratorija.',
  },
];

/**
 * Returns accredited Lithuanian laboratories.
 */
export function getLaboratoriesForCountry(_countryCode?: string): Laboratory[] {
  return LABORATORIES;
}

/**
 * Returns Lithuania country configuration.
 */
export function getCountryByCode(_countryCode?: string): CountryOption {
  return COUNTRIES[0];
}
