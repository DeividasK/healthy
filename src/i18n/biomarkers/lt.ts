/**
 * Lithuanian Clinical Biomarker Translations & Localized Display Helpers
 * Standardized across Lithuanian clinical laboratory accreditation norms
 * (Antėja, Synlab, Medicina Practica, Rezus.lt, Santaros klinikos, Kauno klinikos).
 */

import type { BiomarkerTranslation } from './types';

export const biomarkersLt: Record<string, BiomarkerTranslation> = {
  // CBC & Hematology
  cbc_wbc: {
    name: 'Leukocitai (WBC)',
    aliases: ['WBC', 'Leukocitai', 'Baltieji kraujo kūneliai', 'Bendras leukocitų skaičius'],
    description: 'Baltieji kraujo kūneliai; pagrindinis organizmo imuninės gynybos, infekcijų ir uždegimų rodiklis.',
  },
  cbc_rbc: {
    name: 'Eritrocitai (RBC)',
    aliases: ['RBC', 'Eritrocitai', 'Raudonieji kraujo kūneliai'],
    description: 'Raudonieji kraujo kūneliai, pernešantys deguonį iš plaučių į visus kūno audinius.',
  },
  cbc_hemoglobin: {
    name: 'Hemoglobinas (Hgb)',
    aliases: ['Hgb', 'Hb', 'Hemoglobinas'],
    description: 'Geležies turintis eritrocitų baltymas, surišantis ir pernešantis deguonį organizme.',
  },
  cbc_hematocrit: {
    name: 'Hematokritas (Hct)',
    aliases: ['Hct', 'Hematokritas', 'Ht'],
    description: 'Kraujo kūnelių užimama tūrio dalis visame kraujo tūryje, išreikšta procentais.',
  },
  cbc_platelets: {
    name: 'Trombocitai (PLT)',
    aliases: ['PLT', 'Trombocitai', 'Kraujo plokštelės'],
    description: 'Kraujo plokštelės, būtinos kraujo krešėjimui ir kraujavimo stabdymui.',
  },
  cbc_mcv: {
    name: 'Vidutinis eritrocitų tūris (MCV)',
    aliases: ['MCV', 'Vidutinis eritrocitų tūris'],
    description: 'Vidutinis vieno eritrocito dydis; esminis rodiklis anemijų tipams (mikrocitinei, makrocitinei) diferencijuoti.',
  },
  cbc_mch: {
    name: 'Vidutinis eritrocitų hemoglobinas (MCH)',
    aliases: ['MCH', 'Vidutinis hemoglobino kiekis eritrocite'],
    description: 'Vidutinis hemoglobino svoris viename raudonajame kraujo kūnelyje.',
  },
  cbc_mchc: {
    name: 'Vidutinė eritrocitų Hb koncentracija (MCHC)',
    aliases: ['MCHC', 'Vidutinė hemoglobino koncentracija eritrocite'],
    description: 'Vidutinė hemoglobino koncentracija tam tikrame eritrocitų tūryje.',
  },
  cbc_rdw_cv: {
    name: 'Eritrocitų pasiskirstymo plotis (RDW-CV)',
    aliases: ['RDW-CV', 'RDW', 'Eritrocitų anizocitozė'],
    description: 'Eritrocitų tūrio variacijos koeficientas; parodo raudonųjų kraujo kūnelių dydžių nevienodumą.',
  },
  cbc_rdw_sd: {
    name: 'Eritrocitų pasiskirstymo plotis (RDW-SD)',
    aliases: ['RDW-SD', 'RDW SD'],
    description: 'Eritrocitų dydžio pasiskirstymo kreivės plotis, matuojamas femtolitrais (fL).',
  },
  cbc_mpv: {
    name: 'Vidutinis trombocitų tūris (MPV)',
    aliases: ['MPV', 'Trombocitų tūris'],
    description: 'Vidutinis kraujo plokštelių dydis; atspindi trombocitų gamybos aktyvumą kaulų čiulpuose.',
  },
  cbc_neutrophils_pct: {
    name: 'Neutrofilai (%)',
    aliases: ['NEUT%', 'Neutrofilai procentais', 'Segmentuoti neutrofilai'],
    description: 'Pagrindinė leukocitų dalis, atsakinga už kovą su bakterinėmis infekcijomis ir ūmų uždegimą.',
  },
  cbc_neutrophils_abs: {
    name: 'Absoliutus neutrofilų skaičius (ANC)',
    aliases: ['ANC', 'Neutrofilai absoliutus', 'NEUT#'],
    description: 'Bendras neutrofilų kiekis kraujo tūrio vienete.',
  },
  cbc_lymphocytes_pct: {
    name: 'Limfocitai (%)',
    aliases: ['LYMPH%', 'Limfocitai procentais'],
    description: 'Imuninės sistemos ląstelės, atsakingos už virusinių infekcijų atpažinimą ir antikūnų gamybą.',
  },
  cbc_lymphocytes_abs: {
    name: 'Absoliutus limfocitų skaičius (ALC)',
    aliases: ['ALC', 'Limfocitai absoliutus', 'LYMPH#'],
    description: 'Bendras cirkuliuojančių limfocitų skaičius kraujyje.',
  },
  cbc_monocytes_pct: {
    name: 'Monocitai (%)',
    aliases: ['MONO%', 'Monocitai procentais'],
    description: 'Didelės fagocitinės imuninės ląstelės, kovojančios su lėtinėmis infekcijomis ir šalinančios ląstelių liekanas.',
  },
  cbc_monocytes_percent: {
    name: 'Monocitai (%)',
    aliases: ['MONO%', 'Monocitai procentais'],
    description: 'Didelės fagocitinės imuninės ląstelės, kovojančios su lėtinėmis infekcijomis.',
  },
  cbc_monocytes_abs: {
    name: 'Absoliutus monocitų skaičius',
    aliases: ['MONO#', 'Monocitai absoliutus'],
    description: 'Bendras monocitų kiekis kraujyje.',
  },
  cbc_eosinophils_pct: {
    name: 'Eozinofilai (%)',
    aliases: ['EOS%', 'Eozinofilai procentais'],
    description: 'Leukocitų rūšis, dalyvaujanti alerginėse reakcijose ir kovoje su parazitinėmis infekcijomis.',
  },
  cbc_eosinophils_abs: {
    name: 'Absoliutus eozinofilų skaičius (AEC)',
    aliases: ['AEC', 'Eozinofilai absoliutus', 'EOS#'],
    description: 'Bendras eozinofilų skaičius kraujyje.',
  },
  cbc_basophils_pct: {
    name: 'Bazofilai (%)',
    aliases: ['BASO%', 'Bazofilai procentais'],
    description: 'Mažiausia leukocitų frakcija, išskirianti histaminą ir heparinas alerginių reakcijų metu.',
  },
  cbc_basophils_abs: {
    name: 'Absoliutus bazofilų skaičius',
    aliases: ['BASO#', 'Bazofilai absoliutus'],
    description: 'Bendras bazofilų skaičius kraujyje.',
  },
  cbc_immature_granulocytes_pct: {
    name: 'Nesubrendę granuliocitai (IG %)',
    aliases: ['IG%', 'Nesubrendę granuliocitai'],
    description: 'Ankstyvos kaulų čiulpų granuliocitų formos; padidėja esant sunkiai infekcijai ar sepsiui.',
  },
  cbc_reticulocytes_pct: {
    name: 'Retikulocitai (%)',
    aliases: ['RETIC%', 'Retikulocitai procentais'],
    description: 'Jauni nesubrendę eritrocitai; rodo kaulų čiulpų eritropoezės aktyvumą.',
  },
  cbc_reticulocytes_abs: {
    name: 'Absoliutus retikulocitų skaičius',
    aliases: ['RETIC#', 'Retikulocitai absoliutus'],
    description: 'Absoliutus jaunų raudonųjų kraujo kūnelių kiekis kraujyje.',
  },
  cbc_plateletcrit: {
    name: 'Trombokritas (PCT)',
    aliases: ['PCT', 'Trombokritas'],
    description: 'Trombocitų užimama kraujo tūrio procentinė dalis.',
  },
  cbc_g6pd: {
    name: 'G6PD fermentas',
    aliases: ['G6PD', 'Gliukozės-6-fosfatdehidrogenazė'],
    description: 'Eritrocitų fermentas, apsaugantis ląsteles nuo hemolizės oksidacinio streso metu.',
  },
  cbc_osmotic_fragility: {
    name: 'Eritrocitų osmotinis atsparumas',
    aliases: ['Osmotinis atsparumas', 'Eritrocitų rezistentiškumas'],
    description: 'Eritrocitų gebėjimas atlaikyti osmosinį slėgį hipotoniniuose natrio chlorido tirpaluose.',
  },

  // Lipids & Cardiovascular
  lipid_total_cholesterol: {
    name: 'Bendras cholesterolis',
    aliases: ['Cholesterolis', 'CHOL', 'Bendras cholesterolis'],
    description: 'Bendras cirkuliuojančio cholesterolio kiekis kraujyje (apima DTL, MTL ir LMTL).',
  },
  lipid_cholesterol_total: {
    name: 'Bendras cholesterolis',
    aliases: ['Cholesterolis', 'CHOL', 'Bendras cholesterolis'],
    description: 'Bendras cirkuliuojančio cholesterolio kiekis kraujyje.',
  },
  lipid_hdl: {
    name: 'DTL cholesterolis ("gerasis")',
    aliases: ['DTL', 'HDL', 'Gerasis cholesterolis', 'Didelio tankio lipoproteinai'],
    description: 'Didelio tankio lipoproteinų cholesterolis, saugantis kraujagysles nuo aterosklerozės.',
  },
  lipid_ldl_calculated: {
    name: 'MTL cholesterolis (apskaičiuotas)',
    aliases: ['MTL', 'LDL', 'Blogasis cholesterolis', 'Mažo tankio lipoproteinai'],
    description: 'Apskaičiuotas mažo tankio lipoproteinų cholesterolis; pagrindinis aterogeninis veiksnys.',
  },
  lipid_ldl_direct: {
    name: 'MTL cholesterolis (tiesioginis)',
    aliases: ['MTL tiesioginis', 'Direct LDL', 'dLDL'],
    description: 'Tiesiogiai išmatuota mažo tankio lipoproteinų cholesterolio koncentracija.',
  },
  lipid_triglycerides: {
    name: 'Trigliceridai',
    aliases: ['TG', 'Trigliceridai', 'TRIG'],
    description: 'Pagrindinė riebalų forma kraujyje; svarbus metabolinės ir širdies-kraujagyslių ligų rizikos žymuo.',
  },
  lipid_vldl: {
    name: 'LMTL cholesterolis',
    aliases: ['LMTL', 'VLDL', 'Labai mažo tankio lipoproteinai'],
    description: 'Labai mažo tankio lipoproteinų cholesterolis, pernešantis trigliceridus organizme.',
  },
  lipid_non_hdl: {
    name: 'Ne-DTL cholesterolis',
    aliases: ['Non-HDL', 'Ne-DTL', 'Aterogeninis cholesterolis'],
    description: 'Visų aterogeninių lipoproteinų suma (bendras cholesterolis atėmus DTL).',
  },
  lipid_cholesterol_hdl_ratio: {
    name: 'Bendro cholesterolio ir DTL santykis',
    aliases: ['Chol/HDL', 'Aterogeniškumo indeksas', 'TC/HDL'],
    description: 'Klinikinis santykis širdies ir kraujagyslių ligų santykinei rizikai įvertinti.',
  },
  lipid_apob: {
    name: 'Apolipoproteinas B (ApoB)',
    aliases: ['ApoB', 'Apolipoproteinas B'],
    description: 'Pagrindinis visų aterogeninių dalelių baltymas; itin tikslus aterosklerozės rizikos rodiklis.',
  },
  lipid_apoa1: {
    name: 'Apolipoproteinas A1 (ApoA1)',
    aliases: ['ApoA1', 'Apolipoproteinas A1'],
    description: 'Pagrindinis apsauginio DTL cholesterolio baltymas.',
  },
  lipid_lpa: {
    name: 'Lipoproteinas (a) [Lp(a)]',
    aliases: ['Lp(a)', 'Lipoproteinas a', 'LPA'],
    description: 'Genetiškai nulemtas nepriklausomas ankstyvos aterosklerozės ir trombozės rizikos žymuo.',
  },
  cardio_hscrp: {
    name: 'Didelio jautrumo CRB (hs-CRB)',
    aliases: ['hs-CRB', 'hs-CRP', 'Kardiologinis CRB'],
    description: 'Didelio jautrumo C-reaktyvus baltymas lėtiniam kraujagyslių sienelių uždegimui vertinti.',
  },
  inflam_crp_hs: {
    name: 'Didelio jautrumo CRB (hs-CRB)',
    aliases: ['hs-CRB', 'hs-CRP', 'Kardiologinis CRB'],
    description: 'Didelio jautrumo C-reaktyvus baltymas lėtiniam kraujagyslių sienelių uždegimui vertinti.',
  },
  cardio_homocysteine: {
    name: 'Homocisteinas',
    aliases: ['Homocisteinas', 'HCY'],
    description: 'Aminorūgštis, kurios perteklius pažeidžia kraujagyslių endotelį ir didina krešulių riziką.',
  },
  cardio_troponin_i: {
    name: 'Troponinas I (hs-cTnI)',
    aliases: ['Troponinas I', 'cTnI', 'hs-TnI'],
    description: 'Didelio jautrumo miokardo pažeidimo baltymas, naudojamas infarkto diagnostikai.',
  },
  cardio_troponin_t: {
    name: 'Troponinas T (hs-cTnT)',
    aliases: ['Troponinas T', 'cTnT', 'hs-TnT'],
    description: 'Širdies raumens pažeidimui specifiškas baltymas.',
  },
  cardio_bnp: {
    name: 'B tipo natriuretinis peptidas (BNP)',
    aliases: ['BNP', 'Natriuretinis peptidas'],
    description: 'Širdies skilvelių išskiriamas hormonas esant skilvelių pertempimui ar nepakankamumui.',
  },
  cardio_nt_probnp: {
    name: 'NT-proBNP',
    aliases: ['NT-proBNP', 'ProBNP'],
    description: 'Širdies nepakankamumo diagnostikos ir gydymo efektyvumo sekimo rodiklis.',
  },
  cardio_ck: {
    name: 'Kreatinkinazė (CK bendra)',
    aliases: ['CK', 'Kreatinkinazė', 'CPK'],
    description: 'Raumenų ir širdies audinių fermentas, padidėjantis esant raumenų pažeidimui ar fiziniam krūviui.',
  },
  cardio_ck_mb: {
    name: 'Kreatinkinazė-MB (CK-MB)',
    aliases: ['CK-MB', 'Kreatinkinazė MB'],
    description: 'Širdies raumeniui specifiška kreatinkinazės izoforma.',
  },
  cardio_myoglobin: {
    name: 'Mioglobinas',
    aliases: ['Mioglobinas', 'Mb'],
    description: 'Greitas raumenų ir miokardo pažeidimo ankstyvas baltymas.',
  },
  cardio_mpo: {
    name: 'Mieloperoksidazė (MPO)',
    aliases: ['MPO', 'Mieloperoksidazė'],
    description: 'Kraujagyslių uždegimo ir nestabilių aterosklerotinių plokštelių žymuo.',
  },
  cardio_oxldl: {
    name: 'Oksiduotas MTL (oxLDL)',
    aliases: ['oxLDL', 'Oksiduotas MTL'],
    description: 'Oksiduota mažo tankio lipoproteinų forma, pasižyminti stipriu aterogeniškumu.',
  },
  cardio_fibrinogen_ag: {
    name: 'Fibrinogeno antigenas',
    aliases: ['Fibrinogenas AG'],
    description: 'Plazmos krešėjimo ir širdies bei kraujagyslių trombozės rizikos baltymas.',
  },

  // Metabolic & Renal
  metabolic_fasting_glucose: {
    name: 'Gliukozė nevalgius',
    aliases: ['Gliukozė', 'GLU', 'Cukrus kraujyje', 'Glikemija'],
    description: 'Cukraus koncentracija kraujyje nevalgius; pagrindinis diabeto ir angliavandenių apykaitos rodiklis.',
  },
  metabolic_glucose: {
    name: 'Gliukozė',
    aliases: ['Gliukozė', 'GLU', 'Cukrus kraujyje'],
    description: 'Gliukozės koncentracija kraujyje.',
  },
  metabolic_hba1c: {
    name: 'Glikuotas hemoglobinas (HbA1c)',
    aliases: ['HbA1c', 'Glikuotas hemoglobinas', 'A1C'],
    description: 'Vidutinio gliukozės lygio kraujyje per pastaruosius 2-3 mėnesius rodiklis.',
  },
  metabolic_estimated_avg_glucose: {
    name: 'Apskaičiuotas vidutinis gliukozės kiekis (eAG)',
    aliases: ['eAG', 'Vidutinė gliukozė'],
    description: 'Apskaičiuota vidutinė glikemija remiantis HbA1c reikšme.',
  },
  metabolic_fasting_insulin: {
    name: 'Insulinas nevalgius',
    aliases: ['Insulinas', 'INS', 'Insulinas nevalgius'],
    description: 'Kasos hormonas, reguliuojantis gliukozės pasisavinimą ląstelėse; atsparumo insulinui rodiklis.',
  },
  metabolic_c_peptide: {
    name: 'C-peptidas',
    aliases: ['C-peptidas', 'C peptide'],
    description: 'Endogeninės kasos insulino gamybos rodiklis, padedantis atskirti 1 ir 2 tipo diabetą.',
  },
  renal_bun: {
    name: 'Šlapalas (Karbamidas / BUN)',
    aliases: ['BUN', 'Šlapalas', 'Karbamidas', 'Urea'],
    description: 'Baltymų apykaitos galutinis produktas; rodo inkstų šalinimo funkciją ir baltymų skilimą.',
  },
  renal_creatinine: {
    name: 'Kreatininas serume',
    aliases: ['Kreatininas', 'CREA', 'Serum Creatinine'],
    description: 'Nuolatinis raumenų apykaitos produktas; pagrindinis inkstų filtracinės funkcijos rodiklis.',
  },
  metabolic_creatinine: {
    name: 'Kreatininas',
    aliases: ['Kreatininas', 'CREA'],
    description: 'Inkstų filtracinės funkcijos rodiklis.',
  },
  renal_egfr: {
    name: 'Apskaičiuotas GFG (eGFR)',
    aliases: ['eGFR', 'GFG', 'Glomerulų filtracijos greitis'],
    description: 'Glomerulų filtracijos greitis pagal CKD-EPI formulę, parodantis inkstų pajėgumą filtruoti kraują.',
  },
  metabolic_egfr: {
    name: 'Apskaičiuotas GFG (eGFR)',
    aliases: ['eGFR', 'GFG'],
    description: 'Glomerulų filtracijos greitis.',
  },
  renal_cystatin_c: {
    name: 'Cistatinas C',
    aliases: ['Cistatinas C', 'Cystatin C'],
    description: 'Labai jautrus inkstų filtracijos rodiklis, nepriklausomas nuo žmogaus raumenų masės ar mitybos.',
  },
  renal_bun_creatinine_ratio: {
    name: 'Šlapalo ir kreatinino santykis',
    aliases: ['BUN/Crea', 'Šlapalo/kreatinino santykis'],
    description: 'Indeksas prieinkstinio nepakankamumo (dehidratacijos) ir inkstinio pažeidimo diferencijavimui.',
  },
  metabolic_uric_acid: {
    name: 'Šlapimo rūgštis',
    aliases: ['Šlapimo rūgštis', 'Uric acid', 'URIC'],
    description: 'Purinų apykaitos produktas; padidėjusi koncentracija sukelia podagrą ir inkstų akmenligę.',
  },
  metabolic_lactate: {
    name: 'Laktatas (Pieno rūgštis)',
    aliases: ['Laktatas', 'Pieno rūgštis', 'Lactate'],
    description: 'Anaerobinio metabolizmo produktas; audinių hipoksijos, intensyvaus krūvio ar sepsio rodiklis.',
  },
  metabolic_ketones: {
    name: 'Beta-hidroksibutiratas (Ketonai)',
    aliases: ['Ketonai', 'Beta-hidroksibutiratas', 'BOHB'],
    description: 'Pagrindinis kraujo ketoninis kūnas; padidėja badaujant, ketogeninės dietos metu ar esant ketoacidozei.',
  },
  metabolic_microalbumin_urine: {
    name: 'Mikroalbuminas / kreatininas šlapime',
    aliases: ['ACR', 'Mikroalbuminas', 'Albuminas/kreatininas šlapime'],
    description: 'Ankstyviausias diabetinio ir hipertenzinio inkstų pažeidimo rodiklis.',
  },
  metabolic_fructosamine: {
    name: 'Fruktozaminas',
    aliases: ['Fruktozaminas'],
    description: 'Glikuoti kraujo baltymai; atspindi vidutinę glikemiją per pastarąsias 2-3 savaites.',
  },
  metabolic_adiponectin: {
    name: 'Adiponektinas',
    aliases: ['Adiponektinas'],
    description: 'Apsauginis riebalinio audinio hormonas, didinantis jautrumą insulinui ir slopinantis aterogenezę.',
  },
  metabolic_leptin: {
    name: 'Leptinas',
    aliases: ['Leptinas'],
    description: 'Riebalinio audinio hormonas, reguliuojantis apetitą, sotumo jausmą ir energijos apykaitą.',
  },
  metabolic_glucagon: {
    name: 'Gliukagonas',
    aliases: ['Gliukagonas'],
    description: 'Kasos alfa ląstelių hormonas, skatinantis gliukozės išsiskyrimą iš kepenų į kraują.',
  },
  metabolic_homa_ir: {
    name: 'HOMA-IR indeksas',
    aliases: ['HOMA-IR', 'Atsparumo insulinui indeksas'],
    description: 'Homeostatinis atsparumo insulinui modelis, apskaičiuojamas iš gliukozės ir insulino nevalgius.',
  },
  metabolic_proinsulin: {
    name: 'Proinsulinas',
    aliases: ['Proinsulinas'],
    description: 'Insulino pirmtakas; padidėjęs kiekis žymi kasos beta ląstelių disfunkciją.',
  },
  creatinine_clearance: {
    name: 'Kreatinino klirensas (CrCl)',
    aliases: ['CrCl', 'Kreatinino klirensas'],
    description: 'Tikrasis inkstų gebėjimas išvalyti kraują per laiko vienetą pagal paros šlapimą.',
  },
  urine_protein_24h: {
    name: 'Baltymas paros šlapime',
    aliases: ['Paros proteinurija', 'Baltymas šlapime 24h'],
    description: 'Bendras su šlapimu netenkamų baltymų kiekis per 24 valandas.',
  },

  // Electrolytes & Minerals
  electrolyte_sodium: {
    name: 'Natris (Na)',
    aliases: ['Na', 'Natris', 'Sodium'],
    description: 'Pagrindinis ekstraląstelinis katijonas, palaikantis skysčių balansą, kraujospūdį ir osmosinį slėgį.',
  },
  electrolyte_potassium: {
    name: 'Kalis (K)',
    aliases: ['K', 'Kalis', 'Potassium'],
    description: 'Svarbiausias intraląstelinis katijonas, gyvybiškai būtinas širdies ritmui ir raumenų susitraukimui.',
  },
  electrolyte_chloride: {
    name: 'Chloras (Cl)',
    aliases: ['Cl', 'Chloras', 'Chloride'],
    description: 'Pagrindinis ekstraląstelinis anijonas, kartu su natriu reguliuojantis osmosinį slėgį ir rūgščių-šarmų pusiausvyrą.',
  },
  electrolyte_bicarbonate: {
    name: 'Bikarbonatas (CO2)',
    aliases: ['CO2', 'Bikarbonatai', 'HCO3', 'Anglies dioksidas'],
    description: 'Pagrindinis kraujo buferinės sistemos komponentas organizmo pH pusiausvyrai palaikyti.',
  },
  metabolic_bicarbonate: {
    name: 'Bikarbonatas (CO2)',
    aliases: ['CO2', 'Bikarbonatai', 'HCO3'],
    description: 'Rūgščių-šarmų buferinės sistemos rodiklis.',
  },
  electrolyte_calcium: {
    name: 'Bendras kalcis (Ca)',
    aliases: ['Ca', 'Kalcis', 'Total Calcium'],
    description: 'Esminis mineralas kaulų tvirtumui, širdies ir raumenų susitraukimui bei kraujo krešėjimui.',
  },
  electrolyte_calcium_ionized: {
    name: 'Jonizuotas kalcis (Ca2+)',
    aliases: ['Ca2+', 'Jonizuotas kalcis', 'Laisvas kalcis'],
    description: 'Biologiškai aktyvi, nesurišta kalcio dalis kraujyje.',
  },
  electrolyte_phosphate: {
    name: 'Fosforas (Fosfatai / PO4)',
    aliases: ['PO4', 'Fosforas', 'Fosfatai', 'Phosphorus'],
    description: 'Mineralas, būtinas kaulų struktūrai, ląstelių membranoms ir energijos (ATP) apykaitai.',
  },
  electrolyte_magnesium: {
    name: 'Magnis (Mg)',
    aliases: ['Mg', 'Magnis', 'Magnesium'],
    description: 'Gyvybiškai svarbus mineralas šimtams fermentinių reakcijų, nervų sistemai ir raumenų atsipalaidavimui.',
  },
  electrolyte_anion_gap: {
    name: 'Anijoninis tarpas',
    aliases: ['Anion Gap', 'Anijonų skirtumas'],
    description: 'Apskaičiuotas katijonų ir anijonų skirtumas metabolinės acidozės priežastims nustatyti.',
  },
  electrolyte_osmolality: {
    name: 'Kraujo osmoliariškumas',
    aliases: ['Osmolality', 'Osmoliariškumas'],
    description: 'Ištirpusių dalelių koncentracija kraujo serume; atspindi vandens ir elektrolitų balansą.',
  },

  // Liver & Enzymes
  liver_alt: {
    name: 'ALT (Alaninaminotransferazė)',
    aliases: ['ALT', 'SGPT', 'Alaninaminotransferazė'],
    description: 'Kepenų ląstelių fermentas; padidėjimas rodo hepatocitų pažeidimą ar uždegimą.',
  },
  liver_ast: {
    name: 'AST (Aspartataminotransferazė)',
    aliases: ['AST', 'SGOT', 'Aspartataminotransferazė'],
    description: 'Fermentas, esantis kepenyse, širdyje ir griaučių raumenyse; pažeidimo rodiklis.',
  },
  liver_alp: {
    name: 'Šarminė fosfatazė (ALP)',
    aliases: ['ALP', 'ŠF', 'Šarminė fosfatazė'],
    description: 'Tulžies latakų ir kaulų apykaitos fermentas; padidėja esant tulžies sąstoviui ar kaulų ligoms.',
  },
  liver_ggt: {
    name: 'GGT (Gama gliutamiltransferazė)',
    aliases: ['GGT', 'Gama GT', 'GGTP'],
    description: 'Labai jautrus tulžies nutekėjimo sutrikimų (cholestazės) ir alkoholio ar vaistų poveikio kepenims rodiklis.',
  },
  liver_total_bilirubin: {
    name: 'Bendras bilirubinas',
    aliases: ['BIL', 'Bilirubinas bendras', 'Total Bilirubin'],
    description: 'Hemoglobino skilimo produktas; padidėjimas sukelia geltą.',
  },
  liver_bilirubin_total: {
    name: 'Bendras bilirubinas',
    aliases: ['BIL', 'Bilirubinas bendras'],
    description: 'Hemoglobino skilimo produktas kepenų funkcijai ir geltai tirti.',
  },
  liver_direct_bilirubin: {
    name: 'Tiesioginis bilirubinas (konjuguotas)',
    aliases: ['DBIL', 'Tiesioginis bilirubinas', 'Konjuguotas bilirubinas'],
    description: 'Kepenų apdorota tirpi bilirubino forma; padidėja esant tulžies latakų obstrukcijai.',
  },
  liver_indirect_bilirubin: {
    name: 'Netiesioginis bilirubinas (nekonjuguotas)',
    aliases: ['IBIL', 'Netiesioginis bilirubinas'],
    description: 'Nekonjuguotas bilirubinas kraujyje; padidėja esant hemolizei ar Gilberto sindromui.',
  },
  liver_total_protein: {
    name: 'Bendras baltymas',
    aliases: ['TP', 'Bendras baltymas', 'Total Protein'],
    description: 'Bendra visų kraujo plazmos baltymų (albuminų ir globulinų) koncentracija.',
  },
  liver_albumin: {
    name: 'Albuminas serume',
    aliases: ['ALB', 'Albuminas', 'Serum Albumin'],
    description: 'Pagrindinis kepenyse sintetinamas kraujo baltymas, palaikantis onkotinį slėgį ir pernešantis molekules.',
  },
  liver_globulin: {
    name: 'Globulinai',
    aliases: ['Globulinai', 'GLOB'],
    description: 'Baltymai, apimantys antikūnus, krešėjimo faktorius ir fermentus.',
  },
  liver_ag_ratio: {
    name: 'Albumino ir globulino santykis (A/G)',
    aliases: ['A/G santykis', 'A/G ratio', 'AG Ratio'],
    description: 'Santykinis baltymų frakcijų balansas kepenų sintezei ir lėtiniam uždegimui vertinti.',
  },
  liver_fib4_index: {
    name: 'FIB-4 indeksas (Kepenų fibrozė)',
    aliases: ['FIB-4', 'FIB4', 'Fibrozės indeksas'],
    description: 'Neinvazinis kepenų audinio fibrozės ir suriebėjimo rizikos vertinimo rodiklis.',
  },
  liver_ldh: {
    name: 'Laktatdehidrogenazė (LDH)',
    aliases: ['LDH', 'Laktatdehidrogenazė'],
    description: 'Ląstelių fermentas; padidėja esant audinių pažeidimui, hemolizei ar piktybiniams procesams.',
  },
  liver_amylase: {
    name: 'Amilazė serume',
    aliases: ['Amilazė', 'AMY', 'Kasos amilazė'],
    description: 'Kasos fermentas angliavandenių skaidymui; staigus padidėjimas būdingas ūminiam pankreatitui.',
  },
  liver_lipase: {
    name: 'Lipazė serume',
    aliases: ['Lipazė', 'LIP', 'Kasos lipazė'],
    description: 'Labai specifiškas kasos fermentas riebalams skaidyti, pagrindinis pankreatito rodiklis.',
  },
  liver_cholinesterase: {
    name: 'Pseudocholinesterazė (BChE)',
    aliases: ['Cholinesterazė', 'BChE'],
    description: 'Kepenų sintezės pajėgumo rodiklis ir jautrumo raumenų relaksantams žymuo.',
  },
  bile_acids: {
    name: 'Tulžies rūgštys',
    aliases: ['Tulžies rūgštys', 'Bile Acids'],
    description: 'Kepenyse iš cholesterolio sintetinamos rūgštys; nėščiųjų cholestazės diagnostika.',
  },
  ammonia: {
    name: 'Amoniakas kraujyje',
    aliases: ['Amoniakas', 'NH3'],
    description: 'Baltymų skilimo toksinis produktas; kepenų detoksikacinės funkcijos rodiklis.',
  },

  // Thyroid & Endocrine
  thyroid_tsh: {
    name: 'Tirotropinas (TTH / TSH)',
    aliases: ['TTH', 'TSH', 'Tirotropinis hormonas'],
    description: 'Hipofizės hormonas, reguliuojantis skydliaukės veiklą; pagrindinis skydliaukės būklės tyrimas.',
  },
  thyroid_free_t4: {
    name: 'Laisvas tiroksinas (LT4 / FT4)',
    aliases: ['LT4', 'FT4', 'Laisvas T4'],
    description: 'Pagrindinis aktyvus skydliaukės hormonas kraujyje.',
  },
  thyroid_total_t4: {
    name: 'Bendras tiroksinas (T4)',
    aliases: ['T4', 'Bendras T4'],
    description: 'Bendras tiroksino hormono kiekis kraujo serume.',
  },
  thyroid_free_t3: {
    name: 'Laisvas trijodtironinas (LT3 / FT3)',
    aliases: ['LT3', 'FT3', 'Laisvas T3'],
    description: 'Biologiškai aktyviausia skydliaukės hormono forma ląstelių metabolizmui skatinti.',
  },
  thyroid_total_t3: {
    name: 'Bendras trijodtironinas (T3)',
    aliases: ['T3', 'Bendras T3'],
    description: 'Bendras trijodtironino kiekis kraujyje.',
  },
  thyroid_reverse_t3: {
    name: 'Atvirkštinis T3 (rT3)',
    aliases: ['rT3', 'Reverse T3'],
    description: 'Neaktyvus T4 metabolizmo šalutinis produktas esant lėtinėms ligoms ar stipriam stresui.',
  },
  thyroid_tpo_ab: {
    name: 'Anti-TPO (Skydliaukės peroksidazės antikūnai)',
    aliases: ['Anti-TPO', 'ATPO', 'TPO antikūnai'],
    description: 'Antikūnai prieš skydliaukės fermentą peroksidazę; žymi Hašimoto autoimuninį tiroiditą.',
  },
  thyroid_tg_ab: {
    name: 'Anti-Tg (Tiroglobulino antikūnai)',
    aliases: ['Anti-Tg', 'ATG', 'Tiroglobulino antikūnai'],
    description: 'Autoantikūnai prieš tiroglobuliną skydliaukės autoimuninėms ligoms nustatyti.',
  },
  thyroid_thyroglobulin: {
    name: 'Tiroglobulinas (Tg)',
    aliases: ['Tiroglobulinas', 'Tg'],
    description: 'Skydliaukės audinio baltymas; stebimas po skydliaukės vėžio pašalinimo operacijų.',
  },
  endocrine_cortisol_am: {
    name: 'Kortizolis (rytinis)',
    aliases: ['Kortizolis', 'Kortizolis iš ryto', 'AM Cortisol'],
    description: 'Pagrindinis antinksčių streso hormonas; reguliuoja gliukozę, kraujospūdį ir uždegimą.',
  },
  endocrine_cortisol_pm: {
    name: 'Kortizolis (vakarinis)',
    aliases: ['Kortizolis vakare', 'PM Cortisol'],
    description: 'Vakarinis kortizolio lygis paros cirkadiniam ritmui įvertinti.',
  },
  endocrine_acth: {
    name: 'AKTH (Adrenokortikotropinis hormonas)',
    aliases: ['AKTH', 'ACTH'],
    description: 'Hipofizės priekinės dalies hormonas, stimuliuojantis antinksčių žievę gaminti kortizolį.',
  },
  endocrine_pth: {
    name: 'Parathormonas (PTH)',
    aliases: ['PTH', 'Parathormonas'],
    description: 'Prieskydinių liaukų hormonas, palaikantis pastovų kalcio ir fosforo lygį kraujyje.',
  },
  endocrine_igf1: {
    name: 'IGF-1 (Augimo faktorius 1)',
    aliases: ['IGF-1', 'Somatomedinas C'],
    description: 'Kepenyse gaminamas baltymas pagal augimo hormono stimulus; atspindi audinių anabolizmą.',
  },
  endocrine_prolactin: {
    name: 'Prolaktinas',
    aliases: ['Prolaktinas', 'PRL'],
    description: 'Hipofizės hormonas laktacijai, reprodukcinei funkcijai ir elgsenai reguliuoti.',
  },
  growth_hormone: {
    name: 'Augimo hormonas (GH / STH)',
    aliases: ['GH', 'STH', 'Somatotropinas'],
    description: 'Hipofizės hormonas, skatinantis augimą, ląstelių atsinaujinimą ir metabolizmą.',
  },
  aldosterone: {
    name: 'Aldosteronas',
    aliases: ['Aldosteronas'],
    description: 'Antinksčių žievės mineralokortikoidas, reguliuojantis natrio, kalio ir vandens pusiausvyrą.',
  },
  plasma_renin: {
    name: 'Plazmos renino aktyvumas (PRA)',
    aliases: ['Reninas', 'PRA'],
    description: 'Inkstų fermentas reninas arterinio kraujospūdžio ir skysčių tūrio kontrolei.',
  },
  calcitonin: {
    name: 'Kalcitoninas',
    aliases: ['Kalcitoninas'],
    description: 'Skydliaukės C ląstelių hormonas; medulinio skydliaukės vėžio navikinis žymuo.',
  },
  gastrin: {
    name: 'Gastrinas serume',
    aliases: ['Gastrinas'],
    description: 'Skrandžio hormonas druskos rūgšties gamybai virškinimo metu skatinti.',
  },
  erythropoietin: {
    name: 'Eritropoetinas (EPO)',
    aliases: ['EPO', 'Eritropoetinas'],
    description: 'Inkstų hormonas, stimuliuojantis raudonųjų kraujo kūnelių gamybą kaulų čiulpuose.',
  },
  endocrine_metanephrines: {
    name: 'Metanefrinai plazmoje',
    aliases: ['Metanefrinai'],
    description: 'Adrenalino skilimo metabolitai feochromocitomai nustatyti.',
  },
  endocrine_normetanephrine: {
    name: 'Normetanefrinas plazmoje',
    aliases: ['Normetanefrinas'],
    description: 'Noradrenalino metabolizmo produktas antinksčių navikams tirti.',
  },
  endocrine_chromogranin_a: {
    name: 'Chromograninas A (CgA)',
    aliases: ['Chromograninas A', 'CgA'],
    description: 'Neuroendokrininių ląstelių baltymas; neuroendokrininių navikų žymuo.',
  },

  // Hormones & Reproductive
  hormone_total_testosterone: {
    name: 'Bendras testosteronas',
    aliases: ['Testosteronas', 'TEST', 'Total Testosterone'],
    description: 'Pagrindinis vyriškas lytinis hormonas (androgenas), atsakingas už raumenų masę, libido ir kaulų tankį.',
  },
  hormone_testosterone_total: {
    name: 'Bendras testosteronas',
    aliases: ['Testosteronas', 'TEST'],
    description: 'Vyriškas lytinis hormonas raumenų masei, kaulų tvirtumui ir energijai.',
  },
  hormone_free_testosterone: {
    name: 'Laisvas testosteronas',
    aliases: ['Laisvas testosteronas', 'Free Testosterone', 'FT'],
    description: 'Biologiškai aktyvi, baltymais nesurišta testosterono dalis, tiesiogiai veikianti audinius.',
  },
  hormone_shbg: {
    name: 'Lytinius hormonus rišantis globulinas (SHBG)',
    aliases: ['SHBG', 'LHRG'],
    description: 'Baltymas, reguliuojantis laisvųjų testosterono ir estrogenų kiekį kraujyje.',
  },
  hormone_estradiol: {
    name: 'Estradiolis (E2)',
    aliases: ['Estradiolis', 'E2'],
    description: 'Pagrindinis moteriškas estrogenas, reguliuojantis menstruacinį ciklą, kaulų tankį ir kraujagyslių sveikatą.',
  },
  hormone_progesterone: {
    name: 'Progesteronas',
    aliases: ['Progesteronas', 'PRG'],
    description: 'Hormonas, būtinas gimdos gleivinės pasiruošimui nėštumui ir jo palaikymui.',
  },
  hormone_dhea_s: {
    name: 'DHEA-S (Dehidroepiandrosterono sulfatas)',
    aliases: ['DHEA-S', 'DHEAS'],
    description: 'Antinksčių gaminamas androgenų pirmtakas, svarbus energijai, imunitetui ir senėjimo procesams.',
  },
  hormone_lh: {
    name: 'Liuteinizuojantis hormonas (LH)',
    aliases: ['LH', 'Liuteinizuojantis hormonas'],
    description: 'Hipofizės hormonas, skatinantis ovuliaciją moterims ir testosterono gamybą vyrams.',
  },
  hormone_fsh: {
    name: 'Folikulus stimuliuojantis hormonas (FSH)',
    aliases: ['FSH', 'Folikulotropinas'],
    description: 'Hormonas, reguliuojantis kiaušidžių folikulų augimą moterims ir spermatozoidų gamybą vyrams.',
  },
  hormone_dht: {
    name: 'Dihidrotestosteronas (DHT)',
    aliases: ['DHT', 'Dihidrotestosteronas'],
    description: 'Galingiausias aktyvus androgenas prostatai, plaukų folikulams ir vyriškiems lytiniams požymiams.',
  },
  hormone_amh: {
    name: 'Anti-Miulerio hormonas (AMH)',
    aliases: ['AMH', 'Anti-Mullerian'],
    description: 'Tikslus kiaušidžių folikulų atsargų (kiaušialąsčių rezervo) rodiklis moters vaisingumui tirti.',
  },
  prostate_specific_antigen: {
    name: 'PSA (Prostatos specifinis antigenas)',
    aliases: ['PSA', 'Bendras PSA'],
    description: 'Priešinės liaukos gaminamas baltymas prostatos ligoms (hiperplazijai, uždegimui, vėžiui) nustatyti.',
  },
  free_psa: {
    name: 'Laisvas PSA',
    aliases: ['FPSA', 'Laisvas PSA'],
    description: 'Laisvoji PSA frakcija; santykis su bendru PSA padeda patikslinti prostatos vėžio riziką.',
  },
  hcg_total: {
    name: 'HCG (Chorioninis gonadotropinas)',
    aliases: ['HCG', 'hCG', 'Nėštumo hormonas'],
    description: 'Nėštumo metu placentos gaminamas hormonas; taip pat germinacinių navikų žymuo.',
  },
  estrone: {
    name: 'Estronas (E1)',
    aliases: ['Estronas', 'E1'],
    description: 'Estrogeno forma, vyraujanti po menopauzės ir sintetinama riebaliniame audinyje.',
  },
  estriol: {
    name: 'Estriolis (E3)',
    aliases: ['Estriolis', 'E3'],
    description: 'Estrogenas, gausiai sintetinamas placentos nėštumo metu.',
  },
  '17_hydroxyprogesterone': {
    name: '17-hidroksiprogesteronas (17-OHP)',
    aliases: ['17-OHP', '17-hidroksiprogesteronas'],
    description: 'Antinksčių steroidogenezės tarpinis produktas įgimtai antinksčių hiperplazijai tirti.',
  },
  androstenedione: {
    name: 'Androstenedionas',
    aliases: ['Androstenedionas'],
    description: 'Tarpinis steroidas, iš kurio gaminamas testosteronas ir estrogenai.',
  },

  // Vitamins & Nutrition
  vitamin_d_25oh: {
    name: 'Vitaminas D (25-OH)',
    aliases: ['Vitaminas D', '25-OH-D', 'Vit D', 'Kalcidiolis'],
    description: 'Pagrindinė organizmo vitamino D atsargų forma; esminis kaulams, imunitetui ir ląstelių veiklai.',
  },
  vit_d_25_hydroxy: {
    name: 'Vitaminas D (25-OH)',
    aliases: ['Vitaminas D', '25-OH-D'],
    description: 'Organizmo vitamino D atsargų rodiklis kaulams ir imunitetui.',
  },
  vitamin_b12: {
    name: 'Vitaminas B12 (Kobalaminas)',
    aliases: ['Vitaminas B12', 'B12', 'Kobalaminas'],
    description: 'Vandenyje tirpus vitaminas, būtinas DNR sintezei, kraujodarai ir nervų skaidulų mielinizacijai.',
  },
  vit_b12: {
    name: 'Vitaminas B12',
    aliases: ['Vitaminas B12', 'B12'],
    description: 'Būtinas vitaminas kraujodarai ir nervų sistemai.',
  },
  vitamin_folate_serum: {
    name: 'Folio rūgštis (Vitaminas B9)',
    aliases: ['Folio rūgštis', 'Folatai', 'Vitaminas B9'],
    description: 'Vitaminas, reikalingas raudonųjų kraujo kūnelių gamybai ir vaisiaus vystymuisi.',
  },
  vitamin_folate_rbc: {
    name: 'Folatai eritrocituose',
    aliases: ['RBC Folate', 'Eritrocitų folatai'],
    description: 'Ilgalaikių organizmo folatų atsargų rodiklis per pastaruosius mėnesius.',
  },
  vitamin_a: {
    name: 'Vitaminas A (Retinolis)',
    aliases: ['Vitaminas A', 'Retinolis'],
    description: 'Riebaluose tirpus vitaminas regėjimui, odai ir imuninės sistemos barjerams.',
  },
  vitamin_c: {
    name: 'Vitaminas C (Askorbo rūgštis)',
    aliases: ['Vitaminas C', 'Askorbo rūgštis'],
    description: 'Galingas antioksidantas, stiprinantis kraujagyslių sieneles ir dalyvaujantis kolageno sintezėje.',
  },
  vitamin_e: {
    name: 'Vitaminas E (Alfa-tokoferolis)',
    aliases: ['Vitaminas E', 'Tokoferolis'],
    description: 'Riebaluose tirpus antioksidantas, saugantis ląstelių membranas nuo laisvųjų radikalų.',
  },
  nutrition_coq10: {
    name: 'Kofermentas Q10 (Ubichinonas)',
    aliases: ['Kofermentas Q10', 'CoQ10', 'Ubichinonas'],
    description: 'Ląstelių mitochondrijų komponentas energijos gamybai (ATP) ir širdies raumens apsaugai.',
  },
  vitamin_b1: {
    name: 'Tiaminas (Vitaminas B1)',
    aliases: ['Vitaminas B1', 'Tiaminas'],
    description: 'Būtinas angliavandenių apykaitai ir normaliai nervų bei širdies funkcijai.',
  },
  vitamin_b2: {
    name: 'Riboflavinas (Vitaminas B2)',
    aliases: ['Vitaminas B2', 'Riboflavinas'],
    description: 'Ląstelių kvėpavimo ir energijos apykaitos kofermentas.',
  },
  vitamin_b6: {
    name: 'Piridoksal-5-fosfatas (Vitaminas B6)',
    aliases: ['Vitaminas B6', 'Piridoksinas', 'P5P'],
    description: 'Būtinas aminorūgščių skaidymui, neuromediatorių sintezei ir imuninei funkcijai.',
  },
  vitamin_b3: {
    name: 'Niacinas (Vitaminas B3)',
    aliases: ['Vitaminas B3', 'Niacinas', 'Nikotino rūgštis'],
    description: 'Dalyvauja lipidų apykaitoje ir ląstelių energijos generavime.',
  },
  vitamin_b5: {
    name: 'Pantoteno rūgštis (Vitaminas B5)',
    aliases: ['Vitaminas B5', 'Pantoteno rūgštis'],
    description: 'Kofermento A komponentas riebalų ir angliavandenių apykaitai.',
  },
  biotin: {
    name: 'Biotinas (Vitaminas B7)',
    aliases: ['Biotinas', 'Vitaminas B7', 'Vitaminas H'],
    description: 'Vitaminas sveikai odai, plaukams, nagams ir riebalų rūgščių sintezei.',
  },
  vitamin_k1: {
    name: 'Filochinonas (Vitaminas K1)',
    aliases: ['Vitaminas K1', 'Filochinonas'],
    description: 'Būtinas kraujo krešėjimo faktorių sintezei kepenyse ir kaulų mineralizacijai.',
  },
  methylmalonic_acid: {
    name: 'Metilmaloninė rūgštis (MMA)',
    aliases: ['MMA', 'Metilmaloninė rūgštis'],
    description: 'Jautriausias funkcinio ląstelinio vitamino B12 trūkumo žymuo.',
  },
  vitamin_calcitriol: {
    name: 'Kalcitriolis (1,25-dihidroksi Vit D)',
    aliases: ['Kalcitriolis', '1,25-(OH)2-D'],
    description: 'Aktyvioji hormoniškai veikianti vitamino D forma kalcio pasisavinimui žarnyne.',
  },

  // Iron & Anemia
  iron_serum_iron: {
    name: 'Geležis serume',
    aliases: ['Fe', 'Geležis', 'Serum Iron'],
    description: 'Kraujo serume cirkuliuojančios laisvos geležies koncentracija.',
  },
  iron_ferritin: {
    name: 'Feritinas serume',
    aliases: ['Feritinas', 'FERR', 'Geležies atsargos'],
    description: 'Pagrindinis organizmo geležies atsargų baltymas; ankstyviausias geležies stokos rodiklis.',
  },
  iron_tibc: {
    name: 'Bendra geležies surišimo talpa (BGST)',
    aliases: ['BGST', 'TIBC', 'Geležies surišimo talpa'],
    description: 'Maksimalus geležies kiekis, kurį geba prisijungti kraujo transferinas.',
  },
  iron_transferrin_sat: {
    name: 'Transferino įsotinimas (%)',
    aliases: ['Transferino įsotinimas', 'TSAT', 'Transferrin Saturation'],
    description: 'Geležimi užpildytų transferino surišimo vietų procentas.',
  },
  iron_transferrin: {
    name: 'Transferinas',
    aliases: ['Transferinas', 'TRF'],
    description: 'Pagrindinis kraujo plazmos baltymas, pernešantis geležį į kaulų čiulpus ir audinius.',
  },
  iron_stfr: {
    name: 'Tirpūs transferino receptoriai (sTfR)',
    aliases: ['sTfR', 'Transferino receptoriai'],
    description: 'Ląstelinio geležies trūkumo rodiklis, nepriklausomas nuo organizme vykstančio uždegimo.',
  },
  iron_zpp: {
    name: 'Cinko protoporfirinas (ZPP)',
    aliases: ['ZPP', 'Cinko protoporfirinas'],
    description: 'Žymuo, rodantis nepakankamą geležies tiekimą hemoglobino sintezei kaulų čiulpuose.',
  },
  iron_hepcidin: {
    name: 'Hepcidinas',
    aliases: ['Hepcidinas'],
    description: 'Kepenyse gaminamas hormonas, pagrindinis sisteminis geležies pasisavinimo reguliatorius.',
  },
  iron_haptoglobin: {
    name: 'Haptoglobinas',
    aliases: ['Haptoglobinas'],
    description: 'Baltymas, rišantis laisvą hemoglobiną; staigus sumažėjimas rodo hemolizinę anemiją.',
  },
  iron_hemopexin: {
    name: 'Hemopeksinas',
    aliases: ['Hemopeksinas'],
    description: 'Apsauginis kraujo baltymas, rišantis laisvą hemą po eritrocitų suirimo.',
  },

  // Inflammation & Immunology
  inflam_crp: {
    name: 'C-reaktyvus baltymas (CRB)',
    aliases: ['CRB', 'CRP', 'C-reaktyvus baltymas'],
    description: 'Pagrindinis ūminės fazės uždegimo, bakterinės infekcijos ir audinių pažeidimo baltymas.',
  },
  inflam_esr: {
    name: 'Eritrocitų nusėdimo greitis (ENG / ESR)',
    aliases: ['ENG', 'ESR', 'Nusėdimo greitis'],
    description: 'Nespecifinis lėtinio uždegimo, autoimuninių ligų ir infekcijų eigos rodiklis.',
  },
  inflam_rf: {
    name: 'Reumatoidinis faktorius (RF)',
    aliases: ['RF', 'Reumatoidinis faktorius'],
    description: 'Autoantikūnai prieš savus imunoglobulinus reumatoidinio artrito diagnostikai.',
  },
  inflam_ana: {
    name: 'Antibruoliniai antikūnai (ANA)',
    aliases: ['ANA', 'Antinukleariniai antikūnai'],
    description: 'Atrankinis autoantikūnų tyrimas sisteminėms autoimuninėms jungiamojo audinio ligoms.',
  },
  inflam_igg: {
    name: 'Imunoglobulinas G (IgG)',
    aliases: ['IgG', 'Imunoglobulinas G'],
    description: 'Gausiausia antikūnų klasė kraujyje, užtikrinanti ilgalaikį humoralinį imunitetą.',
  },
  inflam_iga: {
    name: 'Imunoglobulinas A (IgA)',
    aliases: ['IgA', 'Imunoglobulinas A'],
    description: 'Gleivinių (kvėpavimo takų, virškinamojo trakto) apsauginis antikūnas.',
  },
  inflam_igm: {
    name: 'Imunoglobulinas M (IgM)',
    aliases: ['IgM', 'Imunoglobulinas M'],
    description: 'Pirmieji antikūnai, atsirandantys kraujyje pradinėje ūminės infekcijos stadijoje.',
  },
  inflam_ige: {
    name: 'Imunoglobulinas E (IgE bendras)',
    aliases: ['IgE', 'Bendras IgE'],
    description: 'Antikūnai, lemiantys alergines reakcijas ir dalyvaujantys kovoje su parazitais.',
  },
  inflam_complement_c3: {
    name: 'Komplemento komponentas C3',
    aliases: ['C3', 'Komplementas C3'],
    description: 'Imuninės sistemos komplemento kaskados baltymas imuniniams kompleksams šalinti.',
  },
  inflam_complement_c4: {
    name: 'Komplemento komponentas C4',
    aliases: ['C4', 'Komplementas C4'],
    description: 'Klasikinio komplemento kelio baltymas autoimuninių ligų aktyvumui stebėti.',
  },
  anti_ccp: {
    name: 'Anti-CCP (Citrulinuoto peptido antikūnai)',
    aliases: ['Anti-CCP', 'ACPA', 'Ciklinio citrulino antikūnai'],
    description: 'Labai specifiškas ankstyvo reumatoidinio artrito diagnostinis žymuo.',
  },
  anti_dsdna: {
    name: 'Anti-dsDNA antikūnai',
    aliases: ['Anti-dsDNA', 'dsDNA'],
    description: 'Specifiški antikūnai prieš dvigrandę DNR sisteminei raudonajai vilkligei (SRV) diagnozuoti.',
  },
  anti_smith: {
    name: 'Anti-Smith antikūnai (Anti-Sm)',
    aliases: ['Anti-Sm', 'Smith antikūnai'],
    description: 'Labai specifiškas sisteminės raudonosios vilkligės autoantikūnas.',
  },
  anti_ssa_ro: {
    name: 'Anti-SSA (Ro) antikūnai',
    aliases: ['Anti-SSA', 'Anti-Ro', 'SSA/Ro'],
    description: 'Sjogreno sindromo ir vilkligės autoimuniniai antikūnai.',
  },
  anti_ssb_la: {
    name: 'Anti-SSB (La) antikūnai',
    aliases: ['Anti-SSB', 'Anti-La', 'SSB/La'],
    description: 'Sjogreno sindromui būdingi antikūnai.',
  },
  tissue_transglutaminase_iga: {
    name: 'Anti-tTG IgA (Transgliutaminazės antikūnai)',
    aliases: ['Anti-tTG', 'tTG-IgA', 'Celiakijos antikūnai'],
    description: 'Auksinis standartas celiakijos (gliuteno netoleravimo) kraujo diagnostikai.',
  },
  deamidated_gliadin_iga: {
    name: 'Deamidinto gliadino peptidų IgA (DGP)',
    aliases: ['DGP-IgA', 'Anti-DGP'],
    description: 'Jautrus celiakijos tyrimas, ypač tinkamas mažiems vaikams.',
  },
  hLAB27: {
    name: 'HLA-B27 antigenas',
    aliases: ['HLA-B27', 'HLAB27'],
    description: 'Genetinis žymuo ankilozinio spondilito (Bechterevo ligos) rizikai vertinti.',
  },
  mpo_anca: {
    name: 'p-ANCA / MPO antikūnai',
    aliases: ['p-ANCA', 'MPO-ANCA'],
    description: 'Antineutrofiliniai citoplazminiai antikūnai sisteminiams vaskulitams diagnozuoti.',
  },
  pr3_anca: {
    name: 'c-ANCA / PR3 antikūnai',
    aliases: ['c-ANCA', 'PR3-ANCA'],
    description: 'Antikūnai prieš proteinazę 3 granuliomatozei su poliangitu (Vegenerio) tirti.',
  },

  // Coagulation
  coag_pt: {
    name: 'Protrombino laikas (SPA / PT)',
    aliases: ['SPA', 'PT', 'Protrombino laikas', 'Protrombinas'],
    description: 'Išorinio kraujo krešėjimo kelio tyrimas kepenų sintezei ir krešėjimui vertinti.',
  },
  coag_inr: {
    name: 'Tarptautinis normalizuotas santykis (INR)',
    aliases: ['INR', 'TNS', 'Protrombino indeksas'],
    description: 'Standartizuotas protrombino laiko rodiklis geriamųjų antikoaguliantų (varfarino) dozei parinkti.',
  },
  coag_aptt: {
    name: 'ADTL (Aktyvintas dalinis tromboplastino laikas)',
    aliases: ['ADTL', 'aPTT', 'APTT'],
    description: 'Vidinio kraujo krešėjimo kelio tyrimas ir heparino terapijos efektyvumo sekimas.',
  },
  coag_fibrinogen: {
    name: 'Fibrinogenas',
    aliases: ['Fibrinogenas', 'FIB', 'I krešėjimo faktorius'],
    description: 'Pagrindinis krešėjimo baltymas, virstantis fibrino tinklu krešulio susidarymo metu.',
  },
  coag_d_dimer: {
    name: 'D-Dimerai',
    aliases: ['D-Dimerai', 'D-Dimer', 'D dimerai'],
    description: 'Fibrino skilimo produktas; neigiamas rezultatas padeda patikimai atmesti giliųjų venų trombozę ir plaučių emboliją.',
  },
  antithrombin_iii: {
    name: 'Antitrombinas III',
    aliases: ['Antitrombinas', 'ATIII'],
    description: 'Pagrindinis natūralus organizmo krešėjimo inhibitorius; trūkumas didina trombozės riziką.',
  },
  protein_c: {
    name: 'Baltymas C (Protein C)',
    aliases: ['Baltymas C', 'Protein C'],
    description: 'Nuo vitamino K priklausomas natūralus antikoaguliantas.',
  },
  protein_s: {
    name: 'Baltymas S (Protein S)',
    aliases: ['Baltymas S', 'Protein S'],
    description: 'Baltymo C kofaktorius kraujo krešėjimo slopinimui.',
  },
  factor_v_leiden: {
    name: 'V faktoriaus Leideno mutacija',
    aliases: ['Leideno faktorius', 'Factor V Leiden'],
    description: 'Genetinis polinkis į venines trombozes (atsparumas aktyvuotam baltymui C).',
  },
  lupus_anticoagulant: {
    name: 'Vilkligės antikoaguliantas (dRVVT)',
    aliases: ['Vilkligės antikoaguliantas', 'Lupus Anticoagulant'],
    description: 'Antifosfolipidinių antikūnų tyrimas trombozėms ir pasikartojantiems persileidimams tirti.',
  },

  // Trace Elements & Heavy Metals
  trace_zinc: {
    name: 'Cinkas (Zn)',
    aliases: ['Zn', 'Cinkas', 'Zinc'],
    description: 'Būtinas mikroelementas imunitetui, odos ir žaizdų gijimui bei lytinei funkcijai.',
  },
  trace_copper: {
    name: 'Varis (Cu)',
    aliases: ['Cu', 'Varis', 'Copper'],
    description: 'Mikroelementas, reikalingas geležies apykaitai, jungiamajam audiniui ir neuromediatoriams.',
  },
  trace_selenium: {
    name: 'Selenas (Se)',
    aliases: ['Se', 'Selenas', 'Selenium'],
    description: 'Svarbus antioksidantas skydliaukės hormonų sintezei ir imuninei sistemai.',
  },
  trace_lead: {
    name: 'Švinas kraujyje (Pb)',
    aliases: ['Pb', 'Švinas', 'Lead'],
    description: 'Toksiškas sunkusis metalas lėtiniam ar profesiniam apsinuodijimui nustatyti.',
  },
  trace_mercury: {
    name: 'Gyvsidabris kraujyje (Hg)',
    aliases: ['Hg', 'Gyvsidabris', 'Mercury'],
    description: 'Toksiškas sunkusis metalas, pažeidžiantis nervų sistemą ir inkstus.',
  },
  trace_cadmium: {
    name: 'Kadmis kraujyje (Cd)',
    aliases: ['Cd', 'Kadmis'],
    description: 'Toksiškas sunkusis metalas (dažnas rūkalių kraujyje), pažeidžiantis inkstus ir plaučius.',
  },
  trace_arsenic: {
    name: 'Arsenas kraujyje (As)',
    aliases: ['As', 'Arsenas'],
    description: 'Toksiškas metaloidas apsinuodijimui ištirti.',
  },
  trace_aluminum: {
    name: 'Aliuminis serume (Al)',
    aliases: ['Al', 'Aliuminis'],
    description: 'Toksiškas metalas; stebimas dializuojamiems pacientams ar profesinės ekspozicijos metu.',
  },
  trace_manganese: {
    name: 'Manganas kraujyje (Mn)',
    aliases: ['Mn', 'Manganas'],
    description: 'Fermentų kofaktorius kaulų vystymuisi ir antioksidacinei apsaugai.',
  },
  trace_chromium: {
    name: 'Chromas serume (Cr)',
    aliases: ['Cr', 'Chromas'],
    description: 'Mikroelementas gliukozės apykaitai; taip pat stebimas esant sąnarių protezams.',
  },
  trace_nickel: {
    name: 'Nikelis serume (Ni)',
    aliases: ['Ni', 'Nikelis'],
    description: 'Sunkusis metalas kontaktinėms alergijoms ir implantų korozijai tirti.',
  },
  trace_cobalt: {
    name: 'Kobaltas serume (Co)',
    aliases: ['Co', 'Kobaltas'],
    description: 'Vitamino B12 sudedamoji dalis; stebimas esant metaliniams sąnarių protezams.',
  },

  // Tumor & Special Markers
  cea: {
    name: 'Kancinoembrioninis antigenas (CEA)',
    aliases: ['CEA', 'Karcinoembrioninis antigenas'],
    description: 'Storosios žarnos ir kitų virškinamojo trakto organų onkologinis žymuo.',
  },
  ca_125: {
    name: 'Vėžio antigenas CA 125',
    aliases: ['CA 125', 'CA-125'],
    description: 'Kiaušidžių vėžio ir endometriozės eigos bei gydymo efektyvumo žymuo.',
  },
  ca_19_9: {
    name: 'Vėžio antigenas CA 19-9',
    aliases: ['CA 19-9', 'CA19-9'],
    description: 'Kasos, tulžies pūslės ir virškinamojo trakto navikinis žymuo.',
  },
  ca_15_3: {
    name: 'Vėžio antigenas CA 15-3',
    aliases: ['CA 15-3', 'CA15-3'],
    description: 'Krūties vėžio atkryčio ir gydymo stebėsenos žymuo.',
  },
  alpha_fetoprotein: {
    name: 'Alfa-fetoproteinas (AFP)',
    aliases: ['AFP', 'Alfa-fetoproteinas'],
    description: 'Pirminio kepenų vėžio (hepatoceliulinės karcinomos) ir sėklidžių navikų žymuo.',
  },
  beta_2_microglobulin: {
    name: 'Beta-2 mikroglobulinas (B2M)',
    aliases: ['B2M', 'Beta-2 mikroglobulinas'],
    description: 'Mielominės ligos, limfomų ir inkstų kanalėlių pažeidimo žymuo.',
  },
  blood_ph: {
    name: 'Kraujo pH',
    aliases: ['pH', 'Kraujo pH'],
    description: 'Kraujo rūgščių ir šarmų pusiausvyros rodiklis.',
  },
  pco2: {
    name: 'pCO2 (Anglies dioksido slėgis)',
    aliases: ['pCO2', 'Anglies dvideginio slėgis'],
    description: 'Ištirpusio anglies dioksido dalinis slėgis kraujyje kvėpavimo funkcijai tirti.',
  },
  po2: {
    name: 'pO2 (Deguonies dalinis slėgis)',
    aliases: ['pO2', 'Deguonies slėgis'],
    description: 'Deguonies dalinis slėgis kraujyje plaučių oksigenacijos būklei nustatyti.',
  },
  oxygen_saturation: {
    name: 'Deguonies saturacija (sO2)',
    aliases: ['sO2', 'SaO2', 'SpO2', 'Saturacija'],
    description: 'Deguonimi prisotinto hemoglobino procentinė dalis.',
  },
  carboxyhemoglobin: {
    name: 'Karboksihemoglobinas (CO-Hb)',
    aliases: ['CO-Hb', 'Karboksihemoglobinas', 'Smalkės'],
    description: 'Su smalkėmis (anglies monoksidu) susijungęs hemoglobinas apsinuodijimui vertinti.',
  },
  methemoglobin: {
    name: 'Methemoglobinas (Met-Hb)',
    aliases: ['Met-Hb', 'Methemoglobinas'],
    description: 'Oksiduota hemoglobino forma, negebanti atiduoti deguonies audiniams.',
  },
  ceruloplasmin: {
    name: 'Ceruloplazminas',
    aliases: ['Ceruloplazminas'],
    description: 'Vario pernašos baltymas Wilsono ligai diagnozuoti.',
  },
  alpha_1_antitrypsin: {
    name: 'Alfa-1 antitripsinas (AAT)',
    aliases: ['AAT', 'Alfa-1 antitripsinas'],
    description: 'Kepenis ir plaučius saugantis proteazių inhibitorius.',
  },
};
