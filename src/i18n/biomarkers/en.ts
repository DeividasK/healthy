/**
 * English Clinical Biomarker Translations
 * Names and descriptions sourced from LOINC / IFCC / international clinical standards.
 */

import type { BiomarkerTranslation } from './types';

export const biomarkersEn: Record<string, BiomarkerTranslation> = {
  // CBC & Hematology
  cbc_wbc: {
    name: 'White Blood Cell Count (WBC)',
    aliases: ['WBC', 'Leukocytes', 'White Count', 'White Blood Cells'],
    description: 'Total number of white blood cells; primary indicator of infection, inflammation, or immune disorders.',
  },
  cbc_rbc: {
    name: 'Red Blood Cell Count (RBC)',
    aliases: ['RBC', 'Erythrocytes', 'Red Count', 'Red Blood Cells'],
    description: 'Red blood cells that transport oxygen from the lungs to all body tissues.',
  },
  cbc_hemoglobin: {
    name: 'Hemoglobin (Hgb)',
    aliases: ['Hgb', 'Hb', 'Hemoglobin'],
    description: 'Iron-containing protein in red blood cells that binds and transports oxygen throughout the body.',
  },
  cbc_hematocrit: {
    name: 'Hematocrit (Hct)',
    aliases: ['Hct', 'Hematocrit', 'Ht', 'PCV'],
    description: 'The percentage of blood volume occupied by red blood cells.',
  },
  cbc_platelets: {
    name: 'Platelet Count (PLT)',
    aliases: ['PLT', 'Platelets', 'Thrombocytes'],
    description: 'Blood cells essential for clotting and stopping bleeding.',
  },
  cbc_mcv: {
    name: 'Mean Corpuscular Volume (MCV)',
    aliases: ['MCV', 'Mean Cell Volume'],
    description: 'Average size of a red blood cell; key for differentiating anemia types (microcytic, macrocytic).',
  },
  cbc_mch: {
    name: 'Mean Corpuscular Hemoglobin (MCH)',
    aliases: ['MCH', 'Mean Cell Hemoglobin'],
    description: 'Average weight of hemoglobin in a single red blood cell.',
  },
  cbc_mchc: {
    name: 'Mean Corpuscular Hemoglobin Concentration (MCHC)',
    aliases: ['MCHC', 'Mean Cell Hemoglobin Concentration'],
    description: 'Average concentration of hemoglobin within a given volume of red blood cells.',
  },
  cbc_rdw_cv: {
    name: 'Red Cell Distribution Width — CV (RDW-CV)',
    aliases: ['RDW-CV', 'RDW', 'Red Cell Anisocytosis'],
    description: 'Coefficient of variation of red cell volume; indicates variation in red blood cell size.',
  },
  cbc_rdw_sd: {
    name: 'Red Cell Distribution Width — SD (RDW-SD)',
    aliases: ['RDW-SD', 'RDW SD'],
    description: 'Width of the red cell volume distribution curve, measured in femtoliters (fL).',
  },
  cbc_mpv: {
    name: 'Mean Platelet Volume (MPV)',
    aliases: ['MPV', 'Mean Platelet Volume'],
    description: 'Average size of platelets; reflects the activity of platelet production in the bone marrow.',
  },
  cbc_neutrophils_pct: {
    name: 'Neutrophils (%)',
    aliases: ['NEUT%', 'Neutrophils Percent', 'Segmented Neutrophils'],
    description: 'The main type of white blood cell that fights bacterial infections and acute inflammation.',
  },
  cbc_neutrophils_abs: {
    name: 'Absolute Neutrophil Count (ANC)',
    aliases: ['ANC', 'Absolute Neutrophils', 'NEUT#'],
    description: 'Total number of neutrophils per unit of blood volume.',
  },
  cbc_lymphocytes_pct: {
    name: 'Lymphocytes (%)',
    aliases: ['LYMPH%', 'Lymphocytes Percent'],
    description: 'Immune cells responsible for recognizing viral infections and producing antibodies.',
  },
  cbc_lymphocytes_abs: {
    name: 'Absolute Lymphocyte Count (ALC)',
    aliases: ['ALC', 'Absolute Lymphocytes', 'LYMPH#'],
    description: 'Total number of circulating lymphocytes in the blood.',
  },
  cbc_monocytes_pct: {
    name: 'Monocytes (%)',
    aliases: ['MONO%', 'Monocytes Percent'],
    description: 'Large phagocytic immune cells that fight chronic infections and remove cellular debris.',
  },
  cbc_monocytes_percent: {
    name: 'Monocytes (%)',
    aliases: ['MONO%', 'Monocytes Percent'],
    description: 'Large phagocytic immune cells that fight chronic infections.',
  },
  cbc_monocytes_abs: {
    name: 'Absolute Monocyte Count',
    aliases: ['MONO#', 'Absolute Monocytes'],
    description: 'Total monocyte count in the blood.',
  },
  cbc_eosinophils_pct: {
    name: 'Eosinophils (%)',
    aliases: ['EOS%', 'Eosinophils Percent'],
    description: 'White blood cell type involved in allergic reactions and fighting parasitic infections.',
  },
  cbc_eosinophils_abs: {
    name: 'Absolute Eosinophil Count (AEC)',
    aliases: ['AEC', 'Absolute Eosinophils', 'EOS#'],
    description: 'Total number of eosinophils in the blood.',
  },
  cbc_basophils_pct: {
    name: 'Basophils (%)',
    aliases: ['BASO%', 'Basophils Percent'],
    description: 'Smallest leukocyte fraction that releases histamine and heparin during allergic reactions.',
  },
  cbc_basophils_abs: {
    name: 'Absolute Basophil Count',
    aliases: ['BASO#', 'Absolute Basophils'],
    description: 'Total basophil count in the blood.',
  },
  cbc_immature_granulocytes_pct: {
    name: 'Immature Granulocytes (IG %)',
    aliases: ['IG%', 'Immature Granulocytes'],
    description: 'Early bone marrow granulocyte forms; elevated in severe infection or sepsis.',
  },
  cbc_reticulocytes_pct: {
    name: 'Reticulocytes (%)',
    aliases: ['RETIC%', 'Reticulocytes Percent'],
    description: 'Young immature red blood cells; indicates bone marrow erythropoiesis activity.',
  },
  cbc_reticulocytes_abs: {
    name: 'Absolute Reticulocyte Count',
    aliases: ['RETIC#', 'Absolute Reticulocytes'],
    description: 'Absolute count of young red blood cells in the blood.',
  },
  cbc_plateletcrit: {
    name: 'Plateletcrit (PCT)',
    aliases: ['PCT', 'Plateletcrit'],
    description: 'Percentage of blood volume occupied by platelets.',
  },
  cbc_g6pd: {
    name: 'G6PD Enzyme',
    aliases: ['G6PD', 'Glucose-6-Phosphate Dehydrogenase'],
    description: 'Red blood cell enzyme protecting cells from hemolysis during oxidative stress.',
  },
  cbc_osmotic_fragility: {
    name: 'Osmotic Fragility of Red Blood Cells',
    aliases: ['Osmotic Fragility', 'Erythrocyte Resistance'],
    description: 'Ability of red blood cells to withstand osmotic pressure in hypotonic saline solutions.',
  },

  // Lipids & Cardiovascular
  lipid_total_cholesterol: {
    name: 'Total Cholesterol',
    aliases: ['Cholesterol', 'CHOL', 'Total Cholesterol'],
    description: 'Total amount of circulating cholesterol in the blood (includes HDL, LDL, and VLDL).',
  },
  lipid_cholesterol_total: {
    name: 'Total Cholesterol',
    aliases: ['Cholesterol', 'CHOL'],
    description: 'Total amount of circulating cholesterol in the blood.',
  },
  lipid_hdl: {
    name: 'HDL Cholesterol ("Good")',
    aliases: ['HDL', 'Good Cholesterol', 'High-Density Lipoprotein'],
    description: 'High-density lipoprotein cholesterol that protects blood vessels from atherosclerosis.',
  },
  lipid_ldl_calculated: {
    name: 'LDL Cholesterol (Calculated)',
    aliases: ['LDL', 'Bad Cholesterol', 'Low-Density Lipoprotein'],
    description: 'Calculated low-density lipoprotein cholesterol; the primary atherogenic risk factor.',
  },
  lipid_ldl_direct: {
    name: 'LDL Cholesterol (Direct)',
    aliases: ['Direct LDL', 'dLDL'],
    description: 'Directly measured low-density lipoprotein cholesterol concentration.',
  },
  lipid_triglycerides: {
    name: 'Triglycerides',
    aliases: ['TG', 'Triglycerides', 'TRIG'],
    description: 'Main form of fat in the blood; important marker for metabolic and cardiovascular disease risk.',
  },
  lipid_vldl: {
    name: 'VLDL Cholesterol',
    aliases: ['VLDL', 'Very Low-Density Lipoprotein'],
    description: 'Very low-density lipoprotein cholesterol that transports triglycerides throughout the body.',
  },
  lipid_non_hdl: {
    name: 'Non-HDL Cholesterol',
    aliases: ['Non-HDL', 'Atherogenic Cholesterol'],
    description: 'Sum of all atherogenic lipoproteins (total cholesterol minus HDL).',
  },
  lipid_cholesterol_hdl_ratio: {
    name: 'Total Cholesterol / HDL Ratio',
    aliases: ['Chol/HDL', 'Atherogenicity Index', 'TC/HDL'],
    description: 'Clinical ratio for assessing relative cardiovascular disease risk.',
  },
  lipid_apob: {
    name: 'Apolipoprotein B (ApoB)',
    aliases: ['ApoB', 'Apolipoprotein B'],
    description: 'Primary protein of all atherogenic particles; highly accurate atherosclerosis risk marker.',
  },
  lipid_apoa1: {
    name: 'Apolipoprotein A1 (ApoA1)',
    aliases: ['ApoA1', 'Apolipoprotein A1'],
    description: 'Primary protein of protective HDL cholesterol.',
  },
  lipid_lpa: {
    name: 'Lipoprotein(a) [Lp(a)]',
    aliases: ['Lp(a)', 'Lipoprotein a', 'LPA'],
    description: 'Genetically determined independent risk marker for early atherosclerosis and thrombosis.',
  },
  cardio_hscrp: {
    name: 'High-Sensitivity CRP (hs-CRP)',
    aliases: ['hs-CRP', 'Cardiac CRP'],
    description: 'High-sensitivity C-reactive protein for assessing chronic vascular wall inflammation.',
  },
  inflam_crp_hs: {
    name: 'High-Sensitivity CRP (hs-CRP)',
    aliases: ['hs-CRP', 'Cardiac CRP'],
    description: 'High-sensitivity C-reactive protein for assessing chronic vascular wall inflammation.',
  },
  cardio_homocysteine: {
    name: 'Homocysteine',
    aliases: ['Homocysteine', 'HCY'],
    description: 'Amino acid whose excess damages vascular endothelium and increases clot risk.',
  },
  cardio_troponin_i: {
    name: 'Troponin I (hs-cTnI)',
    aliases: ['Troponin I', 'cTnI', 'hs-TnI'],
    description: 'High-sensitivity myocardial injury protein used in heart attack diagnosis.',
  },
  cardio_troponin_t: {
    name: 'Troponin T (hs-cTnT)',
    aliases: ['Troponin T', 'cTnT', 'hs-TnT'],
    description: 'Protein specific to cardiac muscle damage.',
  },
  cardio_bnp: {
    name: 'B-Type Natriuretic Peptide (BNP)',
    aliases: ['BNP', 'Natriuretic Peptide'],
    description: 'Hormone secreted by heart ventricles when they are under stress or failing.',
  },
  cardio_nt_probnp: {
    name: 'NT-proBNP',
    aliases: ['NT-proBNP', 'ProBNP'],
    description: 'Marker for diagnosing heart failure and monitoring treatment effectiveness.',
  },
  cardio_ck: {
    name: 'Creatine Kinase (CK Total)',
    aliases: ['CK', 'Creatine Kinase', 'CPK'],
    description: 'Muscle and cardiac tissue enzyme elevated by muscle damage or physical exertion.',
  },
  cardio_ck_mb: {
    name: 'Creatine Kinase-MB (CK-MB)',
    aliases: ['CK-MB', 'Creatine Kinase MB'],
    description: 'Heart muscle-specific isoform of creatine kinase.',
  },
  cardio_myoglobin: {
    name: 'Myoglobin',
    aliases: ['Myoglobin', 'Mb'],
    description: 'Early rapid marker of muscle and myocardial damage.',
  },
  cardio_mpo: {
    name: 'Myeloperoxidase (MPO)',
    aliases: ['MPO', 'Myeloperoxidase'],
    description: 'Marker of vascular inflammation and unstable atherosclerotic plaques.',
  },
  cardio_oxldl: {
    name: 'Oxidized LDL (oxLDL)',
    aliases: ['oxLDL', 'Oxidized LDL'],
    description: 'Oxidized form of low-density lipoprotein with strong atherogenic properties.',
  },
  cardio_fibrinogen_ag: {
    name: 'Fibrinogen Antigen',
    aliases: ['Fibrinogen AG'],
    description: 'Plasma clotting and cardiovascular thrombosis risk protein.',
  },

  // Metabolic & Renal
  metabolic_fasting_glucose: {
    name: 'Fasting Glucose',
    aliases: ['Glucose', 'GLU', 'Blood Sugar', 'Glycemia'],
    description: 'Blood sugar concentration while fasting; primary marker for diabetes and carbohydrate metabolism.',
  },
  metabolic_glucose: {
    name: 'Glucose',
    aliases: ['Glucose', 'GLU', 'Blood Sugar'],
    description: 'Blood glucose concentration.',
  },
  metabolic_hba1c: {
    name: 'Glycated Hemoglobin (HbA1c)',
    aliases: ['HbA1c', 'Glycated Hemoglobin', 'A1C'],
    description: 'Indicator of average blood glucose levels over the past 2–3 months.',
  },
  metabolic_estimated_avg_glucose: {
    name: 'Estimated Average Glucose (eAG)',
    aliases: ['eAG', 'Average Glucose'],
    description: 'Calculated average glycemia based on HbA1c value.',
  },
  metabolic_fasting_insulin: {
    name: 'Fasting Insulin',
    aliases: ['Insulin', 'INS', 'Fasting Insulin'],
    description: 'Pancreatic hormone regulating cellular glucose uptake; marker of insulin resistance.',
  },
  metabolic_c_peptide: {
    name: 'C-Peptide',
    aliases: ['C-Peptide', 'C Peptide'],
    description: 'Marker of endogenous pancreatic insulin production, useful to distinguish type 1 from type 2 diabetes.',
  },
  renal_bun: {
    name: 'Blood Urea Nitrogen (BUN)',
    aliases: ['BUN', 'Urea', 'Urea Nitrogen'],
    description: 'End product of protein metabolism; reflects kidney excretory function and protein catabolism.',
  },
  renal_creatinine: {
    name: 'Serum Creatinine',
    aliases: ['Creatinine', 'CREA', 'Serum Creatinine'],
    description: 'Constant byproduct of muscle metabolism; primary marker of kidney filtration function.',
  },
  metabolic_creatinine: {
    name: 'Creatinine',
    aliases: ['Creatinine', 'CREA'],
    description: 'Kidney filtration function marker.',
  },
  renal_egfr: {
    name: 'Estimated Glomerular Filtration Rate (eGFR)',
    aliases: ['eGFR', 'GFR', 'Glomerular Filtration Rate'],
    description: 'Glomerular filtration rate by the CKD-EPI formula, showing the kidneys\' capacity to filter blood.',
  },
  metabolic_egfr: {
    name: 'Estimated Glomerular Filtration Rate (eGFR)',
    aliases: ['eGFR', 'GFR'],
    description: 'Glomerular filtration rate.',
  },
  renal_cystatin_c: {
    name: 'Cystatin C',
    aliases: ['Cystatin C'],
    description: 'Highly sensitive kidney filtration marker, independent of muscle mass or diet.',
  },
  renal_bun_creatinine_ratio: {
    name: 'BUN / Creatinine Ratio',
    aliases: ['BUN/Cr', 'BUN Creatinine Ratio'],
    description: 'Index for differentiating prerenal failure (dehydration) from intrinsic renal damage.',
  },
  metabolic_uric_acid: {
    name: 'Uric Acid',
    aliases: ['Uric Acid', 'URIC'],
    description: 'Purine metabolism byproduct; elevated levels cause gout and kidney stones.',
  },
  metabolic_lactate: {
    name: 'Lactate (Lactic Acid)',
    aliases: ['Lactate', 'Lactic Acid'],
    description: 'Anaerobic metabolism product; marker of tissue hypoxia, intense exercise, or sepsis.',
  },
  metabolic_ketones: {
    name: 'Beta-Hydroxybutyrate (Ketones)',
    aliases: ['Ketones', 'Beta-Hydroxybutyrate', 'BOHB'],
    description: 'Primary blood ketone body; elevated during fasting, ketogenic diet, or ketoacidosis.',
  },
  metabolic_microalbumin_urine: {
    name: 'Urine Microalbumin / Creatinine Ratio',
    aliases: ['ACR', 'Microalbumin', 'Urine Albumin/Creatinine'],
    description: 'Earliest marker of diabetic and hypertensive kidney damage.',
  },
  metabolic_fructosamine: {
    name: 'Fructosamine',
    aliases: ['Fructosamine'],
    description: 'Glycated blood proteins; reflects average glycemia over the past 2–3 weeks.',
  },
  metabolic_adiponectin: {
    name: 'Adiponectin',
    aliases: ['Adiponectin'],
    description: 'Protective adipose tissue hormone that increases insulin sensitivity and suppresses atherogenesis.',
  },
  metabolic_leptin: {
    name: 'Leptin',
    aliases: ['Leptin'],
    description: 'Adipose tissue hormone regulating appetite, satiety, and energy metabolism.',
  },
  metabolic_glucagon: {
    name: 'Glucagon',
    aliases: ['Glucagon'],
    description: 'Pancreatic alpha cell hormone that stimulates glucose release from the liver into the blood.',
  },
  metabolic_homa_ir: {
    name: 'HOMA-IR Index',
    aliases: ['HOMA-IR', 'Insulin Resistance Index'],
    description: 'Homeostatic model assessment of insulin resistance, calculated from fasting glucose and insulin.',
  },
  metabolic_proinsulin: {
    name: 'Proinsulin',
    aliases: ['Proinsulin'],
    description: 'Insulin precursor; elevated levels indicate pancreatic beta cell dysfunction.',
  },
  creatinine_clearance: {
    name: 'Creatinine Clearance (CrCl)',
    aliases: ['CrCl', 'Creatinine Clearance'],
    description: 'True kidney capacity to clear blood per unit time based on 24-hour urine.',
  },
  urine_protein_24h: {
    name: '24-Hour Urine Protein',
    aliases: ['24h Proteinuria', '24h Urine Protein'],
    description: 'Total protein lost in urine over 24 hours.',
  },

  // Electrolytes & Minerals
  electrolyte_sodium: {
    name: 'Sodium (Na)',
    aliases: ['Na', 'Sodium'],
    description: 'Primary extracellular cation maintaining fluid balance, blood pressure, and osmotic pressure.',
  },
  electrolyte_potassium: {
    name: 'Potassium (K)',
    aliases: ['K', 'Potassium'],
    description: 'Most important intracellular cation, vital for heart rhythm and muscle contraction.',
  },
  electrolyte_chloride: {
    name: 'Chloride (Cl)',
    aliases: ['Cl', 'Chloride'],
    description: 'Primary extracellular anion that, with sodium, regulates osmotic pressure and acid-base balance.',
  },
  electrolyte_bicarbonate: {
    name: 'Bicarbonate (CO2)',
    aliases: ['CO2', 'Bicarbonate', 'HCO3', 'Carbon Dioxide'],
    description: 'Main component of the blood buffering system for maintaining body pH balance.',
  },
  metabolic_bicarbonate: {
    name: 'Bicarbonate (CO2)',
    aliases: ['CO2', 'Bicarbonate', 'HCO3'],
    description: 'Acid-base buffering system marker.',
  },
  electrolyte_calcium: {
    name: 'Total Calcium (Ca)',
    aliases: ['Ca', 'Calcium', 'Total Calcium'],
    description: 'Essential mineral for bone strength, cardiac and muscle contraction, and blood clotting.',
  },
  electrolyte_calcium_ionized: {
    name: 'Ionized Calcium (Ca2+)',
    aliases: ['Ca2+', 'Ionized Calcium', 'Free Calcium'],
    description: 'Biologically active, unbound fraction of calcium in the blood.',
  },
  electrolyte_phosphate: {
    name: 'Phosphorus (Phosphate / PO4)',
    aliases: ['PO4', 'Phosphorus', 'Phosphate'],
    description: 'Mineral essential for bone structure, cell membranes, and energy (ATP) metabolism.',
  },
  electrolyte_magnesium: {
    name: 'Magnesium (Mg)',
    aliases: ['Mg', 'Magnesium'],
    description: 'Vitally important mineral for hundreds of enzymatic reactions, the nervous system, and muscle relaxation.',
  },
  electrolyte_anion_gap: {
    name: 'Anion Gap',
    aliases: ['Anion Gap'],
    description: 'Calculated difference between cations and anions to identify causes of metabolic acidosis.',
  },
  electrolyte_osmolality: {
    name: 'Serum Osmolality',
    aliases: ['Osmolality', 'Serum Osmolality'],
    description: 'Concentration of dissolved particles in blood serum; reflects water and electrolyte balance.',
  },

  // Liver & Enzymes
  liver_alt: {
    name: 'ALT (Alanine Aminotransferase)',
    aliases: ['ALT', 'SGPT', 'Alanine Aminotransferase'],
    description: 'Liver cell enzyme; elevated levels indicate hepatocyte damage or inflammation.',
  },
  liver_ast: {
    name: 'AST (Aspartate Aminotransferase)',
    aliases: ['AST', 'SGOT', 'Aspartate Aminotransferase'],
    description: 'Enzyme present in liver, heart, and skeletal muscle; indicator of damage.',
  },
  liver_alp: {
    name: 'Alkaline Phosphatase (ALP)',
    aliases: ['ALP', 'Alkaline Phosphatase'],
    description: 'Bile duct and bone metabolism enzyme; elevated in bile stasis or bone disease.',
  },
  liver_ggt: {
    name: 'GGT (Gamma-Glutamyltransferase)',
    aliases: ['GGT', 'Gamma GT', 'GGTP'],
    description: 'Highly sensitive marker of bile flow impairment (cholestasis) and alcohol or drug effects on the liver.',
  },
  liver_total_bilirubin: {
    name: 'Total Bilirubin',
    aliases: ['BIL', 'Total Bilirubin'],
    description: 'Hemoglobin breakdown product; elevated levels cause jaundice.',
  },
  liver_bilirubin_total: {
    name: 'Total Bilirubin',
    aliases: ['BIL', 'Total Bilirubin'],
    description: 'Hemoglobin breakdown product for assessing liver function and jaundice.',
  },
  liver_direct_bilirubin: {
    name: 'Direct Bilirubin (Conjugated)',
    aliases: ['DBIL', 'Direct Bilirubin', 'Conjugated Bilirubin'],
    description: 'Liver-processed, soluble form of bilirubin; elevated in bile duct obstruction.',
  },
  liver_indirect_bilirubin: {
    name: 'Indirect Bilirubin (Unconjugated)',
    aliases: ['IBIL', 'Indirect Bilirubin', 'Unconjugated Bilirubin'],
    description: 'Unconjugated bilirubin in the blood; elevated in hemolysis or Gilbert\'s syndrome.',
  },
  liver_total_protein: {
    name: 'Total Protein',
    aliases: ['TP', 'Total Protein'],
    description: 'Total concentration of all blood plasma proteins (albumins and globulins).',
  },
  liver_albumin: {
    name: 'Serum Albumin',
    aliases: ['ALB', 'Albumin', 'Serum Albumin'],
    description: 'Main liver-synthesized blood protein that maintains oncotic pressure and transports molecules.',
  },
  liver_globulin: {
    name: 'Globulins',
    aliases: ['Globulins', 'GLOB'],
    description: 'Proteins including antibodies, clotting factors, and enzymes.',
  },
  liver_ag_ratio: {
    name: 'Albumin / Globulin Ratio (A/G)',
    aliases: ['A/G Ratio', 'AG Ratio'],
    description: 'Relative protein fraction balance for assessing liver synthesis and chronic inflammation.',
  },
  liver_fib4_index: {
    name: 'FIB-4 Index (Liver Fibrosis)',
    aliases: ['FIB-4', 'FIB4', 'Fibrosis Index'],
    description: 'Non-invasive assessment of liver fibrosis and fatty liver disease risk.',
  },
  liver_ldh: {
    name: 'Lactate Dehydrogenase (LDH)',
    aliases: ['LDH', 'Lactate Dehydrogenase'],
    description: 'Cellular enzyme; elevated in tissue damage, hemolysis, or malignant processes.',
  },
  liver_amylase: {
    name: 'Serum Amylase',
    aliases: ['Amylase', 'AMY', 'Pancreatic Amylase'],
    description: 'Pancreatic enzyme for carbohydrate digestion; sudden increase is typical of acute pancreatitis.',
  },
  liver_lipase: {
    name: 'Serum Lipase',
    aliases: ['Lipase', 'LIP', 'Pancreatic Lipase'],
    description: 'Highly specific pancreatic enzyme for fat digestion; the primary pancreatitis marker.',
  },
  liver_cholinesterase: {
    name: 'Pseudocholinesterase (BChE)',
    aliases: ['Cholinesterase', 'BChE'],
    description: 'Marker of liver synthetic capacity and susceptibility to muscle relaxants.',
  },
  bile_acids: {
    name: 'Bile Acids',
    aliases: ['Bile Acids'],
    description: 'Acids synthesized in the liver from cholesterol; used in diagnosing obstetric cholestasis.',
  },
  ammonia: {
    name: 'Blood Ammonia',
    aliases: ['Ammonia', 'NH3'],
    description: 'Toxic byproduct of protein catabolism; marker of liver detoxification function.',
  },

  // Thyroid & Endocrine
  thyroid_tsh: {
    name: 'Thyroid-Stimulating Hormone (TSH)',
    aliases: ['TSH', 'Thyrotropin'],
    description: 'Pituitary hormone regulating thyroid function; the primary thyroid status test.',
  },
  thyroid_free_t4: {
    name: 'Free Thyroxine (FT4)',
    aliases: ['FT4', 'Free T4'],
    description: 'Primary active thyroid hormone in the blood.',
  },
  thyroid_total_t4: {
    name: 'Total Thyroxine (T4)',
    aliases: ['T4', 'Total T4'],
    description: 'Total thyroxine hormone level in blood serum.',
  },
  thyroid_free_t3: {
    name: 'Free Triiodothyronine (FT3)',
    aliases: ['FT3', 'Free T3'],
    description: 'Most biologically active form of thyroid hormone for stimulating cellular metabolism.',
  },
  thyroid_total_t3: {
    name: 'Total Triiodothyronine (T3)',
    aliases: ['T3', 'Total T3'],
    description: 'Total triiodothyronine level in the blood.',
  },
  thyroid_reverse_t3: {
    name: 'Reverse T3 (rT3)',
    aliases: ['rT3', 'Reverse T3'],
    description: 'Inactive T4 metabolic byproduct in chronic illness or severe stress.',
  },
  thyroid_tpo_ab: {
    name: 'Anti-TPO (Thyroid Peroxidase Antibodies)',
    aliases: ['Anti-TPO', 'ATPO', 'TPO Antibodies'],
    description: 'Antibodies against thyroid peroxidase enzyme; marker of Hashimoto\'s autoimmune thyroiditis.',
  },
  thyroid_tg_ab: {
    name: 'Anti-Tg (Thyroglobulin Antibodies)',
    aliases: ['Anti-Tg', 'ATG', 'Thyroglobulin Antibodies'],
    description: 'Autoantibodies against thyroglobulin for detecting autoimmune thyroid diseases.',
  },
  thyroid_thyroglobulin: {
    name: 'Thyroglobulin (Tg)',
    aliases: ['Thyroglobulin', 'Tg'],
    description: 'Thyroid tissue protein; monitored after thyroid cancer removal surgery.',
  },
  endocrine_cortisol_am: {
    name: 'Cortisol (Morning)',
    aliases: ['Cortisol', 'Morning Cortisol', 'AM Cortisol'],
    description: 'Primary adrenal stress hormone; regulates glucose, blood pressure, and inflammation.',
  },
  endocrine_cortisol_pm: {
    name: 'Cortisol (Evening)',
    aliases: ['Evening Cortisol', 'PM Cortisol'],
    description: 'Evening cortisol level for assessing diurnal circadian rhythm.',
  },
  endocrine_acth: {
    name: 'ACTH (Adrenocorticotropic Hormone)',
    aliases: ['ACTH'],
    description: 'Pituitary hormone that stimulates the adrenal cortex to produce cortisol.',
  },
  endocrine_pth: {
    name: 'Parathyroid Hormone (PTH)',
    aliases: ['PTH', 'Parathyroid Hormone'],
    description: 'Parathyroid gland hormone that maintains constant calcium and phosphorus levels in the blood.',
  },
  endocrine_igf1: {
    name: 'IGF-1 (Insulin-Like Growth Factor 1)',
    aliases: ['IGF-1', 'Somatomedin C'],
    description: 'Liver-produced protein in response to growth hormone stimulation; reflects tissue anabolism.',
  },
  endocrine_prolactin: {
    name: 'Prolactin',
    aliases: ['Prolactin', 'PRL'],
    description: 'Pituitary hormone for regulating lactation, reproductive function, and behavior.',
  },
  growth_hormone: {
    name: 'Growth Hormone (GH / STH)',
    aliases: ['GH', 'STH', 'Somatotropin'],
    description: 'Pituitary hormone stimulating growth, cellular renewal, and metabolism.',
  },
  aldosterone: {
    name: 'Aldosterone',
    aliases: ['Aldosterone'],
    description: 'Adrenal cortex mineralocorticoid regulating sodium, potassium, and water balance.',
  },
  plasma_renin: {
    name: 'Plasma Renin Activity (PRA)',
    aliases: ['Renin', 'PRA'],
    description: 'Kidney enzyme renin for controlling blood pressure and fluid volume.',
  },
  calcitonin: {
    name: 'Calcitonin',
    aliases: ['Calcitonin'],
    description: 'Thyroid C-cell hormone; tumor marker for medullary thyroid cancer.',
  },
  gastrin: {
    name: 'Serum Gastrin',
    aliases: ['Gastrin'],
    description: 'Stomach hormone that stimulates hydrochloric acid production during digestion.',
  },
  erythropoietin: {
    name: 'Erythropoietin (EPO)',
    aliases: ['EPO', 'Erythropoietin'],
    description: 'Kidney hormone that stimulates red blood cell production in the bone marrow.',
  },
  endocrine_metanephrines: {
    name: 'Plasma Metanephrines',
    aliases: ['Metanephrines'],
    description: 'Adrenaline breakdown metabolites for detecting pheochromocytoma.',
  },
  endocrine_normetanephrine: {
    name: 'Plasma Normetanephrine',
    aliases: ['Normetanephrine'],
    description: 'Noradrenaline metabolite for investigating adrenal tumors.',
  },
  endocrine_chromogranin_a: {
    name: 'Chromogranin A (CgA)',
    aliases: ['Chromogranin A', 'CgA'],
    description: 'Neuroendocrine cell protein; marker of neuroendocrine tumors.',
  },

  // Hormones & Reproductive
  hormone_total_testosterone: {
    name: 'Total Testosterone',
    aliases: ['Testosterone', 'TEST', 'Total Testosterone'],
    description: 'Primary male sex hormone (androgen) responsible for muscle mass, libido, and bone density.',
  },
  hormone_testosterone_total: {
    name: 'Total Testosterone',
    aliases: ['Testosterone', 'TEST'],
    description: 'Male sex hormone for muscle mass, bone strength, and energy.',
  },
  hormone_free_testosterone: {
    name: 'Free Testosterone',
    aliases: ['Free Testosterone', 'FT'],
    description: 'Biologically active, protein-unbound fraction of testosterone that directly affects tissues.',
  },
  hormone_shbg: {
    name: 'Sex Hormone-Binding Globulin (SHBG)',
    aliases: ['SHBG'],
    description: 'Protein regulating the amount of free testosterone and estrogens in the blood.',
  },
  hormone_estradiol: {
    name: 'Estradiol (E2)',
    aliases: ['Estradiol', 'E2'],
    description: 'Primary female estrogen regulating the menstrual cycle, bone density, and vascular health.',
  },
  hormone_progesterone: {
    name: 'Progesterone',
    aliases: ['Progesterone', 'PRG'],
    description: 'Hormone essential for preparing the uterine lining for pregnancy and maintaining it.',
  },
  hormone_dhea_s: {
    name: 'DHEA-S (Dehydroepiandrosterone Sulfate)',
    aliases: ['DHEA-S', 'DHEAS'],
    description: 'Adrenal-produced androgen precursor, important for energy, immunity, and aging processes.',
  },
  hormone_lh: {
    name: 'Luteinizing Hormone (LH)',
    aliases: ['LH', 'Luteinizing Hormone'],
    description: 'Pituitary hormone stimulating ovulation in women and testosterone production in men.',
  },
  hormone_fsh: {
    name: 'Follicle-Stimulating Hormone (FSH)',
    aliases: ['FSH', 'Follitropin'],
    description: 'Hormone regulating ovarian follicle growth in women and sperm production in men.',
  },
  hormone_dht: {
    name: 'Dihydrotestosterone (DHT)',
    aliases: ['DHT', 'Dihydrotestosterone'],
    description: 'Most potent active androgen for prostate, hair follicles, and male secondary sex characteristics.',
  },
  hormone_amh: {
    name: 'Anti-Müllerian Hormone (AMH)',
    aliases: ['AMH', 'Anti-Mullerian'],
    description: 'Accurate marker of ovarian follicle reserve (egg reserve) for assessing female fertility.',
  },
  prostate_specific_antigen: {
    name: 'PSA (Prostate-Specific Antigen)',
    aliases: ['PSA', 'Total PSA'],
    description: 'Prostate-produced protein for detecting prostate conditions (hyperplasia, inflammation, cancer).',
  },
  free_psa: {
    name: 'Free PSA',
    aliases: ['FPSA', 'Free PSA'],
    description: 'Free PSA fraction; ratio with total PSA helps refine prostate cancer risk.',
  },
  hcg_total: {
    name: 'HCG (Human Chorionic Gonadotropin)',
    aliases: ['HCG', 'hCG', 'Pregnancy Hormone'],
    description: 'Hormone produced by the placenta during pregnancy; also a germ cell tumor marker.',
  },
  estrone: {
    name: 'Estrone (E1)',
    aliases: ['Estrone', 'E1'],
    description: 'Estrogen form predominant after menopause, synthesized in adipose tissue.',
  },
  estriol: {
    name: 'Estriol (E3)',
    aliases: ['Estriol', 'E3'],
    description: 'Estrogen abundantly synthesized by the placenta during pregnancy.',
  },
  '17_hydroxyprogesterone': {
    name: '17-Hydroxyprogesterone (17-OHP)',
    aliases: ['17-OHP', '17-Hydroxyprogesterone'],
    description: 'Adrenal steroidogenesis intermediate product for testing congenital adrenal hyperplasia.',
  },
  androstenedione: {
    name: 'Androstenedione',
    aliases: ['Androstenedione'],
    description: 'Intermediate steroid from which testosterone and estrogens are produced.',
  },

  // Vitamins & Nutrition
  vitamin_d_25oh: {
    name: 'Vitamin D (25-OH)',
    aliases: ['Vitamin D', '25-OH-D', 'Vit D', 'Calcidiol'],
    description: 'Primary form of the body\'s vitamin D stores; essential for bones, immunity, and cell function.',
  },
  vit_d_25_hydroxy: {
    name: 'Vitamin D (25-OH)',
    aliases: ['Vitamin D', '25-OH-D'],
    description: 'Body vitamin D store indicator for bones and immunity.',
  },
  vitamin_b12: {
    name: 'Vitamin B12 (Cobalamin)',
    aliases: ['Vitamin B12', 'B12', 'Cobalamin'],
    description: 'Water-soluble vitamin essential for DNA synthesis, blood cell formation, and nerve myelination.',
  },
  vit_b12: {
    name: 'Vitamin B12',
    aliases: ['Vitamin B12', 'B12'],
    description: 'Essential vitamin for blood cell formation and the nervous system.',
  },
  vitamin_folate_serum: {
    name: 'Folate / Folic Acid (Vitamin B9)',
    aliases: ['Folic Acid', 'Folate', 'Vitamin B9'],
    description: 'Vitamin needed for red blood cell production and fetal development.',
  },
  vitamin_folate_rbc: {
    name: 'RBC Folate',
    aliases: ['RBC Folate', 'Erythrocyte Folate'],
    description: 'Long-term indicator of body folate stores over the past months.',
  },
  vitamin_a: {
    name: 'Vitamin A (Retinol)',
    aliases: ['Vitamin A', 'Retinol'],
    description: 'Fat-soluble vitamin for vision, skin, and immune system barriers.',
  },
  vitamin_c: {
    name: 'Vitamin C (Ascorbic Acid)',
    aliases: ['Vitamin C', 'Ascorbic Acid'],
    description: 'Powerful antioxidant that strengthens vascular walls and participates in collagen synthesis.',
  },
  vitamin_e: {
    name: 'Vitamin E (Alpha-Tocopherol)',
    aliases: ['Vitamin E', 'Tocopherol'],
    description: 'Fat-soluble antioxidant protecting cell membranes from free radicals.',
  },
  nutrition_coq10: {
    name: 'Coenzyme Q10 (Ubiquinone)',
    aliases: ['Coenzyme Q10', 'CoQ10', 'Ubiquinone'],
    description: 'Cellular mitochondrial component for energy production (ATP) and cardiac muscle protection.',
  },
  vitamin_b1: {
    name: 'Thiamine (Vitamin B1)',
    aliases: ['Vitamin B1', 'Thiamine'],
    description: 'Essential for carbohydrate metabolism and normal nervous and cardiac function.',
  },
  vitamin_b2: {
    name: 'Riboflavin (Vitamin B2)',
    aliases: ['Vitamin B2', 'Riboflavin'],
    description: 'Coenzyme for cellular respiration and energy metabolism.',
  },
  vitamin_b6: {
    name: 'Pyridoxal-5-Phosphate (Vitamin B6)',
    aliases: ['Vitamin B6', 'Pyridoxine', 'P5P'],
    description: 'Essential for amino acid catabolism, neurotransmitter synthesis, and immune function.',
  },
  vitamin_b3: {
    name: 'Niacin (Vitamin B3)',
    aliases: ['Vitamin B3', 'Niacin', 'Nicotinic Acid'],
    description: 'Involved in lipid metabolism and cellular energy generation.',
  },
  vitamin_b5: {
    name: 'Pantothenic Acid (Vitamin B5)',
    aliases: ['Vitamin B5', 'Pantothenic Acid'],
    description: 'Coenzyme A component for fat and carbohydrate metabolism.',
  },
  biotin: {
    name: 'Biotin (Vitamin B7)',
    aliases: ['Biotin', 'Vitamin B7', 'Vitamin H'],
    description: 'Vitamin for healthy skin, hair, nails, and fatty acid synthesis.',
  },
  vitamin_k1: {
    name: 'Phylloquinone (Vitamin K1)',
    aliases: ['Vitamin K1', 'Phylloquinone'],
    description: 'Essential for synthesis of clotting factors in the liver and bone mineralization.',
  },
  methylmalonic_acid: {
    name: 'Methylmalonic Acid (MMA)',
    aliases: ['MMA', 'Methylmalonic Acid'],
    description: 'Most sensitive marker of functional cellular vitamin B12 deficiency.',
  },
  vitamin_calcitriol: {
    name: 'Calcitriol (1,25-Dihydroxy Vit D)',
    aliases: ['Calcitriol', '1,25-(OH)2-D'],
    description: 'Active hormonal form of vitamin D for intestinal calcium absorption.',
  },

  // Iron & Anemia
  iron_serum_iron: {
    name: 'Serum Iron',
    aliases: ['Fe', 'Iron', 'Serum Iron'],
    description: 'Concentration of free iron circulating in blood serum.',
  },
  iron_ferritin: {
    name: 'Serum Ferritin',
    aliases: ['Ferritin', 'FERR', 'Iron Stores'],
    description: 'Primary body iron storage protein; the earliest indicator of iron deficiency.',
  },
  iron_tibc: {
    name: 'Total Iron-Binding Capacity (TIBC)',
    aliases: ['TIBC', 'Iron Binding Capacity'],
    description: 'Maximum amount of iron that blood transferrin can bind.',
  },
  iron_transferrin_sat: {
    name: 'Transferrin Saturation (%)',
    aliases: ['Transferrin Saturation', 'TSAT'],
    description: 'Percentage of transferrin binding sites occupied by iron.',
  },
  iron_transferrin: {
    name: 'Transferrin',
    aliases: ['Transferrin', 'TRF'],
    description: 'Primary blood plasma protein transporting iron to the bone marrow and tissues.',
  },
  iron_stfr: {
    name: 'Soluble Transferrin Receptors (sTfR)',
    aliases: ['sTfR', 'Transferrin Receptors'],
    description: 'Cellular iron deficiency marker, independent of body inflammation.',
  },
  iron_zpp: {
    name: 'Zinc Protoporphyrin (ZPP)',
    aliases: ['ZPP', 'Zinc Protoporphyrin'],
    description: 'Marker showing inadequate iron supply to hemoglobin synthesis in the bone marrow.',
  },
  iron_hepcidin: {
    name: 'Hepcidin',
    aliases: ['Hepcidin'],
    description: 'Liver-produced hormone that is the primary systemic regulator of iron absorption.',
  },
  iron_haptoglobin: {
    name: 'Haptoglobin',
    aliases: ['Haptoglobin'],
    description: 'Protein binding free hemoglobin; sudden decrease indicates hemolytic anemia.',
  },
  iron_hemopexin: {
    name: 'Hemopexin',
    aliases: ['Hemopexin'],
    description: 'Protective blood protein binding free heme after red blood cell breakdown.',
  },

  // Inflammation & Immunology
  inflam_crp: {
    name: 'C-Reactive Protein (CRP)',
    aliases: ['CRP', 'C-Reactive Protein'],
    description: 'Primary acute-phase marker of inflammation, bacterial infection, and tissue damage.',
  },
  inflam_esr: {
    name: 'Erythrocyte Sedimentation Rate (ESR)',
    aliases: ['ESR', 'Sedimentation Rate'],
    description: 'Non-specific chronic inflammation, autoimmune disease, and infection progression indicator.',
  },
  inflam_rf: {
    name: 'Rheumatoid Factor (RF)',
    aliases: ['RF', 'Rheumatoid Factor'],
    description: 'Autoantibodies against own immunoglobulins for diagnosing rheumatoid arthritis.',
  },
  inflam_ana: {
    name: 'Antinuclear Antibodies (ANA)',
    aliases: ['ANA', 'Antinuclear Antibodies'],
    description: 'Screening autoantibody test for systemic autoimmune connective tissue diseases.',
  },
  inflam_igg: {
    name: 'Immunoglobulin G (IgG)',
    aliases: ['IgG'],
    description: 'Most abundant antibody class in blood, providing long-term humoral immunity.',
  },
  inflam_iga: {
    name: 'Immunoglobulin A (IgA)',
    aliases: ['IgA'],
    description: 'Protective antibody of mucous membranes (respiratory tract, GI tract).',
  },
  inflam_igm: {
    name: 'Immunoglobulin M (IgM)',
    aliases: ['IgM'],
    description: 'First antibodies to appear in the blood during the initial stage of acute infection.',
  },
  inflam_ige: {
    name: 'Immunoglobulin E (Total IgE)',
    aliases: ['IgE', 'Total IgE'],
    description: 'Antibodies responsible for allergic reactions and fighting parasites.',
  },
  inflam_complement_c3: {
    name: 'Complement Component C3',
    aliases: ['C3', 'Complement C3'],
    description: 'Immune system complement cascade protein for removing immune complexes.',
  },
  inflam_complement_c4: {
    name: 'Complement Component C4',
    aliases: ['C4', 'Complement C4'],
    description: 'Classical complement pathway protein for monitoring autoimmune disease activity.',
  },
  anti_ccp: {
    name: 'Anti-CCP (Cyclic Citrullinated Peptide Antibodies)',
    aliases: ['Anti-CCP', 'ACPA', 'Citrullinated Peptide Antibodies'],
    description: 'Highly specific diagnostic marker for early rheumatoid arthritis.',
  },
  anti_dsdna: {
    name: 'Anti-dsDNA Antibodies',
    aliases: ['Anti-dsDNA', 'dsDNA'],
    description: 'Specific antibodies against double-stranded DNA for diagnosing systemic lupus erythematosus (SLE).',
  },
  anti_smith: {
    name: 'Anti-Smith Antibodies (Anti-Sm)',
    aliases: ['Anti-Sm', 'Smith Antibodies'],
    description: 'Highly specific autoantibody for systemic lupus erythematosus.',
  },
  anti_ssa_ro: {
    name: 'Anti-SSA (Ro) Antibodies',
    aliases: ['Anti-SSA', 'Anti-Ro', 'SSA/Ro'],
    description: 'Autoimmune antibodies of Sjögren\'s syndrome and lupus.',
  },
  anti_ssb_la: {
    name: 'Anti-SSB (La) Antibodies',
    aliases: ['Anti-SSB', 'Anti-La', 'SSB/La'],
    description: 'Antibodies characteristic of Sjögren\'s syndrome.',
  },
  tissue_transglutaminase_iga: {
    name: 'Anti-tTG IgA (Tissue Transglutaminase Antibodies)',
    aliases: ['Anti-tTG', 'tTG-IgA', 'Celiac Antibodies'],
    description: 'Gold standard blood test for diagnosing celiac disease (gluten intolerance).',
  },
  deamidated_gliadin_iga: {
    name: 'Deamidated Gliadin Peptide IgA (DGP)',
    aliases: ['DGP-IgA', 'Anti-DGP'],
    description: 'Sensitive celiac test, especially suitable for young children.',
  },
  hLAB27: {
    name: 'HLA-B27 Antigen',
    aliases: ['HLA-B27', 'HLAB27'],
    description: 'Genetic marker for assessing risk of ankylosing spondylitis (Bechterew\'s disease).',
  },
  mpo_anca: {
    name: 'p-ANCA / MPO Antibodies',
    aliases: ['p-ANCA', 'MPO-ANCA'],
    description: 'Antineutrophil cytoplasmic antibodies for diagnosing systemic vasculitis.',
  },
  pr3_anca: {
    name: 'c-ANCA / PR3 Antibodies',
    aliases: ['c-ANCA', 'PR3-ANCA'],
    description: 'Antibodies against proteinase 3 for testing granulomatosis with polyangiitis (Wegener\'s).',
  },

  // Coagulation
  coag_pt: {
    name: 'Prothrombin Time (PT)',
    aliases: ['PT', 'Prothrombin Time', 'Prothrombin'],
    description: 'External blood clotting pathway test for assessing liver synthesis and coagulation.',
  },
  coag_inr: {
    name: 'International Normalized Ratio (INR)',
    aliases: ['INR', 'Prothrombin Index'],
    description: 'Standardized prothrombin time marker for selecting oral anticoagulant (warfarin) doses.',
  },
  coag_aptt: {
    name: 'Activated Partial Thromboplastin Time (aPTT)',
    aliases: ['aPTT', 'APTT'],
    description: 'Internal blood clotting pathway test and heparin therapy effectiveness monitoring.',
  },
  coag_fibrinogen: {
    name: 'Fibrinogen',
    aliases: ['Fibrinogen', 'FIB', 'Clotting Factor I'],
    description: 'Primary clotting protein that becomes a fibrin network during clot formation.',
  },
  coag_d_dimer: {
    name: 'D-Dimer',
    aliases: ['D-Dimer', 'D Dimer'],
    description: 'Fibrin degradation product; a negative result reliably rules out DVT and pulmonary embolism.',
  },
  antithrombin_iii: {
    name: 'Antithrombin III',
    aliases: ['Antithrombin', 'ATIII'],
    description: 'Primary natural coagulation inhibitor; deficiency increases thrombosis risk.',
  },
  protein_c: {
    name: 'Protein C',
    aliases: ['Protein C'],
    description: 'Vitamin K-dependent natural anticoagulant.',
  },
  protein_s: {
    name: 'Protein S',
    aliases: ['Protein S'],
    description: 'Cofactor for Protein C in inhibiting blood clotting.',
  },
  factor_v_leiden: {
    name: 'Factor V Leiden Mutation',
    aliases: ['Leiden Factor', 'Factor V Leiden'],
    description: 'Genetic predisposition to venous thrombosis (resistance to activated protein C).',
  },
  lupus_anticoagulant: {
    name: 'Lupus Anticoagulant (dRVVT)',
    aliases: ['Lupus Anticoagulant'],
    description: 'Antiphospholipid antibody test for thromboses and recurrent miscarriages.',
  },

  // Trace Elements & Heavy Metals
  trace_zinc: {
    name: 'Zinc (Zn)',
    aliases: ['Zn', 'Zinc'],
    description: 'Essential trace element for immunity, skin and wound healing, and sexual function.',
  },
  trace_copper: {
    name: 'Copper (Cu)',
    aliases: ['Cu', 'Copper'],
    description: 'Trace element needed for iron metabolism, connective tissue, and neurotransmitters.',
  },
  trace_selenium: {
    name: 'Selenium (Se)',
    aliases: ['Se', 'Selenium'],
    description: 'Important antioxidant for thyroid hormone synthesis and the immune system.',
  },
  trace_lead: {
    name: 'Blood Lead (Pb)',
    aliases: ['Pb', 'Lead'],
    description: 'Toxic heavy metal for detecting chronic or occupational poisoning.',
  },
  trace_mercury: {
    name: 'Blood Mercury (Hg)',
    aliases: ['Hg', 'Mercury'],
    description: 'Toxic heavy metal that damages the nervous system and kidneys.',
  },
  trace_cadmium: {
    name: 'Blood Cadmium (Cd)',
    aliases: ['Cd', 'Cadmium'],
    description: 'Toxic heavy metal (common in smokers\' blood) that damages kidneys and lungs.',
  },
  trace_arsenic: {
    name: 'Blood Arsenic (As)',
    aliases: ['As', 'Arsenic'],
    description: 'Toxic metalloid for investigating poisoning.',
  },
  trace_aluminum: {
    name: 'Serum Aluminum (Al)',
    aliases: ['Al', 'Aluminum'],
    description: 'Toxic metal; monitored in dialysis patients or occupational exposure.',
  },
  trace_manganese: {
    name: 'Blood Manganese (Mn)',
    aliases: ['Mn', 'Manganese'],
    description: 'Enzyme cofactor for bone development and antioxidant protection.',
  },
  trace_chromium: {
    name: 'Serum Chromium (Cr)',
    aliases: ['Cr', 'Chromium'],
    description: 'Trace element for glucose metabolism; also monitored with joint implants.',
  },
  trace_nickel: {
    name: 'Serum Nickel (Ni)',
    aliases: ['Ni', 'Nickel'],
    description: 'Heavy metal for testing contact allergies and implant corrosion.',
  },
  trace_cobalt: {
    name: 'Serum Cobalt (Co)',
    aliases: ['Co', 'Cobalt'],
    description: 'Component of vitamin B12; monitored with metallic joint prostheses.',
  },

  // Tumor & Special Markers
  cea: {
    name: 'Carcinoembryonic Antigen (CEA)',
    aliases: ['CEA', 'Carcinoembryonic Antigen'],
    description: 'Oncological marker for colon and other gastrointestinal cancers.',
  },
  ca_125: {
    name: 'Cancer Antigen CA 125',
    aliases: ['CA 125', 'CA-125'],
    description: 'Marker for ovarian cancer and monitoring endometriosis treatment.',
  },
  ca_19_9: {
    name: 'Cancer Antigen CA 19-9',
    aliases: ['CA 19-9', 'CA19-9'],
    description: 'Tumor marker for pancreatic, gallbladder, and gastrointestinal cancers.',
  },
  ca_15_3: {
    name: 'Cancer Antigen CA 15-3',
    aliases: ['CA 15-3', 'CA15-3'],
    description: 'Breast cancer recurrence and treatment monitoring marker.',
  },
  alpha_fetoprotein: {
    name: 'Alpha-Fetoprotein (AFP)',
    aliases: ['AFP', 'Alpha-Fetoprotein'],
    description: 'Marker for primary liver cancer (hepatocellular carcinoma) and testicular tumors.',
  },
  beta_2_microglobulin: {
    name: 'Beta-2 Microglobulin (B2M)',
    aliases: ['B2M', 'Beta-2 Microglobulin'],
    description: 'Marker of multiple myeloma, lymphomas, and renal tubular damage.',
  },
  blood_ph: {
    name: 'Blood pH',
    aliases: ['pH', 'Blood pH'],
    description: 'Blood acid-base balance indicator.',
  },
  pco2: {
    name: 'pCO2 (Partial Pressure of Carbon Dioxide)',
    aliases: ['pCO2', 'Carbon Dioxide Pressure'],
    description: 'Partial pressure of dissolved carbon dioxide in blood for testing respiratory function.',
  },
  po2: {
    name: 'pO2 (Partial Pressure of Oxygen)',
    aliases: ['pO2', 'Oxygen Pressure'],
    description: 'Partial pressure of oxygen in blood for assessing pulmonary oxygenation.',
  },
  oxygen_saturation: {
    name: 'Oxygen Saturation (sO2)',
    aliases: ['sO2', 'SaO2', 'SpO2', 'Saturation'],
    description: 'Percentage of hemoglobin saturated with oxygen.',
  },
  carboxyhemoglobin: {
    name: 'Carboxyhemoglobin (CO-Hb)',
    aliases: ['CO-Hb', 'Carboxyhemoglobin', 'Carbon Monoxide'],
    description: 'Hemoglobin bound to carbon monoxide (CO) for assessing CO poisoning.',
  },
  methemoglobin: {
    name: 'Methemoglobin (Met-Hb)',
    aliases: ['Met-Hb', 'Methemoglobin'],
    description: 'Oxidized form of hemoglobin that cannot deliver oxygen to tissues.',
  },
  ceruloplasmin: {
    name: 'Ceruloplasmin',
    aliases: ['Ceruloplasmin'],
    description: 'Copper transport protein for diagnosing Wilson\'s disease.',
  },
  alpha_1_antitrypsin: {
    name: 'Alpha-1 Antitrypsin (AAT)',
    aliases: ['AAT', 'Alpha-1 Antitrypsin'],
    description: 'Protease inhibitor protecting the liver and lungs.',
  },
};
