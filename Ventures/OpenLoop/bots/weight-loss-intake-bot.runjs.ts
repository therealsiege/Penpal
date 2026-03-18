// Weight Loss Intake Bot
// Builds all output into one string, prints once at the end.

(() => {
  // ─── output buffer — everything goes here, printed once at the end ───
  const o: string[] = []

  // ─── mock medplum client ───
  let n = 0
  const resources: any[] = []
  const create = (r: any) => { n++; const c = { ...r, id: `fake-${n}` }; resources.push(c); return c }
  const ref = (r: any) => ({ reference: `${r.resourceType}/${r.id}` })

  // ─── helpers ───
  const socialCat = () => ({ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'social-history' }] })
  const vitalCat = () => ({ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] })

  const obs = (patient: any, encounter: any, loinc: string, display: string, val: number, unit: string, note?: string, cat?: any) => {
    create({
      resourceType: 'Observation', status: 'final',
      category: [cat || vitalCat()],
      code: { coding: [{ system: 'http://loinc.org', code: loinc, display }] },
      subject: ref(patient), encounter: ref(encounter),
      valueQuantity: { value: val, unit, system: 'http://unitsofmeasure.org', code: unit },
      effectiveDateTime: '2026-03-18T10:00:00Z',
      ...(note ? { note: [{ text: note }] } : {}),
    })
  }

  const obsText = (patient: any, encounter: any, code: any, val: string, cat?: any) => {
    create({
      resourceType: 'Observation', status: 'final',
      category: [cat || socialCat()], code,
      subject: ref(patient), encounter: ref(encounter),
      valueString: val, effectiveDateTime: '2026-03-18T10:00:00Z',
    })
  }

  // ─── condition code map ───
  const CONDITIONS: Record<string, { code: string; display: string }> = {
    'diabetes':           { code: 'E11.9',  display: 'Type 2 diabetes mellitus' },
    'hypertension':       { code: 'I10',    display: 'Essential hypertension' },
    'thyroid':            { code: 'E03.9',  display: 'Hypothyroidism' },
    'cholesterol':        { code: 'E78.5',  display: 'Hyperlipidemia' },
    'sleep-apnea':        { code: 'G47.33', display: 'Obstructive sleep apnea' },
    'joint-pain':         { code: 'M19.90', display: 'Osteoarthritis' },
    'heart-disease':      { code: 'I25.10', display: 'Atherosclerotic heart disease' },
    'gerd':               { code: 'K21.0',  display: 'GERD with esophagitis' },
    'depression-anxiety': { code: 'F41.9',  display: 'Anxiety disorder' },
  }

  // ─── flatten questionnaire answers ───
  const getAnswers = (items: any[]): Record<string, any> => {
    const a: Record<string, any> = {}
    const walk = (list: any[]) => { if (!list) return; for (const i of list) { if (i.answer?.length) a[i.linkId] = i.answer[0]; if (i.item) walk(i.item) } }
    walk(items)
    return a
  }

  // ─── get ALL answers for a repeating field (like checkboxes) ───
  const getAllCodes = (items: any[], linkId: string): string[] => {
    const codes: string[] = []
    const walk = (list: any[]) => { if (!list) return; for (const i of list) { if (i.linkId === linkId && i.answer) for (const a of i.answer) if (a.valueCoding?.code) codes.push(a.valueCoding.code); if (i.item) walk(i.item) } }
    walk(items)
    return codes
  }

  // ─── test patient (already created by Luis's bot) ───
  const patient = { resourceType: 'Patient', id: 'c6dd43a2-db1a-45b2-ac16-24c135babfb7', name: [{ given: ['Luis'], family: 'Ramirez' }] }

  // ─── sample questionnaire response — edit these to test different paths ───
  const items = [
    { linkId: 'weight-vitals', item: [
      { linkId: 'current-weight', answer: [{ valueDecimal: 215 }] },
      { linkId: 'height', answer: [{ valueDecimal: 67 }] },
      { linkId: 'goal-weight', answer: [{ valueDecimal: 170 }] },
      { linkId: 'waist-circumference', answer: [{ valueDecimal: 38 }] },
    ]},
    { linkId: 'weight-history', item: [
      { linkId: 'highest-adult-weight', answer: [{ valueDecimal: 240 }] },
      { linkId: 'lowest-adult-weight', answer: [{ valueDecimal: 155 }] },
      { linkId: 'past-weight-loss-programs', answer: [{ valueCoding: { code: 'yes', display: 'Yes' } }] },
      { linkId: 'past-programs-detail', answer: [{ valueString: 'Tried keto for 3 months, lost 20 lbs but gained it back. Also tried Noom.' }] },
      { linkId: 'weight-gain-triggers', answer: [{ valueString: 'Stress from work, stopped exercising after knee injury' }] },
    ]},
    { linkId: 'medical-history', item: [
      { linkId: 'conditions', answer: [
        { valueCoding: { code: 'hypertension', display: 'High blood pressure' } },
        { valueCoding: { code: 'cholesterol', display: 'High cholesterol' } },
        { valueCoding: { code: 'joint-pain', display: 'Joint pain / arthritis' } },
      ]},
      { linkId: 'current-medications', answer: [{ valueString: 'Lisinopril 10mg daily, Atorvastatin 20mg daily' }] },
      { linkId: 'bariatric-surgery', answer: [{ valueCoding: { code: 'no', display: 'No' } }] },
    ]},
    { linkId: 'lifestyle', item: [
      { linkId: 'meals-per-day', answer: [{ valueInteger: 3 }] },
      { linkId: 'snacking', answer: [{ valueCoding: { code: '3-plus', display: '3+ times/day' } }] },
      { linkId: 'exercise-frequency', answer: [{ valueCoding: { code: '1-2', display: '1-2 times/week' } }] },
      { linkId: 'sleep-hours', answer: [{ valueDecimal: 6 }] },
      { linkId: 'alcohol-use', answer: [{ valueCoding: { code: '1-4', display: '1-4' } }] },
      { linkId: 'smoking-status', answer: [{ valueCoding: { system: 'http://snomed.info/sct', code: '266919005', display: 'Never smoker' } }] },
    ]},
    { linkId: 'screening', item: [
      { linkId: 'eating-disorder-history', answer: [{ valueCoding: { code: 'no', display: 'No' } }] },
      { linkId: 'pregnant-nursing', answer: [{ valueCoding: { code: 'no', display: 'No' } }] },
      { linkId: 'heart-symptoms', answer: [{ valueCoding: { code: 'no', display: 'No' } }] },
    ]},
    { linkId: 'goals-motivation', item: [
      { linkId: 'primary-goal', answer: [{ valueString: 'Get back to college weight, play with my kids without getting winded' }] },
      { linkId: 'readiness', answer: [{ valueInteger: 8 }] },
      { linkId: 'support-at-home', answer: [{ valueCoding: { code: 'yes', display: 'Yes' } }] },
    ]},
    { linkId: 'consent', item: [
      { linkId: 'consent-program', answer: [{ valueBoolean: true }] },
      { linkId: 'consent-date', answer: [{ valueDate: '2026-03-18' }] },
    ]},
  ]

  const a = getAnswers(items)

  // ═══════════════════════════════════════════════════════════════
  // RUN THE BOT
  // ═══════════════════════════════════════════════════════════════

  o.push('=== WEIGHT LOSS INTAKE BOT — DRY RUN ===')
  o.push(`Patient: Luis Ramirez`)
  o.push(`Date: 2026-03-18`)
  o.push('')

  // Step 1: Encounter
  o.push('-- Step 1: Encounter --')
  const enc = create({
    resourceType: 'Encounter', status: 'finished',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR', display: 'virtual' },
    type: [{ text: 'Medical Weight Loss Intake' }],
    subject: ref(patient), period: { start: '2026-03-18T10:00:00Z', end: '2026-03-18T10:00:00Z' },
  })
  o.push('  + Encounter (virtual intake)')

  // Step 2: Vitals
  o.push('-- Step 2: Vitals --')
  const wt = a['current-weight']?.valueDecimal
  const ht = a['height']?.valueDecimal
  if (wt) { obs(patient, enc, '29463-7', 'Body weight', wt, '[lb_av]'); o.push(`  + Weight: ${wt} lbs`) }
  if (ht) { obs(patient, enc, '8302-2', 'Body height', ht, '[in_i]'); o.push(`  + Height: ${ht} in`) }
  if (wt && ht) { const bmi = Math.round(((wt / (ht * ht)) * 703) * 10) / 10; obs(patient, enc, '39156-5', 'BMI', bmi, 'kg/m2'); o.push(`  + BMI: ${bmi} kg/m2 (computed)`) }
  const waist = a['waist-circumference']?.valueDecimal
  if (waist) { obs(patient, enc, '56086-2', 'Waist circumference', waist, '[in_i]'); o.push(`  + Waist: ${waist} in`) }

  // Step 3: Weight History
  o.push('-- Step 3: Weight History --')
  const hi = a['highest-adult-weight']?.valueDecimal
  const lo = a['lowest-adult-weight']?.valueDecimal
  if (hi) { obs(patient, enc, '29463-7', 'Body weight', hi, '[lb_av]', 'Highest adult weight'); o.push(`  + Highest: ${hi} lbs`) }
  if (lo) { obs(patient, enc, '29463-7', 'Body weight', lo, '[lb_av]', 'Lowest adult weight'); o.push(`  + Lowest: ${lo} lbs`) }
  const trig = a['weight-gain-triggers']?.valueString
  if (trig) { obsText(patient, enc, { text: 'Weight gain triggers' }, trig); o.push(`  + Triggers: "${trig}"`) }

  // Step 4: Medical Conditions
  o.push('-- Step 4: Conditions --')
  const conds = getAllCodes(items, 'conditions')
  for (const c of conds) {
    const m = CONDITIONS[c]
    if (!m) { o.push(`  ! Unmapped: ${c}`); continue }
    create({
      resourceType: 'Condition',
      clinicalStatus: { coding: [{ code: 'active' }] },
      verificationStatus: { coding: [{ code: 'confirmed' }] },
      code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: m.code, display: m.display }] },
      subject: ref(patient), encounter: ref(enc), recordedDate: '2026-03-18',
    })
    o.push(`  + ${m.code} ${m.display}`)
  }

  // Step 5: Lifestyle
  o.push('-- Step 5: Lifestyle --')
  const ex = a['exercise-frequency']?.valueCoding
  if (ex) { obsText(patient, enc, { coding: [{ system: 'http://loinc.org', code: '89555-7' }] }, ex.display); o.push(`  + Exercise: ${ex.display}`) }
  const sl = a['sleep-hours']?.valueDecimal
  if (sl) { obs(patient, enc, '93832-4', 'Sleep duration', sl, 'h', undefined, socialCat()); o.push(`  + Sleep: ${sl} hrs`) }
  const alc = a['alcohol-use']?.valueCoding
  if (alc) { obsText(patient, enc, { coding: [{ system: 'http://loinc.org', code: '74013-4' }] }, alc.display); o.push(`  + Alcohol: ${alc.display} drinks/wk`) }
  const smk = a['smoking-status']?.valueCoding
  if (smk) { obsText(patient, enc, { coding: [{ system: 'http://loinc.org', code: '72166-2' }] }, smk.display); o.push(`  + Smoking: ${smk.display}`) }
  const meals = a['meals-per-day']?.valueInteger
  if (meals) { obsText(patient, enc, { text: 'Meals per day' }, String(meals)); o.push(`  + Meals/day: ${meals}`) }
  const snack = a['snacking']?.valueCoding
  if (snack) { obsText(patient, enc, { text: 'Snacking frequency' }, snack.display); o.push(`  + Snacking: ${snack.display}`) }

  // Step 6: Safety Screening
  o.push('-- Step 6: Safety Screening --')
  const ed = a['eating-disorder-history']?.valueCoding?.code
  const preg = a['pregnant-nursing']?.valueCoding?.code
  const heart = a['heart-symptoms']?.valueCoding?.code
  if (ed === 'yes') { create({ resourceType: 'Condition', code: { coding: [{ code: 'F50.9', display: 'Eating disorder' }] }, subject: ref(patient) }); o.push('  !! EATING DISORDER — FLAG') }
  else o.push('  + Eating disorder: No')
  if (preg === 'yes') { obsText(patient, enc, { coding: [{ code: '82810-3' }] }, 'Pregnant/nursing'); o.push('  !! PREGNANT — FLAG') }
  else o.push('  + Pregnant/nursing: No')
  if (heart === 'yes') { obsText(patient, enc, { coding: [{ code: '89550-8' }] }, 'Cardiac symptoms'); o.push('  !! CARDIAC SYMPTOMS — FLAG') }
  else o.push('  + Heart symptoms: No')

  // Step 7: Goals
  o.push('-- Step 7: Goals --')
  const gw = a['goal-weight']?.valueDecimal
  const pg = a['primary-goal']?.valueString
  const rd = a['readiness']?.valueInteger
  if (gw || pg) {
    create({
      resourceType: 'Goal', lifecycleStatus: 'active', subject: ref(patient),
      description: { text: pg || `Reach ${gw} lbs` },
      ...(gw ? { target: [{ detailQuantity: { value: gw, unit: '[lb_av]' } }] } : {}),
      ...(rd ? { note: [{ text: `Readiness: ${rd}/10` }] } : {}),
    })
    if (gw) o.push(`  + Target: ${gw} lbs (lose ${(wt || 0) - gw} lbs)`)
    if (pg) o.push(`  + Goal: "${pg}"`)
    if (rd) o.push(`  + Readiness: ${rd}/10`)
  }

  // Step 8: Consent
  o.push('-- Step 8: Consent --')
  if (a['consent-program']?.valueBoolean) {
    create({ resourceType: 'Consent', status: 'active', patient: ref(patient), dateTime: a['consent-date']?.valueDate })
    o.push(`  + Consent given ${a['consent-date']?.valueDate}`)
  }

  // Summary
  o.push('')
  o.push(`=== DONE: ${resources.length} FHIR resources created ===`)
  resources.forEach((r, i) => o.push(`  ${i + 1}. ${r.resourceType} (${r.id})`))

  // ─── return the string as the expression result ───
  return o.join('\n')
})()
