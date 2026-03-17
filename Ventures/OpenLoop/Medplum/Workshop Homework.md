Assigned Reading
# 1. [FHIR Basics](https://www.medplum.com/docs/fhir-basics)

To follow along with the concepts described in this guide, you can download and import this [sample FHIR bundle](https://drive.google.com/file/d/1196wfX-aBMUK33GdQiIdBUNlYn_cymBU/view?usp=drive_link) into your Medplum project. For instructions on how to import the data, refer to our [Import Sample Data](https://www.medplum.com/docs/tutorials/importing-sample-data) guide.

## Why FHIR?

Medplum stores healthcare data using the FHIR standard. Storing data according to this standard provides developers with the following benefits:

- **Interoperability**: Increasingly, healthcare partners are exposing their data via FHIR APIs. Storing your data according to FHIR spec smooths the path to interoperating with multiple partners
- **Future Proofing**: The healthcare ecosystem is complex and fragmented. As they encounter these complexities, many digital health companies end up performing costly data migrations. The FHIR spec anticipates many of the complexities that arise in the healthcare domain, helping teams avoid these backend rewrites.

While FHIR is quite powerful, it can have a bit of a learning curve. This page covers the basic concepts for understanding FHIR data in Medplum. For more information, you can check out the [official FHIR documentation](http://hl7.org/fhir/).

## Storing Data: Resources

A core data object in FHIR is called a [**Resource**](https://www.hl7.org/fhir/resource.html). You can think of Resources as **objects** in object oriented languages.

The FHIR standard defines over 150 [**Resource Types**](https://www.medplum.com/docs/api/fhir/resources) that model a broad range of healthcare-specific concepts. These include **concrete entities** ([`Patient`](https://www.medplum.com/docs/api/fhir/resources/patient), [`Medication`](https://www.medplum.com/docs/api/fhir/resources/medication), [`Device`](https://www.medplum.com/docs/api/fhir/resources/device)) as well as **abstract concepts** ([`Procedure`](https://www.medplum.com/docs/api/fhir/resources/procedure), [`CarePlan`](https://www.medplum.com/docs/api/fhir/resources/careplan), [`Encounter`](https://www.medplum.com/docs/api/fhir/resources/encounter)).

Each field in a resource is called an [**Element**](https://hl7.org/fhir/R4/element.html), each of which can be a **primitive type** (e.g. `string`, `number`, `date`) or a **complex type** (e.g. [`HumanName`](https://www.medplum.com/docs/api/fhir/datatypes/humanname)).

Lastly, all resources have an `id` element, which is a server-assigned identifier that serves as their **primary key**.

Example [`Patient`](https://www.medplum.com/docs/api/fhir/resources/patient)

## Linking Data: References

When working with FHIR, clinical data is often split across multiple resources. For example a prescription is related to the receiving patient, and a diagnostic report may consist of multiple observations.

To create a link between objects, we use [`Reference`](https://www.medplum.com/docs/api/fhir/datatypes/reference) elements. A FHIR [`Reference`](https://www.medplum.com/docs/api/fhir/datatypes/reference) is an element that functions like a **foreign key** in traditional relational databases to create 1-to-1 or many-to-many relationships between resources.

[`Reference`](https://www.medplum.com/docs/api/fhir/datatypes/reference) elements have the following structure:

```
{  "reference" : ":resourceType/:id",     // Resource type + unique id of the referenced Resource  "display" : string,       // Display string for the reference  "type" : uri,             // Resource type (if using a "logical reference")  "identifier" : Identifier}
```

In Medplum, we will typically only use the `reference` and `display` elements.

Example: Linking a [`MedicationRequest`](https://www.medplum.com/docs/api/fhir/resources/medicationrequest) to a [`Patient`](https://www.medplum.com/docs/api/fhir/resources/patient) and [`Practitioner`](https://www.medplum.com/docs/api/fhir/resources/practitioner)

## Querying Data: Search

  

FHIR offers both a [REST API](https://www.medplum.com/docs/search) and [GraphQL API](https://www.medplum.com/docs/graphql) to query, search, sort, and filter resources by specific criteria (see [this blog post](https://www.medplum.com/blog/graphql-vs-rest) for tradeoffs between REST and GraphQL).

**FHIR resources cannot be searched by arbitrary fields**. Instead, the specification defines specific [search parameters](https://www.medplum.com/docs/search/basic-search#search-parameters) for each resource that can be used for queries.

Refer to the [Medplum search documentation](https://www.medplum.com/docs/search/basic-search) for a more in-depth tutorial on FHIR search.

## Standardizing Data: Codeable Concepts

  

The healthcare system commonly uses standardized coding systems to share information between organizations about **diagnoses**, **procedures**, **clinical outcomes**, and **billing**. See our summary on [Common Terminologies](https://www.medplum.com/docs/terminology/common-terminologies) for an overview of the most frequently used codes in healthcare.

Because there are multiple code systems for many domains, the same _concept_ can be defined in _multiple code systems_. To handle this mapping from concept to system, the FHIR defines the [`CodeableConcept`](https://www.medplum.com/docs/api/fhir/datatypes/codeableconcept) element type.

A [`CodeableConcept`](https://www.medplum.com/docs/api/fhir/datatypes/codeableconcept) consists of two parts:

- A `text` element - describes the concept in plain language
- A `coding` element - an array of `(system, code)` pairs that provide the standard code for the concept within each code system.

FHIR [`CodeableConcepts`](https://www.medplum.com/docs/api/fhir/datatypes/codeableconcept) use the `system` element to identify each code system within the `coding` array. By convention, FHIR uses absolute URLs to enforce that these systems are a globally unique namespace. _However, these URLs do not always point to hosted web sites._

More detailed information about using coded values with FHIR are available in our [Terminology Services documentation](https://www.medplum.com/docs/terminology).

Refer to [this blog post](https://www.medplum.com/blog/demystifying-fhir-systems) for a longer discussion of `system` strings.

Refer to the [FHIR official documentation](https://hl7.org/fhir/R4/terminologies-systems.html) for a list of `systems` for common healthcare code systems.

Below is an example [`CodeableConcept`](https://www.medplum.com/docs/api/fhir/datatypes/codeableconcept), that defines the medication Tylenol, in both the [RXNorm](https://www.medplum.com/docs/medications/medication-codes#rxnorm) or [NDC](https://www.medplum.com/docs/medications/medication-codes#ndc) systems.

```
{  text: 'Tylenol 325 MG Oral Tablet',  coding: [    {      system: 'http://hl7.org/fhir/sid/ndc',      code: '50580045850',    },    {      system: 'http://www.nlm.nih.gov/research/umls/rxnorm',      code: '209387',    },  ],};
```

## Naming Data: Identifiers

  

One issue in healthcare applications is that the same entity can have many different identifiers in different systems. For example, a patient might be identified simultaneously by their:

- Social Security Number (SSN)
- Medical Record Number (MRN)
- Medicare Beneficiary Identifier
- Driver's License Number

FHIR anticipates this complexity by allowing each resource to have multiple identifiers.

Each identifier is defined by a `(system, value)` pair. As with [`CodeableConcepts`](https://www.medplum.com/docs/api/fhir/datatypes/codeableconcept), the `system` acts as namespace for the identifier, and _must be specified as an absolute URL_ to ensure that it is globally unique.

Refer to [this blog post](https://www.medplum.com/blog/demystifying-fhir-systems#identifiers-1) for best practices on using identifier `system` strings.

Using the identifier system allows you to simplify your healthcare applications by consolidating data in a single resource, while allowing different systems to access the data by different ID schemes.

Example: [`Patient`](https://www.medplum.com/docs/api/fhir/resources/patient) with two medical record numbers (MRNs)

## ValueSets

  

ValueSets are a collection of codes that are used to represent a concept. They act as filters or subsets of larger terminology systems (like SNOMED CT, LOINC, or ICD-10) to specify exactly which codes are appropriate for a specific use case. They are defined by a `system` and a `concept` array. The `concept` array contains the codes that are part of the ValueSet.

```
{  "resourceType": "ValueSet",  "url": "http://example.com/ValueSet/vitals",  "name": "vitals",  "title": "Vital Signs",  "status": "active",  "compose": {    "include": [      {        "system": "http://loinc.org",        "concept": [          { "code": "8310-5", "display": "Body temperature" },          { "code": "8462-4", "display": "Diastolic blood pressure" },          { "code": "8480-6", "display": "Systolic blood pressure" },          { "code": "8867-4", "display": "Heart rate" },          { "code": "9279-1", "display": "Respiratory rate" }        ]      }    ]  }}
```

## Listening for changes: Subscriptions

**FHIR has a built-in [Subscription](https://www.medplum.com/docs/api/fhir/resources/subscription) resource** that is used to define a push-based subscription to resources in the system, analogous to web-hooks. A `Subscription` has two primary elements:

- **criteria**: This is a string expression that defines _which_ resources to listen to, specified in [FHIRPath](https://hl7.org/fhirpath/) format. This subscription is invoked whenever a resource that matches the criteria is created or updated.
- **channel**: this describes the kind of action that the `Subscription` will take when it sees a matching resource. Currently, the possible values are `rest-hook`, `websocket`, `email`, and `message`.

In Medplum, a powerful feature is to **use a [Medplum Bot](https://www.medplum.com/docs/bots)** as the endpoint of the `rest-hook` channel. This allows you to run an arbitrary piece of code in response to data changes and automate your medical workflows. See our [Bot-Subscription tutorial](https://www.medplum.com/docs/bots/bot-for-questionnaire-response) for more information.
# 2.  # [Basic Search ](https://www.medplum.com/docs/search/basic-search)
## Intro

One of the most basic operations when working with the Medplum FHIR API is to query resources that fulfill certain criteria.

The FHIR specification defines [rich search semantics](https://www.hl7.org/fhir/R4/search.html) to support these use cases, and this guide will cover some of the basic search operations to get you started. If you're new to FHIR, we'd recommend checking out our [FHIR Basics](https://www.medplum.com/docs/fhir-basics) page first.

## Search Parameters

To maintain performance, FHIR doesn't allow Resources to be queried by arbitrary elements. Instead, it defines a set of **search parameters** for each Resource Type.

Let's look at a few examples with the `Patient` resource. The [`Patient` reference docs](https://www.medplum.com/docs/api/fhir/resources/patient#search-parameters) have a table that list out all the available search parameters.

  

|Search Parameter|Type|Description|Expression|
|---|---|---|---|
|birthdate|`date`|The patient's date of birth|Patient.birthDate|

Some search parameters, such as `birthdate`, map directly to a top-level element, `Patient.birthDate` . (Note that the search parameter is **all lowercase**, even though the element is camel case)

  

|Search Parameter|Type|Description|Expression|
|---|---|---|---|
|address-city|`string`|A city specified in an address|Patient.address.city|

Some search parameters map to nested elements, such as `address-city`, which maps to `Patient.address.city`. Since `Patient.address` is an array element, this search parameter will search _all_ addresses saved to the `Patient`.

  

|Search Parameter|Type|Description|Expression|
|---|---|---|---|
|death-date|`date`|The date of death has been provided and satisfies this search value|Patient.deceased|

Lastly, _some_ search parameters rename/alias the target element. For example, the `death-date` maps to the `Patient.deceased` element.

## Basic Search

To search for resources, you can simply add search parameters and values as query parameters in your `GET` request.

The [Medplum Client SDK](https://www.medplum.com/docs/sdk/core.medplumclient) also provides the `search` helper method, which accepts a `string` or `object`.

- TypeScript
- cURL

```
await medplum.search('Patient', { birthdate: '1940-03-29' });// ORawait medplum.search('Patient', 'birthdate=1940-03-29');
```

This request will return a [FHIR `Bundle`](https://www.medplum.com/docs/api/fhir/resources/bundle) resource, which contains the query results as well as some metadata. The `Bundle.entry` element will contain an array with each `Bundle.entry[i].resource` being a search result.

```
// returns{  resourceType: 'Bundle',  type: 'searchset',  entry: [    {      fullUrl: 'http://api.medplum.com/Patient/1',      resource: {        resourceType: 'Patient',        id: '1',        name: [          {            given: ['John'],            family: 'Doe',          },        ],        birthDate: '1940-03-29',      },    },    {      fullUrl: 'http://api.medplum.com/Patient/2',      resource: {        resourceType: 'Patient',        id: '2',        name: [          {            given: ['Homer'],            family: 'Simpson',          },        ],        birthDate: '1940-03-29',      },    },  ],  link: [    {      relation: 'self',      url: 'http://api.medplum.com/Patient?birthdate=1940-03-29',    },  ],}
```

Because iterating over the `Bundle.entry` array is such a common pattern, the Medplum SDK provides the `searchResources` convenience method that unwraps the bundle and returns an array of resources.

```
await medplum.searchResources('Patient', { name: 'Simpson', birthdate: '1940-03-29' });// ORawait medplum.searchResources('Patient', 'name=Simpson&birthdate=1940-03-29');// returns// [//   {//     resourceType: 'Patient',//     id: '2',//     name: [//       {//         given: ['Homer'],//         family: 'Simpson',//       },//     ],//     birthDate: '1940-03-29',//   },// ]
```

The array returned by `searchResources` also includes a `bundle` property that contains the original `Bundle` resource. You can use this to access bundle metadata such as `Bundle.total` and `Bundle.link`.

## Searching Multiple Criteria

You can perform an AND search by specifying multiple query parameters

- TypeScript
- cURL

```
await medplum.searchResources('Patient', { name: 'Simpson', birthdate: '1940-03-29' });// ORawait medplum.searchResources('Patient', 'name=Simpson&birthdate=1940-03-29');// returns// [//   {//     resourceType: 'Patient',//     id: '2',//     name: [//       {//         given: ['Homer'],//         family: 'Simpson',//       },//     ],//     birthDate: '1940-03-29',//   },// ]
```

Specifying comma separated values performs an OR operation for that search parameter

- TypeScript
- cURL

```
await medplum.searchResources('Task', { status: 'completed,cancelled' });// ORawait medplum.searchResources('Task', 'status=completed,cancelled');
```

## Searching by Reference

You can use `reference` search parameters to search for resources based on the resources they refer to.

The syntax for this kind of search is `[parameter]=[resourceType]/[id]`. You can use the [`getReferenceString()`](https://www.medplum.com/docs/sdk/core.getreferencestring) utility method to help with construct your query.

For example, to search for all `Observation` resources that reference a `Patient` with the ID `"1234"`:

- TypeScript
- cURL

```
/*curl https://api.medplum.com/fhir/R4/Observation?subject=Patient/1234*/const patient: Patient = { resourceType: 'Patient', id: '1234' };await medplum.searchResources('Observation', { subject: getReferenceString(patient) });// ORawait medplum.searchResources('Observation', { subject: 'Patient/1234' });
```

## Strings vs. Tokens

FHIR defines two different types of "string" search parameters: `string` and `token`. Their search behaviors are quite different, and it's important to understand the difference.

|`string`|`token`|
|---|---|
|Case insensitive<br><br>Match strings that _start with_ query<br><br>No `system` URL|Case sensitive<br><br>_Exact_ string match<br><br>Optional `system` URL|

### string

A `string` search parameter is used when searching for a specific word or phrase within a resource. This type of search is more general and allows for partial matches, such as searching for patients whose names contain the word "Smith". Searches are **case insensitive**, and any result that **starts with** the query string will be returned.

Example

For example, the following search will return patients with the names `"eve"`, `"Eve"`, `"Evelyn`", but _not_ `"Steve"`

`medplum.search('Patient', 'name=eve')`

You can use the `:contains` modifier to search _anywhere_ inside the target string, and the `:exact` modifier to perform a case-sensitive, exact string match (see below)

### token

A `token` search parameter is used when searching for exact matches of a specific code or identifier, such as a medical terminology code ([`CodeableConcept`](https://www.medplum.com/docs/api/fhir/datatypes/codeableconcept)) or a unique patient identifier ( [`Identifier`](https://www.medplum.com/docs/api/fhir/datatypes/identifier) ). By default, searching a `token` performs a **case-sensitive, exact string match.**

Additionally, many `token` elements are namespaced by a `system` string. This is because FHIR resources often contain codes or identifiers that come from different code systems, such as LOINC or SNOMED CT, which may use the same code or identifier for different concepts.

You can restrict your `token` search to a specific system by using the syntax `<parameter>=<system>|<value>`

Example

The following search would find all patients with _any_ identifier that equals `"12345"`

```
medplum.searchResources('Patient', 'identifier=12345');
```

If we only wanted to search for patients whose social security number was `"12345"`, we could use the system string `"http://hl7.org/fhir/sid/us-ssn"` as follows:

```
medplum.searchResources('Patient', 'identifier=http://hl7.org/fhir/sid/us-ssn|12345');
```

We can also check for the _presence_ of a particular identifier by dropping the `<value>` and using the syntax `<parameter>=<system>|`.

Example

To find all `Patients` that _have_ a social security number:

```
medplum.searchResources('Patient', 'identifier=http://hl7.org/fhir/sid/us-ssn|');
```

## Search Modifiers

The FHIR spec includes a set of **modifiers** to change the way a specific search parameters behave. They are used by appending the string `:<modifier-name>` to the search parameter. While the [FHIR search specification](http://hl7.org/fhir/R4/search.html) details all the available modifiers, we'll describe some of the most common modifiers here.

### `:not`

`:not` excludes the specified values from results. For example, search for all `Tasks` where status _is not_ `completed`:

- TypeScript
- cURL

```
await medplum.searchResources('Task', { 'status:not': 'completed' });//ORawait medplum.searchResources('Task', 'status:not=completed');
```

### `:missing`

`:missing` specifies whether or not to include values where the specified search parameter is present/absent

For example, searching for all `Patients` with missing `birthDates`.

- TypeScript
- cURL

```
await medplum.searchResources('Patient', { 'birthdate:missing': 'true' });// ORawait medplum.searchResources('Patient', 'birthdate:missing=true');
```

### `:contains`

`:contains` allows you to perform a partial match on `string` search parameters.

For example, searching for `Patients` whose name includes the substring `"stein"`

- TypeScript
- cURL

```
await medplum.searchResources('Patient', { 'name:contains': 'eve' });// ORawait medplum.searchResources('Patient', 'name:contains=eve');// Return patients with the names `"eve"`, `"Eve"`, `"Evelyn`",  AND `"Steve"`
```

## Searching by Comparison

FHIR provides a mechanism to search for resources that have a value greater or less than a certain threshold, or that have a value within a specific range, by adding a prefix to your query value. The table below lists the common prefixes used for `quantity`, `number`, and `date` search parameters:

|Prefix|Description|
|---|---|
|`eq`|equal|
|`ne`|not equal|
|`gt`|greater than|
|`lt`|less than|
|`ge`|greater than or equal to|
|`le`|less than or equal to|
|`sa`|starts after|
|`eb`|ends before|

  

This example shows how to find all [`RiskAssessments`](https://www.medplum.com/docs/api/fhir/resources/riskassessment) with a `probability` greater than 0.8.

- TypeScript
- cURL

```
await medplum.searchResources('RiskAssessment', { probability: 'gt0.8' });// ORawait medplum.searchResources('RiskAssessment', 'probability=gt0.8');
```

  

You can search an inclusive range using an AND search

- TypeScript
- cURL

```
await medplum.searchResources('Observation', [  ['value-quantity', 'gt40'],  ['value-quantity', 'lt60'],]);// ORawait medplum.searchResources('Observation', 'value-quantity=gt40&value-quantity=lt60');
```

Note

Because we are specifying the `value-quantity` parameter twice in this query, we must pass a `string[][]` as the second argument to `searchResources()`

  

You can search an exclusive range using an OR search

- TypeScript
- cURL

```
await medplum.searchResources('Observation', { 'value-quantity': 'lt40,gt60' });// ORawait medplum.searchResources('Observation', 'value-quantity=lt40,gt60');
```

## Sorting the Results

You can sort your search results by using the special search parameter `_sort`.

The `_sort` parameter allows you specify a list of [search parameters](https://www.medplum.com/docs/search/basic-search#search-parameters) to sort by, in order.

The example below searches for all [`RiskAssessments`](https://www.medplum.com/docs/api/fhir/resources/riskassessment), sorted by their `probability`, then by `date`.

- TypeScript
- cURL

```
await medplum.searchResources('RiskAssessment', { _sort: 'probability,date' });// ORawait medplum.searchResources('RiskAssessment', '_sort=probability,date');
```

### Reversing the sort order

To sort in _descending_ order, prepend the search parameter with a minus sign `-`. The following example returns [`RiskAssessments`](https://www.medplum.com/docs/api/fhir/resources/riskassessment), in _descending_ order of `probability`:

- TypeScript
- cURL

```
await medplum.searchResources('RiskAssessment', { _sort: '-probability' });// ORawait medplum.searchResources('RiskAssessment', '_sort=-probability');
```

### Sorting by updated time

FHIR also provides the special search parameter, `_lastUpdated`, to search by the last updated time for a resource. The following example searches for the most recently updated [`RiskAssessments`](https://www.medplum.com/docs/api/fhir/resources/riskassessment) resources:

- TypeScript
- cURL

```
await medplum.searchResources('RiskAssessment', { _sort: '-_lastUpdated' });// ORawait medplum.searchResources('RiskAssessment', '_sort=-_lastUpdated');
```

## Getting the total number of results

You can use the special search parameter, `_total`, to include the total number of matching resources in your search results. This information is particularly useful for [pagination](https://www.medplum.com/docs/search/paginated-search) and understanding the scope of the data you are dealing with.

See the [paginated search](https://www.medplum.com/docs/search/paginated-search#getting-the-total-number-of-results-with-_total) guide for more info.

## Conclusion

This article covers the basic FHIR search functionality needed to build a healthcare application. The next guides will cover more advanced topics such as paginated search and using GraphQL for retrieving linked Resources.

# 3.  [Questionnaires & Assessments](https://www.medplum.com/docs/questionnaires)
Creating, updating and embedding FHIR Questionnaires for both patients and practitioners is a common use-case for Medplum.

- [Medplum app](https://app.medplum.com/Questionnaire) supports creating and updating Questionnaires
- [Questionnaire](https://storybook.medplum.com/?path=/docs/medplum-questionnaireform--basic) react component can be embedded in patient facing or practitioner facing applications
- [QuestionnaireBuilder](https://storybook.medplum.com/?path=/docs/medplum-questionnairebuilder--basic) react component can be embedded in applications as well
- [QuestionnaireResponse](https://app.medplum.com/QuestionnaireResponse) resources can also be viewed in the [Medplum app](https://www.medplum.com/docs/app)
- [Bot for QuestionnaireResponse](https://www.medplum.com/docs/bots/bot-for-questionnaire-response) is one of the most common automations
- [Questionnaire Features and Fixes](https://github.com/medplum/medplum/pulls?q=is%3Apr+label%3Aquestionnaires) on Github

## Key Resources

|**Resource**|**Description**|
|---|---|
|[`Questionnaire`](https://www.medplum.com/docs/api/fhir/resources/questionnaire)|Definition of questions/answers. 1 per form.|
|[`QuestionnaireResponse`](https://www.medplum.com/docs/api/fhir/resources/questionnaireresponse)|A patient's responses to each question. 1 per patient, per instance.|
|[`Observation`](https://www.medplum.com/docs/api/fhir/resources/observation)|A structured representation of a point-in-time result measured by an assessment.|
|[`RiskAssessment`](https://www.medplum.com/docs/api/fhir/resources/riskassessment)|A specialized form of an [`Observation`](https://www.medplum.com/docs/api/fhir/resources/observation) tailored to propensity measurements.|
|[`Condition`](https://www.medplum.com/docs/api/fhir/resources/condition)|Records a long-term diagnosis for a [`Patient`](https://www.medplum.com/docs/api/fhir/resources/patient).|

## Key Code Systems

|**Code System**|**Description**|
|---|---|
|[LOINC](https://www.medplum.com/docs/careplans/loinc)|Used to tag questions and answers. Also has predefined standard assessments.|
|[ICD-10](https://www.cdc.gov/nchs/icd/icd10cm_browsertool.htm)|Used to annotate [`Condition`](https://www.medplum.com/docs/api/fhir/resources/condition) resources for billing.|

## Other Resources

- [Questionnaire Video](https://youtu.be/mOBC0VYtCLE) on Youtube
- [Questionnaire Core Extensions](http://hl7.org/fhir/R4/questionnaire-profiles.html#extensions) - Because of the wide variety of data collection applications, the [`Questionnaire`](https://www.medplum.com/docs/api/fhir/resources/questionnaire) resource has the most "core extensions" of any FHIR resource.
- [Structured Data Capture (SDC) Implementation Guide](http://hl7.org/fhir/uv/sdc/) - A collection of profiles, extensions, and best practices for advanced questionnaire use cases.
    - [Modular Forms](http://hl7.org/fhir/uv/sdc/modular.html) - Reuse sections and questions between questionnaires
    - [Advanced Rendering](http://hl7.org/fhir/uv/sdc/rendering.html) - Additional extensions to inform how a questionnaire is displayed.
- [List of SDC implementations](https://confluence.hl7.org/display/FHIRI/SDC+Implementations) - Wiki page with a number of Form Builders and Form Fillers that implement some part of the SDC guide
# 4. [Medplum Terminology Services](https://www.medplum.com/docs/terminology/medplum-terminology-services)
Medplum provides a layer of functionality to make working with coded values simple. Some of the most common use cases are detailed below to show how these components can fit together.

## Binding an input to a set of codes

To restrict the set of values that can be used with an input, it can be bound to a `ValueSet` defining which codes are allowed. This enables a typeahead UI, where the user can select from a list of available codes, and type part of the desired concept to filter the list and aid in selection when the set of possible codes is large.

### Defining the ValueSet

First, the `ValueSet` resource must be uploaded to the Medplum FHIR server, and must contain a `url` by which to reference it.

```
{  resourceType: 'ValueSet',  url: 'http://example.com/ValueSet/vitals',  name: 'vitals',  title: 'Vital Signs',  status: 'active',  compose: {    include: [      {        system: 'http://loinc.org',        concept: [          { code: '8310-5', display: 'Body temperature' },          { code: '8462-4', display: 'Diastolic blood pressure' },          { code: '8480-6', display: 'Systolic blood pressure' },          { code: '8867-4', display: 'Heart rate' },          { code: '9279-1', display: 'Respiratory rate' },        ],      },    ],  },};
```

Additionally, the URL used to refer to the code system in `ValueSet.compose.include.system` must actually correspond to a valid `CodeSystem` resource on the server:

```
{  resourceType: 'CodeSystem',  url: 'http://loinc.org',  name: 'LOINC',  status: 'active',  content: 'example',  concept: [    { code: '8310-5', display: 'Body temperature' },    { code: '8462-4', display: 'Diastolic blood pressure' },    { code: '8480-6', display: 'Systolic blood pressure' },    { code: '8867-4', display: 'Heart rate' },    { code: '9279-1', display: 'Respiratory rate' },  ],};
```

### Binding to the Input

The `CodeInput`, `CodingInput`, and `CodeableConceptInput` React components provide the ability to connect an input field with a `ValueSet` for typeahead, returning whichever data type is needed by the application.

```
import { MedplumClient } from '@medplum/core';import type { CodeSystem, Coding, Parameters, ValueSet } from '@medplum/fhirtypes';import { CodingInput } from '@medplum/react';<CodingInput  name="vital-sign-code"  binding="http://example.com/ValueSet/vitals"  path="Observation.code"  onChange={(c: Coding) => {    console.log('User selected: ' + c.display + ' (' + c.system + '|' + c.code + ')');  }}/>;
```

## Internationalizing Codings

While coded values provide a consistent way to refer to clinical concepts across different systems and languages, these codes must still ultimately be translated into human-readable terms for users. Many healthcare practices serve people with a diverse set of primary languages, requiring the human-readable display strings to be translated. Building on the strong foundations in the FHIR standard, Medplum provides the ability to work with codes fluently across multiple languages.

### Importing Translated Strings

A `CodeSystem` resource can embed any number of known translations directly alongside the primary display text using the `designation` field. This field can be used both for synonyms in the primary language, as well as translations into additional languages.

```
{  resourceType: 'CodeSystem',  status: 'draft',  url: 'http://example.com/CodeSystem/translated',  content: 'example',  concept: [    {      code: 'HR',      // Primary display string      display: 'Heart rate',      designation: [        // Synonym        { value: 'Cardiac rate' },        // Translation        { language: 'fr', value: 'fréquence cardiaque' },      ],    },  ],};
```

Additionally, synonyms or translations can be added to existing code systems using Medplum's custom [`CodeSystem/$import` API](https://www.medplum.com/docs/api/fhir/operations/codesystem-import).

```
await medplum.post(medplum.fhirUrl('CodeSystem/$import'), {  resourceType: 'Parameters',  parameter: [    { name: 'url', valueUri: 'http://example.com/CodeSystem/translated' },    // Synonym in primary language    {      name: 'designation',      part: [        { name: 'code', valueCode: 'HR' },        { name: 'value', valueString: 'Pulse rate' },      ],    },    // Translation into other language    {      name: 'designation',      part: [        { name: 'code', valueCode: 'HR' },        { name: 'language', valueCode: 'es' },        { name: 'value', valueString: 'frecuencia cardíaca' },      ],    },  ],} satisfies Parameters);
```

### Searching With Translations

Using the [`ValueSet/$expand` API](https://www.medplum.com/docs/api/fhir/operations/valueset-expand), users can leverage these synonyms and translations when searching for a specific code. By default, languages other than the primary are excluded from `filter` search results; a different language can be selected by setting the `displayLanguage` parameter:

```
const vs = await medplum.createResource<ValueSet>({  resourceType: 'ValueSet',  status: 'draft',  url: 'http://example.com/ValueSet/translated',  compose: {    include: [{ system: 'http://example.com/CodeSystem/translated' }],  },});const expansion = await medplum.valueSetExpand({  url: vs.url,  filter: 'card',  displayLanguage: 'fr',});/* Returns:{  "resourceType": "ValueSet",  "status": "draft",  "url": "http://example.com/ValueSet/translated",  "compose": {    "include": [{ "system": "http://example.com/CodeSystem/translated" }]  },  "expansion": {    "total": 1,    "contains": [      {        "system": "http://example.com/CodeSystem/translated",        "code": "HR",        "display": "fréquence cardiaque"      }    ]  }}*/
```

--- 
