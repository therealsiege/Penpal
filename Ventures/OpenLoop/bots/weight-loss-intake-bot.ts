/**
 * Weight Loss Intake Bot
 *
 * This bot fires when a patient submits the Medical Weight Loss Intake Questionnaire.
 * It reads through every answer and fans them out into proper FHIR resources:
 *
 *   QuestionnaireResponse
 *     -> Patient (already exists, linked via subject)
 *     -> Observations (weight, height, BMI, waist, sleep, etc.)
 *     -> Conditions (diabetes, hypertension, etc. — one per checked box)
 *     -> Goal (target weight + primary motivation)
 *     -> Consent (program participation)
 *     -> Encounter (ties everything together as "the intake visit")
 *
 * The bot does NOT create a new Patient — Luis's existing bot already handles that.
 * Instead, it reads the patient reference off the QuestionnaireResponse.subject.
 */

import {
  BotEvent,
  MedplumClient,
  getQuestionnaireAnswers,
  createReference,
} from '@medplum/core';
import {
  QuestionnaireResponse,
  Patient,
  Observation,
  Condition,
  Goal,
  Consent,
  Encounter,
  Reference,
} from '@medplum/fhirtypes';

// ─── Condition Code Lookup ──────────────────────────────────────────────────
// Maps the hard-coded choice values from the questionnaire to real ICD-10 codes.
// Clint flagged that the questionnaire uses internal codes like "diabetes"
// instead of standard terminologies — this is where we bridge that gap.
const CONDITION_CODE_MAP: Record<string, { code: string; display: string }> = {
  'diabetes':           { code: 'E11.9',  display: 'Type 2 diabetes mellitus without complications' },
  'hypertension':       { code: 'I10',    display: 'Essential (primary) hypertension' },
  'thyroid':            { code: 'E03.9',  display: 'Hypothyroidism, unspecified' },
  'cholesterol':        { code: 'E78.5',  display: 'Hyperlipidemia, unspecified' },
  'sleep-apnea':        { code: 'G47.33', display: 'Obstructive sleep apnea' },
  'joint-pain':         { code: 'M19.90', display: 'Unspecified osteoarthritis, unspecified site' },
  'heart-disease':      { code: 'I25.10', display: 'Atherosclerotic heart disease of native coronary artery' },
  'gerd':               { code: 'K21.0',  display: 'Gastro-esophageal reflux disease with esophagitis' },
  'depression-anxiety': { code: 'F41.9',  display: 'Anxiety disorder, unspecified' },
};

// ─── Main Handler ───────────────────────────────────────────────────────────
// This is the entry point Medplum calls when the bot is triggered.
// The event.input is the QuestionnaireResponse the patient just submitted.
export async function handler(medplum: MedplumClient, event: BotEvent): Promise<any> {
  const response = event.input as QuestionnaireResponse;

  // Pull all the answers into a flat map keyed by linkId.
  // So answers['current-weight'] gives us the weight answer, etc.
  const answers = getQuestionnaireAnswers(response);

  // Figure out which patient this questionnaire belongs to.
  // The QuestionnaireResponse.subject should already point to the Patient
  // that was created by the weight-loss-intake-bot earlier.
  const patientRef = response.subject as Reference<Patient>;
  if (!patientRef?.reference) {
    throw new Error('QuestionnaireResponse has no patient subject — cannot proceed.');
  }

  // Read the actual Patient resource so we can reference it everywhere
  const patient = await medplum.readReference(patientRef);
  console.log(`Processing intake for patient: ${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family}`);

  // We'll collect every resource we create so we can log a summary at the end
  const created: string[] = [];

  // ─── Step 1: Create the Encounter ───────────────────────────────────────
  // An Encounter represents "the intake visit" — it's the container that
  // ties all the clinical resources together. Every Observation, Condition,
  // etc. will reference back to this Encounter.
  const encounter = await medplum.createResource<Encounter>({
    resourceType: 'Encounter',
    status: 'finished',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'VR',            // virtual encounter (telehealth intake)
      display: 'virtual',
    },
    type: [
      {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '390906007',
            display: 'Follow-up encounter',
          },
        ],
        text: 'Medical Weight Loss Intake',
      },
    ],
    subject: createReference(patient),
    period: {
      // The encounter happened when the questionnaire was authored
      start: response.authored || new Date().toISOString(),
      end: response.authored || new Date().toISOString(),
    },
  });
  created.push(`Encounter/${encounter.id}`);
  console.log(`Created Encounter: ${encounter.id}`);

  // ─── Step 2: Vitals — Weight, Height, BMI, Waist ───────────────────────
  // These come from the "weight-vitals" group in the questionnaire.
  // We store each as a separate Observation with the proper LOINC code,
  // which is how any EHR or downstream system expects to find them.

  const weightLbs = answers['current-weight']?.valueDecimal;
  const heightIn = answers['height']?.valueDecimal;

  // Current weight
  if (weightLbs !== undefined) {
    await createObservation(medplum, patient, encounter, {
      loincCode: '29463-7',
      display: 'Body weight',
      value: weightLbs,
      unit: '[lb_av]',        // UCUM code for pounds
      unitDisplay: 'lbs',
    });
    created.push('Observation (weight)');
  }

  // Height
  if (heightIn !== undefined) {
    await createObservation(medplum, patient, encounter, {
      loincCode: '8302-2',
      display: 'Body height',
      value: heightIn,
      unit: '[in_i]',         // UCUM code for inches
      unitDisplay: 'in',
    });
    created.push('Observation (height)');
  }

  // BMI — we compute this ourselves from weight and height
  // Formula: (weight in lbs / height in inches^2) * 703
  if (weightLbs !== undefined && heightIn !== undefined && heightIn > 0) {
    const bmi = Math.round(((weightLbs / (heightIn * heightIn)) * 703) * 10) / 10;
    await createObservation(medplum, patient, encounter, {
      loincCode: '39156-5',
      display: 'Body mass index (BMI)',
      value: bmi,
      unit: 'kg/m2',
      unitDisplay: 'kg/m2',
    });
    created.push(`Observation (BMI: ${bmi})`);
  }

  // Waist circumference (optional field)
  const waist = answers['waist-circumference']?.valueDecimal;
  if (waist !== undefined) {
    await createObservation(medplum, patient, encounter, {
      loincCode: '56086-2',
      display: 'Waist circumference',
      value: waist,
      unit: '[in_i]',
      unitDisplay: 'in',
    });
    created.push('Observation (waist)');
  }

  // ─── Step 3: Weight History ─────────────────────────────────────────────
  // These are historical data points, not "today's vitals."
  // We still store them as Observations but mark them with a note.

  const highestWeight = answers['highest-adult-weight']?.valueDecimal;
  if (highestWeight !== undefined) {
    await createObservation(medplum, patient, encounter, {
      loincCode: '29463-7',
      display: 'Body weight',
      value: highestWeight,
      unit: '[lb_av]',
      unitDisplay: 'lbs',
      note: 'Highest adult weight (self-reported)',
    });
    created.push('Observation (highest weight)');
  }

  const lowestWeight = answers['lowest-adult-weight']?.valueDecimal;
  if (lowestWeight !== undefined) {
    await createObservation(medplum, patient, encounter, {
      loincCode: '29463-7',
      display: 'Body weight',
      value: lowestWeight,
      unit: '[lb_av]',
      unitDisplay: 'lbs',
      note: 'Lowest adult weight (self-reported)',
    });
    created.push('Observation (lowest weight)');
  }

  // Weight gain triggers — free text, stored as a social history observation
  const triggers = answers['weight-gain-triggers']?.valueString;
  if (triggers) {
    await medplum.createResource<Observation>({
      resourceType: 'Observation',
      status: 'final',
      category: [socialHistoryCategory()],
      code: {
        text: 'Weight gain contributing factors',
      },
      subject: createReference(patient),
      encounter: createReference(encounter),
      valueString: triggers,
      effectiveDateTime: response.authored || new Date().toISOString(),
    });
    created.push('Observation (weight gain triggers)');
  }

  // ─── Step 4: Medical Conditions ─────────────────────────────────────────
  // The questionnaire has a multi-select "conditions" field. Each checked
  // condition becomes its own FHIR Condition resource with a proper ICD-10 code.
  // This is the key part Clint was talking about — mapping internal codes to
  // real clinical terminologies.

  // getQuestionnaireAnswers returns the last selected value for repeating items,
  // so we need to dig into the raw response items to get ALL selected conditions.
  const conditionAnswers = findAllAnswers(response, 'conditions');
  for (const condCode of conditionAnswers) {
    const mapping = CONDITION_CODE_MAP[condCode];
    if (!mapping) {
      // If someone picked "other", we skip — the free text goes elsewhere
      console.log(`Skipping unmapped condition code: ${condCode}`);
      continue;
    }

    await medplum.createResource<Condition>({
      resourceType: 'Condition',
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'active',
            display: 'Active',
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: 'confirmed',
            display: 'Confirmed',
          },
        ],
      },
      // Tag these as self-reported, since the patient is telling us about them,
      // not a clinician diagnosing them right now
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-category',
              code: 'problem-list-item',
              display: 'Problem List Item',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://hl7.org/fhir/sid/icd-10-cm',
            code: mapping.code,
            display: mapping.display,
          },
        ],
        text: mapping.display,
      },
      subject: createReference(patient),
      encounter: createReference(encounter),
      recordedDate: response.authored || new Date().toISOString(),
    });
    created.push(`Condition (${mapping.code} — ${mapping.display})`);
  }

  // "Other" conditions — if the patient typed something in the free text box
  const otherConditions = answers['conditions-other']?.valueString;
  if (otherConditions) {
    await medplum.createResource<Condition>({
      resourceType: 'Condition',
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'active',
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: 'unconfirmed',  // free text needs provider review
          },
        ],
      },
      code: {
        text: otherConditions,    // no ICD-10 code — just the patient's words
      },
      subject: createReference(patient),
      encounter: createReference(encounter),
      recordedDate: response.authored || new Date().toISOString(),
    });
    created.push('Condition (other — needs provider review)');
  }

  // ─── Step 5: Lifestyle Observations ─────────────────────────────────────
  // All of these go into the "social-history" category.
  // They give the provider a picture of the patient's daily habits.

  // Exercise frequency
  const exercise = answers['exercise-frequency']?.valueCoding;
  if (exercise) {
    await medplum.createResource<Observation>({
      resourceType: 'Observation',
      status: 'final',
      category: [socialHistoryCategory()],
      code: {
        coding: [{ system: 'http://loinc.org', code: '89555-7', display: 'How many days per week did you engage in moderate to strenuous exercise' }],
      },
      subject: createReference(patient),
      encounter: createReference(encounter),
      valueString: exercise.display || exercise.code,
      effectiveDateTime: response.authored || new Date().toISOString(),
    });
    created.push('Observation (exercise)');
  }

  // Sleep hours
  const sleep = answers['sleep-hours']?.valueDecimal;
  if (sleep !== undefined) {
    await createObservation(medplum, patient, encounter, {
      loincCode: '93832-4',
      display: 'Sleep duration',
      value: sleep,
      unit: 'h',
      unitDisplay: 'hours',
      category: socialHistoryCategory(),
    });
    created.push('Observation (sleep)');
  }

  // Alcohol use
  const alcohol = answers['alcohol-use']?.valueCoding;
  if (alcohol) {
    await medplum.createResource<Observation>({
      resourceType: 'Observation',
      status: 'final',
      category: [socialHistoryCategory()],
      code: {
        coding: [{ system: 'http://loinc.org', code: '74013-4', display: 'Alcoholic drinks per week' }],
      },
      subject: createReference(patient),
      encounter: createReference(encounter),
      valueString: alcohol.display || alcohol.code,
      effectiveDateTime: response.authored || new Date().toISOString(),
    });
    created.push('Observation (alcohol)');
  }

  // Smoking status — this one already uses a proper ValueSet in the questionnaire!
  // Clint would be proud. We pass it through as-is.
  const smoking = answers['smoking-status']?.valueCoding;
  if (smoking) {
    await medplum.createResource<Observation>({
      resourceType: 'Observation',
      status: 'final',
      category: [socialHistoryCategory()],
      code: {
        coding: [{ system: 'http://loinc.org', code: '72166-2', display: 'Tobacco smoking status' }],
      },
      subject: createReference(patient),
      encounter: createReference(encounter),
      valueCodeableConcept: {
        coding: [smoking],
      },
      effectiveDateTime: response.authored || new Date().toISOString(),
    });
    created.push('Observation (smoking status)');
  }

  // Meals per day
  const meals = answers['meals-per-day']?.valueInteger;
  if (meals !== undefined) {
    await medplum.createResource<Observation>({
      resourceType: 'Observation',
      status: 'final',
      category: [socialHistoryCategory()],
      code: { text: 'Meals per day' },
      subject: createReference(patient),
      encounter: createReference(encounter),
      valueInteger: meals,
      effectiveDateTime: response.authored || new Date().toISOString(),
    });
    created.push('Observation (meals/day)');
  }

  // Snacking frequency
  const snacking = answers['snacking']?.valueCoding;
  if (snacking) {
    await medplum.createResource<Observation>({
      resourceType: 'Observation',
      status: 'final',
      category: [socialHistoryCategory()],
      code: { text: 'Snacking frequency' },
      subject: createReference(patient),
      encounter: createReference(encounter),
      valueString: snacking.display || snacking.code,
      effectiveDateTime: response.authored || new Date().toISOString(),
    });
    created.push('Observation (snacking)');
  }

  // ─── Step 6: Safety Screening ───────────────────────────────────────────
  // These are red-flag questions. If the patient answers "yes" to any of them,
  // the provider needs to know immediately. We store them as Observations
  // so they show up in the patient's chart.

  const eatingDisorder = answers['eating-disorder-history']?.valueCoding?.code;
  if (eatingDisorder === 'yes') {
    await medplum.createResource<Condition>({
      resourceType: 'Condition',
      clinicalStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }],
      },
      verificationStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'unconfirmed' }],
      },
      code: {
        coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'F50.9', display: 'Eating disorder, unspecified' }],
        text: 'History of eating disorder (self-reported)',
      },
      subject: createReference(patient),
      encounter: createReference(encounter),
      recordedDate: response.authored || new Date().toISOString(),
    });
    created.push('Condition (eating disorder history — FLAG)');
  }

  // Pregnancy/nursing status
  const pregnant = answers['pregnant-nursing']?.valueCoding?.code;
  if (pregnant === 'yes') {
    await medplum.createResource<Observation>({
      resourceType: 'Observation',
      status: 'final',
      code: {
        coding: [{ system: 'http://loinc.org', code: '82810-3', display: 'Pregnancy status' }],
      },
      subject: createReference(patient),
      encounter: createReference(encounter),
      valueString: 'Currently pregnant or nursing',
      effectiveDateTime: response.authored || new Date().toISOString(),
    });
    created.push('Observation (pregnant/nursing — FLAG)');
  }

  // Cardiac symptoms — chest pain, shortness of breath, dizziness
  const heartSymptoms = answers['heart-symptoms']?.valueCoding?.code;
  if (heartSymptoms === 'yes') {
    await medplum.createResource<Observation>({
      resourceType: 'Observation',
      status: 'final',
      code: {
        coding: [{ system: 'http://loinc.org', code: '89550-8', display: 'Cardiac symptoms' }],
      },
      subject: createReference(patient),
      encounter: createReference(encounter),
      valueString: 'Patient reports chest pain, shortness of breath, or dizziness with exercise',
      effectiveDateTime: response.authored || new Date().toISOString(),
    });
    created.push('Observation (cardiac symptoms — FLAG)');
  }

  // ─── Step 7: Goals ──────────────────────────────────────────────────────
  // The patient's target weight and their self-described motivation.
  // We combine these into a single FHIR Goal resource.

  const goalWeight = answers['goal-weight']?.valueDecimal;
  const primaryGoal = answers['primary-goal']?.valueString;
  const readiness = answers['readiness']?.valueInteger;

  if (goalWeight || primaryGoal) {
    const goalTargets: Goal['target'] = [];

    // If they gave us a target weight, add it as a measurable target
    if (goalWeight) {
      goalTargets.push({
        measure: {
          coding: [{ system: 'http://loinc.org', code: '29463-7', display: 'Body weight' }],
        },
        detailQuantity: {
          value: goalWeight,
          unit: '[lb_av]',
          system: 'http://unitsofmeasure.org',
          code: '[lb_av]',
        },
      });
    }

    await medplum.createResource<Goal>({
      resourceType: 'Goal',
      lifecycleStatus: 'active',
      subject: createReference(patient),
      description: {
        text: primaryGoal || `Reach goal weight of ${goalWeight} lbs`,
      },
      target: goalTargets.length > 0 ? goalTargets : undefined,
      // Stash the readiness score in a note so the provider can see it
      note: readiness !== undefined
        ? [{ text: `Patient readiness for lifestyle changes: ${readiness}/10` }]
        : undefined,
    });
    created.push('Goal (weight loss target)');
  }

  // ─── Step 8: Consent ────────────────────────────────────────────────────
  // The patient agreed to participate in the program. We record this as a
  // FHIR Consent resource so there's a formal record.

  const consentGiven = answers['consent-program']?.valueBoolean;
  if (consentGiven) {
    await medplum.createResource<Consent>({
      resourceType: 'Consent',
      status: 'active',
      scope: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/consentscope',
            code: 'treatment',
            display: 'Treatment',
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes',
              code: 'medical',
              display: 'Medical Consent',
            },
          ],
        },
      ],
      patient: createReference(patient),
      dateTime: answers['consent-date']?.valueDate || response.authored || new Date().toISOString(),
    });
    created.push('Consent (program participation)');
  }

  // ─── Done! ──────────────────────────────────────────────────────────────
  // Log everything we created so it's easy to audit
  console.log('─── Intake Processing Complete ───');
  console.log(`Patient: ${patientRef.reference}`);
  console.log(`Encounter: ${encounter.id}`);
  console.log(`Resources created: ${created.length}`);
  for (const r of created) {
    console.log(`  ✓ ${r}`);
  }

  return {
    message: `Intake processed successfully. Created ${created.length} resources.`,
    encounter: encounter.id,
    resources: created,
  };
}

// ─── Helper: Create a numeric Observation ─────────────────────────────────
// Most vitals follow the same pattern: a LOINC code, a numeric value, and a unit.
// This helper keeps us from repeating that boilerplate for every single vital sign.
async function createObservation(
  medplum: MedplumClient,
  patient: Patient,
  encounter: Encounter,
  opts: {
    loincCode: string;
    display: string;
    value: number;
    unit: string;
    unitDisplay: string;
    note?: string;
    category?: Observation['category'][0];
  },
): Promise<Observation> {
  const obs = await medplum.createResource<Observation>({
    resourceType: 'Observation',
    status: 'final',
    // If a category was provided (like social-history), use it.
    // Otherwise default to "vital-signs" which is where weight/height/BMI live.
    category: [
      opts.category || {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: opts.loincCode,
          display: opts.display,
        },
      ],
    },
    subject: createReference(patient),
    encounter: createReference(encounter),
    valueQuantity: {
      value: opts.value,
      unit: opts.unitDisplay,
      system: 'http://unitsofmeasure.org',
      code: opts.unit,
    },
    effectiveDateTime: new Date().toISOString(),
    // If there's a note (like "highest adult weight"), attach it
    note: opts.note ? [{ text: opts.note }] : undefined,
  });

  console.log(`Created Observation (${opts.display}): ${opts.value} ${opts.unitDisplay}`);
  return obs;
}

// ─── Helper: Social History category ──────────────────────────────────────
// Lifestyle observations (exercise, sleep, alcohol, smoking) all belong in
// the "social-history" category. This saves us from typing it out every time.
function socialHistoryCategory() {
  return {
    coding: [
      {
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'social-history',
        display: 'Social History',
      },
    ],
  };
}

// ─── Helper: Find all answers for a repeating question ────────────────────
// getQuestionnaireAnswers() only returns the LAST answer for repeating fields.
// But for "conditions" (check all that apply), we need ALL of them.
// So we walk the raw QuestionnaireResponse items and collect every selected code.
function findAllAnswers(response: QuestionnaireResponse, linkId: string): string[] {
  const codes: string[] = [];

  // Recursively walk through the response items looking for our linkId
  function walk(items: QuestionnaireResponse['item']) {
    if (!items) return;
    for (const item of items) {
      if (item.linkId === linkId && item.answer) {
        // Each answer has a valueCoding with the code the patient selected
        for (const ans of item.answer) {
          if (ans.valueCoding?.code) {
            codes.push(ans.valueCoding.code);
          }
        }
      }
      // Check nested items (groups contain sub-items)
      if (item.item) {
        walk(item.item);
      }
    }
  }

  walk(response.item);
  return codes;
}
