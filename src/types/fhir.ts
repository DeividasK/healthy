/**
 * HL7 FHIR Release 4 (R4) Data Types and Resources
 * Focused on DiagnosticReport and Observation standards for laboratory medicine.
 * Conforms to LOINC (system: "http://loinc.org") and UCUM (system: "http://unitsofmeasure.org").
 */

export interface FHIRCoding {
  system: string;
  code: string;
  display?: string;
  version?: string;
}

export interface FHIRCodeableConcept {
  coding?: FHIRCoding[];
  text?: string;
}

export interface FHIRQuantity {
  value?: number;
  comparator?: '<' | '<=' | '>=' | '>';
  unit?: string;
  system?: string; // Standard: "http://unitsofmeasure.org" (UCUM)
  code?: string;   // UCUM unit code, e.g. "g/dL", "10*3/uL", "%"
}

export interface FHIRReference {
  reference?: string; // e.g. "Observation/urn:uuid:..."
  type?: string;
  display?: string;
}

export interface FHIRObservationReferenceRange {
  low?: FHIRQuantity;
  high?: FHIRQuantity;
  type?: FHIRCodeableConcept;
  text?: string;
}

export interface FHIRAnnotation {
  text: string;
  time?: string;
}

export interface FHIRObservation {
  resourceType: 'Observation';
  id: string;
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled';
  category?: FHIRCodeableConcept[];
  code: FHIRCodeableConcept;
  subject?: FHIRReference;
  effectiveDateTime?: string; // ISO 8601 date or date-time
  issued?: string;
  valueQuantity?: FHIRQuantity;
  interpretation?: FHIRCodeableConcept[]; // Optional per FHIR spec
  note?: FHIRAnnotation[];
  referenceRange?: FHIRObservationReferenceRange[];
}

export interface FHIRDiagnosticReport {
  resourceType: 'DiagnosticReport';
  id: string;
  status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled';
  category?: FHIRCodeableConcept[];
  code: FHIRCodeableConcept; // General report code (e.g. LOINC 11502-2) or panel code (e.g. LOINC 58410-2)
  subject?: FHIRReference;
  effectiveDateTime?: string; // ISO 8601 date or date-time
  issued?: string;
  result?: FHIRReference[]; // References to Observation resources
  conclusion?: string;
  note?: FHIRAnnotation[];
}

export interface DiagnosticReportBundle {
  report: FHIRDiagnosticReport;
  observations: FHIRObservation[];
}
