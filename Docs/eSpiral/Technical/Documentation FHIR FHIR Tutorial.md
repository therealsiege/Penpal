# Documentation > FHIR > FHIR Tutorial

FHIR makes it easy to quickly get patient data from a clinical system, and to connect together queries to obtain a wide variety of related healthcare information. The tutorial below includes a walkthrough introduction to FHIR data and sample patient and clinical information - everything you need to turn up the heat on your first FHIR app!

Let's begin with a few examples using jQuery — in a larger application, you might build your own framework, or use an existing one, to interact with FHIR, but FHIR is easy enough to use without any special libraries. This tutorial assumes you are passing a form of authorization covered in one of our authentication guides. It is generally assumed that in production environments FHIR APIs will use OAuth 2.0; however, it's important to note FHIR APIs do support HTTP Basic Authentication.

# **Interacting with the API**

To get started, let's define the FHIR server base URL. This is a constant address for a server where all FHIR API endpoints for a given FHIR version live. In a SMART on FHIR launch, this is specified with the iss parameter. We'll store this variable as a separate entity, so we can reference it across our queries:

```

var baseUrl = "https://vendorservices.epic.com/interconnect-amcurprd-oauth/api/FHIR/R4"
```

You can expect the bold part of the above URL to be different for each unique instance of Epic you integrate with.

# **Finding Patients via Demographic Data**

With the base URL defined, we can start building queries. Because we're interacting with patient data, there's an obvious place to get started: finding the patient whose data we are interested in. Epic's FHIR support provides two methods for applications to find and interact with patients:

1. The Epic application can provide a patient to you as part of the application launch context, determined from the Epic workflow or the patient selection activity. This method can apply to both clinician and patient-facing workflows.
2. Our Patient API provides a way to match on a single high-confidence patient using demographic information such as patient name, birthdate, address, and other identifying information. We use this method when your application is independent from Epic.

```

var patientMatchString = "/Patient/$match"
```

We can use jQuery's `$.ajax()` function to send patient demographic data to the server using an HTTP POST request. It takes a parameter describing the URL, the data to send to the server, and a callback for doing something with the data once the API responds. In our case, let's just log the data to the console so we can inspect it before developing code that works with it:

```

$.ajax({
  url: baseUrl + patientMatchString,
  type: "POST",
  contentType:"application/json; charset=utf-8",
  dataType: "json",
  data: dataToSend,
  success: function(data) { console.log(data); }
});
```

The complete request URL at this point will read:

```

"https://vendorservices.epic.com/interconnect-amcurprd-oauth/api/FHIR/R4/Patient/$match"
```

The dataToSend will be a FHIR Parameters resource. In this case, there are two parameters:

1. The “resource” parameter, which is a partial Patient resource with demographic information about the patient you want to find.
2. The “onlyCertainMatches” parameter, which is set to true, indicating that the server should only return single high-confidence matches based on your demographic information.

```
{
  "resourceType": "Parameters",
  "id": "example",
  "parameter": [
    {
      "name": "resource",
      "resource": {
        "resourceType": "Patient",
        "identifier": [
            {
                "use": "usual",
                "type": {
                    "text": "EPI"
                },
                "system": "urn:oid:1.2.840.114350.1.1",
                "value": "27475"
            }
        ],
        "name": [
          {
            "family": "Smith",
            "given": [
              "John"
            ]
          }
        ],
        "birthDate": "1906-03-04"
      }
    },
    {
      "name": "count",
      "valueInteger": "1"
    },
    {
      "name": "onlyCertainMatches",
      "valueBoolean": "true"
    }
  ]
}
```

If you execute the above request, you'll see the following full Patient resource response in your console:

```
{
    "resourceType": "Bundle",
    "type": "searchset",
    "total": 1,
    "link": [
        {
            "relation": "self",
            "url": "https://vendorservices.epic.com/interconnect-amcurprd-oauth/api/FHIR/R4/Patient/$match"
        }
    ],
    "entry": [
        {
            "link": [
                {
                    "relation": "self",
                    "url": "https://vendorservices.epic.com/interconnect-amcurprd-oauth/api/FHIR/R4/Patient/ecBjL8PUhljoHWMtwx63UhA3"
                }
            ],
            "fullUrl": "https://vendorservices.epic.com/interconnect-amcurprd-oauth/api/FHIR/R4/Patient/ecBjL8PUhljoHWMtwx63UhA3",
            "resource": {
                "resourceType": "Patient",
                "id": "ecBjL8PUhljoHWMtwx63UhA3",
                "extension": [
                    {
                        "valueCodeableConcept": {
                            "coding": [
                                {
                                    "system": "urn:oid:1.2.840.114350.1.13.5325.1.7.10.698084.130.768080.39128",
                                    "code": "male",
                                    "display": "male"
                                }
                            ]
                        },
                        "url": "http://open.epic.com/FHIR/StructureDefinition/extension/legal-sex"
                    },
                    {
                        "valueCodeableConcept": {
                            "coding": [
                                {
                                    "system": "urn:oid:1.2.840.114350.1.13.5325.1.7.10.698084.130.768080.35144",
                                    "code": "male",
                                    "display": "male"
                                }
                            ]
                        },
                        "url": "http://open.epic.com/FHIR/StructureDefinition/extension/sex-for-clinical-use"
                    },
                    {
                        "extension": [
                            {
                                "valueCoding": {
                                    "system": "http://terminology.hl7.org/CodeSystem/v3-NullFlavor",
                                    "code": "UNK",
                                    "display": "Unknown"
                                },
                                "url": "ombCategory"
                            },
                            {
                                "valueString": "Unknown",
                                "url": "text"
                            }
                        ],
                        "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race"
                    },
                    {
                        "extension": [
                            {
                                "valueString": "Unknown",
                                "url": "text"
                            }
                        ],
                        "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity"
                    },
                    {
                        "valueCode": "248153007",
                        "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-sex"
                    },
                    {
                        "valueCodeableConcept": {
                            "coding": [
                                {
                                    "system": "http://loinc.org",
                                    "code": "LA29518-0",
                                    "display": "he/him/his/his/himself"
                                }
                            ]
                        },
                        "url": "http://open.epic.com/FHIR/StructureDefinition/extension/calculated-pronouns-to-use-for-text"
                    }
                ],
                "identifier": [
                    {
                        "use": "usual",
                        "type": {
                            "text": "CEID"
                        },
                        "system": "urn:oid:1.2.840.114350.1.13.5325.1.7.3.688884.100",
                        "value": "YA5WT9X7ZMB69TB"
                    },
                    {
                        "use": "usual",
                        "type": {
                            "text": "EPI"
                        },
                        "system": "urn:oid:1.2.840.114350.1.1",
                        "value": "27475"
                    },
                    {
                        "use": "usual",
                        "system": "urn:oid:2.16.840.1.113883.4.1",
                        "_value": {
                            "extension": [
                                {
                                    "valueString": "xxx-xx-3745",
                                    "url": "http://hl7.org/fhir/StructureDefinition/rendered-value"
                                }
                            ]
                        }
                    }
                ],
                "active": true,
                "name": [
                    {
                        "use": "official",
                        "text": "John Smith",
                        "family": "Smith",
                        "given": [
                            "John"
                        ]
                    },
                    {
                        "use": "usual",
                        "text": "John Smith",
                        "family": "Smith",
                        "given": [
                            "John"
                        ]
                    }
                ],
                "gender": "male",
                "birthDate": "1906-03-04",
                "deceasedBoolean": false,
                "managingOrganization": {
                    "reference": "Organization/ePUQySFaW.ofXm2GhaXRMDA3",
                    "display": "Epic Facility"
                }
            },
            "search": {
                "extension": [
                    {
                        "valueCode": "certain",
                        "url": "http://hl7.org/fhir/StructureDefinition/match-grade"
                    }
                ],
                "mode": "match",
                "score": 1
            }
        }
    ]
}
```

Let's pick out a couple of key elements to learn more about:

1. The `entry[n].fullUrl` element points to the permanent location of a unique patient. If we make a request to this absolute URL, we can directly access the Patient resource for that patient.
2. The `entry[n].resource.id` contains the FHIR ID of the resource. This ID is assigned by the server responsible for storing the resource. Storing this FHIR ID can be useful if you want to save off a list of recently used patients, for example.
3. The `entry[0].resource` element contains all of the actual data about John Smith. Within this object, you'll find information about John such as his address, phone number, and birth date.

Ideally, you provide enough demographic information in your initial request for the API to return the correct patient. If we were building a more complex app, we might need to handle other scenarios gracefully, such as when no patients are found.

The following response is an example of what to expect if a single high-confidence patient match is not found. Note the text contained within the OperationOutcome resource:

```
{
    "resourceType": "OperationOutcome",
    "issue": [
        {
            "severity": "fatal",
            "code": "processing",
            "details": {
                "coding": [
                    {
                        "system": "urn:oid:1.2.840.114350.1.13.5325.1.7.2.657369",
                        "code": "59013",
                        "display": "The matching operation found one or more possible matches, but did not find a certain match."
                    }
                ],
                "text": "The matching operation found one or more possible matches, but did not find a certain match."
            },
            "location": [
                "/f:patient"
            ],
            "expression": [
                "patient"
            ]
        }
    ]
}
```

That's a quick overview of the Patient $match endpoint, but if you're interested in learning more about our Patient.$match API, you can read more [here](https://vendorservices.epic.com/Sandbox/Index?api=10423). Let's continue by saving off John's FHIR ID so we can refer to it later:

```

var patientId = data.entry[0].resource.id;
```

# **Interlude: Relative Resource URLs (R4 and Later)**

There are several versions of the FHIR standard. We generally recommend using Epic’s latest R4 FHIR resources, as we did in the example above, but you might also need to use DSTU2 resources or STU3 resources in some cases.

For R4 and later versions of FHIR, Epic uses relative URLs for all referenced FHIR resources included in a query response. STU3 and earlier versions use absolute URLs. For example, if we look back at the sample response from our Patient query above, if that query was an STU3 version Patient query, instead of returning a relative reference URL for the managingOrganization:

```
"managingOrganization": {
    "reference": "Organization/ePUQySFaW.ofXm2GhaXRMDA3",
    "display": "Epic Facility"
}
```

An STU3 resource would return an absolute URL instead:

```
"managingOrganization": {
    "reference": "https://vendorservices.epic.com/interconnect-amcurprd-oauth/api/FHIR/STU3/Organization/ePUQySFaW.ofXm2GhaXRMDA3",
    "display": "Epic Facility"
}
```

This distinction is important to keep in mind, particularly if you’re working with some FHIR resources that use the DSTU2 or STU3 standard, and other resources that use the R4 standard. Make sure to append the baseURL to the front of the relative URL when querying referenced FHIR resources.

# **Searching for Clinical Data by Patient ID**

We've found our patient, and we have some demographics that we could parse and display to an end user. But how do we get access to clinical information about that patient? To retrieve this data, we need to use another endpoint within our API, along with the patient ID we saved off above.

Let's start with a simple query — retrieving a patient's allergies. The AllergyIntolerance endpoint exposes exactly that, and provides a search endpoint to find allergies by Patient ID. We can construct a query that provides John's FHIR ID to grab all the active allergies recorded in our system:

```

var allergySearchString = "/AllergyIntolerance?patient=" + patientId;
```

We can use jQuery’s `$.getJSON()` function to call into the URL and retrieve our data in JSON format. We will also log the response bode to the console as a simple means to view the data.

```

$.getJSON(baseUrl + allergySearchString, function(data,error) { console.log(data); });
```

Executing the above request returns the following:

```
{
    "resourceType": "Bundle",
    "type": "searchset",
    "total": 1,
    "link": [
        {
            "relation": "self",
            "url": "https://vendorservices.epic.com/interconnect-amcurprd-oauth/api/FHIR/R4/AllergyIntolerance?patient=ecBjL8PUhljoHWMtwx63UhA3"
        }
    ],
    "entry": [
        {
            "link": [
                {
                    "relation": "self",
                    "url": "https://vendorservices.epic.com/interconnect-amcurprd-oauth/api/FHIR/R4/AllergyIntolerance/efnBJhT6lf969qC4prH5jVqor3vnmeJyvRfMzJX9-yZ43"
                }
            ],
            "fullUrl": "https://vendorservices.epic.com/interconnect-amcurprd-oauth/api/FHIR/R4/AllergyIntolerance/efnBJhT6lf969qC4prH5jVqor3vnmeJyvRfMzJX9-yZ43",
            "resource": {
                "resourceType": "AllergyIntolerance",
                "id": "efnBJhT6lf969qC4prH5jVqor3vnmeJyvRfMzJX9-yZ43",
                "clinicalStatus": {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                            "version": "4.0.0",
                            "code": "active",
                            "display": "Active"
                        }
                    ],
                    "text": "Active"
                },
                "verificationStatus": {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
                            "version": "4.0.0",
                            "code": "confirmed",
                            "display": "Confirmed"
                        }
                    ],
                    "text": "Confirmed"
                },
                "category": [
                    "medication"
                ],
                "criticality": "high",
                "code": {
                    "coding": [
                        {
                            "system": "urn:oid:2.16.840.1.113883.3.26.1.5",
                            "code": "N0000005840",
                            "display": "PENICILLINS"
                        }
                    ],
                    "text": "PENICILLINS"
                },
                "patient": {
                    "reference": "Patient/ecBjL8PUhljoHWMtwx63UhA3",
                    "display": "Smith, John"
                },
                "onsetDateTime": "2024-08-27",
                "recordedDate": "2024-08-27T20:34:34Z",
                "reaction": [
                    {
                        "manifestation": [
                            {
                                "coding": [
                                    {
                                        "system": "http://snomed.info/sct",
                                        "code": "201272008",
                                        "display": "(URTICARIA NOS) OR (HIVES)"
                                    }
                                ],
                                "text": "Hives"
                            }
                        ],
                        "description": "Hives"
                    }
                ]
            },
            "search": {
                "mode": "match"
            }
        }
    ]
}
```

Looking at the response, there are a couple of key elements to highlight to help us understand the allergy information:

1. The `total` element lets you know the number of resources returned for a query. In this case, it lets us know how many allergies our system has documented for John Smith.
2. The `entry[n].fullUrl` element points to the permanent location of a unique AllergyIntolerance resource. If we make a request to this URL, we will always get back data for this specific AllergyIntolerance for the patient. The FHIR ID for this resource can also be retrieved directly from `entry[n].resource.id`. This might be useful for future reference to check whether the patient has developed additional reactions to this allergy.
3. The `entry[n].resource.patient` element describes the patient the allergy relates to. This allows us to confirm the association between allergy and patient and shows how FHIR works by linking these smaller resources to paint a larger picture. In this case, the element in each allergy entry points to our patient, John.
4. The `entry[n].resource.code` element describes the allergen that causes the allergy. This element has a text element, to make it easy to read, as well as coded values, to associate and develop clinical rules against. In this example response, we can see that John is allergic to Penicillin.
5. The `entry[n].resource.reaction` element describes the allergic reactions of the patient documented in the system.
6. The `entry[n].resource.onsetDateTime` element tells you when the allergy first started happening.
7. The `entry[n].resource.reaction[n].manifestation` element tells you what kind of reaction occurred. For example, John's allergy to Penicillin gives him hives.

That's a lot of information with a simple query, and it demonstrates how quickly we can build up and associate the different endpoints available on our API.

# **Wrap Up**

Nice work! You made it to the end of our tutorial, and you understand how to find patients, and start working with their data. There's even more to discover in our documentation, like additional data types, and more complex searches.

# **Advanced Topics**

In this section we'll cover a few advanced topics that may come up in your implementation of FHIR.

# **Searching from Patient Context in Coordination with OAuth 2.0**

For patient-facing applications using OAuth 2.0 authorization, including the patient or subject search parameter(s) is optional when making requests for the patient on whose behalf authorization to the system was granted. This is true for STU3 and R4 versions of FHIR resources.

Including the patient or subject ID in the request is still recommended and encouraged. Requests can be made with these parameters so long as the FHIR ID matches the patient whose data is being requested with the access token.

# **Content negotiation in FHIR**

Epic’s FHIR server defaults to using XML for FHIR resources, but many apps may prefer sending and receiving JSON instead. FHIR allows both XML and JSON MIME-types and specifies how a client can request one or the other. Per the [FHIR spec](https://www.hl7.org/fhir/http.html#mime-type) and in Epic’s FHIR server, a client can specify XML or JSON through either the [_format](https://www.hl7.org/fhir/http.html#parameters) query parameter or by specifying the MIME-type in an HTTP header. A client should use the [`Accept` HTTP header](https://tools.ietf.org/html/rfc7231#section-5.3.2) to specify the MIME-type of the content that it wishes to receive from the server and the [`Content-Type` HTTP header](https://tools.ietf.org/html/rfc7231#section-3.1.1.5) to specify the MIME-type of the content that it is sending in the body of its request, for example, as part of a create or update; the Content-Type HTTP header will also be considered for requests in which another method (_format query parameter, or Accept HTTP header) is not provided.

Epic's FHIR server processes the the available options in the following hierarchy:

- _format query parameter
- Accept HTTP Header
- Content-Type HTTP Header
- Server Default: XML

Epic supports all of the following MIME-types for FHIR interactions:

- application/fhir+json
- application/json+fhir
- application/xml+fhir
- application/fhir+xml
- application/json
- application/xml
- text/xml

In addition to the MIME-types listed above, the _format query parameter supports:

- xml
- json

# **Retrieving Additional ID Types with Patient and Practitioner Resources**

You can also use FHIR search APIs such as Patient.Search and Practitioner.Search to get FHIR IDs for other FHIR versions and a list of other identifiers given one type of identifier. For Patient.Search, use the following format:

```
<base url>/R4/Patient?identifier=<ID Type>|<ID>
```

Where ID Type can be one of the following: CID, CSN, External, ExternalKey, FHIR, FHIR STU3, Internal, Name, NationalID, CEID, MyChartLogin, <any IIT identifier>

The resulting identifiers are identical to those returned by GetPatientIdentifiers.

For practitioners, you can use the Practitioner.Search endpoint to retrieve a list of practitioner identifiers. Use the following format:

```
<base url>/R4/Practitioner?identifier=<ID Type>|<ID>
```

Where ID Type can be one of the following: CID, External, FHIR, Internal, NPI, CSN.

# **Constraining ID Length to 64 Characters in the R4 Version of FHIR**

For historical reasons, some of Epic’s FHIR resources have identifiers that are longer than 64 characters. For example, Medication resource IDs sometimes exceed this length. New clients can be configured to respect the 64-character ID-length limit [described in the HL7 FHIR standard](https://www.hl7.org/fhir/datatypes.html#id) for all STU3 and R4 version FHIR resources that are part of the [USCDI data classes](https://www.healthit.gov/isa/united-states-core-data-interoperability-uscdi). To avoid disrupting existing integrations or new integrations that rely on historical data, this configuration is not enabled by default. You can set your client to observe the 64-character identifier length limit for USCDI resources by changing the FHIR ID Generation Scheme setting on the Build Apps page. To change this setting on an active app, you will need to contact your Epic representative. See the App Default FHIR Version Tutorial for more information.

# **FHIR Search Using HTTP POST**

In some cases, you might want to perform a search interaction using an HTTP POST body. In rare scenarios, the query string might be too long and a POST body could make more sense. This method is supported for all versions of FHIR.

For example, a search query like this:

```
GET <base url>/api/FHIR/<version>/<resource>?param1=val1&param2=val2...
```

Can be executed using a POST using this format:

```
POST <base url>/api/FHIR/<version>/<resource>/_search
Content-Type: application/x-www-form-urlencoded

param1=val1&param2=val2...
```

If both query string parameters and a POST body are provided to the _search endpoint, the POST body is ignored.

Starting in the February 2026 version of Epic, query string parameters, except for _format, are ignored by the _search endpoint.