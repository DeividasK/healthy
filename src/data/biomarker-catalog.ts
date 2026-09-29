import { BiomarkerDefinition } from '../types/health';
import { biomarkersLt as BIOMARKER_TRANSLATIONS_LT } from '../i18n/biomarkers';

/**
 * Standard Catalog of 200+ Most Common Blood Biomarkers
 * Curated from official LOINC (Logical Observation Identifiers Names and Codes)
 * and international medical chemistry standards (IFCC, WHO, ADA, ESC).
 */
export const BIOMARKER_CATALOG: BiomarkerDefinition[] = [
  {
    "loinc": "6690-2",
    "canonicalKey": "cbc_wbc",
    "name": "White Blood Cell Count (WBC)",
    "aliases": [
      "WBC",
      "Leukocytes",
      "White Count",
      "White Blood Cells"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "10*3/uL",
    "siUnit": "10*9/L",
    "conventionalUnit": "10*3/uL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 4.5,
        "max": 11,
        "text": "4.5 - 11.0 x10^3/uL"
      },
      "si": {
        "min": 4.5,
        "max": 11,
        "text": "4.5 - 11.0 x10^9/L"
      }
    },
    "description": "Total number of white blood cells; primary indicator of infection, inflammation, or immune disorders."
  },
  {
    "loinc": "789-8",
    "canonicalKey": "cbc_rbc",
    "name": "Red Blood Cell Count (RBC)",
    "aliases": [
      "RBC",
      "Erythrocytes",
      "Red Count",
      "Red Blood Cells"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "10*6/uL",
    "siUnit": "10*12/L",
    "conventionalUnit": "10*6/uL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 4.2,
        "max": 5.9,
        "text": "4.2 - 5.9 x10^6/uL"
      },
      "si": {
        "min": 4.2,
        "max": 5.9,
        "text": "4.2 - 5.9 x10^12/L"
      }
    },
    "description": "Number of oxygen-carrying red blood cells per volume of blood."
  },
  {
    "loinc": "718-7",
    "canonicalKey": "cbc_hemoglobin",
    "name": "Hemoglobin (Hgb)",
    "aliases": [
      "Hgb",
      "Hb",
      "Hemoglobin"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "g/dL",
    "siUnit": "g/L",
    "conventionalUnit": "g/dL",
    "conversionFactor": 10,
    "referenceIntervals": {
      "conventional": {
        "min": 13.5,
        "max": 17.5,
        "text": "13.5 - 17.5 g/dL"
      },
      "si": {
        "min": 135,
        "max": 175,
        "text": "135 - 175 g/L"
      }
    },
    "description": "Iron-containing protein in red blood cells that transports oxygen throughout the body."
  },
  {
    "loinc": "4544-3",
    "canonicalKey": "cbc_hematocrit",
    "name": "Hematocrit (Hct)",
    "aliases": [
      "Hct",
      "Hematocrit",
      "Packed Cell Volume",
      "PCV"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "%",
    "siUnit": "L/L",
    "conventionalUnit": "%",
    "conversionFactor": 0.01,
    "referenceIntervals": {
      "conventional": {
        "min": 38.8,
        "max": 50,
        "text": "38.8 - 50.0 %"
      },
      "si": {
        "min": 0.388,
        "max": 0.5,
        "text": "0.388 - 0.500"
      }
    },
    "description": "Proportion of total blood volume made up of red blood cells."
  },
  {
    "loinc": "777-3",
    "canonicalKey": "cbc_platelets",
    "name": "Platelet Count (PLT)",
    "aliases": [
      "PLT",
      "Platelets",
      "Thrombocytes"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "10*3/uL",
    "siUnit": "10*9/L",
    "conventionalUnit": "10*3/uL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 150,
        "max": 450,
        "text": "150 - 450 x10^3/uL"
      },
      "si": {
        "min": 150,
        "max": 450,
        "text": "150 - 450 x10^9/L"
      }
    },
    "description": "Cell fragments essential for blood clotting and wound healing."
  },
  {
    "loinc": "787-2",
    "canonicalKey": "cbc_mcv",
    "name": "Mean Corpuscular Volume (MCV)",
    "aliases": [
      "MCV",
      "Mean Cell Volume"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "fL",
    "siUnit": "fL",
    "conventionalUnit": "fL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 80,
        "max": 100,
        "text": "80 - 100 fL"
      },
      "si": {
        "min": 80,
        "max": 100,
        "text": "80 - 100 fL"
      }
    },
    "description": "Average size of red blood cells; differentiates microcytic, normocytic, and macrocytic anemias."
  },
  {
    "loinc": "785-6",
    "canonicalKey": "cbc_mch",
    "name": "Mean Corpuscular Hemoglobin (MCH)",
    "aliases": [
      "MCH",
      "Mean Cell Hemoglobin"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "pg",
    "siUnit": "pg",
    "conventionalUnit": "pg",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 27,
        "max": 33,
        "text": "27.0 - 33.0 pg"
      },
      "si": {
        "min": 27,
        "max": 33,
        "text": "27.0 - 33.0 pg"
      }
    },
    "description": "Average mass of hemoglobin per red blood cell."
  },
  {
    "loinc": "786-4",
    "canonicalKey": "cbc_mchc",
    "name": "Mean Corpuscular Hemoglobin Concentration (MCHC)",
    "aliases": [
      "MCHC"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "g/dL",
    "siUnit": "g/L",
    "conventionalUnit": "g/dL",
    "conversionFactor": 10,
    "referenceIntervals": {
      "conventional": {
        "min": 32,
        "max": 36,
        "text": "32.0 - 36.0 g/dL"
      },
      "si": {
        "min": 320,
        "max": 360,
        "text": "320 - 360 g/L"
      }
    },
    "description": "Average concentration of hemoglobin in a given volume of packed red blood cells."
  },
  {
    "loinc": "788-0",
    "canonicalKey": "cbc_rdw_cv",
    "name": "Red Cell Distribution Width (RDW-CV)",
    "aliases": [
      "RDW",
      "RDW-CV",
      "Red Cell Distribution Width"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "%",
    "siUnit": "%",
    "conventionalUnit": "%",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 11.5,
        "max": 14.5,
        "text": "11.5 - 14.5 %"
      },
      "si": {
        "min": 11.5,
        "max": 14.5,
        "text": "11.5 - 14.5 %"
      }
    },
    "description": "Measurement of variation in red blood cell size (anisocytosis)."
  },
  {
    "loinc": "21000-5",
    "canonicalKey": "cbc_rdw_sd",
    "name": "Red Cell Distribution Width (RDW-SD)",
    "aliases": [
      "RDW-SD"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "fL",
    "siUnit": "fL",
    "conventionalUnit": "fL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 39,
        "max": 46,
        "text": "39.0 - 46.0 fL"
      },
      "si": {
        "min": 39,
        "max": 46,
        "text": "39.0 - 46.0 fL"
      }
    },
    "description": "Direct measurement of width of red blood cell distribution curve at 20% height."
  },
  {
    "loinc": "32623-1",
    "canonicalKey": "cbc_mpv",
    "name": "Mean Platelet Volume (MPV)",
    "aliases": [
      "MPV",
      "Platelet Volume"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "fL",
    "siUnit": "fL",
    "conventionalUnit": "fL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 7.5,
        "max": 11.5,
        "text": "7.5 - 11.5 fL"
      },
      "si": {
        "min": 7.5,
        "max": 11.5,
        "text": "7.5 - 11.5 fL"
      }
    },
    "description": "Average size of platelets; larger platelets often indicate active platelet production."
  },
  {
    "loinc": "770-8",
    "canonicalKey": "cbc_neutrophils_pct",
    "name": "Neutrophils (%)",
    "aliases": [
      "Neutrophils %",
      "Polys %",
      "Segs %",
      "Neutrophil Percentage"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "%",
    "siUnit": "%",
    "conventionalUnit": "%",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 40,
        "max": 70,
        "text": "40 - 70 %"
      },
      "si": {
        "min": 40,
        "max": 70,
        "text": "40 - 70 %"
      }
    },
    "description": "Primary white blood cell line responding to bacterial infections."
  },
  {
    "loinc": "751-8",
    "canonicalKey": "cbc_neutrophils_abs",
    "name": "Absolute Neutrophil Count (ANC)",
    "aliases": [
      "ANC",
      "Neutrophils Absolute",
      "Absolute Neutrophils"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "10*3/uL",
    "siUnit": "10*9/L",
    "conventionalUnit": "10*3/uL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 1.8,
        "max": 7.7,
        "text": "1.8 - 7.7 x10^3/uL"
      },
      "si": {
        "min": 1.8,
        "max": 7.7,
        "text": "1.8 - 7.7 x10^9/L"
      }
    },
    "description": "Total number of neutrophils; critical marker for evaluating infection risk and neutropenia."
  },
  {
    "loinc": "736-9",
    "canonicalKey": "cbc_lymphocytes_pct",
    "name": "Lymphocytes (%)",
    "aliases": [
      "Lymphocytes %",
      "Lymphs %"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "%",
    "siUnit": "%",
    "conventionalUnit": "%",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 20,
        "max": 40,
        "text": "20 - 40 %"
      },
      "si": {
        "min": 20,
        "max": 40,
        "text": "20 - 40 %"
      }
    },
    "description": "Percentage of white cells responsible for viral immunity and antibody production."
  },
  {
    "loinc": "731-0",
    "canonicalKey": "cbc_lymphocytes_abs",
    "name": "Absolute Lymphocyte Count (ALC)",
    "aliases": [
      "ALC",
      "Lymphocytes Absolute",
      "Absolute Lymphocytes"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "10*3/uL",
    "siUnit": "10*9/L",
    "conventionalUnit": "10*3/uL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 1,
        "max": 4,
        "text": "1.0 - 4.0 x10^3/uL"
      },
      "si": {
        "min": 1,
        "max": 4,
        "text": "1.0 - 4.0 x10^9/L"
      }
    },
    "description": "Absolute number of circulating T cells, B cells, and NK cells."
  },
  {
    "loinc": "744-3",
    "canonicalKey": "cbc_monocytes_pct",
    "name": "Monocytes (%)",
    "aliases": [
      "Monocytes %",
      "Monos %"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "%",
    "siUnit": "%",
    "conventionalUnit": "%",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 2,
        "max": 8,
        "text": "2 - 8 %"
      },
      "si": {
        "min": 2,
        "max": 8,
        "text": "2 - 8 %"
      }
    },
    "description": "Precursor cells that migrate into tissues to become macrophages."
  },
  {
    "loinc": "742-7",
    "canonicalKey": "cbc_monocytes_abs",
    "name": "Absolute Monocyte Count",
    "aliases": [
      "Monocytes Absolute",
      "AMC"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "10*3/uL",
    "siUnit": "10*9/L",
    "conventionalUnit": "10*3/uL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.2,
        "max": 0.8,
        "text": "0.2 - 0.8 x10^3/uL"
      },
      "si": {
        "min": 0.2,
        "max": 0.8,
        "text": "0.2 - 0.8 x10^9/L"
      }
    },
    "description": "Total number of circulating monocytes."
  },
  {
    "loinc": "713-8",
    "canonicalKey": "cbc_eosinophils_pct",
    "name": "Eosinophils (%)",
    "aliases": [
      "Eosinophils %",
      "Eos %"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "%",
    "siUnit": "%",
    "conventionalUnit": "%",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 1,
        "max": 4,
        "text": "1 - 4 %"
      },
      "si": {
        "min": 1,
        "max": 4,
        "text": "1 - 4 %"
      }
    },
    "description": "Immune cells involved in allergic reactions, asthma, and parasitic defense."
  },
  {
    "loinc": "711-2",
    "canonicalKey": "cbc_eosinophils_abs",
    "name": "Absolute Eosinophil Count (AEC)",
    "aliases": [
      "AEC",
      "Eosinophils Absolute"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "10*3/uL",
    "siUnit": "10*9/L",
    "conventionalUnit": "10*3/uL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.05,
        "max": 0.5,
        "text": "0.05 - 0.50 x10^3/uL"
      },
      "si": {
        "min": 0.05,
        "max": 0.5,
        "text": "0.05 - 0.50 x10^9/L"
      }
    },
    "description": "Total number of circulating eosinophils."
  },
  {
    "loinc": "706-2",
    "canonicalKey": "cbc_basophils_pct",
    "name": "Basophils (%)",
    "aliases": [
      "Basophils %",
      "Basos %"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "%",
    "siUnit": "%",
    "conventionalUnit": "%",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.5,
        "max": 1.5,
        "text": "0.5 - 1.5 %"
      },
      "si": {
        "min": 0.5,
        "max": 1.5,
        "text": "0.5 - 1.5 %"
      }
    },
    "description": "Granulocytes releasing histamine during inflammatory responses."
  },
  {
    "loinc": "704-7",
    "canonicalKey": "cbc_basophils_abs",
    "name": "Absolute Basophil Count",
    "aliases": [
      "Basophils Absolute"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "10*3/uL",
    "siUnit": "10*9/L",
    "conventionalUnit": "10*3/uL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.01,
        "max": 0.1,
        "text": "0.01 - 0.10 x10^3/uL"
      },
      "si": {
        "min": 0.01,
        "max": 0.1,
        "text": "0.01 - 0.10 x10^9/L"
      }
    },
    "description": "Total number of circulating basophils."
  },
  {
    "loinc": "40443-4",
    "canonicalKey": "cbc_immature_granulocytes_pct",
    "name": "Immature Granulocytes (%)",
    "aliases": [
      "IG %",
      "Immature Granulocytes"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "%",
    "siUnit": "%",
    "conventionalUnit": "%",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 0.6,
        "text": "0.0 - 0.6 %"
      },
      "si": {
        "min": 0,
        "max": 0.6,
        "text": "0.0 - 0.6 %"
      }
    },
    "description": "Early-stage granulocytes (metamyelocytes, myelocytes, promyelocytes) signaling bone marrow stress."
  },
  {
    "loinc": "14196-0",
    "canonicalKey": "cbc_reticulocytes_pct",
    "name": "Reticulocyte Count (%)",
    "aliases": [
      "Reticulocytes %",
      "Retics %"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "%",
    "siUnit": "%",
    "conventionalUnit": "%",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.5,
        "max": 2.5,
        "text": "0.5 - 2.5 %"
      },
      "si": {
        "min": 0.5,
        "max": 2.5,
        "text": "0.5 - 2.5 %"
      }
    },
    "description": "Percentage of newly released immature red blood cells; evaluates bone marrow response."
  },
  {
    "loinc": "34714-6",
    "canonicalKey": "cbc_reticulocytes_abs",
    "name": "Absolute Reticulocyte Count",
    "aliases": [
      "Reticulocytes Absolute",
      "ARC"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "10*3/uL",
    "siUnit": "10*9/L",
    "conventionalUnit": "10*3/uL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 25,
        "max": 100,
        "text": "25 - 100 x10^3/uL"
      },
      "si": {
        "min": 25,
        "max": 100,
        "text": "25 - 100 x10^9/L"
      }
    },
    "description": "Absolute number of reticulocytes; gold standard for evaluating erythropoietic activity."
  },
  {
    "loinc": "32207-3",
    "canonicalKey": "cbc_plateletcrit",
    "name": "Plateletcrit (PCT)",
    "aliases": [
      "PCT",
      "Plateletcrit"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "%",
    "siUnit": "%",
    "conventionalUnit": "%",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.17,
        "max": 0.35,
        "text": "0.17 - 0.35 %"
      },
      "si": {
        "min": 0.17,
        "max": 0.35,
        "text": "0.17 - 0.35 %"
      }
    },
    "description": "Volume percentage occupied by platelets in blood, calculated from platelet count and MPV."
  },
  {
    "loinc": "2093-3",
    "canonicalKey": "lipid_total_cholesterol",
    "name": "Total Cholesterol",
    "aliases": [
      "Cholesterol",
      "TC",
      "Cholesterol Total"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "mg/dL",
    "siUnit": "mmol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.02586,
    "referenceIntervals": {
      "conventional": {
        "min": 125,
        "max": 200,
        "text": "< 200 mg/dL"
      },
      "si": {
        "min": 3.2,
        "max": 5.2,
        "text": "< 5.2 mmol/L"
      }
    },
    "description": "Overall measure of cholesterol particles in blood; primary cardiovascular screening marker."
  },
  {
    "loinc": "2085-9",
    "canonicalKey": "lipid_hdl",
    "name": "HDL Cholesterol",
    "aliases": [
      "HDL",
      "High-Density Lipoprotein",
      "Good Cholesterol"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "mg/dL",
    "siUnit": "mmol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.02586,
    "referenceIntervals": {
      "conventional": {
        "min": 40,
        "max": 80,
        "text": "> 40 mg/dL (M), > 50 mg/dL (F)"
      },
      "si": {
        "min": 1,
        "max": 2.1,
        "text": "> 1.0 mmol/L"
      }
    },
    "description": "High-density lipoprotein that scavenges excess cholesterol from arteries back to the liver."
  },
  {
    "loinc": "13457-7",
    "canonicalKey": "lipid_ldl_calculated",
    "name": "LDL Cholesterol (Calculated)",
    "aliases": [
      "LDL",
      "LDL-C",
      "Low-Density Lipoprotein",
      "Bad Cholesterol"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "mg/dL",
    "siUnit": "mmol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.02586,
    "referenceIntervals": {
      "conventional": {
        "min": 50,
        "max": 100,
        "text": "< 100 mg/dL (Optimal)"
      },
      "si": {
        "min": 1.3,
        "max": 2.6,
        "text": "< 2.6 mmol/L"
      }
    },
    "description": "Atherogenic lipoprotein that deposits cholesterol in arterial walls; primary therapeutic target."
  },
  {
    "loinc": "18262-6",
    "canonicalKey": "lipid_ldl_direct",
    "name": "LDL Cholesterol (Direct / Measured)",
    "aliases": [
      "Direct LDL",
      "Direct LDL-C"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "mg/dL",
    "siUnit": "mmol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.02586,
    "referenceIntervals": {
      "conventional": {
        "min": 50,
        "max": 100,
        "text": "< 100 mg/dL"
      },
      "si": {
        "min": 1.3,
        "max": 2.6,
        "text": "< 2.6 mmol/L"
      }
    },
    "description": "Directly measured LDL cholesterol, unaffected by high triglycerides where Friedewald calculation fails."
  },
  {
    "loinc": "2571-8",
    "canonicalKey": "lipid_triglycerides",
    "name": "Triglycerides",
    "aliases": [
      "Triglycerides",
      "TG",
      "Trigs"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "mg/dL",
    "siUnit": "mmol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.01129,
    "referenceIntervals": {
      "conventional": {
        "min": 40,
        "max": 150,
        "text": "< 150 mg/dL"
      },
      "si": {
        "min": 0.45,
        "max": 1.7,
        "text": "< 1.7 mmol/L"
      }
    },
    "description": "Major form of fat circulating in the bloodstream; elevated levels correlate with metabolic syndrome."
  },
  {
    "loinc": "13458-5",
    "canonicalKey": "lipid_vldl",
    "name": "VLDL Cholesterol",
    "aliases": [
      "VLDL",
      "VLDL-C"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "mg/dL",
    "siUnit": "mmol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.02586,
    "referenceIntervals": {
      "conventional": {
        "min": 5,
        "max": 30,
        "text": "5 - 30 mg/dL"
      },
      "si": {
        "min": 0.1,
        "max": 0.8,
        "text": "0.1 - 0.8 mmol/L"
      }
    },
    "description": "Very low-density lipoprotein carrying endogenous triglycerides from liver to tissues."
  },
  {
    "loinc": "43396-1",
    "canonicalKey": "lipid_non_hdl",
    "name": "Non-HDL Cholesterol",
    "aliases": [
      "Non-HDL",
      "Non-HDL-C"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "mg/dL",
    "siUnit": "mmol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.02586,
    "referenceIntervals": {
      "conventional": {
        "min": 60,
        "max": 130,
        "text": "< 130 mg/dL"
      },
      "si": {
        "min": 1.5,
        "max": 3.4,
        "text": "< 3.4 mmol/L"
      }
    },
    "description": "Total cholesterol minus HDL; reflects all atherogenic particles (LDL, VLDL, IDL, Lp(a))."
  },
  {
    "loinc": "9830-1",
    "canonicalKey": "lipid_cholesterol_hdl_ratio",
    "name": "Total Cholesterol / HDL Ratio",
    "aliases": [
      "TC/HDL",
      "Chol/HDL Ratio"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "ratio",
    "siUnit": "ratio",
    "conventionalUnit": "ratio",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 2,
        "max": 4.5,
        "text": "< 4.5 (Optimal < 3.5)"
      },
      "si": {
        "min": 2,
        "max": 4.5,
        "text": "< 4.5"
      }
    },
    "description": "Atherogenic index estimating cardiovascular risk profile."
  },
  {
    "loinc": "1884-6",
    "canonicalKey": "lipid_apob",
    "name": "Apolipoprotein B (ApoB)",
    "aliases": [
      "ApoB",
      "Apo B",
      "Apolipoprotein B-100"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "mg/dL",
    "siUnit": "g/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.01,
    "referenceIntervals": {
      "conventional": {
        "min": 60,
        "max": 90,
        "text": "< 90 mg/dL (High risk < 80)"
      },
      "si": {
        "min": 0.6,
        "max": 0.9,
        "text": "< 0.9 g/L"
      }
    },
    "description": "Direct count of all atherogenic lipoprotein particles in circulation; superior to LDL-C for risk prediction."
  },
  {
    "loinc": "1869-7",
    "canonicalKey": "lipid_apoa1",
    "name": "Apolipoprotein A1 (ApoA1)",
    "aliases": [
      "ApoA1",
      "Apo A-1",
      "Apolipoprotein A-I"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "mg/dL",
    "siUnit": "g/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.01,
    "referenceIntervals": {
      "conventional": {
        "min": 115,
        "max": 190,
        "text": "115 - 190 mg/dL"
      },
      "si": {
        "min": 1.15,
        "max": 1.9,
        "text": "1.15 - 1.90 g/L"
      }
    },
    "description": "Primary protein constituent of HDL particles; reflects reverse cholesterol transport capacity."
  },
  {
    "loinc": "10835-7",
    "canonicalKey": "lipid_lpa",
    "name": "Lipoprotein(a) [Lp(a)]",
    "aliases": [
      "Lp(a)",
      "Lipoprotein (a)",
      "Lipoprotein a"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "nmol/L",
    "siUnit": "nmol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 2.5,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 30,
        "text": "< 30 mg/dL"
      },
      "si": {
        "min": 0,
        "max": 75,
        "text": "< 75 nmol/L"
      }
    },
    "description": "Genetically determined LDL variant with pro-thrombotic properties; independent risk factor for stroke and CAD."
  },
  {
    "loinc": "30522-7",
    "canonicalKey": "cardio_hscrp",
    "name": "High-Sensitivity C-Reactive Protein (hs-CRP)",
    "aliases": [
      "hs-CRP",
      "Cardio CRP",
      "High Sensitivity CRP"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "mg/L",
    "siUnit": "mg/L",
    "conventionalUnit": "mg/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.1,
        "max": 1,
        "text": "< 1.0 mg/L (Low Risk)"
      },
      "si": {
        "min": 0.1,
        "max": 1,
        "text": "< 1.0 mg/L"
      }
    },
    "description": "Sensitive marker of vascular low-grade inflammation predicting future cardiovascular events."
  },
  {
    "loinc": "13965-9",
    "canonicalKey": "cardio_homocysteine",
    "name": "Homocysteine",
    "aliases": [
      "Homocysteine",
      "HCY"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "umol/L",
    "siUnit": "umol/L",
    "conventionalUnit": "umol/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 5,
        "max": 12,
        "text": "5.0 - 12.0 umol/L"
      },
      "si": {
        "min": 5,
        "max": 12,
        "text": "5.0 - 12.0 umol/L"
      }
    },
    "description": "Amino acid byproduct of methionine metabolism; elevated levels correlate with vascular endothelial damage."
  },
  {
    "loinc": "10839-9",
    "canonicalKey": "cardio_troponin_i",
    "name": "Troponin I (High Sensitivity)",
    "aliases": [
      "hs-cTnI",
      "Troponin I",
      "Cardiac Troponin I"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "ng/L",
    "siUnit": "ng/L",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 1000,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 0.014,
        "text": "< 0.014 ng/mL"
      },
      "si": {
        "min": 0,
        "max": 14,
        "text": "< 14 ng/L"
      }
    },
    "description": "Gold standard myocardial necrosis biomarker used to detect acute coronary syndromes."
  },
  {
    "loinc": "6598-7",
    "canonicalKey": "cardio_troponin_t",
    "name": "Troponin T (High Sensitivity)",
    "aliases": [
      "hs-cTnT",
      "Troponin T"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "ng/L",
    "siUnit": "ng/L",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 1000,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 0.014,
        "text": "< 0.014 ng/mL"
      },
      "si": {
        "min": 0,
        "max": 14,
        "text": "< 14 ng/L"
      }
    },
    "description": "Cardiac protein released into bloodstream during myocardial injury."
  },
  {
    "loinc": "30934-4",
    "canonicalKey": "cardio_bnp",
    "name": "B-Type Natriuretic Peptide (BNP)",
    "aliases": [
      "BNP",
      "Brain Natriuretic Peptide"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "pg/mL",
    "siUnit": "ng/L",
    "conventionalUnit": "pg/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 100,
        "text": "< 100 pg/mL"
      },
      "si": {
        "min": 0,
        "max": 100,
        "text": "< 100 ng/L"
      }
    },
    "description": "Hormone secreted by ventricles in response to volume expansion and pressure overload; screens heart failure."
  },
  {
    "loinc": "33762-6",
    "canonicalKey": "cardio_nt_probnp",
    "name": "NT-proBNP",
    "aliases": [
      "NT-proBNP",
      "N-Terminal proBNP"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "pg/mL",
    "siUnit": "ng/L",
    "conventionalUnit": "pg/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 125,
        "text": "< 125 pg/mL (<75yo)"
      },
      "si": {
        "min": 0,
        "max": 125,
        "text": "< 125 ng/L"
      }
    },
    "description": "Inactive cleavage fragment of proBNP with longer half-life; highly sensitive for heart failure."
  },
  {
    "loinc": "2157-6",
    "canonicalKey": "cardio_ck",
    "name": "Creatine Kinase (Total CK)",
    "aliases": [
      "CK",
      "CPK",
      "Creatine Phosphokinase"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "U/L",
    "siUnit": "U/L",
    "conventionalUnit": "U/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 30,
        "max": 200,
        "text": "30 - 200 U/L"
      },
      "si": {
        "min": 30,
        "max": 200,
        "text": "30 - 200 U/L"
      }
    },
    "description": "Enzyme found in skeletal muscle, heart, and brain; elevated after strenuous exercise, injury, or infarction."
  },
  {
    "loinc": "13969-1",
    "canonicalKey": "cardio_ck_mb",
    "name": "Creatine Kinase-MB (CK-MB)",
    "aliases": [
      "CK-MB",
      "CKMB"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "ng/mL",
    "siUnit": "ug/L",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 5,
        "text": "< 5.0 ng/mL"
      },
      "si": {
        "min": 0,
        "max": 5,
        "text": "< 5.0 ug/L"
      }
    },
    "description": "Specific isoenzyme of creatine kinase concentrated in cardiac tissue."
  },
  {
    "loinc": "2601-3",
    "canonicalKey": "cardio_myoglobin",
    "name": "Myoglobin",
    "aliases": [
      "Myoglobin"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "ng/mL",
    "siUnit": "nmol/L",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 0.0571,
    "referenceIntervals": {
      "conventional": {
        "min": 25,
        "max": 72,
        "text": "25 - 72 ng/mL"
      },
      "si": {
        "min": 1.4,
        "max": 4.1,
        "text": "1.4 - 4.1 nmol/L"
      }
    },
    "description": "Early oxygen-binding heme protein released quickly into bloodstream after muscle or cardiac injury."
  },
  {
    "loinc": "1558-6",
    "canonicalKey": "metabolic_fasting_glucose",
    "name": "Fasting Glucose",
    "aliases": [
      "Glucose",
      "Blood Sugar",
      "Fasting Blood Sugar",
      "FBS"
    ],
    "category": "Metabolic & Renal",
    "primaryUnit": "mg/dL",
    "siUnit": "mmol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.0555,
    "referenceIntervals": {
      "conventional": {
        "min": 70,
        "max": 99,
        "text": "70 - 99 mg/dL"
      },
      "si": {
        "min": 3.9,
        "max": 5.5,
        "text": "3.9 - 5.5 mmol/L"
      }
    },
    "description": "Primary blood sugar level after an overnight fast; key screening test for prediabetes and diabetes."
  },
  {
    "loinc": "4548-4",
    "canonicalKey": "metabolic_hba1c",
    "name": "Hemoglobin A1c (HbA1c)",
    "aliases": [
      "HbA1c",
      "A1C",
      "Glycated Hemoglobin",
      "A1c"
    ],
    "category": "Metabolic & Renal",
    "primaryUnit": "%",
    "siUnit": "mmol/mol",
    "conventionalUnit": "%",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 4,
        "max": 5.6,
        "text": "4.0 - 5.6 %"
      },
      "si": {
        "min": 20,
        "max": 38,
        "text": "20 - 38 mmol/mol"
      }
    },
    "description": "Reflects weighted average blood glucose concentrations over the previous 60 to 90 days."
  },
  {
    "loinc": "20448-7",
    "canonicalKey": "metabolic_estimated_avg_glucose",
    "name": "Estimated Average Glucose (eAG)",
    "aliases": [
      "eAG",
      "Estimated Average Glucose"
    ],
    "category": "Metabolic & Renal",
    "primaryUnit": "mg/dL",
    "siUnit": "mmol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.0555,
    "referenceIntervals": {
      "conventional": {
        "min": 70,
        "max": 114,
        "text": "< 114 mg/dL"
      },
      "si": {
        "min": 3.9,
        "max": 6.3,
        "text": "< 6.3 mmol/L"
      }
    },
    "description": "Calculated average glucose directly derived from HbA1c to correlate with home fingerstick meters."
  },
  {
    "loinc": "20436-2",
    "canonicalKey": "metabolic_fasting_insulin",
    "name": "Fasting Insulin",
    "aliases": [
      "Insulin",
      "Fasting Insulin",
      "Serum Insulin"
    ],
    "category": "Metabolic & Renal",
    "primaryUnit": "uIU/mL",
    "siUnit": "pmol/L",
    "conventionalUnit": "uIU/mL",
    "conversionFactor": 6.945,
    "referenceIntervals": {
      "conventional": {
        "min": 2.6,
        "max": 24.9,
        "text": "2.6 - 24.9 uIU/mL (Optimal < 8)"
      },
      "si": {
        "min": 18,
        "max": 173,
        "text": "18 - 173 pmol/L"
      }
    },
    "description": "Pancreatic beta cell hormone regulating glucose uptake; critical indicator of early insulin resistance."
  },
  {
    "loinc": "1988-5",
    "canonicalKey": "metabolic_c_peptide",
    "name": "C-Peptide",
    "aliases": [
      "C-Peptide",
      "Connecting Peptide"
    ],
    "category": "Metabolic & Renal",
    "primaryUnit": "ng/mL",
    "siUnit": "nmol/L",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 0.331,
    "referenceIntervals": {
      "conventional": {
        "min": 0.8,
        "max": 3.8,
        "text": "0.8 - 3.8 ng/mL"
      },
      "si": {
        "min": 0.26,
        "max": 1.26,
        "text": "0.26 - 1.26 nmol/L"
      }
    },
    "description": "Equimolar cleavage product of proinsulin; accurately assesses endogenous insulin production."
  },
  {
    "loinc": "3094-0",
    "canonicalKey": "renal_bun",
    "name": "Blood Urea Nitrogen (BUN)",
    "aliases": [
      "BUN",
      "Urea Nitrogen",
      "Serum Urea"
    ],
    "category": "Metabolic & Renal",
    "primaryUnit": "mg/dL",
    "siUnit": "mmol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.357,
    "referenceIntervals": {
      "conventional": {
        "min": 7,
        "max": 20,
        "text": "7 - 20 mg/dL"
      },
      "si": {
        "min": 2.5,
        "max": 7.1,
        "text": "2.5 - 7.1 mmol/L"
      }
    },
    "description": "Waste product of dietary and cellular protein breakdown filtered by the kidneys."
  },
  {
    "loinc": "2160-0",
    "canonicalKey": "renal_creatinine",
    "name": "Serum Creatinine",
    "aliases": [
      "Creatinine",
      "Cr",
      "Serum Cr"
    ],
    "category": "Metabolic & Renal",
    "primaryUnit": "mg/dL",
    "siUnit": "umol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 88.4,
    "referenceIntervals": {
      "conventional": {
        "min": 0.6,
        "max": 1.3,
        "text": "0.6 - 1.3 mg/dL"
      },
      "si": {
        "min": 53,
        "max": 115,
        "text": "53 - 115 umol/L"
      }
    },
    "description": "Constant breakdown product of creatine phosphate in muscle; primary indicator of glomerular filtration."
  },
  {
    "loinc": "98979-8",
    "canonicalKey": "renal_egfr",
    "name": "eGFR (CKD-EPI)",
    "aliases": [
      "eGFR",
      "Estimated Glomerular Filtration Rate",
      "GFR"
    ],
    "category": "Metabolic & Renal",
    "primaryUnit": "mL/min/1.73m2",
    "siUnit": "mL/min/1.73m2",
    "conventionalUnit": "mL/min/1.73m2",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 60,
        "max": 120,
        "text": "> 60 mL/min/1.73m2"
      },
      "si": {
        "min": 60,
        "max": 120,
        "text": "> 60 mL/min/1.73m2"
      }
    },
    "description": "Calculated measure of overall kidney filtration efficiency based on creatinine, age, and biological sex."
  },
  {
    "loinc": "33914-3",
    "canonicalKey": "renal_cystatin_c",
    "name": "Cystatin C",
    "aliases": [
      "Cystatin C",
      "CysC"
    ],
    "category": "Metabolic & Renal",
    "primaryUnit": "mg/L",
    "siUnit": "mg/L",
    "conventionalUnit": "mg/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.62,
        "max": 1.15,
        "text": "0.62 - 1.15 mg/L"
      },
      "si": {
        "min": 0.62,
        "max": 1.15,
        "text": "0.62 - 1.15 mg/L"
      }
    },
    "description": "Alternative kidney function biomarker unaffected by muscle mass, diet, or amputations."
  },
  {
    "loinc": "3097-3",
    "canonicalKey": "renal_bun_creatinine_ratio",
    "name": "BUN / Creatinine Ratio",
    "aliases": [
      "BUN/Cr",
      "BUN:Creatinine Ratio"
    ],
    "category": "Metabolic & Renal",
    "primaryUnit": "ratio",
    "siUnit": "ratio",
    "conventionalUnit": "ratio",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 10,
        "max": 20,
        "text": "10 - 20"
      },
      "si": {
        "min": 10,
        "max": 20,
        "text": "10 - 20"
      }
    },
    "description": "Differentiates prerenal causes (dehydration, upper GI bleeding) from intrinsic renal damage."
  },
  {
    "loinc": "3084-1",
    "canonicalKey": "metabolic_uric_acid",
    "name": "Uric Acid",
    "aliases": [
      "Uric Acid",
      "Serum Urate"
    ],
    "category": "Metabolic & Renal",
    "primaryUnit": "mg/dL",
    "siUnit": "umol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 59.48,
    "referenceIntervals": {
      "conventional": {
        "min": 3.5,
        "max": 7.2,
        "text": "3.5 - 7.2 mg/dL"
      },
      "si": {
        "min": 208,
        "max": 428,
        "text": "208 - 428 umol/L"
      }
    },
    "description": "End product of purine nucleotide degradation; elevated in gout, metabolic syndrome, and kidney stones."
  },
  {
    "loinc": "2777-1",
    "canonicalKey": "metabolic_lactate",
    "name": "Lactic Acid (Lactate)",
    "aliases": [
      "Lactate",
      "Lactic Acid"
    ],
    "category": "Metabolic & Renal",
    "primaryUnit": "mmol/L",
    "siUnit": "mmol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.111,
    "referenceIntervals": {
      "conventional": {
        "min": 4.5,
        "max": 19.8,
        "text": "4.5 - 19.8 mg/dL"
      },
      "si": {
        "min": 0.5,
        "max": 2.2,
        "text": "0.5 - 2.2 mmol/L"
      }
    },
    "description": "Byproduct of anaerobic carbohydrate metabolism; marker of tissue hypoperfusion, sepsis, and hypoxia."
  },
  {
    "loinc": "2514-8",
    "canonicalKey": "metabolic_ketones",
    "name": "Beta-Hydroxybutyrate",
    "aliases": [
      "Ketones",
      "BOHB",
      "Beta-Hydroxybutyric Acid"
    ],
    "category": "Metabolic & Renal",
    "primaryUnit": "mmol/L",
    "siUnit": "mmol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 10.4,
    "referenceIntervals": {
      "conventional": {
        "min": 0.2,
        "max": 2.8,
        "text": "< 2.8 mg/dL"
      },
      "si": {
        "min": 0.02,
        "max": 0.27,
        "text": "< 0.27 mmol/L"
      }
    },
    "description": "Predominant circulating ketone body during ketosis and diabetic ketoacidosis."
  },
  {
    "loinc": "14959-1",
    "canonicalKey": "metabolic_microalbumin_urine",
    "name": "Microalbumin / Creatinine Ratio (Urine)",
    "aliases": [
      "uACR",
      "Microalbumin/Cr",
      "Urine Albumin/Creatinine"
    ],
    "category": "Metabolic & Renal",
    "primaryUnit": "mg/g",
    "siUnit": "mg/mmol",
    "conventionalUnit": "mg/g",
    "conversionFactor": 0.113,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 30,
        "text": "< 30 mg/g"
      },
      "si": {
        "min": 0,
        "max": 3.4,
        "text": "< 3.4 mg/mmol"
      }
    },
    "description": "Earliest clinical detector of diabetic nephropathy and hypertensive renal microvascular injury."
  },
  {
    "loinc": "14804-9",
    "canonicalKey": "metabolic_fructosamine",
    "name": "Fructosamine",
    "aliases": [
      "Fructosamine",
      "Glycated Serum Protein"
    ],
    "category": "Metabolic & Renal",
    "primaryUnit": "umol/L",
    "siUnit": "umol/L",
    "conventionalUnit": "umol/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 200,
        "max": 285,
        "text": "200 - 285 umol/L"
      },
      "si": {
        "min": 200,
        "max": 285,
        "text": "200 - 285 umol/L"
      }
    },
    "description": "Reflects glycemic control over the preceding 2 to 3 weeks; ideal when HbA1c is unreliable."
  },
  {
    "loinc": "2951-2",
    "canonicalKey": "electrolyte_sodium",
    "name": "Sodium (Na)",
    "aliases": [
      "Sodium",
      "Na",
      "Serum Sodium"
    ],
    "category": "Electrolytes & Minerals",
    "primaryUnit": "mEq/L",
    "siUnit": "mmol/L",
    "conventionalUnit": "mEq/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 135,
        "max": 145,
        "text": "135 - 145 mEq/L"
      },
      "si": {
        "min": 135,
        "max": 145,
        "text": "135 - 145 mmol/L"
      }
    },
    "description": "Major extracellular cation regulating fluid balance, blood pressure, and neurological function."
  },
  {
    "loinc": "2823-3",
    "canonicalKey": "electrolyte_potassium",
    "name": "Potassium (K)",
    "aliases": [
      "Potassium",
      "K",
      "Serum Potassium"
    ],
    "category": "Electrolytes & Minerals",
    "primaryUnit": "mEq/L",
    "siUnit": "mmol/L",
    "conventionalUnit": "mEq/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 3.5,
        "max": 5.2,
        "text": "3.5 - 5.2 mEq/L"
      },
      "si": {
        "min": 3.5,
        "max": 5.2,
        "text": "3.5 - 5.2 mmol/L"
      }
    },
    "description": "Major intracellular cation essential for myocardial conduction and neuromuscular stability."
  },
  {
    "loinc": "2075-0",
    "canonicalKey": "electrolyte_chloride",
    "name": "Chloride (Cl)",
    "aliases": [
      "Chloride",
      "Cl"
    ],
    "category": "Electrolytes & Minerals",
    "primaryUnit": "mEq/L",
    "siUnit": "mmol/L",
    "conventionalUnit": "mEq/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 96,
        "max": 106,
        "text": "96 - 106 mEq/L"
      },
      "si": {
        "min": 96,
        "max": 106,
        "text": "96 - 106 mmol/L"
      }
    },
    "description": "Primary extracellular anion maintaining osmotic pressure and acid-base balance."
  },
  {
    "loinc": "1963-8",
    "canonicalKey": "electrolyte_bicarbonate",
    "name": "Bicarbonate / Carbon Dioxide (CO2)",
    "aliases": [
      "CO2",
      "Bicarbonate",
      "Total CO2",
      "HCO3"
    ],
    "category": "Electrolytes & Minerals",
    "primaryUnit": "mEq/L",
    "siUnit": "mmol/L",
    "conventionalUnit": "mEq/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 22,
        "max": 29,
        "text": "22 - 29 mEq/L"
      },
      "si": {
        "min": 22,
        "max": 29,
        "text": "22 - 29 mmol/L"
      }
    },
    "description": "Key buffer maintaining the physiological pH of blood and systemic acid-base equilibrium."
  },
  {
    "loinc": "17861-6",
    "canonicalKey": "electrolyte_calcium",
    "name": "Total Calcium (Ca)",
    "aliases": [
      "Calcium",
      "Serum Calcium",
      "Ca"
    ],
    "category": "Electrolytes & Minerals",
    "primaryUnit": "mg/dL",
    "siUnit": "mmol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.25,
    "referenceIntervals": {
      "conventional": {
        "min": 8.5,
        "max": 10.5,
        "text": "8.5 - 10.5 mg/dL"
      },
      "si": {
        "min": 2.15,
        "max": 2.55,
        "text": "2.15 - 2.55 mmol/L"
      }
    },
    "description": "Essential for bone mineralization, muscle contraction, nerve impulse transmission, and coagulation."
  },
  {
    "loinc": "1994-3",
    "canonicalKey": "electrolyte_calcium_ionized",
    "name": "Ionized Calcium (Free Ca2+)",
    "aliases": [
      "Ionized Calcium",
      "Free Calcium"
    ],
    "category": "Electrolytes & Minerals",
    "primaryUnit": "mg/dL",
    "siUnit": "mmol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.25,
    "referenceIntervals": {
      "conventional": {
        "min": 4.6,
        "max": 5.3,
        "text": "4.6 - 5.3 mg/dL"
      },
      "si": {
        "min": 1.15,
        "max": 1.33,
        "text": "1.15 - 1.33 mmol/L"
      }
    },
    "description": "Biologically active, unbound fraction of calcium unaffected by serum albumin fluctuations."
  },
  {
    "loinc": "2774-8",
    "canonicalKey": "electrolyte_phosphate",
    "name": "Phosphorus / Phosphate (PO4)",
    "aliases": [
      "Phosphorus",
      "Phosphate",
      "Inorganic Phosphate"
    ],
    "category": "Electrolytes & Minerals",
    "primaryUnit": "mg/dL",
    "siUnit": "mmol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.3229,
    "referenceIntervals": {
      "conventional": {
        "min": 2.5,
        "max": 4.5,
        "text": "2.5 - 4.5 mg/dL"
      },
      "si": {
        "min": 0.81,
        "max": 1.45,
        "text": "0.81 - 1.45 mmol/L"
      }
    },
    "description": "Partner to calcium in bone mineralization and energy (ATP) storage and metabolism."
  },
  {
    "loinc": "2601-3",
    "canonicalKey": "electrolyte_magnesium",
    "name": "Serum Magnesium (Mg)",
    "aliases": [
      "Magnesium",
      "Mg",
      "Serum Mg"
    ],
    "category": "Electrolytes & Minerals",
    "primaryUnit": "mg/dL",
    "siUnit": "mmol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.4114,
    "referenceIntervals": {
      "conventional": {
        "min": 1.7,
        "max": 2.4,
        "text": "1.7 - 2.4 mg/dL"
      },
      "si": {
        "min": 0.7,
        "max": 1.05,
        "text": "0.70 - 1.05 mmol/L"
      }
    },
    "description": "Cofactor in over 300 biochemical reactions including ATP synthesis, protein production, and cardiac stability."
  },
  {
    "loinc": "1863-0",
    "canonicalKey": "electrolyte_anion_gap",
    "name": "Anion Gap",
    "aliases": [
      "Anion Gap",
      "AGAP"
    ],
    "category": "Electrolytes & Minerals",
    "primaryUnit": "mEq/L",
    "siUnit": "mmol/L",
    "conventionalUnit": "mEq/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 4,
        "max": 12,
        "text": "4 - 12 mEq/L"
      },
      "si": {
        "min": 4,
        "max": 12,
        "text": "4 - 12 mmol/L"
      }
    },
    "description": "Calculated difference between measured cations (Na) and anions (Cl + HCO3) to assess metabolic acidosis."
  },
  {
    "loinc": "2713-6",
    "canonicalKey": "electrolyte_osmolality",
    "name": "Serum Osmolality",
    "aliases": [
      "Osmolality",
      "Serum Osmolality"
    ],
    "category": "Electrolytes & Minerals",
    "primaryUnit": "mOsm/kg",
    "siUnit": "mmol/kg",
    "conventionalUnit": "mOsm/kg",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 275,
        "max": 295,
        "text": "275 - 295 mOsm/kg"
      },
      "si": {
        "min": 275,
        "max": 295,
        "text": "275 - 295 mmol/kg"
      }
    },
    "description": "Measure of dissolved solute concentration per kg of serum water; evaluates hydration and hyponatremia."
  },
  {
    "loinc": "1742-6",
    "canonicalKey": "liver_alt",
    "name": "Alanine Aminotransferase (ALT / SGPT)",
    "aliases": [
      "ALT",
      "SGPT",
      "Alanine Transaminase"
    ],
    "category": "Liver & Enzymes",
    "primaryUnit": "U/L",
    "siUnit": "U/L",
    "conventionalUnit": "U/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 7,
        "max": 45,
        "text": "7 - 45 U/L"
      },
      "si": {
        "min": 7,
        "max": 45,
        "text": "7 - 45 U/L"
      }
    },
    "description": "Liver-specific enzyme released into the blood in acute hepatocellular injury or hepatitis."
  },
  {
    "loinc": "1920-8",
    "canonicalKey": "liver_ast",
    "name": "Aspartate Aminotransferase (AST / SGOT)",
    "aliases": [
      "AST",
      "SGOT",
      "Aspartate Transaminase"
    ],
    "category": "Liver & Enzymes",
    "primaryUnit": "U/L",
    "siUnit": "U/L",
    "conventionalUnit": "U/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 8,
        "max": 40,
        "text": "8 - 40 U/L"
      },
      "si": {
        "min": 8,
        "max": 40,
        "text": "8 - 40 U/L"
      }
    },
    "description": "Enzyme present in liver, heart, and skeletal muscle; evaluated alongside ALT (AST/ALT ratio)."
  },
  {
    "loinc": "6768-6",
    "canonicalKey": "liver_alp",
    "name": "Alkaline Phosphatase (ALP)",
    "aliases": [
      "ALP",
      "Alk Phos"
    ],
    "category": "Liver & Enzymes",
    "primaryUnit": "U/L",
    "siUnit": "U/L",
    "conventionalUnit": "U/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 44,
        "max": 147,
        "text": "44 - 147 U/L"
      },
      "si": {
        "min": 44,
        "max": 147,
        "text": "44 - 147 U/L"
      }
    },
    "description": "Enzyme concentrated in biliary epithelial cells and bone; elevated in cholestasis, bile duct obstruction, or bone turnover."
  },
  {
    "loinc": "2324-2",
    "canonicalKey": "liver_ggt",
    "name": "Gamma-Glutamyl Transferase (GGT)",
    "aliases": [
      "GGT",
      "GGTP"
    ],
    "category": "Liver & Enzymes",
    "primaryUnit": "U/L",
    "siUnit": "U/L",
    "conventionalUnit": "U/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 9,
        "max": 48,
        "text": "9 - 48 U/L"
      },
      "si": {
        "min": 9,
        "max": 48,
        "text": "9 - 48 U/L"
      }
    },
    "description": "Highly sensitive marker for biliary tract disease and alcohol-induced liver toxicity."
  },
  {
    "loinc": "1975-2",
    "canonicalKey": "liver_total_bilirubin",
    "name": "Total Bilirubin",
    "aliases": [
      "Total Bilirubin",
      "Bilirubin Total",
      "TBIL"
    ],
    "category": "Liver & Enzymes",
    "primaryUnit": "mg/dL",
    "siUnit": "umol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 17.1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.1,
        "max": 1.2,
        "text": "0.1 - 1.2 mg/dL"
      },
      "si": {
        "min": 1.7,
        "max": 20.5,
        "text": "1.7 - 20.5 umol/L"
      }
    },
    "description": "Breakdown product of hemoglobin cleared by the liver; elevated in jaundice, hemolysis, or biliary obstruction."
  },
  {
    "loinc": "1968-7",
    "canonicalKey": "liver_direct_bilirubin",
    "name": "Direct Bilirubin (Conjugated)",
    "aliases": [
      "Direct Bilirubin",
      "Conjugated Bilirubin",
      "DBIL"
    ],
    "category": "Liver & Enzymes",
    "primaryUnit": "mg/dL",
    "siUnit": "umol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 17.1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 0.3,
        "text": "< 0.3 mg/dL"
      },
      "si": {
        "min": 0,
        "max": 5.1,
        "text": "< 5.1 umol/L"
      }
    },
    "description": "Water-soluble conjugated fraction of bilirubin that has passed through liver processing."
  },
  {
    "loinc": "1971-1",
    "canonicalKey": "liver_indirect_bilirubin",
    "name": "Indirect Bilirubin (Unconjugated)",
    "aliases": [
      "Indirect Bilirubin",
      "Unconjugated Bilirubin"
    ],
    "category": "Liver & Enzymes",
    "primaryUnit": "mg/dL",
    "siUnit": "umol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 17.1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.2,
        "max": 0.8,
        "text": "0.2 - 0.8 mg/dL"
      },
      "si": {
        "min": 3.4,
        "max": 13.7,
        "text": "3.4 - 13.7 umol/L"
      }
    },
    "description": "Lipid-soluble bilirubin bound to albumin prior to hepatic conjugation; elevated in hemolysis and Gilbert syndrome."
  },
  {
    "loinc": "2885-2",
    "canonicalKey": "liver_total_protein",
    "name": "Total Protein",
    "aliases": [
      "Total Protein",
      "TP"
    ],
    "category": "Liver & Enzymes",
    "primaryUnit": "g/dL",
    "siUnit": "g/L",
    "conventionalUnit": "g/dL",
    "conversionFactor": 10,
    "referenceIntervals": {
      "conventional": {
        "min": 6,
        "max": 8.3,
        "text": "6.0 - 8.3 g/dL"
      },
      "si": {
        "min": 60,
        "max": 83,
        "text": "60 - 83 g/L"
      }
    },
    "description": "Combined total of albumin and globulins; assesses nutritional status and liver/kidney disease."
  },
  {
    "loinc": "1751-7",
    "canonicalKey": "liver_albumin",
    "name": "Serum Albumin",
    "aliases": [
      "Albumin",
      "ALB"
    ],
    "category": "Liver & Enzymes",
    "primaryUnit": "g/dL",
    "siUnit": "g/L",
    "conventionalUnit": "g/dL",
    "conversionFactor": 10,
    "referenceIntervals": {
      "conventional": {
        "min": 3.5,
        "max": 5.5,
        "text": "3.5 - 5.5 g/dL"
      },
      "si": {
        "min": 35,
        "max": 55,
        "text": "35 - 55 g/L"
      }
    },
    "description": "Main protein synthesized by liver maintaining intravascular oncotic pressure and transporting hormones."
  },
  {
    "loinc": "2339-0",
    "canonicalKey": "liver_globulin",
    "name": "Serum Globulin",
    "aliases": [
      "Globulin",
      "Total Globulin"
    ],
    "category": "Liver & Enzymes",
    "primaryUnit": "g/dL",
    "siUnit": "g/L",
    "conventionalUnit": "g/dL",
    "conversionFactor": 10,
    "referenceIntervals": {
      "conventional": {
        "min": 2,
        "max": 3.5,
        "text": "2.0 - 3.5 g/dL"
      },
      "si": {
        "min": 20,
        "max": 35,
        "text": "20 - 35 g/L"
      }
    },
    "description": "Immunoglobulins and transport proteins calculated as total protein minus albumin."
  },
  {
    "loinc": "1759-0",
    "canonicalKey": "liver_ag_ratio",
    "name": "Albumin / Globulin Ratio",
    "aliases": [
      "A/G Ratio",
      "Albumin/Globulin"
    ],
    "category": "Liver & Enzymes",
    "primaryUnit": "ratio",
    "siUnit": "ratio",
    "conventionalUnit": "ratio",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 1.1,
        "max": 2.5,
        "text": "1.1 - 2.5"
      },
      "si": {
        "min": 1.1,
        "max": 2.5,
        "text": "1.1 - 2.5"
      }
    },
    "description": "Ratio helping identify hypergammaglobulinemia, cirrhosis, or nephrotic syndrome."
  },
  {
    "loinc": "2532-0",
    "canonicalKey": "liver_ldh",
    "name": "Lactate Dehydrogenase (LDH)",
    "aliases": [
      "LDH",
      "Lactate Dehydrogenase"
    ],
    "category": "Liver & Enzymes",
    "primaryUnit": "U/L",
    "siUnit": "U/L",
    "conventionalUnit": "U/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 140,
        "max": 280,
        "text": "140 - 280 U/L"
      },
      "si": {
        "min": 140,
        "max": 280,
        "text": "140 - 280 U/L"
      }
    },
    "description": "Ubiquitous intracellular enzyme released into blood upon generalized tissue breakdown or hemolysis."
  },
  {
    "loinc": "1798-8",
    "canonicalKey": "liver_amylase",
    "name": "Serum Amylase",
    "aliases": [
      "Amylase"
    ],
    "category": "Liver & Enzymes",
    "primaryUnit": "U/L",
    "siUnit": "U/L",
    "conventionalUnit": "U/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 30,
        "max": 110,
        "text": "30 - 110 U/L"
      },
      "si": {
        "min": 30,
        "max": 110,
        "text": "30 - 110 U/L"
      }
    },
    "description": "Digestive enzyme secreted by pancreas and salivary glands; rises sharply in acute pancreatitis."
  },
  {
    "loinc": "2554-4",
    "canonicalKey": "liver_lipase",
    "name": "Serum Lipase",
    "aliases": [
      "Lipase"
    ],
    "category": "Liver & Enzymes",
    "primaryUnit": "U/L",
    "siUnit": "U/L",
    "conventionalUnit": "U/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 10,
        "max": 140,
        "text": "10 - 140 U/L"
      },
      "si": {
        "min": 10,
        "max": 140,
        "text": "10 - 140 U/L"
      }
    },
    "description": "Pancreas-specific enzyme that hydrolyzes dietary triglycerides; more sensitive and specific than amylase."
  },
  {
    "loinc": "14627-4",
    "canonicalKey": "liver_cholinesterase",
    "name": "Pseudocholinesterase (BChE)",
    "aliases": [
      "Cholinesterase",
      "Pseudocholinesterase"
    ],
    "category": "Liver & Enzymes",
    "primaryUnit": "U/L",
    "siUnit": "U/L",
    "conventionalUnit": "U/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 5300,
        "max": 12900,
        "text": "5300 - 12900 U/L"
      },
      "si": {
        "min": 5300,
        "max": 12900,
        "text": "5300 - 12900 U/L"
      }
    },
    "description": "Liver-synthesized enzyme assessing hepatic protein synthesis and neuromuscular blocking agent susceptibility."
  },
  {
    "loinc": "3016-3",
    "canonicalKey": "thyroid_tsh",
    "name": "Thyroid Stimulating Hormone (TSH)",
    "aliases": [
      "TSH",
      "Thyrotropin"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "uIU/mL",
    "siUnit": "mIU/L",
    "conventionalUnit": "uIU/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.45,
        "max": 4.5,
        "text": "0.45 - 4.5 uIU/mL"
      },
      "si": {
        "min": 0.45,
        "max": 4.5,
        "text": "0.45 - 4.5 mIU/L"
      }
    },
    "description": "Pituitary hormone regulating thyroid function; first-line screening test for hypo- and hyperthyroidism."
  },
  {
    "loinc": "3024-7",
    "canonicalKey": "thyroid_free_t4",
    "name": "Free Thyroxine (Free T4)",
    "aliases": [
      "Free T4",
      "FT4"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "ng/dL",
    "siUnit": "pmol/L",
    "conventionalUnit": "ng/dL",
    "conversionFactor": 12.87,
    "referenceIntervals": {
      "conventional": {
        "min": 0.8,
        "max": 1.8,
        "text": "0.8 - 1.8 ng/dL"
      },
      "si": {
        "min": 10.3,
        "max": 23.2,
        "text": "10.3 - 23.2 pmol/L"
      }
    },
    "description": "Biologically active, unbound thyroxine available to target tissues."
  },
  {
    "loinc": "3026-2",
    "canonicalKey": "thyroid_total_t4",
    "name": "Total Thyroxine (Total T4)",
    "aliases": [
      "Total T4",
      "TT4"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "ug/dL",
    "siUnit": "nmol/L",
    "conventionalUnit": "ug/dL",
    "conversionFactor": 12.87,
    "referenceIntervals": {
      "conventional": {
        "min": 4.5,
        "max": 12,
        "text": "4.5 - 12.0 ug/dL"
      },
      "si": {
        "min": 58,
        "max": 154,
        "text": "58 - 154 nmol/L"
      }
    },
    "description": "Total circulating thyroxine including both protein-bound (TBG) and free fractions."
  },
  {
    "loinc": "3051-3",
    "canonicalKey": "thyroid_free_t3",
    "name": "Free Triiodothyronine (Free T3)",
    "aliases": [
      "Free T3",
      "FT3"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "pg/mL",
    "siUnit": "pmol/L",
    "conventionalUnit": "pg/mL",
    "conversionFactor": 1.536,
    "referenceIntervals": {
      "conventional": {
        "min": 2.3,
        "max": 4.2,
        "text": "2.3 - 4.2 pg/mL"
      },
      "si": {
        "min": 3.5,
        "max": 6.5,
        "text": "3.5 - 6.5 pmol/L"
      }
    },
    "description": "The most metabolically active thyroid hormone; essential for evaluating hyperthyroidism and conversion efficiency."
  },
  {
    "loinc": "3053-9",
    "canonicalKey": "thyroid_total_t3",
    "name": "Total Triiodothyronine (Total T3)",
    "aliases": [
      "Total T3",
      "TT3"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "ng/dL",
    "siUnit": "nmol/L",
    "conventionalUnit": "ng/dL",
    "conversionFactor": 0.01536,
    "referenceIntervals": {
      "conventional": {
        "min": 75,
        "max": 200,
        "text": "75 - 200 ng/dL"
      },
      "si": {
        "min": 1.15,
        "max": 3.07,
        "text": "1.15 - 3.07 nmol/L"
      }
    },
    "description": "Total concentration of circulating T3."
  },
  {
    "loinc": "3055-4",
    "canonicalKey": "thyroid_reverse_t3",
    "name": "Reverse T3 (rT3)",
    "aliases": [
      "Reverse T3",
      "rT3"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "ng/dL",
    "siUnit": "pmol/L",
    "conventionalUnit": "ng/dL",
    "conversionFactor": 15.36,
    "referenceIntervals": {
      "conventional": {
        "min": 9,
        "max": 24,
        "text": "9.0 - 24.0 ng/dL"
      },
      "si": {
        "min": 138,
        "max": 368,
        "text": "138 - 368 pmol/L"
      }
    },
    "description": "Inactive isomer of T3 produced during severe illness, prolonged fasting, or high physiological stress."
  },
  {
    "loinc": "8098-6",
    "canonicalKey": "thyroid_tpo_ab",
    "name": "Thyroid Peroxidase Antibodies (Anti-TPO)",
    "aliases": [
      "Anti-TPO",
      "TPO Antibodies",
      "TPOAb"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "IU/mL",
    "siUnit": "kU/L",
    "conventionalUnit": "IU/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 34,
        "text": "< 34 IU/mL (Negative)"
      },
      "si": {
        "min": 0,
        "max": 34,
        "text": "< 34 kU/L"
      }
    },
    "description": "Hallmark autoantibody of Hashimoto thyroiditis and autoimmune thyroid disease."
  },
  {
    "loinc": "5512-9",
    "canonicalKey": "thyroid_tg_ab",
    "name": "Thyroglobulin Antibodies (Anti-Tg)",
    "aliases": [
      "Anti-Tg",
      "TgAb",
      "Thyroglobulin Antibodies"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "IU/mL",
    "siUnit": "kU/L",
    "conventionalUnit": "IU/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 115,
        "text": "< 115 IU/mL"
      },
      "si": {
        "min": 0,
        "max": 115,
        "text": "< 115 kU/L"
      }
    },
    "description": "Autoantibodies directed against thyroglobulin protein; monitored in thyroid carcinoma and autoimmune thyroiditis."
  },
  {
    "loinc": "2143-6",
    "canonicalKey": "endocrine_cortisol_am",
    "name": "Cortisol (Morning / AM)",
    "aliases": [
      "Cortisol AM",
      "Morning Cortisol",
      "Serum Cortisol"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "ug/dL",
    "siUnit": "nmol/L",
    "conventionalUnit": "ug/dL",
    "conversionFactor": 27.59,
    "referenceIntervals": {
      "conventional": {
        "min": 6.2,
        "max": 19.4,
        "text": "6.2 - 19.4 ug/dL"
      },
      "si": {
        "min": 171,
        "max": 536,
        "text": "171 - 536 nmol/L"
      }
    },
    "description": "Peak adrenal glucocorticoid regulating metabolism, immune response, and stress adaptation."
  },
  {
    "loinc": "2144-4",
    "canonicalKey": "endocrine_cortisol_pm",
    "name": "Cortisol (Evening / PM)",
    "aliases": [
      "Cortisol PM",
      "Evening Cortisol"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "ug/dL",
    "siUnit": "nmol/L",
    "conventionalUnit": "ug/dL",
    "conversionFactor": 27.59,
    "referenceIntervals": {
      "conventional": {
        "min": 2.3,
        "max": 11.9,
        "text": "2.3 - 11.9 ug/dL"
      },
      "si": {
        "min": 64,
        "max": 327,
        "text": "64 - 327 nmol/L"
      }
    },
    "description": "Trough circadian cortisol value; loss of evening nadir indicates hypercortisolemia / Cushing syndrome."
  },
  {
    "loinc": "2141-0",
    "canonicalKey": "endocrine_acth",
    "name": "Adrenocorticotropic Hormone (ACTH)",
    "aliases": [
      "ACTH",
      "Corticotropin"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "pg/mL",
    "siUnit": "pmol/L",
    "conventionalUnit": "pg/mL",
    "conversionFactor": 0.22,
    "referenceIntervals": {
      "conventional": {
        "min": 7.2,
        "max": 63.3,
        "text": "7.2 - 63.3 pg/mL"
      },
      "si": {
        "min": 1.6,
        "max": 13.9,
        "text": "1.6 - 13.9 pmol/L"
      }
    },
    "description": "Anterior pituitary hormone stimulating adrenal cortisol production."
  },
  {
    "loinc": "2857-1",
    "canonicalKey": "endocrine_pth",
    "name": "Parathyroid Hormone (PTH, Intact)",
    "aliases": [
      "PTH",
      "iPTH",
      "Parathyroid Hormone"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "pg/mL",
    "siUnit": "pmol/L",
    "conventionalUnit": "pg/mL",
    "conversionFactor": 0.106,
    "referenceIntervals": {
      "conventional": {
        "min": 15,
        "max": 65,
        "text": "15 - 65 pg/mL"
      },
      "si": {
        "min": 1.6,
        "max": 6.9,
        "text": "1.6 - 6.9 pmol/L"
      }
    },
    "description": "Regulates systemic calcium and phosphate homeostasis by acting on bone, kidneys, and gut."
  },
  {
    "loinc": "2484-4",
    "canonicalKey": "endocrine_igf1",
    "name": "Insulin-Like Growth Factor 1 (IGF-1)",
    "aliases": [
      "IGF-1",
      "Somatomedin C"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "ng/mL",
    "siUnit": "nmol/L",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 0.13,
    "referenceIntervals": {
      "conventional": {
        "min": 115,
        "max": 307,
        "text": "115 - 307 ng/mL (Age-dependent)"
      },
      "si": {
        "min": 15,
        "max": 40,
        "text": "15 - 40 nmol/L"
      }
    },
    "description": "Primary mediator of growth hormone actions; stable clinical indicator of GH status."
  },
  {
    "loinc": "2965-2",
    "canonicalKey": "endocrine_prolactin",
    "name": "Prolactin",
    "aliases": [
      "Prolactin",
      "PRL"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "ng/mL",
    "siUnit": "mIU/L",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 21.2,
    "referenceIntervals": {
      "conventional": {
        "min": 4,
        "max": 23,
        "text": "4 - 23 ng/mL (M: < 15, F: < 23)"
      },
      "si": {
        "min": 85,
        "max": 490,
        "text": "85 - 490 mIU/L"
      }
    },
    "description": "Pituitary hormone essential for lactation; elevated in prolactinoma and dopamine antagonists."
  },
  {
    "loinc": "2986-8",
    "canonicalKey": "hormone_total_testosterone",
    "name": "Total Testosterone",
    "aliases": [
      "Testosterone",
      "Total T",
      "Serum Testosterone"
    ],
    "category": "Hormones & Reproductive",
    "primaryUnit": "ng/dL",
    "siUnit": "nmol/L",
    "conventionalUnit": "ng/dL",
    "conversionFactor": 0.0347,
    "referenceIntervals": {
      "conventional": {
        "min": 300,
        "max": 1000,
        "text": "300 - 1000 ng/dL (Male)"
      },
      "si": {
        "min": 10.4,
        "max": 34.7,
        "text": "10.4 - 34.7 nmol/L"
      }
    },
    "description": "Primary androgenic hormone regulating libido, muscle mass, bone density, and erythropoiesis."
  },
  {
    "loinc": "2991-8",
    "canonicalKey": "hormone_free_testosterone",
    "name": "Free Testosterone",
    "aliases": [
      "Free T",
      "Unbound Testosterone"
    ],
    "category": "Hormones & Reproductive",
    "primaryUnit": "pg/mL",
    "siUnit": "pmol/L",
    "conventionalUnit": "pg/mL",
    "conversionFactor": 3.47,
    "referenceIntervals": {
      "conventional": {
        "min": 50,
        "max": 210,
        "text": "50 - 210 pg/mL (Male)"
      },
      "si": {
        "min": 174,
        "max": 729,
        "text": "174 - 729 pmol/L"
      }
    },
    "description": "Unbound, biologically active fraction of testosterone that enters target cells freely."
  },
  {
    "loinc": "13967-5",
    "canonicalKey": "hormone_shbg",
    "name": "Sex Hormone Binding Globulin (SHBG)",
    "aliases": [
      "SHBG"
    ],
    "category": "Hormones & Reproductive",
    "primaryUnit": "nmol/L",
    "siUnit": "nmol/L",
    "conventionalUnit": "ug/dL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 16.5,
        "max": 55.9,
        "text": "16.5 - 55.9 nmol/L (Male)"
      },
      "si": {
        "min": 16.5,
        "max": 55.9,
        "text": "16.5 - 55.9 nmol/L"
      }
    },
    "description": "Liver glycoprotein that binds testosterone and estradiol, governing bioavailable fraction."
  },
  {
    "loinc": "2243-4",
    "canonicalKey": "hormone_estradiol",
    "name": "Estradiol (E2)",
    "aliases": [
      "Estradiol",
      "E2",
      "Estrogen"
    ],
    "category": "Hormones & Reproductive",
    "primaryUnit": "pg/mL",
    "siUnit": "pmol/L",
    "conventionalUnit": "pg/mL",
    "conversionFactor": 3.67,
    "referenceIntervals": {
      "conventional": {
        "min": 10,
        "max": 40,
        "text": "10 - 40 pg/mL (M), varies by cycle (F)"
      },
      "si": {
        "min": 37,
        "max": 147,
        "text": "37 - 147 pmol/L"
      }
    },
    "description": "Potent estrogen regulating reproductive cycles, vascular health, and bone mineralization."
  },
  {
    "loinc": "2839-9",
    "canonicalKey": "hormone_progesterone",
    "name": "Progesterone",
    "aliases": [
      "Progesterone",
      "P4"
    ],
    "category": "Hormones & Reproductive",
    "primaryUnit": "ng/mL",
    "siUnit": "nmol/L",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 3.18,
    "referenceIntervals": {
      "conventional": {
        "min": 0.1,
        "max": 20,
        "text": "< 1.0 ng/mL (Follicular), 5 - 20 (Luteal)"
      },
      "si": {
        "min": 0.3,
        "max": 63.6,
        "text": "< 3.18 nmol/L"
      }
    },
    "description": "Steroid hormone essential for luteal phase maintenance, implantation, and gestation."
  },
  {
    "loinc": "2198-0",
    "canonicalKey": "hormone_dhea_s",
    "name": "DHEA-Sulfate (DHEA-S)",
    "aliases": [
      "DHEA-S",
      "DHEAS",
      "Dehydroepiandrosterone Sulfate"
    ],
    "category": "Hormones & Reproductive",
    "primaryUnit": "ug/dL",
    "siUnit": "umol/L",
    "conventionalUnit": "ug/dL",
    "conversionFactor": 0.0271,
    "referenceIntervals": {
      "conventional": {
        "min": 160,
        "max": 450,
        "text": "160 - 450 ug/dL (Age/Sex dependent)"
      },
      "si": {
        "min": 4.3,
        "max": 12.2,
        "text": "4.3 - 12.2 umol/L"
      }
    },
    "description": "Abundant adrenal androgen precursor converted peripherally into active testosterone and estrogens."
  },
  {
    "loinc": "2532-0",
    "canonicalKey": "hormone_lh",
    "name": "Luteinizing Hormone (LH)",
    "aliases": [
      "LH",
      "Luteinizing Hormone"
    ],
    "category": "Hormones & Reproductive",
    "primaryUnit": "mIU/mL",
    "siUnit": "IU/L",
    "conventionalUnit": "mIU/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 1.7,
        "max": 8.6,
        "text": "1.7 - 8.6 mIU/mL (Male)"
      },
      "si": {
        "min": 1.7,
        "max": 8.6,
        "text": "1.7 - 8.6 IU/L"
      }
    },
    "description": "Anterior pituitary gonadotropin triggering Leydig cell testosterone production and ovulation."
  },
  {
    "loinc": "2276-4",
    "canonicalKey": "hormone_fsh",
    "name": "Follicle-Stimulating Hormone (FSH)",
    "aliases": [
      "FSH",
      "Follicle Stimulating Hormone"
    ],
    "category": "Hormones & Reproductive",
    "primaryUnit": "mIU/mL",
    "siUnit": "IU/L",
    "conventionalUnit": "mIU/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 1.5,
        "max": 12.4,
        "text": "1.5 - 12.4 mIU/mL"
      },
      "si": {
        "min": 1.5,
        "max": 12.4,
        "text": "1.5 - 12.4 IU/L"
      }
    },
    "description": "Pituitary gonadotropin stimulating spermatogenesis in men and follicular recruitment in women."
  },
  {
    "loinc": "1853-2",
    "canonicalKey": "hormone_dht",
    "name": "Dihydrotestosterone (DHT)",
    "aliases": [
      "DHT",
      "Dihydrotestosterone"
    ],
    "category": "Hormones & Reproductive",
    "primaryUnit": "ng/dL",
    "siUnit": "nmol/L",
    "conventionalUnit": "ng/dL",
    "conversionFactor": 0.0344,
    "referenceIntervals": {
      "conventional": {
        "min": 30,
        "max": 85,
        "text": "30 - 85 ng/dL (Male)"
      },
      "si": {
        "min": 1,
        "max": 2.9,
        "text": "1.0 - 2.9 nmol/L"
      }
    },
    "description": "Potent 5alpha-reduced metabolite of testosterone active in prostate, hair follicles, and skin."
  },
  {
    "loinc": "14634-0",
    "canonicalKey": "hormone_amh",
    "name": "Anti-Mullerian Hormone (AMH)",
    "aliases": [
      "AMH",
      "Ovarian Reserve"
    ],
    "category": "Hormones & Reproductive",
    "primaryUnit": "ng/mL",
    "siUnit": "pmol/L",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 7.14,
    "referenceIntervals": {
      "conventional": {
        "min": 1,
        "max": 3.5,
        "text": "1.0 - 3.5 ng/mL (Optimal ovarian reserve)"
      },
      "si": {
        "min": 7.1,
        "max": 25,
        "text": "7.1 - 25.0 pmol/L"
      }
    },
    "description": "Secreted by preantral ovarian follicles; premier marker of functional ovarian reserve."
  },
  {
    "loinc": "1989-3",
    "canonicalKey": "vitamin_d_25oh",
    "name": "Vitamin D (25-Hydroxycholecalciferol)",
    "aliases": [
      "Vitamin D",
      "25-OH Vitamin D",
      "Vit D",
      "25-Hydroxy Vitamin D"
    ],
    "category": "Vitamins & Nutrition",
    "primaryUnit": "ng/mL",
    "siUnit": "nmol/L",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 2.496,
    "referenceIntervals": {
      "conventional": {
        "min": 30,
        "max": 100,
        "text": "30 - 100 ng/mL (Optimal: 40-70)"
      },
      "si": {
        "min": 75,
        "max": 250,
        "text": "75 - 250 nmol/L"
      }
    },
    "description": "Circulating storage form of vitamin D; essential for calcium absorption, bone strength, and immunity."
  },
  {
    "loinc": "2132-9",
    "canonicalKey": "vitamin_b12",
    "name": "Vitamin B12 (Cobalamin)",
    "aliases": [
      "B12",
      "Cobalamin",
      "Vitamin B12"
    ],
    "category": "Vitamins & Nutrition",
    "primaryUnit": "pg/mL",
    "siUnit": "pmol/L",
    "conventionalUnit": "pg/mL",
    "conversionFactor": 0.738,
    "referenceIntervals": {
      "conventional": {
        "min": 200,
        "max": 900,
        "text": "200 - 900 pg/mL (Optimal > 400)"
      },
      "si": {
        "min": 148,
        "max": 664,
        "text": "148 - 664 pmol/L"
      }
    },
    "description": "Crucial cofactor for DNA synthesis, erythropoiesis, and neurological myelin maintenance."
  },
  {
    "loinc": "2284-8",
    "canonicalKey": "vitamin_folate_serum",
    "name": "Serum Folate (Vitamin B9)",
    "aliases": [
      "Folate",
      "Folic Acid",
      "Vitamin B9"
    ],
    "category": "Vitamins & Nutrition",
    "primaryUnit": "ng/mL",
    "siUnit": "nmol/L",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 2.266,
    "referenceIntervals": {
      "conventional": {
        "min": 4,
        "max": 20,
        "text": "> 4.0 ng/mL"
      },
      "si": {
        "min": 9.1,
        "max": 45.3,
        "text": "> 9.1 nmol/L"
      }
    },
    "description": "Required for purine and pyrimidine synthesis, methylation pathways, and fetal neural development."
  },
  {
    "loinc": "2282-2",
    "canonicalKey": "vitamin_folate_rbc",
    "name": "RBC Folate",
    "aliases": [
      "Red Blood Cell Folate"
    ],
    "category": "Vitamins & Nutrition",
    "primaryUnit": "ng/mL",
    "siUnit": "nmol/L",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 2.266,
    "referenceIntervals": {
      "conventional": {
        "min": 280,
        "max": 791,
        "text": "> 280 ng/mL"
      },
      "si": {
        "min": 635,
        "max": 1792,
        "text": "> 635 nmol/L"
      }
    },
    "description": "Measures intraerythrocytic folate reflecting tissue folate stores over the preceding 3 months."
  },
  {
    "loinc": "2923-1",
    "canonicalKey": "vitamin_a",
    "name": "Vitamin A (Retinol)",
    "aliases": [
      "Vitamin A",
      "Retinol"
    ],
    "category": "Vitamins & Nutrition",
    "primaryUnit": "ug/dL",
    "siUnit": "umol/L",
    "conventionalUnit": "ug/dL",
    "conversionFactor": 0.0349,
    "referenceIntervals": {
      "conventional": {
        "min": 32.5,
        "max": 78,
        "text": "32.5 - 78.0 ug/dL"
      },
      "si": {
        "min": 1.13,
        "max": 2.72,
        "text": "1.13 - 2.72 umol/L"
      }
    },
    "description": "Fat-soluble vitamin required for ocular photoreception, epithelial differentiation, and immune function."
  },
  {
    "loinc": "2990-0",
    "canonicalKey": "vitamin_c",
    "name": "Vitamin C (Ascorbic Acid)",
    "aliases": [
      "Vitamin C",
      "Ascorbic Acid"
    ],
    "category": "Vitamins & Nutrition",
    "primaryUnit": "mg/dL",
    "siUnit": "umol/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 56.78,
    "referenceIntervals": {
      "conventional": {
        "min": 0.4,
        "max": 2,
        "text": "0.4 - 2.0 mg/dL"
      },
      "si": {
        "min": 23,
        "max": 114,
        "text": "23 - 114 umol/L"
      }
    },
    "description": "Water-soluble antioxidant essential for collagen hydroxylation, carnitine synthesis, and iron absorption."
  },
  {
    "loinc": "3046-3",
    "canonicalKey": "vitamin_e",
    "name": "Vitamin E (Alpha-Tocopherol)",
    "aliases": [
      "Vitamin E",
      "Alpha Tocopherol"
    ],
    "category": "Vitamins & Nutrition",
    "primaryUnit": "mg/L",
    "siUnit": "umol/L",
    "conventionalUnit": "mg/L",
    "conversionFactor": 2.32,
    "referenceIntervals": {
      "conventional": {
        "min": 5.5,
        "max": 17,
        "text": "5.5 - 17.0 mg/L"
      },
      "si": {
        "min": 12.8,
        "max": 39.4,
        "text": "12.8 - 39.4 umol/L"
      }
    },
    "description": "Lipid-soluble antioxidant protecting polyunsaturated membrane fatty acids from peroxidation."
  },
  {
    "loinc": "27770-1",
    "canonicalKey": "nutrition_coq10",
    "name": "Coenzyme Q10 (Ubiquinone)",
    "aliases": [
      "CoQ10",
      "Ubiquinone"
    ],
    "category": "Vitamins & Nutrition",
    "primaryUnit": "ug/mL",
    "siUnit": "umol/L",
    "conventionalUnit": "ug/mL",
    "conversionFactor": 1.158,
    "referenceIntervals": {
      "conventional": {
        "min": 0.5,
        "max": 1.8,
        "text": "0.5 - 1.8 ug/mL"
      },
      "si": {
        "min": 0.58,
        "max": 2.08,
        "text": "0.58 - 2.08 umol/L"
      }
    },
    "description": "Mitochondrial electron transport chain cofactor often depleted by HMG-CoA reductase inhibitor (statin) therapy."
  },
  {
    "loinc": "2498-4",
    "canonicalKey": "iron_serum_iron",
    "name": "Serum Iron",
    "aliases": [
      "Iron",
      "Serum Iron",
      "Fe"
    ],
    "category": "Iron & Anemia",
    "primaryUnit": "ug/dL",
    "siUnit": "umol/L",
    "conventionalUnit": "ug/dL",
    "conversionFactor": 0.179,
    "referenceIntervals": {
      "conventional": {
        "min": 60,
        "max": 170,
        "text": "60 - 170 ug/dL"
      },
      "si": {
        "min": 10.7,
        "max": 30.4,
        "text": "10.7 - 30.4 umol/L"
      }
    },
    "description": "Circulating iron currently bound to transferrin protein in serum."
  },
  {
    "loinc": "2276-4",
    "canonicalKey": "iron_ferritin",
    "name": "Serum Ferritin",
    "aliases": [
      "Ferritin"
    ],
    "category": "Iron & Anemia",
    "primaryUnit": "ng/mL",
    "siUnit": "pmol/L",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 2.247,
    "referenceIntervals": {
      "conventional": {
        "min": 30,
        "max": 400,
        "text": "30 - 400 ng/mL (M), 15 - 150 (F)"
      },
      "si": {
        "min": 67,
        "max": 900,
        "text": "67 - 900 pmol/L"
      }
    },
    "description": "Primary intracellular iron storage protein; most sensitive test for iron deficiency anemia."
  },
  {
    "loinc": "2500-7",
    "canonicalKey": "iron_tibc",
    "name": "Total Iron Binding Capacity (TIBC)",
    "aliases": [
      "TIBC",
      "Total Iron Binding Capacity"
    ],
    "category": "Iron & Anemia",
    "primaryUnit": "ug/dL",
    "siUnit": "umol/L",
    "conventionalUnit": "ug/dL",
    "conversionFactor": 0.179,
    "referenceIntervals": {
      "conventional": {
        "min": 250,
        "max": 450,
        "text": "250 - 450 ug/dL"
      },
      "si": {
        "min": 44.8,
        "max": 80.6,
        "text": "44.8 - 80.6 umol/L"
      }
    },
    "description": "Indirect measurement of transferrin availability; increases in iron deficiency and drops in inflammation."
  },
  {
    "loinc": "2502-3",
    "canonicalKey": "iron_transferrin_sat",
    "name": "Transferrin Saturation (% Sat)",
    "aliases": [
      "Transferrin Saturation",
      "% Saturation",
      "Iron Saturation"
    ],
    "category": "Iron & Anemia",
    "primaryUnit": "%",
    "siUnit": "%",
    "conventionalUnit": "%",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 20,
        "max": 50,
        "text": "20 - 50 %"
      },
      "si": {
        "min": 20,
        "max": 50,
        "text": "20 - 50 %"
      }
    },
    "description": "Percentage of transferrin binding sites occupied by iron; <16% indicates iron-deficient erythropoiesis."
  },
  {
    "loinc": "3034-6",
    "canonicalKey": "iron_transferrin",
    "name": "Transferrin",
    "aliases": [
      "Transferrin",
      "Siderophilin"
    ],
    "category": "Iron & Anemia",
    "primaryUnit": "mg/dL",
    "siUnit": "g/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.01,
    "referenceIntervals": {
      "conventional": {
        "min": 200,
        "max": 380,
        "text": "200 - 380 mg/dL"
      },
      "si": {
        "min": 2,
        "max": 3.8,
        "text": "2.0 - 3.8 g/L"
      }
    },
    "description": "Main transport protein responsible for iron delivery from gut and macrophages to bone marrow."
  },
  {
    "loinc": "1988-5",
    "canonicalKey": "inflam_crp",
    "name": "C-Reactive Protein (CRP)",
    "aliases": [
      "CRP",
      "Standard CRP"
    ],
    "category": "Inflammation & Immunology",
    "primaryUnit": "mg/L",
    "siUnit": "mg/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 0.8,
        "text": "< 0.8 mg/dL"
      },
      "si": {
        "min": 0,
        "max": 8,
        "text": "< 8.0 mg/L"
      }
    },
    "description": "Acute-phase reactant synthesized by hepatocytes during bacterial infection, tissue trauma, or active autoimmunity."
  },
  {
    "loinc": "30341-2",
    "canonicalKey": "inflam_esr",
    "name": "Erythrocyte Sedimentation Rate (ESR)",
    "aliases": [
      "ESR",
      "Sed Rate",
      "Westergren Sed Rate"
    ],
    "category": "Inflammation & Immunology",
    "primaryUnit": "mm/hr",
    "siUnit": "mm/hr",
    "conventionalUnit": "mm/hr",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 20,
        "text": "< 20 mm/hr (M: <15, F: <20)"
      },
      "si": {
        "min": 0,
        "max": 20,
        "text": "< 20 mm/hr"
      }
    },
    "description": "Rate at which erythrocytes settle out of anticoagulated blood; indirect marker of fibrinogen and inflammation."
  },
  {
    "loinc": "11572-5",
    "canonicalKey": "inflam_rf",
    "name": "Rheumatoid Factor (RF)",
    "aliases": [
      "RF",
      "Rheumatoid Factor"
    ],
    "category": "Inflammation & Immunology",
    "primaryUnit": "IU/mL",
    "siUnit": "kU/L",
    "conventionalUnit": "IU/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 14,
        "text": "< 14 IU/mL (Negative)"
      },
      "si": {
        "min": 0,
        "max": 14,
        "text": "< 14 kU/L"
      }
    },
    "description": "Autoantibody directed against the Fc region of IgG; classic screening marker for rheumatoid arthritis."
  },
  {
    "loinc": "42254-3",
    "canonicalKey": "inflam_ana",
    "name": "Antinuclear Antibodies (ANA Screen)",
    "aliases": [
      "ANA",
      "Antinuclear Antibodies"
    ],
    "category": "Inflammation & Immunology",
    "primaryUnit": "titer",
    "siUnit": "titer",
    "conventionalUnit": "titer",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 0,
        "text": "Negative (< 1:80)"
      },
      "si": {
        "min": 0,
        "max": 0,
        "text": "Negative (< 1:80)"
      }
    },
    "description": "Primary screening test for systemic lupus erythematosus (SLE) and connective tissue diseases."
  },
  {
    "loinc": "2465-3",
    "canonicalKey": "inflam_igg",
    "name": "Immunoglobulin G (IgG)",
    "aliases": [
      "IgG",
      "Total IgG"
    ],
    "category": "Inflammation & Immunology",
    "primaryUnit": "mg/dL",
    "siUnit": "g/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.01,
    "referenceIntervals": {
      "conventional": {
        "min": 700,
        "max": 1600,
        "text": "700 - 1600 mg/dL"
      },
      "si": {
        "min": 7,
        "max": 16,
        "text": "7.0 - 16.0 g/L"
      }
    },
    "description": "Most abundant antibody class providing long-term humoral protection against bacterial and viral pathogens."
  },
  {
    "loinc": "2458-8",
    "canonicalKey": "inflam_iga",
    "name": "Immunoglobulin A (IgA)",
    "aliases": [
      "IgA",
      "Total IgA"
    ],
    "category": "Inflammation & Immunology",
    "primaryUnit": "mg/dL",
    "siUnit": "g/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.01,
    "referenceIntervals": {
      "conventional": {
        "min": 70,
        "max": 400,
        "text": "70 - 400 mg/dL"
      },
      "si": {
        "min": 0.7,
        "max": 4,
        "text": "0.7 - 4.0 g/L"
      }
    },
    "description": "Primary mucosal antibody found in respiratory and gastrointestinal secretions."
  },
  {
    "loinc": "2472-9",
    "canonicalKey": "inflam_igm",
    "name": "Immunoglobulin M (IgM)",
    "aliases": [
      "IgM",
      "Total IgM"
    ],
    "category": "Inflammation & Immunology",
    "primaryUnit": "mg/dL",
    "siUnit": "g/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.01,
    "referenceIntervals": {
      "conventional": {
        "min": 40,
        "max": 230,
        "text": "40 - 230 mg/dL"
      },
      "si": {
        "min": 0.4,
        "max": 2.3,
        "text": "0.4 - 2.3 g/L"
      }
    },
    "description": "First antibody isotype produced upon initial antigen encounter."
  },
  {
    "loinc": "19113-0",
    "canonicalKey": "inflam_ige",
    "name": "Immunoglobulin E (IgE Total)",
    "aliases": [
      "IgE",
      "Total IgE"
    ],
    "category": "Inflammation & Immunology",
    "primaryUnit": "kU/L",
    "siUnit": "kU/L",
    "conventionalUnit": "IU/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 100,
        "text": "< 100 IU/mL"
      },
      "si": {
        "min": 0,
        "max": 100,
        "text": "< 100 kU/L"
      }
    },
    "description": "Mediator of type I hypersensitivity (atopy, allergic asthma, anaphylaxis) and parasitic defense."
  },
  {
    "loinc": "4485-9",
    "canonicalKey": "inflam_complement_c3",
    "name": "Complement C3",
    "aliases": [
      "C3",
      "Complement C3"
    ],
    "category": "Inflammation & Immunology",
    "primaryUnit": "mg/dL",
    "siUnit": "g/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.01,
    "referenceIntervals": {
      "conventional": {
        "min": 90,
        "max": 180,
        "text": "90 - 180 mg/dL"
      },
      "si": {
        "min": 0.9,
        "max": 1.8,
        "text": "0.9 - 1.8 g/L"
      }
    },
    "description": "Central component of classical and alternative complement pathways; consumed in active immune-complex diseases."
  },
  {
    "loinc": "4490-9",
    "canonicalKey": "inflam_complement_c4",
    "name": "Complement C4",
    "aliases": [
      "C4",
      "Complement C4"
    ],
    "category": "Inflammation & Immunology",
    "primaryUnit": "mg/dL",
    "siUnit": "g/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.01,
    "referenceIntervals": {
      "conventional": {
        "min": 10,
        "max": 40,
        "text": "10 - 40 mg/dL"
      },
      "si": {
        "min": 0.1,
        "max": 0.4,
        "text": "0.1 - 0.4 g/L"
      }
    },
    "description": "Classical complement component; low levels indicate lupus nephritis or hereditary angioedema."
  },
  {
    "loinc": "5902-2",
    "canonicalKey": "coag_pt",
    "name": "Prothrombin Time (PT)",
    "aliases": [
      "PT",
      "Pro Time"
    ],
    "category": "Coagulation",
    "primaryUnit": "sec",
    "siUnit": "sec",
    "conventionalUnit": "sec",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 11,
        "max": 13.5,
        "text": "11.0 - 13.5 sec"
      },
      "si": {
        "min": 11,
        "max": 13.5,
        "text": "11.0 - 13.5 sec"
      }
    },
    "description": "Evaluates the extrinsic and common pathways of the coagulation cascade."
  },
  {
    "loinc": "6301-6",
    "canonicalKey": "coag_inr",
    "name": "International Normalized Ratio (INR)",
    "aliases": [
      "INR",
      "PT/INR"
    ],
    "category": "Coagulation",
    "primaryUnit": "ratio",
    "siUnit": "ratio",
    "conventionalUnit": "ratio",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.8,
        "max": 1.1,
        "text": "0.8 - 1.1 (Therapeutic: 2.0-3.0)"
      },
      "si": {
        "min": 0.8,
        "max": 1.1,
        "text": "0.8 - 1.1"
      }
    },
    "description": "Standardized PT metric calibrated across laboratories for warfarin monitoring."
  },
  {
    "loinc": "3173-2",
    "canonicalKey": "coag_aptt",
    "name": "Activated Partial Thromboplastin Time (aPTT)",
    "aliases": [
      "aPTT",
      "PTT"
    ],
    "category": "Coagulation",
    "primaryUnit": "sec",
    "siUnit": "sec",
    "conventionalUnit": "sec",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 25,
        "max": 35,
        "text": "25.0 - 35.0 sec"
      },
      "si": {
        "min": 25,
        "max": 35,
        "text": "25.0 - 35.0 sec"
      }
    },
    "description": "Monitors intrinsic and common coagulation pathways; used to titrate unfractionated heparin."
  },
  {
    "loinc": "3255-7",
    "canonicalKey": "coag_fibrinogen",
    "name": "Fibrinogen (Factor I)",
    "aliases": [
      "Fibrinogen",
      "Factor I"
    ],
    "category": "Coagulation",
    "primaryUnit": "mg/dL",
    "siUnit": "g/L",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 0.01,
    "referenceIntervals": {
      "conventional": {
        "min": 200,
        "max": 400,
        "text": "200 - 400 mg/dL"
      },
      "si": {
        "min": 2,
        "max": 4,
        "text": "2.0 - 4.0 g/L"
      }
    },
    "description": "Precursor protein cleaved by thrombin into fibrin clot threads; also acts as acute-phase reactant."
  },
  {
    "loinc": "48065-7",
    "canonicalKey": "coag_d_dimer",
    "name": "D-Dimer",
    "aliases": [
      "D-Dimer",
      "Fibrin Degradation Fragment"
    ],
    "category": "Coagulation",
    "primaryUnit": "ng/mL D-DU",
    "siUnit": "ug/L FEU",
    "conventionalUnit": "ug/mL FEU",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 0.5,
        "text": "< 0.50 ug/mL FEU"
      },
      "si": {
        "min": 0,
        "max": 500,
        "text": "< 500 ug/L FEU"
      }
    },
    "description": "Degradation product of cross-linked fibrin clot; high negative predictive value ruling out DVT and PE."
  },
  {
    "loinc": "3134-4",
    "canonicalKey": "trace_zinc",
    "name": "Serum Zinc (Zn)",
    "aliases": [
      "Zinc",
      "Zn",
      "Serum Zinc"
    ],
    "category": "Trace Elements & Heavy Metals",
    "primaryUnit": "ug/dL",
    "siUnit": "umol/L",
    "conventionalUnit": "ug/dL",
    "conversionFactor": 0.153,
    "referenceIntervals": {
      "conventional": {
        "min": 60,
        "max": 130,
        "text": "60 - 130 ug/dL"
      },
      "si": {
        "min": 9.2,
        "max": 19.9,
        "text": "9.2 - 19.9 umol/L"
      }
    },
    "description": "Essential catalytic and structural cofactor for over 100 metalloenzymes and transcription factors."
  },
  {
    "loinc": "2147-7",
    "canonicalKey": "trace_copper",
    "name": "Serum Copper (Cu)",
    "aliases": [
      "Copper",
      "Cu"
    ],
    "category": "Trace Elements & Heavy Metals",
    "primaryUnit": "ug/dL",
    "siUnit": "umol/L",
    "conventionalUnit": "ug/dL",
    "conversionFactor": 0.157,
    "referenceIntervals": {
      "conventional": {
        "min": 70,
        "max": 140,
        "text": "70 - 140 ug/dL"
      },
      "si": {
        "min": 11,
        "max": 22,
        "text": "11.0 - 22.0 umol/L"
      }
    },
    "description": "Trace element required for cytochrome c oxidase, superoxide dismutase, and ceruloplasmin."
  },
  {
    "loinc": "2926-4",
    "canonicalKey": "trace_selenium",
    "name": "Serum Selenium (Se)",
    "aliases": [
      "Selenium",
      "Se"
    ],
    "category": "Trace Elements & Heavy Metals",
    "primaryUnit": "ug/L",
    "siUnit": "umol/L",
    "conventionalUnit": "ug/L",
    "conversionFactor": 0.01266,
    "referenceIntervals": {
      "conventional": {
        "min": 70,
        "max": 150,
        "text": "70 - 150 ug/L"
      },
      "si": {
        "min": 0.89,
        "max": 1.9,
        "text": "0.89 - 1.90 umol/L"
      }
    },
    "description": "Essential component of selenoproteins including glutathione peroxidase and deiodinase enzymes."
  },
  {
    "loinc": "5671-3",
    "canonicalKey": "trace_lead",
    "name": "Blood Lead Level (Pb)",
    "aliases": [
      "Lead",
      "Blood Lead",
      "Pb"
    ],
    "category": "Trace Elements & Heavy Metals",
    "primaryUnit": "ug/dL",
    "siUnit": "umol/L",
    "conventionalUnit": "ug/dL",
    "conversionFactor": 0.0483,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 5,
        "text": "< 5.0 ug/dL (< 3.5 in children)"
      },
      "si": {
        "min": 0,
        "max": 0.24,
        "text": "< 0.24 umol/L"
      }
    },
    "description": "Toxic heavy metal causing neurocognitive deficits and anemia; CDC reference level is < 3.5 ug/dL."
  },
  {
    "loinc": "5685-3",
    "canonicalKey": "trace_mercury",
    "name": "Blood Mercury (Hg)",
    "aliases": [
      "Mercury",
      "Hg"
    ],
    "category": "Trace Elements & Heavy Metals",
    "primaryUnit": "ug/L",
    "siUnit": "nmol/L",
    "conventionalUnit": "ug/L",
    "conversionFactor": 4.985,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 10,
        "text": "< 10 ug/L"
      },
      "si": {
        "min": 0,
        "max": 50,
        "text": "< 50 nmol/L"
      }
    },
    "description": "Environmental toxicant derived from seafood consumption and occupational exposures."
  },
  {
    "loinc": "2286-3",
    "canonicalKey": "growth_hormone",
    "name": "Growth Hormone (GH)",
    "aliases": [
      "GH",
      "Somatotropin"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "ng/mL",
    "siUnit": "ng/mL",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.01,
        "max": 5,
        "text": "0.01 - 5 ng/mL"
      },
      "si": {
        "min": 0.01,
        "max": 5,
        "text": "0.01 - 5 ng/mL"
      }
    },
    "description": "Pulsatile pituitary hormone regulating somatic tissue growth."
  },
  {
    "loinc": "2787-0",
    "canonicalKey": "aldosterone",
    "name": "Aldosterone",
    "aliases": [
      "Aldosterone",
      "ALDO"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "ng/dL",
    "siUnit": "ng/dL",
    "conventionalUnit": "ng/dL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 3,
        "max": 16,
        "text": "3 - 16 ng/dL"
      },
      "si": {
        "min": 3,
        "max": 16,
        "text": "3 - 16 ng/dL"
      }
    },
    "description": "Adrenal mineralocorticoid promoting renal sodium reabsorption and potassium excretion."
  },
  {
    "loinc": "2837-3",
    "canonicalKey": "plasma_renin",
    "name": "Plasma Renin Activity (PRA)",
    "aliases": [
      "PRA",
      "Renin"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "ng/mL/hr",
    "siUnit": "ng/mL/hr",
    "conventionalUnit": "ng/mL/hr",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.6,
        "max": 4.3,
        "text": "0.6 - 4.3 ng/mL/hr"
      },
      "si": {
        "min": 0.6,
        "max": 4.3,
        "text": "0.6 - 4.3 ng/mL/hr"
      }
    },
    "description": "Enzymatic activity of renal juxtaglomerular renin."
  },
  {
    "loinc": "2168-3",
    "canonicalKey": "calcitonin",
    "name": "Calcitonin",
    "aliases": [
      "Calcitonin"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "pg/mL",
    "siUnit": "pg/mL",
    "conventionalUnit": "pg/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 8.4,
        "text": "0 - 8.4 pg/mL"
      },
      "si": {
        "min": 0,
        "max": 8.4,
        "text": "0 - 8.4 pg/mL"
      }
    },
    "description": "Thyroid C-cell hormone; tumor marker for medullary thyroid carcinoma."
  },
  {
    "loinc": "2336-6",
    "canonicalKey": "gastrin",
    "name": "Serum Gastrin",
    "aliases": [
      "Gastrin"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "pg/mL",
    "siUnit": "pg/mL",
    "conventionalUnit": "pg/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 13,
        "max": 115,
        "text": "13 - 115 pg/mL"
      },
      "si": {
        "min": 13,
        "max": 115,
        "text": "13 - 115 pg/mL"
      }
    },
    "description": "Antral G-cell hormone stimulating gastric acid secretion; elevated in Zollinger-Ellison."
  },
  {
    "loinc": "2234-3",
    "canonicalKey": "erythropoietin",
    "name": "Erythropoietin (EPO)",
    "aliases": [
      "EPO",
      "Erythropoietin"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "mIU/mL",
    "siUnit": "mIU/mL",
    "conventionalUnit": "mIU/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 2.6,
        "max": 18.5,
        "text": "2.6 - 18.5 mIU/mL"
      },
      "si": {
        "min": 2.6,
        "max": 18.5,
        "text": "2.6 - 18.5 mIU/mL"
      }
    },
    "description": "Renal glycoprotein hormone driving bone marrow red blood cell production."
  },
  {
    "loinc": "2842-3",
    "canonicalKey": "prostate_specific_antigen",
    "name": "PSA Total (Prostate-Specific Antigen)",
    "aliases": [
      "PSA",
      "Total PSA",
      "Prostate Specific Antigen"
    ],
    "category": "Hormones & Reproductive",
    "primaryUnit": "ng/mL",
    "siUnit": "ng/mL",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 4,
        "text": "0 - 4 ng/mL"
      },
      "si": {
        "min": 0,
        "max": 4,
        "text": "0 - 4 ng/mL"
      }
    },
    "description": "Serine protease screened for prostatic hyperplasia and adenocarcinoma."
  },
  {
    "loinc": "2854-8",
    "canonicalKey": "free_psa",
    "name": "Free PSA",
    "aliases": [
      "Free PSA",
      "fPSA"
    ],
    "category": "Hormones & Reproductive",
    "primaryUnit": "ng/mL",
    "siUnit": "ng/mL",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 0.93,
        "text": "0 - 0.93 ng/mL"
      },
      "si": {
        "min": 0,
        "max": 0.93,
        "text": "0 - 0.93 ng/mL"
      }
    },
    "description": "Unbound PSA fraction; higher % Free PSA indicates benign prostatic hyperplasia."
  },
  {
    "loinc": "20570-8",
    "canonicalKey": "hcg_total",
    "name": "hCG (Total / Quantitative)",
    "aliases": [
      "hCG",
      "Beta-hCG",
      "Pregnancy Test"
    ],
    "category": "Hormones & Reproductive",
    "primaryUnit": "mIU/mL",
    "siUnit": "mIU/mL",
    "conventionalUnit": "mIU/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 5,
        "text": "0 - 5 mIU/mL"
      },
      "si": {
        "min": 0,
        "max": 5,
        "text": "0 - 5 mIU/mL"
      }
    },
    "description": "Human chorionic gonadotropin secreted by placental syncytiotrophoblasts."
  },
  {
    "loinc": "2238-4",
    "canonicalKey": "estrone",
    "name": "Estrone (E1)",
    "aliases": [
      "Estrone",
      "E1"
    ],
    "category": "Hormones & Reproductive",
    "primaryUnit": "pg/mL",
    "siUnit": "pg/mL",
    "conventionalUnit": "pg/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 15,
        "max": 65,
        "text": "15 - 65 pg/mL"
      },
      "si": {
        "min": 15,
        "max": 65,
        "text": "15 - 65 pg/mL"
      }
    },
    "description": "Predominant circulating estrogen in postmenopausal women."
  },
  {
    "loinc": "2240-0",
    "canonicalKey": "estriol",
    "name": "Estriol (E3, Unconjugated)",
    "aliases": [
      "Estriol",
      "uE3"
    ],
    "category": "Hormones & Reproductive",
    "primaryUnit": "ng/mL",
    "siUnit": "ng/mL",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.1,
        "max": 0.4,
        "text": "0.1 - 0.4 ng/mL"
      },
      "si": {
        "min": 0.1,
        "max": 0.4,
        "text": "0.1 - 0.4 ng/mL"
      }
    },
    "description": "Placental estrogen monitored in maternal serum triple and quad screens."
  },
  {
    "loinc": "2973-6",
    "canonicalKey": "17_hydroxyprogesterone",
    "name": "17-Hydroxyprogesterone (17-OHP)",
    "aliases": [
      "17-OHP",
      "17-Hydroxyprogesterone"
    ],
    "category": "Hormones & Reproductive",
    "primaryUnit": "ng/dL",
    "siUnit": "ng/dL",
    "conventionalUnit": "ng/dL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 27,
        "max": 199,
        "text": "27 - 199 ng/dL"
      },
      "si": {
        "min": 27,
        "max": 199,
        "text": "27 - 199 ng/dL"
      }
    },
    "description": "Adrenal steroid evaluated for congenital adrenal hyperplasia (21-hydroxylase deficiency)."
  },
  {
    "loinc": "2088-3",
    "canonicalKey": "androstenedione",
    "name": "Androstenedione",
    "aliases": [
      "Androstenedione",
      "Delta-4"
    ],
    "category": "Hormones & Reproductive",
    "primaryUnit": "ng/dL",
    "siUnit": "ng/dL",
    "conventionalUnit": "ng/dL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 50,
        "max": 220,
        "text": "50 - 220 ng/dL"
      },
      "si": {
        "min": 50,
        "max": 220,
        "text": "50 - 220 ng/dL"
      }
    },
    "description": "Androgen precursor secreted by gonads and adrenal cortex."
  },
  {
    "loinc": "2614-6",
    "canonicalKey": "vitamin_b1",
    "name": "Thiamine (Vitamin B1)",
    "aliases": [
      "Thiamine",
      "Vitamin B1",
      "B1"
    ],
    "category": "Vitamins & Nutrition",
    "primaryUnit": "nmol/L",
    "siUnit": "nmol/L",
    "conventionalUnit": "nmol/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 70,
        "max": 180,
        "text": "70 - 180 nmol/L"
      },
      "si": {
        "min": 70,
        "max": 180,
        "text": "70 - 180 nmol/L"
      }
    },
    "description": "Essential cofactor for pyruvate dehydrogenase; deficiency causes beriberi and Wernicke-Korsakoff."
  },
  {
    "loinc": "2616-1",
    "canonicalKey": "vitamin_b2",
    "name": "Riboflavin (Vitamin B2)",
    "aliases": [
      "Riboflavin",
      "Vitamin B2",
      "B2"
    ],
    "category": "Vitamins & Nutrition",
    "primaryUnit": "ug/L",
    "siUnit": "ug/L",
    "conventionalUnit": "ug/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 180,
        "max": 295,
        "text": "180 - 295 ug/L"
      },
      "si": {
        "min": 180,
        "max": 295,
        "text": "180 - 295 ug/L"
      }
    },
    "description": "Precursor for FMN and FAD coenzymes in cellular respiration."
  },
  {
    "loinc": "2618-7",
    "canonicalKey": "vitamin_b6",
    "name": "Pyridoxal 5-Phosphate (Vitamin B6)",
    "aliases": [
      "Vitamin B6",
      "PLP",
      "B6",
      "Pyridoxine"
    ],
    "category": "Vitamins & Nutrition",
    "primaryUnit": "ug/L",
    "siUnit": "ug/L",
    "conventionalUnit": "ug/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 5,
        "max": 50,
        "text": "5 - 50 ug/L"
      },
      "si": {
        "min": 5,
        "max": 50,
        "text": "5 - 50 ug/L"
      }
    },
    "description": "Cofactor in amino acid neurotransmitter metabolism and heme synthesis."
  },
  {
    "loinc": "2620-3",
    "canonicalKey": "vitamin_b3",
    "name": "Niacin / Nicotinic Acid (Vitamin B3)",
    "aliases": [
      "Niacin",
      "Vitamin B3",
      "B3"
    ],
    "category": "Vitamins & Nutrition",
    "primaryUnit": "ug/mL",
    "siUnit": "ug/mL",
    "conventionalUnit": "ug/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.5,
        "max": 8.5,
        "text": "0.5 - 8.5 ug/mL"
      },
      "si": {
        "min": 0.5,
        "max": 8.5,
        "text": "0.5 - 8.5 ug/mL"
      }
    },
    "description": "Precursor for NAD and NADP coenzymes; deficiency leads to pellagra."
  },
  {
    "loinc": "2622-9",
    "canonicalKey": "vitamin_b5",
    "name": "Pantothenic Acid (Vitamin B5)",
    "aliases": [
      "Pantothenic Acid",
      "Vitamin B5",
      "B5"
    ],
    "category": "Vitamins & Nutrition",
    "primaryUnit": "ug/dL",
    "siUnit": "ug/dL",
    "conventionalUnit": "ug/dL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 1.6,
        "max": 14,
        "text": "1.6 - 14 ug/dL"
      },
      "si": {
        "min": 1.6,
        "max": 14,
        "text": "1.6 - 14 ug/dL"
      }
    },
    "description": "Structural core of Coenzyme A essential for fatty acid synthesis."
  },
  {
    "loinc": "2624-5",
    "canonicalKey": "biotin",
    "name": "Biotin (Vitamin B7)",
    "aliases": [
      "Biotin",
      "Vitamin B7",
      "Vitamin H"
    ],
    "category": "Vitamins & Nutrition",
    "primaryUnit": "pg/mL",
    "siUnit": "pg/mL",
    "conventionalUnit": "pg/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 200,
        "max": 1500,
        "text": "200 - 1500 pg/mL"
      },
      "si": {
        "min": 200,
        "max": 1500,
        "text": "200 - 1500 pg/mL"
      }
    },
    "description": "Cofactor for carboxylase enzymes in gluconeogenesis and lipogenesis."
  },
  {
    "loinc": "2626-0",
    "canonicalKey": "vitamin_k1",
    "name": "Phylloquinone (Vitamin K1)",
    "aliases": [
      "Vitamin K",
      "Vitamin K1",
      "Phylloquinone"
    ],
    "category": "Vitamins & Nutrition",
    "primaryUnit": "ng/mL",
    "siUnit": "ng/mL",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.2,
        "max": 3.2,
        "text": "0.2 - 3.2 ng/mL"
      },
      "si": {
        "min": 0.2,
        "max": 3.2,
        "text": "0.2 - 3.2 ng/mL"
      }
    },
    "description": "Required for post-translational gamma-carboxylation of clotting factors II, VII, IX, and X."
  },
  {
    "loinc": "3052-2",
    "canonicalKey": "methylmalonic_acid",
    "name": "Methylmalonic Acid (MMA)",
    "aliases": [
      "MMA",
      "Methylmalonic Acid"
    ],
    "category": "Vitamins & Nutrition",
    "primaryUnit": "umol/L",
    "siUnit": "umol/L",
    "conventionalUnit": "umol/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.08,
        "max": 0.56,
        "text": "0.08 - 0.56 umol/L"
      },
      "si": {
        "min": 0.08,
        "max": 0.56,
        "text": "0.08 - 0.56 umol/L"
      }
    },
    "description": "Highly sensitive functional biomarker for intracellular vitamin B12 deficiency."
  },
  {
    "loinc": "2039-6",
    "canonicalKey": "cea",
    "name": "Carcinoembryonic Antigen (CEA)",
    "aliases": [
      "CEA"
    ],
    "category": "Inflammation & Immunology",
    "primaryUnit": "ng/mL",
    "siUnit": "ng/mL",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 3,
        "text": "0 - 3 ng/mL"
      },
      "si": {
        "min": 0,
        "max": 3,
        "text": "0 - 3 ng/mL"
      }
    },
    "description": "Oncofetal glycoprotein monitored in colorectal carcinoma surveillance."
  },
  {
    "loinc": "10334-1",
    "canonicalKey": "ca_125",
    "name": "Cancer Antigen 125 (CA-125)",
    "aliases": [
      "CA 125",
      "CA-125"
    ],
    "category": "Hormones & Reproductive",
    "primaryUnit": "U/mL",
    "siUnit": "U/mL",
    "conventionalUnit": "U/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 35,
        "text": "0 - 35 U/mL"
      },
      "si": {
        "min": 0,
        "max": 35,
        "text": "0 - 35 U/mL"
      }
    },
    "description": "Ovarian epithelial tumor marker monitored during therapy and recurrence."
  },
  {
    "loinc": "24108-3",
    "canonicalKey": "ca_19_9",
    "name": "Carbohydrate Antigen 19-9 (CA 19-9)",
    "aliases": [
      "CA 19-9",
      "CA19-9"
    ],
    "category": "Liver & Enzymes",
    "primaryUnit": "U/mL",
    "siUnit": "U/mL",
    "conventionalUnit": "U/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 37,
        "text": "0 - 37 U/mL"
      },
      "si": {
        "min": 0,
        "max": 37,
        "text": "0 - 37 U/mL"
      }
    },
    "description": "Serum biomarker monitored in pancreaticobiliary adenocarcinoma."
  },
  {
    "loinc": "1787-8",
    "canonicalKey": "ca_15_3",
    "name": "Cancer Antigen 15-3 (CA 15-3)",
    "aliases": [
      "CA 15-3",
      "CA15-3"
    ],
    "category": "Hormones & Reproductive",
    "primaryUnit": "U/mL",
    "siUnit": "U/mL",
    "conventionalUnit": "U/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 30,
        "text": "0 - 30 U/mL"
      },
      "si": {
        "min": 0,
        "max": 30,
        "text": "0 - 30 U/mL"
      }
    },
    "description": "Epithelial glycoprotein tracked in metastatic breast carcinoma."
  },
  {
    "loinc": "1834-1",
    "canonicalKey": "alpha_fetoprotein",
    "name": "Alpha-Fetoprotein (AFP)",
    "aliases": [
      "AFP",
      "Alpha Fetoprotein"
    ],
    "category": "Liver & Enzymes",
    "primaryUnit": "ng/mL",
    "siUnit": "ng/mL",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 8,
        "text": "0 - 8 ng/mL"
      },
      "si": {
        "min": 0,
        "max": 8,
        "text": "0 - 8 ng/mL"
      }
    },
    "description": "Oncofetal protein screened in hepatocellular carcinoma and germ cell tumors."
  },
  {
    "loinc": "1794-7",
    "canonicalKey": "beta_2_microglobulin",
    "name": "Beta-2 Microglobulin (B2M)",
    "aliases": [
      "B2M",
      "Beta 2 Microglobulin"
    ],
    "category": "Inflammation & Immunology",
    "primaryUnit": "mg/L",
    "siUnit": "mg/L",
    "conventionalUnit": "mg/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 1,
        "max": 2.4,
        "text": "1 - 2.4 mg/L"
      },
      "si": {
        "min": 1,
        "max": 2.4,
        "text": "1 - 2.4 mg/L"
      }
    },
    "description": "MHC class I light chain reflecting lymphocyte turnover and multiple myeloma staging."
  },
  {
    "loinc": "2744-1",
    "canonicalKey": "blood_ph",
    "name": "Blood pH (Arterial / Venous)",
    "aliases": [
      "pH",
      "Blood pH"
    ],
    "category": "Electrolytes & Minerals",
    "primaryUnit": "pH units",
    "siUnit": "pH units",
    "conventionalUnit": "pH units",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 7.35,
        "max": 7.45,
        "text": "7.35 - 7.45 pH units"
      },
      "si": {
        "min": 7.35,
        "max": 7.45,
        "text": "7.35 - 7.45 pH units"
      }
    },
    "description": "Strictly regulated arterial hydrogen ion concentration balance."
  },
  {
    "loinc": "2019-8",
    "canonicalKey": "pco2",
    "name": "Partial Pressure of CO2 (pCO2)",
    "aliases": [
      "pCO2",
      "Carbon Dioxide Tension"
    ],
    "category": "Electrolytes & Minerals",
    "primaryUnit": "mmHg",
    "siUnit": "mmHg",
    "conventionalUnit": "mmHg",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 35,
        "max": 45,
        "text": "35 - 45 mmHg"
      },
      "si": {
        "min": 35,
        "max": 45,
        "text": "35 - 45 mmHg"
      }
    },
    "description": "Respiratory component of systemic acid-base equilibrium."
  },
  {
    "loinc": "2703-7",
    "canonicalKey": "po2",
    "name": "Partial Pressure of Oxygen (pO2)",
    "aliases": [
      "pO2",
      "Oxygen Tension"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "mmHg",
    "siUnit": "mmHg",
    "conventionalUnit": "mmHg",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 80,
        "max": 100,
        "text": "80 - 100 mmHg"
      },
      "si": {
        "min": 80,
        "max": 100,
        "text": "80 - 100 mmHg"
      }
    },
    "description": "Direct physical dissolved oxygen tension in arterial blood."
  },
  {
    "loinc": "2708-6",
    "canonicalKey": "oxygen_saturation",
    "name": "Oxygen Saturation (sO2 / SaO2)",
    "aliases": [
      "SaO2",
      "O2 Sat",
      "SpO2"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "%",
    "siUnit": "%",
    "conventionalUnit": "%",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 95,
        "max": 100,
        "text": "95 - 100 %"
      },
      "si": {
        "min": 95,
        "max": 100,
        "text": "95 - 100 %"
      }
    },
    "description": "Percentage of total hemoglobin bound with oxygen."
  },
  {
    "loinc": "20563-3",
    "canonicalKey": "carboxyhemoglobin",
    "name": "Carboxyhemoglobin (CO-Hb)",
    "aliases": [
      "COHb",
      "Carboxyhemoglobin"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "%",
    "siUnit": "%",
    "conventionalUnit": "%",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 2,
        "text": "0 - 2 %"
      },
      "si": {
        "min": 0,
        "max": 2,
        "text": "0 - 2 %"
      }
    },
    "description": "Hemoglobin bound with carbon monoxide; elevated in smoke inhalation and smokers."
  },
  {
    "loinc": "2614-6",
    "canonicalKey": "methemoglobin",
    "name": "Methemoglobin",
    "aliases": [
      "MetHb",
      "Methemoglobin"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "%",
    "siUnit": "%",
    "conventionalUnit": "%",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 1.5,
        "text": "0 - 1.5 %"
      },
      "si": {
        "min": 0,
        "max": 1.5,
        "text": "0 - 1.5 %"
      }
    },
    "description": "Oxidized ferric (Fe3+) hemoglobin unable to release oxygen."
  },
  {
    "loinc": "2064-4",
    "canonicalKey": "ceruloplasmin",
    "name": "Ceruloplasmin",
    "aliases": [
      "Ceruloplasmin"
    ],
    "category": "Liver & Enzymes",
    "primaryUnit": "mg/dL",
    "siUnit": "mg/dL",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 20,
        "max": 60,
        "text": "20 - 60 mg/dL"
      },
      "si": {
        "min": 20,
        "max": 60,
        "text": "20 - 60 mg/dL"
      }
    },
    "description": "Copper transport ferroxidase enzyme decreased in Wilson disease."
  },
  {
    "loinc": "1826-7",
    "canonicalKey": "alpha_1_antitrypsin",
    "name": "Alpha-1 Antitrypsin (AAT)",
    "aliases": [
      "AAT",
      "Alpha 1 Antitrypsin"
    ],
    "category": "Liver & Enzymes",
    "primaryUnit": "mg/dL",
    "siUnit": "mg/dL",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 90,
        "max": 200,
        "text": "90 - 200 mg/dL"
      },
      "si": {
        "min": 90,
        "max": 200,
        "text": "90 - 200 mg/dL"
      }
    },
    "description": "Protease inhibitor safeguarding lung parenchymal elastin from neutrophil elastase."
  },
  {
    "loinc": "1977-8",
    "canonicalKey": "bile_acids",
    "name": "Total Bile Acids",
    "aliases": [
      "Bile Acids",
      "Serum Bile Acids"
    ],
    "category": "Liver & Enzymes",
    "primaryUnit": "umol/L",
    "siUnit": "umol/L",
    "conventionalUnit": "umol/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 10,
        "text": "0 - 10 umol/L"
      },
      "si": {
        "min": 0,
        "max": 10,
        "text": "0 - 10 umol/L"
      }
    },
    "description": "Hepatic cholesterol derivatives elevated in intrahepatic cholestasis of pregnancy."
  },
  {
    "loinc": "1805-1",
    "canonicalKey": "ammonia",
    "name": "Plasma Ammonia (NH3)",
    "aliases": [
      "Ammonia",
      "NH3"
    ],
    "category": "Liver & Enzymes",
    "primaryUnit": "umol/L",
    "siUnit": "umol/L",
    "conventionalUnit": "umol/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 15,
        "max": 45,
        "text": "15 - 45 umol/L"
      },
      "si": {
        "min": 15,
        "max": 45,
        "text": "15 - 45 umol/L"
      }
    },
    "description": "Neurotoxic nitrogenous waste product cleared into urea by healthy liver."
  },
  {
    "loinc": "2164-2",
    "canonicalKey": "creatinine_clearance",
    "name": "Creatinine Clearance (CrCl)",
    "aliases": [
      "CrCl",
      "Creatinine Clearance"
    ],
    "category": "Metabolic & Renal",
    "primaryUnit": "mL/min",
    "siUnit": "mL/min",
    "conventionalUnit": "mL/min",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 90,
        "max": 140,
        "text": "90 - 140 mL/min"
      },
      "si": {
        "min": 90,
        "max": 140,
        "text": "90 - 140 mL/min"
      }
    },
    "description": "24-hour urine creatinine measurement of glomerular filtration rate."
  },
  {
    "loinc": "2888-6",
    "canonicalKey": "urine_protein_24h",
    "name": "24-Hour Urine Total Protein",
    "aliases": [
      "24h Urine Protein",
      "Urine Protein"
    ],
    "category": "Metabolic & Renal",
    "primaryUnit": "mg/24h",
    "siUnit": "mg/24h",
    "conventionalUnit": "mg/24h",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 150,
        "text": "0 - 150 mg/24h"
      },
      "si": {
        "min": 0,
        "max": 150,
        "text": "0 - 150 mg/24h"
      }
    },
    "description": "Total protein lost in 24 hours; >3.5g defines nephrotic-range proteinuria."
  },
  {
    "loinc": "3182-3",
    "canonicalKey": "antithrombin_iii",
    "name": "Antithrombin III Activity",
    "aliases": [
      "AT III",
      "Antithrombin"
    ],
    "category": "Coagulation",
    "primaryUnit": "%",
    "siUnit": "%",
    "conventionalUnit": "%",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 80,
        "max": 120,
        "text": "80 - 120 %"
      },
      "si": {
        "min": 80,
        "max": 120,
        "text": "80 - 120 %"
      }
    },
    "description": "Natural anticoagulant enzyme inhibiting thrombin and factor Xa; required for heparin efficacy."
  },
  {
    "loinc": "5946-9",
    "canonicalKey": "protein_c",
    "name": "Protein C Activity",
    "aliases": [
      "Protein C"
    ],
    "category": "Coagulation",
    "primaryUnit": "%",
    "siUnit": "%",
    "conventionalUnit": "%",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 70,
        "max": 140,
        "text": "70 - 140 %"
      },
      "si": {
        "min": 70,
        "max": 140,
        "text": "70 - 140 %"
      }
    },
    "description": "Vitamin K-dependent anticoagulant that degrades factors Va and VIIIa."
  },
  {
    "loinc": "5947-7",
    "canonicalKey": "protein_s",
    "name": "Protein S Activity (Free)",
    "aliases": [
      "Protein S",
      "Free Protein S"
    ],
    "category": "Coagulation",
    "primaryUnit": "%",
    "siUnit": "%",
    "conventionalUnit": "%",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 65,
        "max": 140,
        "text": "65 - 140 %"
      },
      "si": {
        "min": 65,
        "max": 140,
        "text": "65 - 140 %"
      }
    },
    "description": "Essential cofactor to activated Protein C in physiological anticoagulation."
  },
  {
    "loinc": "27813-5",
    "canonicalKey": "factor_v_leiden",
    "name": "Factor V Leiden Resistance",
    "aliases": [
      "Factor V Leiden",
      "APC Resistance"
    ],
    "category": "Coagulation",
    "primaryUnit": "ratio",
    "siUnit": "ratio",
    "conventionalUnit": "ratio",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 2.1,
        "max": 3.5,
        "text": "2.1 - 3.5 ratio"
      },
      "si": {
        "min": 2.1,
        "max": 3.5,
        "text": "2.1 - 3.5 ratio"
      }
    },
    "description": "Most common hereditary thrombophilia conferring resistance to activated Protein C."
  },
  {
    "loinc": "3185-6",
    "canonicalKey": "lupus_anticoagulant",
    "name": "Lupus Anticoagulant Screen (dRVVT)",
    "aliases": [
      "Lupus Anticoagulant",
      "dRVVT"
    ],
    "category": "Coagulation",
    "primaryUnit": "ratio",
    "siUnit": "ratio",
    "conventionalUnit": "ratio",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.8,
        "max": 1.2,
        "text": "0.8 - 1.2 ratio"
      },
      "si": {
        "min": 0.8,
        "max": 1.2,
        "text": "0.8 - 1.2 ratio"
      }
    },
    "description": "Antiphospholipid antibody prolonging in vitro clotting tests while causing in vivo thrombosis."
  },
  {
    "loinc": "30523-5",
    "canonicalKey": "mpo_anca",
    "name": "Myeloperoxidase Antibodies (p-ANCA / MPO)",
    "aliases": [
      "p-ANCA",
      "MPO Antibodies"
    ],
    "category": "Inflammation & Immunology",
    "primaryUnit": "AU/mL",
    "siUnit": "AU/mL",
    "conventionalUnit": "AU/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 19,
        "text": "0 - 19 AU/mL"
      },
      "si": {
        "min": 0,
        "max": 19,
        "text": "0 - 19 AU/mL"
      }
    },
    "description": "Vasculitis autoantibody associated with microscopic polyangiitis and Churg-Strauss."
  },
  {
    "loinc": "30524-3",
    "canonicalKey": "pr3_anca",
    "name": "Proteinase 3 Antibodies (c-ANCA / PR3)",
    "aliases": [
      "c-ANCA",
      "PR3 Antibodies"
    ],
    "category": "Inflammation & Immunology",
    "primaryUnit": "AU/mL",
    "siUnit": "AU/mL",
    "conventionalUnit": "AU/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 19,
        "text": "0 - 19 AU/mL"
      },
      "si": {
        "min": 0,
        "max": 19,
        "text": "0 - 19 AU/mL"
      }
    },
    "description": "Vasculitis autoantibody diagnostic for granulomatosis with polyangiitis (Wegener)."
  },
  {
    "loinc": "53023-8",
    "canonicalKey": "anti_ccp",
    "name": "Anti-Cyclic Citrullinated Peptide (Anti-CCP)",
    "aliases": [
      "Anti-CCP",
      "CCP Antibodies"
    ],
    "category": "Inflammation & Immunology",
    "primaryUnit": "U/mL",
    "siUnit": "U/mL",
    "conventionalUnit": "U/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 20,
        "text": "0 - 20 U/mL"
      },
      "si": {
        "min": 0,
        "max": 20,
        "text": "0 - 20 U/mL"
      }
    },
    "description": "Highly specific (>95%) serological marker for rheumatoid arthritis."
  },
  {
    "loinc": "46152-5",
    "canonicalKey": "anti_dsdna",
    "name": "Anti-dsDNA Antibodies",
    "aliases": [
      "Anti-dsDNA",
      "dsDNA Antibodies"
    ],
    "category": "Inflammation & Immunology",
    "primaryUnit": "IU/mL",
    "siUnit": "IU/mL",
    "conventionalUnit": "IU/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 10,
        "text": "0 - 10 IU/mL"
      },
      "si": {
        "min": 0,
        "max": 10,
        "text": "0 - 10 IU/mL"
      }
    },
    "description": "Pathognomonic antibody for systemic lupus erythematosus correlated with active nephritis."
  },
  {
    "loinc": "11090-8",
    "canonicalKey": "anti_smith",
    "name": "Anti-Smith Antibodies (Anti-Sm)",
    "aliases": [
      "Anti-Sm",
      "Smith Antibodies"
    ],
    "category": "Inflammation & Immunology",
    "primaryUnit": "index",
    "siUnit": "index",
    "conventionalUnit": "index",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 0.9,
        "text": "0 - 0.9 index"
      },
      "si": {
        "min": 0,
        "max": 0.9,
        "text": "0 - 0.9 index"
      }
    },
    "description": "Highly specific nuclear autoantibody characteristic of lupus."
  },
  {
    "loinc": "11091-6",
    "canonicalKey": "anti_ssa_ro",
    "name": "Anti-SSA / Ro Antibodies",
    "aliases": [
      "Anti-Ro",
      "SSA Antibodies"
    ],
    "category": "Inflammation & Immunology",
    "primaryUnit": "index",
    "siUnit": "index",
    "conventionalUnit": "index",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 0.9,
        "text": "0 - 0.9 index"
      },
      "si": {
        "min": 0,
        "max": 0.9,
        "text": "0 - 0.9 index"
      }
    },
    "description": "Autoantibody prevalent in Sjogren syndrome, cutaneous lupus, and neonatal heart block."
  },
  {
    "loinc": "11092-4",
    "canonicalKey": "anti_ssb_la",
    "name": "Anti-SSB / La Antibodies",
    "aliases": [
      "Anti-La",
      "SSB Antibodies"
    ],
    "category": "Inflammation & Immunology",
    "primaryUnit": "index",
    "siUnit": "index",
    "conventionalUnit": "index",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 0.9,
        "text": "0 - 0.9 index"
      },
      "si": {
        "min": 0,
        "max": 0.9,
        "text": "0 - 0.9 index"
      }
    },
    "description": "Companion autoantibody to SSA/Ro in Sjogren syndrome."
  },
  {
    "loinc": "46452-9",
    "canonicalKey": "tissue_transglutaminase_iga",
    "name": "tTG-IgA (Tissue Transglutaminase)",
    "aliases": [
      "tTG-IgA",
      "Celiac Panel",
      "Tissue Transglutaminase"
    ],
    "category": "Inflammation & Immunology",
    "primaryUnit": "U/mL",
    "siUnit": "U/mL",
    "conventionalUnit": "U/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 15,
        "text": "0 - 15 U/mL"
      },
      "si": {
        "min": 0,
        "max": 15,
        "text": "0 - 15 U/mL"
      }
    },
    "description": "Premier serological screening test for Celiac disease."
  },
  {
    "loinc": "50868-9",
    "canonicalKey": "deamidated_gliadin_iga",
    "name": "Deamidated Gliadin Peptide IgA (DGP)",
    "aliases": [
      "DGP-IgA",
      "Gliadin Peptide"
    ],
    "category": "Inflammation & Immunology",
    "primaryUnit": "U/mL",
    "siUnit": "U/mL",
    "conventionalUnit": "U/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 19,
        "text": "0 - 19 U/mL"
      },
      "si": {
        "min": 0,
        "max": 19,
        "text": "0 - 19 U/mL"
      }
    },
    "description": "High-specificity marker for gluten-sensitive enteropathy in young pediatric patients."
  },
  {
    "loinc": "11580-8",
    "canonicalKey": "hLAB27",
    "name": "HLA-B27 Antigen",
    "aliases": [
      "HLA-B27",
      "Ankylosing Spondylitis Gene"
    ],
    "category": "Inflammation & Immunology",
    "primaryUnit": "result",
    "siUnit": "result",
    "conventionalUnit": "result",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 0,
        "text": "0 - 0 result"
      },
      "si": {
        "min": 0,
        "max": 0,
        "text": "0 - 0 result"
      }
    },
    "description": "MHC class I surface allele strongly predisposing to ankylosing spondylitis and uveitis."
  },
  {
    "loinc": "3299-5",
    "canonicalKey": "cardio_mpo",
    "name": "Myeloperoxidase (MPO)",
    "aliases": [
      "Myeloperoxidase (MPO)",
      "Myeloperoxidase"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "pmol/L",
    "siUnit": "pmol/L",
    "conventionalUnit": "pmol/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 470,
        "text": "0 - 470 pmol/L"
      },
      "si": {
        "min": 0,
        "max": 470,
        "text": "0 - 470 pmol/L"
      }
    },
    "description": "Leukocyte-derived enzyme linked to vulnerable coronary plaque rupture."
  },
  {
    "loinc": "35677-4",
    "canonicalKey": "cardio_oxldl",
    "name": "Oxidized LDL (oxLDL)",
    "aliases": [
      "Oxidized LDL (oxLDL)",
      "Oxidized"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "U/L",
    "siUnit": "U/L",
    "conventionalUnit": "U/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 60,
        "text": "0 - 60 U/L"
      },
      "si": {
        "min": 0,
        "max": 60,
        "text": "0 - 60 U/L"
      }
    },
    "description": "Circulating oxidatively modified LDL triggering foam cell formation."
  },
  {
    "loinc": "3256-5",
    "canonicalKey": "cardio_fibrinogen_ag",
    "name": "Fibrinogen Antigen",
    "aliases": [
      "Fibrinogen Antigen",
      "Fibrinogen"
    ],
    "category": "Lipids & Cardiovascular",
    "primaryUnit": "mg/dL",
    "siUnit": "mg/dL",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 200,
        "max": 393,
        "text": "200 - 393 mg/dL"
      },
      "si": {
        "min": 200,
        "max": 393,
        "text": "200 - 393 mg/dL"
      }
    },
    "description": "Independent cardiovascular risk factor for ischemic heart disease."
  },
  {
    "loinc": "47867-7",
    "canonicalKey": "metabolic_adiponectin",
    "name": "Adiponectin",
    "aliases": [
      "Adiponectin",
      "Adiponectin"
    ],
    "category": "Metabolic & Renal",
    "primaryUnit": "ug/mL",
    "siUnit": "ug/mL",
    "conventionalUnit": "ug/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 5,
        "max": 30,
        "text": "5 - 30 ug/mL"
      },
      "si": {
        "min": 5,
        "max": 30,
        "text": "5 - 30 ug/mL"
      }
    },
    "description": "Anti-inflammatory, insulin-sensitizing adipokine secreted by healthy fat tissue."
  },
  {
    "loinc": "2544-5",
    "canonicalKey": "metabolic_leptin",
    "name": "Leptin",
    "aliases": [
      "Leptin",
      "Leptin"
    ],
    "category": "Metabolic & Renal",
    "primaryUnit": "ng/mL",
    "siUnit": "ng/mL",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 2,
        "max": 18,
        "text": "2 - 18 ng/mL"
      },
      "si": {
        "min": 2,
        "max": 18,
        "text": "2 - 18 ng/mL"
      }
    },
    "description": "Adipose-derived satiety hormone regulating long-term energy expenditure."
  },
  {
    "loinc": "2338-2",
    "canonicalKey": "metabolic_glucagon",
    "name": "Glucagon",
    "aliases": [
      "Glucagon",
      "Glucagon"
    ],
    "category": "Metabolic & Renal",
    "primaryUnit": "pg/mL",
    "siUnit": "pg/mL",
    "conventionalUnit": "pg/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 50,
        "max": 100,
        "text": "50 - 100 pg/mL"
      },
      "si": {
        "min": 50,
        "max": 100,
        "text": "50 - 100 pg/mL"
      }
    },
    "description": "Alpha-cell hormone stimulating glycogenolysis and hepatic glucose release."
  },
  {
    "loinc": "58450-8",
    "canonicalKey": "metabolic_homa_ir",
    "name": "HOMA-IR",
    "aliases": [
      "HOMA-IR",
      "HOMA-IR"
    ],
    "category": "Metabolic & Renal",
    "primaryUnit": "index",
    "siUnit": "index",
    "conventionalUnit": "index",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.5,
        "max": 1.9,
        "text": "0.5 - 1.9 index"
      },
      "si": {
        "min": 0.5,
        "max": 1.9,
        "text": "0.5 - 1.9 index"
      }
    },
    "description": "Homeostatic model assessment of insulin resistance calculated from fasting glucose and insulin."
  },
  {
    "loinc": "2841-5",
    "canonicalKey": "metabolic_proinsulin",
    "name": "Proinsulin",
    "aliases": [
      "Proinsulin",
      "Proinsulin"
    ],
    "category": "Metabolic & Renal",
    "primaryUnit": "pmol/L",
    "siUnit": "pmol/L",
    "conventionalUnit": "pmol/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 3,
        "max": 20,
        "text": "3 - 20 pmol/L"
      },
      "si": {
        "min": 3,
        "max": 20,
        "text": "3 - 20 pmol/L"
      }
    },
    "description": "Immature precursor protein; elevated in beta cell stress and insulinoma."
  },
  {
    "loinc": "30252-1",
    "canonicalKey": "iron_stfr",
    "name": "Soluble Transferrin Receptor (sTfR)",
    "aliases": [
      "Soluble Transferrin Receptor (sTfR)",
      "Soluble"
    ],
    "category": "Iron & Anemia",
    "primaryUnit": "mg/L",
    "siUnit": "mg/L",
    "conventionalUnit": "mg/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 1.8,
        "max": 4.6,
        "text": "1.8 - 4.6 mg/L"
      },
      "si": {
        "min": 1.8,
        "max": 4.6,
        "text": "1.8 - 4.6 mg/L"
      }
    },
    "description": "Measures cellular iron hunger without confounding by systemic inflammation."
  },
  {
    "loinc": "2930-6",
    "canonicalKey": "iron_zpp",
    "name": "Zinc Protoporphyrin (ZPP)",
    "aliases": [
      "Zinc Protoporphyrin (ZPP)",
      "Zinc"
    ],
    "category": "Iron & Anemia",
    "primaryUnit": "umol/mol heme",
    "siUnit": "umol/mol heme",
    "conventionalUnit": "umol/mol heme",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 30,
        "max": 70,
        "text": "30 - 70 umol/mol heme"
      },
      "si": {
        "min": 30,
        "max": 70,
        "text": "30 - 70 umol/mol heme"
      }
    },
    "description": "Incorporated into heme when iron is unavailable; indicator of functional iron deficiency."
  },
  {
    "loinc": "55787-6",
    "canonicalKey": "iron_hepcidin",
    "name": "Hepcidin",
    "aliases": [
      "Hepcidin",
      "Hepcidin"
    ],
    "category": "Iron & Anemia",
    "primaryUnit": "ng/mL",
    "siUnit": "ng/mL",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 1.5,
        "max": 25,
        "text": "1.5 - 25 ng/mL"
      },
      "si": {
        "min": 1.5,
        "max": 25,
        "text": "1.5 - 25 ng/mL"
      }
    },
    "description": "Master iron regulatory hormone that blocks ferroportin channel."
  },
  {
    "loinc": "2354-9",
    "canonicalKey": "iron_haptoglobin",
    "name": "Haptoglobin",
    "aliases": [
      "Haptoglobin",
      "Haptoglobin"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "mg/dL",
    "siUnit": "mg/dL",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 30,
        "max": 200,
        "text": "30 - 200 mg/dL"
      },
      "si": {
        "min": 30,
        "max": 200,
        "text": "30 - 200 mg/dL"
      }
    },
    "description": "Binds free hemoglobin; markedly drops in intravascular hemolysis."
  },
  {
    "loinc": "2357-2",
    "canonicalKey": "iron_hemopexin",
    "name": "Hemopexin",
    "aliases": [
      "Hemopexin",
      "Hemopexin"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "mg/dL",
    "siUnit": "mg/dL",
    "conventionalUnit": "mg/dL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 50,
        "max": 115,
        "text": "50 - 115 mg/dL"
      },
      "si": {
        "min": 50,
        "max": 115,
        "text": "50 - 115 mg/dL"
      }
    },
    "description": "Plasma scavenger of free toxic heme released during severe hemolytic events."
  },
  {
    "loinc": "2345-7",
    "canonicalKey": "cbc_g6pd",
    "name": "G6PD (Glucose-6-Phosphate Dehydrogenase)",
    "aliases": [
      "G6PD (Glucose-6-Phosphate Dehydrogenase)",
      "G6PD"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "U/g Hb",
    "siUnit": "U/g Hb",
    "conventionalUnit": "U/g Hb",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 7,
        "max": 20.5,
        "text": "7 - 20.5 U/g Hb"
      },
      "si": {
        "min": 7,
        "max": 20.5,
        "text": "7 - 20.5 U/g Hb"
      }
    },
    "description": "Enzyme protecting red cells against oxidative stressors; deficiency triggers favism."
  },
  {
    "loinc": "2696-3",
    "canonicalKey": "cbc_osmotic_fragility",
    "name": "Osmotic Fragility",
    "aliases": [
      "Osmotic Fragility",
      "Osmotic"
    ],
    "category": "CBC & Hematology",
    "primaryUnit": "% lysis",
    "siUnit": "% lysis",
    "conventionalUnit": "% lysis",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.4,
        "max": 0.45,
        "text": "0.4 - 0.45 % lysis"
      },
      "si": {
        "min": 0.4,
        "max": 0.45,
        "text": "0.4 - 0.45 % lysis"
      }
    },
    "description": "Diagnostic test for hereditary spherocytosis."
  },
  {
    "loinc": "2610-4",
    "canonicalKey": "endocrine_metanephrines",
    "name": "Metanephrines (Plasma Free)",
    "aliases": [
      "Metanephrines (Plasma Free)",
      "Metanephrines"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "pg/mL",
    "siUnit": "pg/mL",
    "conventionalUnit": "pg/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 65,
        "text": "0 - 65 pg/mL"
      },
      "si": {
        "min": 0,
        "max": 65,
        "text": "0 - 65 pg/mL"
      }
    },
    "description": "Screening biomarker for pheochromocytoma and paraganglioma."
  },
  {
    "loinc": "14868-4",
    "canonicalKey": "endocrine_normetanephrine",
    "name": "Normetanephrine (Plasma Free)",
    "aliases": [
      "Normetanephrine (Plasma Free)",
      "Normetanephrine"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "pg/mL",
    "siUnit": "pg/mL",
    "conventionalUnit": "pg/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 148,
        "text": "0 - 148 pg/mL"
      },
      "si": {
        "min": 0,
        "max": 148,
        "text": "0 - 148 pg/mL"
      }
    },
    "description": "Norepinephrine metabolite screened in neuroendocrine tumors."
  },
  {
    "loinc": "9811-1",
    "canonicalKey": "endocrine_chromogranin_a",
    "name": "Chromogranin A (CgA)",
    "aliases": [
      "Chromogranin A (CgA)",
      "Chromogranin"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "ng/mL",
    "siUnit": "ng/mL",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 25,
        "max": 140,
        "text": "25 - 140 ng/mL"
      },
      "si": {
        "min": 25,
        "max": 140,
        "text": "25 - 140 ng/mL"
      }
    },
    "description": "Major neuroendocrine secretory granule protein tracked in carcinoid tumors."
  },
  {
    "loinc": "3013-0",
    "canonicalKey": "thyroid_thyroglobulin",
    "name": "Thyroglobulin (Tg)",
    "aliases": [
      "Thyroglobulin (Tg)",
      "Thyroglobulin"
    ],
    "category": "Thyroid & Endocrine",
    "primaryUnit": "ng/mL",
    "siUnit": "ng/mL",
    "conventionalUnit": "ng/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 1.5,
        "max": 30,
        "text": "1.5 - 30 ng/mL"
      },
      "si": {
        "min": 1.5,
        "max": 30,
        "text": "1.5 - 30 ng/mL"
      }
    },
    "description": "Differentiated thyroid tissue tumor marker monitored after thyroidectomy."
  },
  {
    "loinc": "1649-3",
    "canonicalKey": "vitamin_calcitriol",
    "name": "Calcitriol (1,25-Dihydroxyvitamin D)",
    "aliases": [
      "Calcitriol (1,25-Dihydroxyvitamin D)",
      "Calcitriol"
    ],
    "category": "Vitamins & Nutrition",
    "primaryUnit": "pg/mL",
    "siUnit": "pg/mL",
    "conventionalUnit": "pg/mL",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 18,
        "max": 72,
        "text": "18 - 72 pg/mL"
      },
      "si": {
        "min": 18,
        "max": 72,
        "text": "18 - 72 pg/mL"
      }
    },
    "description": "Active hormonal form of vitamin D converted in kidneys by 1-alpha-hydroxylase."
  },
  {
    "loinc": "5630-9",
    "canonicalKey": "trace_cadmium",
    "name": "Cadmium (Blood)",
    "aliases": [
      "Cadmium (Blood)",
      "Cadmium"
    ],
    "category": "Trace Elements & Heavy Metals",
    "primaryUnit": "ug/L",
    "siUnit": "ug/L",
    "conventionalUnit": "ug/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 1.2,
        "text": "0 - 1.2 ug/L"
      },
      "si": {
        "min": 0,
        "max": 1.2,
        "text": "0 - 1.2 ug/L"
      }
    },
    "description": "Industrial and tobacco smoke toxicant accumulated in renal cortex."
  },
  {
    "loinc": "5585-5",
    "canonicalKey": "trace_arsenic",
    "name": "Arsenic (Blood)",
    "aliases": [
      "Arsenic (Blood)",
      "Arsenic"
    ],
    "category": "Trace Elements & Heavy Metals",
    "primaryUnit": "ug/L",
    "siUnit": "ug/L",
    "conventionalUnit": "ug/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 12,
        "text": "0 - 12 ug/L"
      },
      "si": {
        "min": 0,
        "max": 12,
        "text": "0 - 12 ug/L"
      }
    },
    "description": "Toxic heavy metalloid inhibiting cellular pyruvate dehydrogenase."
  },
  {
    "loinc": "5574-9",
    "canonicalKey": "trace_aluminum",
    "name": "Aluminum (Serum)",
    "aliases": [
      "Aluminum (Serum)",
      "Aluminum"
    ],
    "category": "Trace Elements & Heavy Metals",
    "primaryUnit": "ug/L",
    "siUnit": "ug/L",
    "conventionalUnit": "ug/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0,
        "max": 7,
        "text": "0 - 7 ug/L"
      },
      "si": {
        "min": 0,
        "max": 7,
        "text": "0 - 7 ug/L"
      }
    },
    "description": "Accumulates in dialysis patients causing osteomalacia and encephalopathy."
  },
  {
    "loinc": "5683-8",
    "canonicalKey": "trace_manganese",
    "name": "Manganese (Blood)",
    "aliases": [
      "Manganese (Blood)",
      "Manganese"
    ],
    "category": "Trace Elements & Heavy Metals",
    "primaryUnit": "ug/L",
    "siUnit": "ug/L",
    "conventionalUnit": "ug/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 4.7,
        "max": 18.3,
        "text": "4.7 - 18.3 ug/L"
      },
      "si": {
        "min": 4.7,
        "max": 18.3,
        "text": "4.7 - 18.3 ug/L"
      }
    },
    "description": "Essential element required for superoxide dismutase; neurotoxic in excess."
  },
  {
    "loinc": "5616-8",
    "canonicalKey": "trace_chromium",
    "name": "Chromium (Serum)",
    "aliases": [
      "Chromium (Serum)",
      "Chromium"
    ],
    "category": "Trace Elements & Heavy Metals",
    "primaryUnit": "ug/L",
    "siUnit": "ug/L",
    "conventionalUnit": "ug/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.1,
        "max": 2.1,
        "text": "0.1 - 2.1 ug/L"
      },
      "si": {
        "min": 0.1,
        "max": 2.1,
        "text": "0.1 - 2.1 ug/L"
      }
    },
    "description": "Trace element participating in glucose and lipid metabolic regulation."
  },
  {
    "loinc": "5695-2",
    "canonicalKey": "trace_nickel",
    "name": "Nickel (Serum)",
    "aliases": [
      "Nickel (Serum)",
      "Nickel"
    ],
    "category": "Trace Elements & Heavy Metals",
    "primaryUnit": "ug/L",
    "siUnit": "ug/L",
    "conventionalUnit": "ug/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.2,
        "max": 1.5,
        "text": "0.2 - 1.5 ug/L"
      },
      "si": {
        "min": 0.2,
        "max": 1.5,
        "text": "0.2 - 1.5 ug/L"
      }
    },
    "description": "Trace element monitored in metal-on-metal orthopedic implant wear."
  },
  {
    "loinc": "5623-4",
    "canonicalKey": "trace_cobalt",
    "name": "Cobalt (Serum)",
    "aliases": [
      "Cobalt (Serum)",
      "Cobalt"
    ],
    "category": "Trace Elements & Heavy Metals",
    "primaryUnit": "ug/L",
    "siUnit": "ug/L",
    "conventionalUnit": "ug/L",
    "conversionFactor": 1,
    "referenceIntervals": {
      "conventional": {
        "min": 0.1,
        "max": 0.9,
        "text": "0.1 - 0.9 ug/L"
      },
      "si": {
        "min": 0.1,
        "max": 0.9,
        "text": "0.1 - 0.9 ug/L"
      }
    },
    "description": "Constituent of vitamin B12; monitored in orthopedic joint prostheses."
  }
];

/**
 * Quick search helper matching against name, aliases, Lithuanian translations, or LOINC code.
 */
export function searchBiomarkers(query: string): BiomarkerDefinition[] {
  if (!query || query.trim().length === 0) return [];
  const q = query.toLowerCase().trim();

  return BIOMARKER_CATALOG.filter(item => {
    if (item.name.toLowerCase().includes(q)) return true;
    if (item.loinc.includes(q)) return true;
    if (item.canonicalKey.toLowerCase().includes(q)) return true;
    if (item.aliases.some(alias => alias.toLowerCase().includes(q))) return true;

    const lt = BIOMARKER_TRANSLATIONS_LT[item.canonicalKey];
    if (lt) {
      if (lt.name.toLowerCase().includes(q)) return true;
      if (lt.aliases.some(alias => alias.toLowerCase().includes(q))) return true;
    }

    return false;
  }).slice(0, 15); // Return top 15 matches for snappy UI
}

/**
 * Find biomarker by canonical key or LOINC.
 */
export function findBiomarkerByKey(key: string): BiomarkerDefinition | undefined {
  return BIOMARKER_CATALOG.find(b => b.canonicalKey === key || b.loinc === key);
}
