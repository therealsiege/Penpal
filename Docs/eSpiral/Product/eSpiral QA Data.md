# eSpiral QA Data

- Capability Statement
    
    ```json
    {
      "conformance": {
        "resourceType": "CapabilityStatement",
        "status": "active",
        "experimental": false,
        "date": "2024-07-11T19:18:58Z",
        "copyright": "Copyright Epic 1979-2023",
        "kind": "instance",
        "instantiates": [
          "http://hl7.org/fhir/uv/bulkdata/CapabilityStatement/bulk-data"
        ],
        "software": {
          "name": "Epic",
          "version": "November 2023",
          "releaseDate": "2024-06-05"
        },
        "implementation": {
          "description": "Infirmary Health Systems FHIR Server",
          "url": "https://ssproxyprod.infirmaryhealth.org/epicFHIR/api/FHIR/R4"
        },
        "fhirVersion": "4.0.1",
        "format": [
          "xml",
          "json"
        ],
        "rest": [
          {
            "mode": "server",
            "security": {
              "extension": [
                {
                  "extension": [
                    {
                      "valueUri": "https://ssproxyprod.infirmaryhealth.org/epicFHIR/oauth2/authorize",
                      "url": "authorize"
                    },
                    {
                      "valueUri": "https://ssproxyprod.infirmaryhealth.org/epicFHIR/oauth2/token",
                      "url": "token"
                    }
                  ],
                  "url": "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris"
                }
              ],
              "cors": true,
              "service": [
                {
                  "coding": [
                    {
                      "system": "http://terminology.hl7.org/CodeSystem/restful-security-service",
                      "code": "OAuth",
                      "display": "OAuth"
                    }
                  ],
                  "text": "OAuth"
                },
                {
                  "coding": [
                    {
                      "system": "http://terminology.hl7.org/CodeSystem/restful-security-service",
                      "code": "SMART-on-FHIR",
                      "display": "SMART-on-FHIR"
                    }
                  ],
                  "text": "SMART-on-FHIR"
                },
                {
                  "coding": [
                    {
                      "system": "http://terminology.hl7.org/CodeSystem/restful-security-service",
                      "code": "Basic",
                      "display": "Basic"
                    }
                  ],
                  "text": "Basic"
                }
              ]
            },
            "resource": [
              {
                "type": "Account",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "A FHIR ID for a patient resource"
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "AdverseEvent",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "seriousness",
                    "type": "token",
                    "documentation": "Refine a search for AdverseEvent resources by seriousness of the event. Serious and Non-serious are the only supported values."
                  },
                  {
                    "name": "study",
                    "type": "reference",
                    "documentation": "Search for AdverseEvent resources for a specified study ID."
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Search for AdverseEvent resources for a specified patient ID."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "AllergyIntolerance",
                "interaction": [
                  {
                    "code": "create"
                  },
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "clinical-status",
                    "type": "token",
                    "documentation": "Refine a search for AllergyIntolerance resources by clinicalStatus. Active is the only supported clinical status to search by."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for AllergyIntolerance resources for a specified patient ID."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Appointment",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "date",
                    "type": "date",
                    "documentation": "Refine a search for Appointment resources by date. By default, all Appointments are returned. Not supported for scheduled surgeries."
                  },
                  {
                    "name": "identifier",
                    "type": "token",
                    "documentation": "Refine a search for Appointment resources by identifier. Not supported for scheduled surgeries."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for Appointment resources for a specified patient ID."
                  },
                  {
                    "name": "service-category",
                    "type": "token",
                    "documentation": "Search on the type of appointment. Enter 'surgery' for scheduled surgery appointments, and 'appointment' for all other types of appointments."
                  },
                  {
                    "name": "status",
                    "type": "token",
                    "documentation": "Refine a search for Appointment resources by status. By default, all Appointments are returned. Not supported for scheduled surgeries."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Binary",
                "interaction": [
                  {
                    "code": "read"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported"
              },
              {
                "type": "BodyStructure",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "location",
                    "type": "token",
                    "documentation": "Refine a search for BodyStructure resources by identifier. Enter using the structure \"[system]|[search string]\"."
                  },
                  {
                    "name": "morphology",
                    "type": "token",
                    "documentation": "Refine a search for BodyStructure resources by morphology."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for BodyStructure resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Search for BodyStructure resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "CarePlan",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "activity-date",
                    "type": "date",
                    "documentation": "Search for CarePlan resources with questionaires due before the provided date."
                  },
                  {
                    "name": "category",
                    "type": "token",
                    "documentation": "Search for CarePlans of the given type. This is a required search parameter."
                  },
                  {
                    "name": "encounter",
                    "type": "reference",
                    "documentation": "Refine a search for Encounter CarePlans to search only the encounters provided. Ignored if not searching for Encounter CarePlans."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for CarePlan resources using a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "part-of",
                    "type": "reference",
                    "documentation": "Refine a search for Education CarePlans to include only Education CarePlans that are part of the given Education CarePlans. Ignored if not searching for Education CarePlans."
                  },
                  {
                    "name": "status",
                    "type": "token",
                    "documentation": "Refine a search for Encounter, Education, and Care Path CarePlans to search only for encounters, education, or Care Paths with the provided status. Ignored if not searching for Encounter, Education, or Care Path CarePlans."
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Search for CarePlan resources using a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "CareTeam",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for CareTeam resources using a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "status",
                    "type": "token",
                    "documentation": "Refine a search based on the CareTeam's status. Currently only active is supported."
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Search for CareTeam resources using a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Communication",
                "interaction": [
                  {
                    "code": "create"
                  },
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "based-on",
                    "type": "reference",
                    "documentation": "Refine a search for Education Communication resources to include only Education Communication resources that are documentation for the given Education CarePlans. These should be CarePlans with an education-subcategory of point. Ignored if not searching for Education Communication resources."
                  },
                  {
                    "name": "category",
                    "type": "token",
                    "documentation": "Refine a search to include only Communication resources with the given categories."
                  },
                  {
                    "name": "encounter",
                    "type": "reference",
                    "documentation": "Refine a search to include Communication resources from only the encounters provided."
                  },
                  {
                    "name": "part-of",
                    "type": "reference",
                    "documentation": "Refine a search for Communication resources \"part of\" a specified Task ID. If not provided, all Communications are returned."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for Communication resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Search for Communication resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "ConceptMap",
                "interaction": [
                  {
                    "code": "create"
                  },
                  {
                    "code": "read"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported"
              },
              {
                "type": "Condition",
                "interaction": [
                  {
                    "code": "create"
                  },
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "abatement-date",
                    "type": "date",
                    "documentation": "Search for Conditions with a specified abatement date. This is only used when searching for infections."
                  },
                  {
                    "name": "category",
                    "type": "token",
                    "documentation": "Search for Condition resources by category."
                  },
                  {
                    "name": "clinical-status",
                    "type": "token",
                    "documentation": "Refine a search for Condition resources by clinicalStatus. Only clinical statuses of 'inactive', 'resolved' and 'active' are supported for health concerns and problem list items. Only clinical statuses of 'inactive' and 'active' are supported for infections."
                  },
                  {
                    "name": "code",
                    "type": "token",
                    "documentation": "Search for Conditions with a specified code. This is only used when searching for infections."
                  },
                  {
                    "name": "encounter",
                    "type": "reference",
                    "documentation": "Search for Condition resources for specific encounters."
                  },
                  {
                    "name": "onset-date",
                    "type": "date",
                    "documentation": "Search for Conditions with a specified onset date. This is only used when searching for infections."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for Condition resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "recorded-date",
                    "type": "date",
                    "documentation": "Search for Conditions with a specified recorded date. This is only used when searching for infections."
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Search for Condition resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Consent",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "category",
                    "type": "token",
                    "documentation": "Search for Consent resources by category."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for Consent resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "status",
                    "type": "token",
                    "documentation": "Search for Consent resources by status."
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Search for Consent resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Coverage",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "beneficiary",
                    "type": "reference",
                    "documentation": "Search for Coverage resource for a specific patient ID. You can use \"patient\" or \"beneficiary\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for Coverage resource for a specific patient ID. You can use \"patient\" or \"beneficiary\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Device",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "device-name",
                    "type": "string",
                    "documentation": "A string that will match the Device.deviceName.name field. Not case sensitive."
                  },
                  {
                    "name": "manufacturer",
                    "type": "string",
                    "documentation": "Manufacturer of the device."
                  },
                  {
                    "name": "model",
                    "type": "string",
                    "documentation": "Model number of the device."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "The patient in whom this device is implanted. This is a required parameter."
                  },
                  {
                    "name": "udi-carrier",
                    "type": "string",
                    "documentation": "The UDI barcode string - matches static UDI."
                  },
                  {
                    "name": "udi-di",
                    "type": "string",
                    "documentation": "The UDI device identifier (DI)."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "DeviceRequest",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for DeviceRequest resource for a specified patient ID."
                  },
                  {
                    "name": "status",
                    "type": "token",
                    "documentation": "Search for a DeviceRequest based on a device request status"
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "DeviceUseStatement",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for DeviceUseStatement resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Search for DeviceUseStatement resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "DiagnosticReport",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  },
                  {
                    "code": "update"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "category",
                    "type": "token",
                    "documentation": "Refine a search for DiagnosticReport resources by category."
                  },
                  {
                    "name": "code",
                    "type": "token",
                    "documentation": "Refine a search for DiagnosticReport resources by code."
                  },
                  {
                    "name": "date",
                    "type": "date",
                    "documentation": "Refine a search for DiagnosticReport resources by specifying a date or date range that a DiagnosticReport was resulted or recorded. Enter dates in ISO format (YYYY[-MM[-DD[THH:MM[:SS][TZ]]]]). Local server time is assumed if time zone information is not included. Not supported by Care Plan Goal."
                  },
                  {
                    "name": "identifier",
                    "type": "token",
                    "documentation": "Refine search by specifying an identifier, such as the internal order ID or the accession number. Not supported by Care Plan Goal."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for DiagnosticReport resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Search for DiagnosticReport resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "DocumentReference",
                "interaction": [
                  {
                    "code": "create"
                  },
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  },
                  {
                    "code": "update"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "author",
                    "type": "reference",
                    "documentation": "Further refine a search for a given set of DocumentReferences on a patient by specifying a Practitioner ID that corresponds to the author of the document. Currently only supported for correspondence, imaging-result, and summary-document search."
                  },
                  {
                    "name": "category",
                    "type": "token",
                    "documentation": "Refine a search for DocumentReference resources by category."
                  },
                  {
                    "name": "date",
                    "type": "date",
                    "documentation": "Further refine a search for a given set of DocumentReferences on a patient by specifying a date or date range in ISO format (YYYY[-MM[-DD[THH:MM[:SS][TZ]]]]]) that corresponds to the document creation time. Local server time is assumed if time zone information is not included."
                  },
                  {
                    "name": "docstatus",
                    "type": "token",
                    "documentation": "Further refine a search for a given set of DocumentReferences on a patient by specifying a docStatus. By default, all docStatuses are returned. Not supported for correspondence, imaging-result, or questionnaire-response search."
                  },
                  {
                    "name": "encounter",
                    "type": "reference",
                    "documentation": "Search for DocumentReference resources for a specified encounter ID. Not supported for correspondence, imaging-result, or questionnaire-response search."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for DocumentReference resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "period",
                    "type": "date",
                    "documentation": "Further refine a search for a given set of DocumentReferences on a patient by specifying a date or date range in ISO format (YYYY[-MM[-DD]]) that corresponds to the time of the service that is being documented. Not supported for questionnaire-response search."
                  },
                  {
                    "name": "status",
                    "type": "token",
                    "documentation": "Further refine a search for a given set of DocumentReferences on a patient by specifying a status of the document. Currently only supported for correspondence, imaging-result, questionnaire-response, and summary-document."
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Search for DocumentReference resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "type",
                    "type": "token",
                    "documentation": "Further refine a search for a given set of DocumentReferences on a patient by specifying a type code to return only documents of that type. Use the format: type=<code> to search all supported systems with that code or type=<system>|<code> to further refine the search to one code system. Not supported for questionnaire-response search."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Encounter",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "class",
                    "type": "token",
                    "documentation": "Refine a search for Encounter resources by class. By default, all classes are returned."
                  },
                  {
                    "name": "date",
                    "type": "date",
                    "documentation": "Refine a search for Encounter resources by date. By default, all Encounters are returned. Enter dates in ISO format (YYYY[-MM[-DD[THH:MM[:SS][TZ]]]]]). Local server time is assumed if time zone information is not included."
                  },
                  {
                    "name": "identifier",
                    "type": "token",
                    "documentation": "Search for Encounter resources by encounter identifier in the format <code system>|<code>"
                  },
                  {
                    "name": "onlyscannable",
                    "type": "token",
                    "documentation": "Refine a search for Encounter resources to scannable encounters only. By default, all Encounters are returned. Use a value of \"true\" to only return scannable encounters. Can only be used when the application is launched from Hyperspace."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for Encounter resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for difference references."
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Search for Encounter resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for difference references."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Endpoint",
                "interaction": [
                  {
                    "code": "read"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported"
              },
              {
                "type": "EpisodeOfCare",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for EpisodeOfCare resources for a specified patient ID."
                  },
                  {
                    "name": "status",
                    "type": "token",
                    "documentation": "Refine a search for EpisodeOfCare resources by status. Active, finished, and cancelled are the only supported statuses."
                  },
                  {
                    "name": "type",
                    "type": "token",
                    "documentation": "Refine a search for EpisodeOfCare resources by type."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "ExplanationOfBenefit",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "created",
                    "type": "date",
                    "documentation": "Refine a search for ExplanationOfBenefit resources by creation date for the claim. Enter dates in ISO format (YYYY[-MM[-DD[THH:MM[:SS][TZ]]]]). Local server time is assumed if time zone information is not included."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for ExplanationOfBenefit resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "FamilyMemberHistory",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Required: the patient whose family history you'd like to search."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Flag",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "category",
                    "type": "token",
                    "documentation": "Refine a search for Flag resources by category."
                  },
                  {
                    "name": "encounter",
                    "type": "reference",
                    "documentation": "Refine a search for Flag resources by encounter. This is currently only supported for the isolation category."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for Flag resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "status",
                    "type": "token",
                    "documentation": "Refine a search for Flag resources by status."
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Search for Flag resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Goal",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "category",
                    "type": "token",
                    "documentation": "Refines a search by Goal category."
                  },
                  {
                    "name": "lifecycle-status",
                    "type": "token",
                    "documentation": "Refines a search based on Goal lifecycle status."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for Patient resources for a specific patient ID. You can use \"patient\" or \"subject\" equivalently but they can't be used at the same time for different references."
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Search for Patient resources for a specific patient ID. You can use \"patient\" or \"subject\" equivalently but they can't be used at the same time for different references."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Group",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ],
                "operation": [
                  {
                    "name": "group-export",
                    "definition": "http://hl7.org/fhir/uv/bulkdata/OperationDefinition/group-export"
                  }
                ]
              },
              {
                "type": "ImagingStudy",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "identifier",
                    "type": "token",
                    "documentation": "Search for ImagingStudy resources by a study's identifier. You can use the identifier parameter as the only parameter in a search or in conjunction with other parameters. An ImagingStudy's identifier must be in the format <code system>|<code> or <ID Type>|<ID>."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for ImagingStudy resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Search for ImagingStudy resources for a specified patient ID. You can use \"patient\" and \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Immunization",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "date",
                    "type": "date",
                    "documentation": "Refine a search for Immunization resources by vaccine administration date. Enter dates in ISO format (YYYY[-MM[-DD[THH:MM[:SS][TZ]]]]). Local server time is assumed if time zone information is not included."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for Immunization resources for a specified patient ID."
                  },
                  {
                    "name": "status",
                    "type": "token",
                    "documentation": "Refine a search for Immunization resources by status."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "ImmunizationRecommendation",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "The FHIR id of a patient whose immunization recommendations you'd like to obtain. Only one of either patient or subject needs to be specified."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "List",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "code",
                    "type": "token",
                    "documentation": "Refine a search for List resources by list type. Accepted values include \"medications,\" \"allergies,\" \"immunizations,\" \"problems,\" \"pedigree-list,\" \"hospital-problems,\" and \"patients.\""
                  },
                  {
                    "name": "encounter",
                    "type": "reference",
                    "documentation": "Refine a search for List resources by encounter."
                  },
                  {
                    "name": "identifier",
                    "type": "token",
                    "documentation": "Refine a search for List resource by internal identifier. Only applies to the Patient List sub-resource."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Refine a search for List resources by patient. You can use \"patient\" or \"subject\" equivalently, but not at the same time with different references."
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Refine a search for List resources by patient. You can use \"patient\" or \"subject\" equivalently, but not at the same time with different references."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Location",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "type",
                    "type": "token",
                    "documentation": "Search for Location resources with a specified location type."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Measure",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "MeasureReport",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Medication",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "MedicationAdministration",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "context",
                    "type": "reference",
                    "documentation": "Refine a search for MedicationAdministration resources with one or more linked encounters."
                  },
                  {
                    "name": "effective-time",
                    "type": "date",
                    "documentation": "Refine a search for MedicationAdministration resources for a given patient by specifying a date or a range of dates for the administration."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for MedicationAdministration resources for a specified patient ID. You can use \"patient\" and \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "performer",
                    "type": "reference",
                    "documentation": "Refine a search for MedicationAdministration resources by one or more associated Practitioners."
                  },
                  {
                    "name": "request",
                    "type": "reference",
                    "documentation": "Refine a search for MedicationAdministration resources by associated MedicationRequests."
                  },
                  {
                    "name": "status",
                    "type": "token",
                    "documentation": "Refine a search for MedicationAdministration resources with one or more statuses."
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Search for MedicationAdministration resources for a specified patient ID. You can use \"patient\" and \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "MedicationDispense",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for MedicationDispense resources for a specified patient ID."
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Search for MedicationDispense resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for difference references."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "MedicationRequest",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "authoredon",
                    "type": "date",
                    "documentation": "Further refine a search for MedicationRequest resources for a given patient by specifying a date or range of dates for when the medication was ordered. Note: all medications will be returned regardless of date range provided on the search."
                  },
                  {
                    "name": "category",
                    "type": "token",
                    "documentation": "Refine a search for MedicationRequest resources by category. By default, the search returns all categories. Categories of inpatient, outpatient, community, and discharge are supported."
                  },
                  {
                    "name": "date",
                    "type": "date",
                    "documentation": "Refine a search for MedicationRequest resources for a given patient by specifying a date or a range of dates for when the medication was active."
                  },
                  {
                    "name": "intent",
                    "type": "token",
                    "documentation": "Refine a search for MedicationRequest resources by one or more intents."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for MedicationRequest resources for a specified patient ID. You can use \"patient\" and \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "status",
                    "type": "token",
                    "documentation": "Refine a search for MedicationRequest resources by one or more statuses."
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Search for MedicationRequest resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "NutritionOrder",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for NutritionOrder resources for the specified patient ID."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Observation",
                "interaction": [
                  {
                    "code": "create"
                  },
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  },
                  {
                    "code": "update"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "based-on",
                    "type": "reference",
                    "documentation": "Refine a search for Observation resources by specifying a ServiceRequest associated with the Observation. (currently Genomics-only)"
                  },
                  {
                    "name": "category",
                    "type": "token",
                    "documentation": "Refine a search for Observation resources by category or SNOMED code. Epic categories are laboratory, vital-signs, social-history, core-characteristics, LDA, LDA-property, LDA-assessment, functional-mental-status, periodontal, labor-delivery, newborn-delivery, and obstetrics-gynecology. Supported SNOMED codes include 384821006, 118228005, 252275004, 275711006, 68793005, 395124008, 314076009, 19851009, and 405825005."
                  },
                  {
                    "name": "code",
                    "type": "token",
                    "documentation": "Refine a search for Observation resources by code, including but not limited to LOINC code, SNOMED code, flowsheet row IDs, or SmartData Identifiers. Codes associated with the labor-delivery and newborn-delivery categories require that the category be specified."
                  },
                  {
                    "name": "date",
                    "type": "date",
                    "documentation": "Refine a search for Observation resources by specifying a date or date range that a result- or vital sign-based Observation was resulted or recorded. This can also be used to refine the search results for labor-delivery, obstetrics-gynecology, and LDA based Observation searches. Enter dates in ISO format (YYYY[-MM[-DD[THH:MM[:SS][TZ]]]]). Local server time is assumed if time zone information is not included."
                  },
                  {
                    "name": "focus",
                    "type": "reference",
                    "documentation": "Refine a search for Observation resources by specifying a Reference associated with the Observation. (currently only SmartData and obstetrics-gynecology)"
                  },
                  {
                    "name": "issued",
                    "type": "date",
                    "documentation": "Refine a search for Observation resources by specifying a date or date range that a social-history-based Observation was made available. Enter dates in ISO format (YYYY[-MM[-DD[THH:MM[:SS][TZ]]]]). Local server time is assumed if time zone information is not included."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for Observation resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Search for Observation resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Organization",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Patient",
                "interaction": [
                  {
                    "code": "create"
                  },
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "address",
                    "type": "string",
                    "documentation": "Search for Patient resources using an address string."
                  },
                  {
                    "name": "address-city",
                    "type": "string",
                    "documentation": "Search for Patient resources using the city for a patient's home address. You can use this parameter along with other address parameters."
                  },
                  {
                    "name": "address-postalcode",
                    "type": "string",
                    "documentation": "Search for Patient resources using the postal code for a patient's home address. You can use this parameter along with other address parameters."
                  },
                  {
                    "name": "address-state",
                    "type": "string",
                    "documentation": "Search for Patient resources using the state for a patient's home address. You can use this parameter along with other address parameters."
                  },
                  {
                    "name": "birthdate",
                    "type": "date",
                    "documentation": "Search for Patient resources using a date of birth in ISO format (YYYY-MM-DD)."
                  },
                  {
                    "name": "doc-type",
                    "type": "token",
                    "documentation": "Search for Patient resources using Singapore document type. This parameter is only used in Singapore environment and is only respected if a Singapore document ID is passed in as one of the identifiers."
                  },
                  {
                    "name": "family",
                    "type": "string",
                    "documentation": "Search for Patient resources by family (last) name. You can use the family parameter along with other name parameters to search by a patient's name. Family name searching supports exact matching, \"sounds like\" matching, and patient aliases."
                  },
                  {
                    "name": "gender",
                    "type": "token",
                    "documentation": "Search for Patient resources using the following gender codes: female, male, other, or unknown."
                  },
                  {
                    "name": "given",
                    "type": "string",
                    "documentation": "Search for Patient resources by given (first) name.  You can use the given parameter along with other name parameters to search by a patient's name. Given name searching supports both exact and \"sounds like\" matches. Patient aliases and dominant name aliases (ex. Bob for Robert) are also supported."
                  },
                  {
                    "name": "identifier",
                    "type": "token",
                    "documentation": "Search for Patient resources by a patient's identifier. You can use the identifier parameter as the only parameter in a search or in conjunction with other parameters. A patient's identifier must be in the format {<code system>|}<code> or {<ID Type>|}<ID>."
                  },
                  {
                    "name": "legal-sex",
                    "type": "token",
                    "documentation": "Search for Patient resources using the following gender codes: female, male, nonbinary, x, other, or unknown."
                  },
                  {
                    "name": "name",
                    "type": "string",
                    "documentation": "Search for Patient resources by a patient's name. To search on specific name parts use the name part parameters, such as family or given. This parameter is ignored if any name part parameters are used."
                  },
                  {
                    "name": "own-name",
                    "type": "string",
                    "documentation": "Search for Patient resources by patient's own last name, usually used in non-US names. You can use the own-name parameter along with other name parameters to search by a patient's name."
                  },
                  {
                    "name": "own-prefix",
                    "type": "string",
                    "documentation": "Search for Patient resources by patient's own last name prefix, usually used in non-US names. You can use the own-prefix parameter along with other name parameters to search by a patient's name, but own-name must also be included."
                  },
                  {
                    "name": "partner-name",
                    "type": "string",
                    "documentation": "Search for Patient resources by patient's spouse's last name, usually used in non-US names. You can use the partner-name parameter along with other name parameters to search by a patient's name, but own-name must also be included."
                  },
                  {
                    "name": "partner-prefix",
                    "type": "string",
                    "documentation": "Search for Patient resources by patient's spouse's last name prefix, usually used in non-US names. You can use the partner-prefix parameter along with other name parameters to search by a patient's name, but own-name must also be included."
                  },
                  {
                    "name": "telecom",
                    "type": "token",
                    "documentation": "Search for Patient resources using a patient's home phone number, cell phone number, or email address."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Practitioner",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "address",
                    "type": "string",
                    "documentation": "Any part of an address (street, city, etc.) where a practitioner can be visited. When used, family is also required.  Only respected if no other address parameters are populated. Only the first instance of this parameter is respected."
                  },
                  {
                    "name": "address-city",
                    "type": "string",
                    "documentation": "The city where a practitioner can be visited. When used, address-state is also required. Only the first instance of this parameter is respected."
                  },
                  {
                    "name": "address-postalcode",
                    "type": "string",
                    "documentation": "The zip code where a practitioner can be found. When used, family is also required."
                  },
                  {
                    "name": "address-state",
                    "type": "string",
                    "documentation": "The state where a practitioner can be found.  When used, family is also required.  Only the first instance of this parameter is respected."
                  },
                  {
                    "name": "family",
                    "type": "string",
                    "documentation": "A practitioner's family (last) name. Only the first instance of this parameter is respected."
                  },
                  {
                    "name": "given",
                    "type": "string",
                    "documentation": "A practitioner's given (first) name.  When used, family is also required. Only the first instance of this parameter is respected."
                  },
                  {
                    "name": "identifier",
                    "type": "token",
                    "documentation": "A practitioner's identifier in the format <code system>|<code>.  When this parameter is provided, all others (except _id) are ignored."
                  },
                  {
                    "name": "name",
                    "type": "string",
                    "documentation": "Any part of a practitioner's name.  For full names, format should be first last. When specified, family and given are ignored. Only the first instance of this parameter is respected."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "PractitionerRole",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "email",
                    "type": "token",
                    "documentation": "Refine a search for a PractitionerRole by entering a valid email address.  Code system is ignored."
                  },
                  {
                    "name": "identifier",
                    "type": "token",
                    "documentation": "Search for PractitionerRoles using identifiers. A code system is required. The code must be prepended with URN:OID.  Some codes may need to be URL encoded prior to query."
                  },
                  {
                    "name": "location",
                    "type": "reference",
                    "documentation": "Search for PractitionerRoles using a Location ID. Only the first instance of this parameter is respected."
                  },
                  {
                    "name": "organization",
                    "type": "reference",
                    "documentation": "Search for PractitionerRoles using an Organization ID. Only the first instance of this parameter is respected."
                  },
                  {
                    "name": "phone",
                    "type": "token",
                    "documentation": "Refine a search for a PractitionerRole by entering a valid phone number.  Code system is ignored."
                  },
                  {
                    "name": "practitioner",
                    "type": "reference",
                    "documentation": "Search for PractitionerRoles for a specified Practitioner ID. Only the first instance of this parameter is respected."
                  },
                  {
                    "name": "role",
                    "type": "token",
                    "documentation": "Refine a search for a PractitionerRole by entering a valid role.  System must be included."
                  },
                  {
                    "name": "specialty",
                    "type": "token",
                    "documentation": "Search for PractitionerRoles for a given specialty.  A code system is required.  Depending on the organization, NUCC may be supported."
                  },
                  {
                    "name": "telecom",
                    "type": "token",
                    "documentation": "Refine a search for a PractitionerRole for a specific telecom.  System must be specified as either 'phone' or 'email'"
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Procedure",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "category",
                    "type": "token",
                    "documentation": "Refine a search for Procedure resources by category. Only the following values are supported: 103693007 (diagnostic procedures), 387713003 (surgical procedures), 9632001 (nursing procedures, Netherlands only), and 225317005 or freedom-restricting-intervention (restricting intervention, Netherlands only) are supported."
                  },
                  {
                    "name": "date",
                    "type": "date",
                    "documentation": "Refine a search for Procedure resources by specifying a date or date range that a Procedure was resulted. Enter dates in ISO format (YYYY[-MM[-DD]]). Not supported by nursing procedures or restricting interventions."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for Procedure resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Search for Procedure resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Provenance",
                "interaction": [
                  {
                    "code": "read"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported"
              },
              {
                "type": "Questionnaire",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "QuestionnaireResponse",
                "interaction": [
                  {
                    "code": "create"
                  },
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "encounter",
                    "type": "reference",
                    "documentation": "Search for QuestionnaireResponses by encounter"
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for QuestionnaireResponses for a specified patient. You can also use \"subject\" equivalently"
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Search for QuestionnaireResponses for a specified patient or research subject. You can also use \"patient\" equivalently if subject references a patient."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "RelatedPerson",
                "interaction": [
                  {
                    "code": "read"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported"
              },
              {
                "type": "RequestGroup",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "ResearchStudy",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "identifier",
                    "type": "token",
                    "documentation": "Search for the ResearchStudy resource for a specified study code."
                  },
                  {
                    "name": "status",
                    "type": "token",
                    "documentation": "Search for the ResearchStudy resource for a specified status"
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "ResearchSubject",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for the ResearchSubject resources related to a specified patient"
                  },
                  {
                    "name": "status",
                    "type": "token",
                    "documentation": "Search for the ResearchSubject resources for a specified status."
                  },
                  {
                    "name": "study",
                    "type": "reference",
                    "documentation": "Search for the ResearchSubject resources related to a specified study"
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "ServiceRequest",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "category",
                    "type": "token",
                    "documentation": "Refine a search for ServiceRequests of a particular category. By default, all ServiceRequests are returned."
                  },
                  {
                    "name": "encounter",
                    "type": "reference",
                    "documentation": "Search for ServiceRequest resources for specific encounters. If not provided, all ServiceRequest results are returned."
                  },
                  {
                    "name": "onlyscannable",
                    "type": "token",
                    "documentation": "Refine a search for ServiceRequest resources to scannable only. By default, all ServiceRequests are returned. Use a value of \"true\" to only return scannable ServiceRequests. Can only be used when the application is launched from Hyperspace."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search ServiceRequest resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "requester",
                    "type": "reference",
                    "documentation": "Refine a search for ServiceRequest resources by individual making the request. By default, all ServiceRequests are returned."
                  },
                  {
                    "name": "status",
                    "type": "token",
                    "documentation": "Refine a search for ServiceRequest resources by status. By default, all ServiceRequests are returned. Statuses of draft, active, completed, revoked, and unknown are supported."
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Search ServiceRequest resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Specimen",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Substance",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "Task",
                "interaction": [
                  {
                    "code": "read"
                  },
                  {
                    "code": "search-type"
                  },
                  {
                    "code": "update"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported",
                "searchInclude": [
                  "*"
                ],
                "searchRevInclude": [
                  "Provenance:target"
                ],
                "searchParam": [
                  {
                    "name": "code",
                    "type": "token",
                    "documentation": "Specify community-resource for CRRN tasks, episode-checklist for Episode Checklist tasks. When nothing is specified, all valid tasks are returned."
                  },
                  {
                    "name": "encounter",
                    "type": "reference",
                    "documentation": "Further refine the search for a task by specifying the encounter associated with the task. For Episode Checklist tasks, only tasks created in this encounter will be returned."
                  },
                  {
                    "name": "focus",
                    "type": "reference",
                    "documentation": "Specify the EpisodeOfCare FHIR ID to search for Episode Checklist tasks."
                  },
                  {
                    "name": "patient",
                    "type": "reference",
                    "documentation": "Search for Task resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "status",
                    "type": "token",
                    "documentation": "Restrict the search for tasks based on task status. Only respected by Episode Checklist tasks."
                  },
                  {
                    "name": "subject",
                    "type": "reference",
                    "documentation": "Search for Task resources for a specified patient ID. You can use \"patient\" or \"subject\" equivalently, but they cannot be used at the same time for different references."
                  },
                  {
                    "name": "_id",
                    "type": "token",
                    "documentation": "FHIR resource IDs for the desired resources. If _id is used in a search, all other parameters will be ignored."
                  },
                  {
                    "name": "_count",
                    "type": "number",
                    "documentation": "Number of results per page."
                  }
                ]
              },
              {
                "type": "ValueSet",
                "interaction": [
                  {
                    "code": "read"
                  }
                ],
                "readHistory": false,
                "updateCreate": false,
                "conditionalCreate": false,
                "conditionalRead": "not-supported",
                "conditionalUpdate": false,
                "conditionalDelete": "not-supported"
              }
            ]
          }
        ]
      }
    }
    
    ```
    
- Working Chart Data
    
    ```json
    {
      "pk": "patientChart#eTjDDWfopD0BnRlyEO2mGZQ3",
      "externalId": "eTjDDWfopD0BnRlyEO2mGZQ3",
      "images": "data:image/svg+xml;base64",
      "patient": {
        "dob": "1980-06-20",
        "first": "John",
        "gender": "male",
        "id": "eTjDDWfopD0BnRlyEO2mGZQ3",
        "last": "Grand Central"
      },
      "practitioner": {
        "first": "User",
        "id": "evNp-KhYwOOqAZn1pZ2enuA3",
        "last": "Interconnect"
      },
      "problemList": [
        {
          "date": "2013-10-19",
          "day": 18,
          "description": "Fever with chills",
          "icd10": "R50.9",
          "id": "exjm3OnWbjjF13mb55txF4A3",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 34,
            "hidden": false,
            "ringcolor": "#0F8CDB",
            "width": 34
          },
          "month": 10,
          "offset": 60,
          "x": 12.124355652982148,
          "y": 6.9999999999999885,
          "year": 2013
        }
      ]
    }
    
    ```
    
- Current Chart (Prod)
    
    ```json
    {
      "pk": "patientChart#e3Sh76e3F5d7gMoebhYoUDw3",
      "externalId": "e3Sh76e3F5d7gMoebhYoUDw3",
      "images": "",
      "patient": {
        "dob": "1956-03-03",
        "first": "Kathleen",
        "gender": "female",
        "id": "e3Sh76e3F5d7gMoebhYoUDw3",
        "last": "Alexander"
      },
      "practitioner": {
        "first": "David",
        "id": "eE-KiH93.bIR17hJK5ydFFQ3",
        "last": "Clarkson"
      },
      "problemList": [
        {
          "date": "2013-10-01",
          "day": 30,
          "description": "Rib contusion",
          "icd10": "428016006",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 9,
          "offset": 66,
          "x": 20,
          "y": -0.000000000000007347880794884118,
          "year": 2013
        },
        {
          "date": "2014-07-21",
          "day": 20,
          "description": "Viral meningitis",
          "icd10": "58170007",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 60,
          "x": 6.999999999999989,
          "y": -12.124355652982148,
          "year": 2014
        },
        {
          "date": "2014-07-21",
          "day": 20,
          "description": "Neck pain",
          "icd10": "81680005",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 60,
          "x": 6.999999999999989,
          "y": -12.124355652982148,
          "year": 2014
        },
        {
          "date": "2014-07-21",
          "day": 20,
          "description": "Neck stiffness",
          "icd10": "161882006",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 60,
          "x": 6.999999999999989,
          "y": -12.124355652982148,
          "year": 2014
        },
        {
          "date": "2014-07-21",
          "day": 20,
          "description": "Alcoholism (*)",
          "icd10": "7200002",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 60,
          "x": 6.999999999999989,
          "y": -12.124355652982148,
          "year": 2014
        },
        {
          "date": "2014-07-21",
          "day": 20,
          "description": "History of hypertension",
          "icd10": "161501007",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 60,
          "x": 6.999999999999989,
          "y": -12.124355652982148,
          "year": 2014
        },
        {
          "date": "2014-07-21",
          "day": 20,
          "description": "Hyponatremia",
          "icd10": "89627008",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 60,
          "x": 6.999999999999989,
          "y": -12.124355652982148,
          "year": 2014
        },
        {
          "date": "2016-01-06",
          "day": 5,
          "description": "Headache",
          "icd10": "25064002",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 48,
          "x": -1.0000000000000002,
          "y": 1.7320508075688772,
          "year": 2016
        },
        {
          "date": "2016-01-06",
          "day": 5,
          "description": "Essential hypertension",
          "icd10": "59621000",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 48,
          "x": -1.0000000000000002,
          "y": 1.7320508075688772,
          "year": 2016
        },
        {
          "date": "2016-10-12",
          "day": 11,
          "description": "Pneumonia of right upper lobe due to infectious organism",
          "icd10": "301004001",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 48,
          "x": 1.7320508075688783,
          "y": 0.9999999999999983,
          "year": 2016
        },
        {
          "date": "2016-10-12",
          "day": 11,
          "description": "Chronic obstructive pulmonary disease (*)",
          "icd10": "13645005",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 48,
          "x": 1.7320508075688783,
          "y": 0.9999999999999983,
          "year": 2016
        },
        {
          "date": "2016-10-12",
          "day": 11,
          "description": "Tobacco abuse",
          "icd10": "110483000",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 48,
          "x": 1.7320508075688783,
          "y": 0.9999999999999983,
          "year": 2016
        },
        {
          "date": "2017-07-05",
          "day": 4,
          "description": "Neuralgia of lower extremity",
          "icd10": "10601006",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 42,
          "x": -1.999999999999997,
          "y": 3.4641016151377566,
          "year": 2017
        },
        {
          "date": "2017-12-07",
          "day": 6,
          "description": "Pneumonia of right lower lobe due to infectious organism",
          "icd10": "301001009",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 42,
          "x": -0.0000000000000017145055188062944,
          "y": -4,
          "year": 2017
        },
        {
          "date": "2017-12-07",
          "day": 6,
          "description": "Shortness of breath",
          "icd10": "267036007",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 42,
          "x": -0.0000000000000017145055188062944,
          "y": -4,
          "year": 2017
        },
        {
          "date": "2017-12-07",
          "day": 6,
          "description": "Hypoxia",
          "icd10": "389086002",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 42,
          "x": -0.0000000000000017145055188062944,
          "y": -4,
          "year": 2017
        },
        {
          "date": "2017-12-07",
          "day": 6,
          "description": "COPD exacerbation (*)",
          "icd10": "195951007",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 42,
          "x": -0.0000000000000017145055188062944,
          "y": -4,
          "year": 2017
        },
        {
          "date": "2017-12-07",
          "day": 6,
          "description": "Pulmonary vascular congestion",
          "icd10": "304523003",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 42,
          "x": -0.0000000000000017145055188062944,
          "y": -4,
          "year": 2017
        },
        {
          "date": "2017-12-07",
          "day": 6,
          "description": "Sepsis, due to unspecified organism",
          "icd10": "91302008",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 42,
          "x": -0.0000000000000017145055188062944,
          "y": -4,
          "year": 2017
        },
        {
          "date": "2017-12-07",
          "day": 6,
          "description": "Malignant hypertension",
          "icd10": "70272006",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 42,
          "x": -0.0000000000000017145055188062944,
          "y": -4,
          "year": 2017
        },
        {
          "date": "2017-12-07",
          "day": 6,
          "description": "Hypomagnesemia",
          "icd10": "190855004",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 42,
          "x": -0.0000000000000017145055188062944,
          "y": -4,
          "year": 2017
        },
        {
          "date": "2017-12-07",
          "day": 6,
          "description": "Uncomplicated alcohol dependence (*)",
          "icd10": "66590003",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 42,
          "x": -0.0000000000000017145055188062944,
          "y": -4,
          "year": 2017
        },
        {
          "date": "2017-12-07",
          "day": 6,
          "description": "Chronic obstructive pulmonary disease, unspecified COPD type (*)",
          "icd10": "13645005",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 42,
          "x": -0.0000000000000017145055188062944,
          "y": -4,
          "year": 2017
        },
        {
          "date": "2018-03-23",
          "day": 22,
          "description": "COPD with acute exacerbation (*)",
          "icd10": "195951007",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 3,
          "offset": 36,
          "x": 10,
          "y": -0.0000000000000024492935982947065,
          "year": 2018
        },
        {
          "date": "2018-03-23",
          "day": 22,
          "description": "Hypokalemia",
          "icd10": "43339004",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 3,
          "offset": 36,
          "x": 10,
          "y": -0.0000000000000024492935982947065,
          "year": 2018
        },
        {
          "date": "2021-02-24",
          "day": 23,
          "description": "Hypochloremia",
          "forSVG": [
            120.04324532017614,
            69.30700000000006
          ],
          "icd10": "10399008",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 2,
          "offset": 18,
          "x": 24.248711305964274,
          "y": -14.000000000000012,
          "year": 2021
        },
        {
          "date": "2021-02-24",
          "day": 23,
          "description": "Near syncope",
          "forSVG": [
            120.04324532017614,
            69.30700000000006
          ],
          "icd10": "427461000",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 2,
          "offset": 18,
          "x": 24.248711305964274,
          "y": -14.000000000000012,
          "year": 2021
        },
        {
          "date": "2021-02-24",
          "day": 23,
          "description": "Functional diarrhea",
          "forSVG": [
            120.04324532017614,
            69.30700000000006
          ],
          "icd10": "47812002",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 2,
          "offset": 18,
          "x": 24.248711305964274,
          "y": -14.000000000000012,
          "year": 2021
        },
        {
          "date": "2021-06-14",
          "day": 13,
          "description": "Aortoiliac occlusive disease (*)",
          "forSVG": [
            0.00000000000004243829785425281,
            -138.614
          ],
          "icd10": "10749961000119104",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 6,
          "offset": 18,
          "x": 0.000000000000008572527594031473,
          "y": 28,
          "year": 2021
        },
        {
          "date": "2021-10-11",
          "day": 10,
          "description": "Postmenopausal",
          "forSVG": [
            -120.04324532017624,
            69.30699999999989
          ],
          "icd10": "76498008",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 18,
          "x": -24.248711305964296,
          "y": -13.999999999999977,
          "year": 2021
        },
        {
          "date": "2021-11-29",
          "day": 28,
          "description": "Hyponatremia",
          "forSVG": [
            -69.30700000000019,
            120.04324532017607
          ],
          "icd10": "89627008",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 11,
          "offset": 18,
          "x": -14.000000000000037,
          "y": -24.24871130596426,
          "year": 2021
        },
        {
          "date": "2021-11-29",
          "day": 28,
          "description": "Migraine without aura and without status migrainosus, not intractable",
          "forSVG": [
            -69.30700000000019,
            120.04324532017607
          ],
          "icd10": "425007008",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 11,
          "offset": 18,
          "x": -14.000000000000037,
          "y": -24.24871130596426,
          "year": 2021
        },
        {
          "date": "2021-11-29",
          "day": 28,
          "description": "Dizziness",
          "forSVG": [
            -69.30700000000019,
            120.04324532017607
          ],
          "icd10": "162260006",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 11,
          "offset": 18,
          "x": -14.000000000000037,
          "y": -24.24871130596426,
          "year": 2021
        },
        {
          "date": "2021-11-29",
          "day": 28,
          "description": "Hypokalemia",
          "forSVG": [
            -69.30700000000019,
            120.04324532017607
          ],
          "icd10": "43339004",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 11,
          "offset": 18,
          "x": -14.000000000000037,
          "y": -24.24871130596426,
          "year": 2021
        },
        {
          "date": "2021-11-29",
          "day": 28,
          "description": "Serum chloride decreased",
          "forSVG": [
            -69.30700000000019,
            120.04324532017607
          ],
          "icd10": "10399008",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 11,
          "offset": 18,
          "x": -14.000000000000037,
          "y": -24.24871130596426,
          "year": 2021
        },
        {
          "date": "2021-11-29",
          "day": 28,
          "description": "Elevated troponin",
          "forSVG": [
            -69.30700000000019,
            120.04324532017607
          ],
          "icd10": "405740000",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 11,
          "offset": 18,
          "x": -14.000000000000037,
          "y": -24.24871130596426,
          "year": 2021
        },
        {
          "date": "2022-02-25",
          "day": 24,
          "description": "Iron deficiency anemia secondary to inadequate dietary iron intake",
          "forSVG": [
            145.7667978887853,
            84.15850000000007
          ],
          "icd10": "371315009",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 2,
          "offset": 12,
          "x": 29.444863728670903,
          "y": -17.000000000000014,
          "year": 2022
        },
        {
          "date": "2022-12-13",
          "day": 12,
          "description": "Age-related osteoporosis without current pathological fracture",
          "forSVG": [
            -0.00000000000007214510635222976,
            168.317
          ],
          "icd10": "18040001",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 12,
          "x": -0.0000000000000145732969098535,
          "y": -34,
          "year": 2022
        },
        {
          "date": "2022-12-13",
          "day": 12,
          "description": "Primary malignant neoplasm of female breast (*)",
          "forSVG": [
            -0.00000000000007214510635222976,
            168.317
          ],
          "icd10": "93796005",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 12,
          "x": -0.0000000000000145732969098535,
          "y": -34,
          "year": 2022
        },
        {
          "date": "2023-01-26",
          "day": 25,
          "description": "Acute exacerbation of chronic obstructive pulmonary disease (COPD) (*)",
          "forSVG": [
            99.01000000000002,
            171.49035045739453
          ],
          "icd10": "195951007",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 6,
          "x": 20.000000000000004,
          "y": -34.64101615137754,
          "year": 2023
        },
        {
          "date": "2023-03-21",
          "day": 20,
          "description": "Chronic pain of right knee",
          "forSVG": [
            198.01999999999998,
            0.000000000000048500911833431775
          ],
          "icd10": "1003722009",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 3,
          "offset": 6,
          "x": 40,
          "y": -0.000000000000009797174393178826,
          "year": 2023
        },
        {
          "date": "2023-05-09",
          "day": 8,
          "description": "NSTEMI (non-ST elevated myocardial infarction) (*)",
          "forSVG": [
            99.0100000000001,
            -171.49035045739447
          ],
          "icd10": "22298006",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 5,
          "offset": 6,
          "x": 20.00000000000002,
          "y": 34.641016151377535,
          "year": 2023
        },
        {
          "date": "2023-05-10",
          "day": 9,
          "description": "Coronary artery disease involving native coronary artery of native heart without angina pectoris",
          "forSVG": [
            99.0100000000001,
            -171.49035045739447
          ],
          "icd10": "53741008",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 5,
          "offset": 6,
          "x": 20.00000000000002,
          "y": 34.641016151377535,
          "year": 2023
        },
        {
          "date": "2023-05-10",
          "day": 9,
          "description": "Ischemic cardiomyopathy",
          "forSVG": [
            99.0100000000001,
            -171.49035045739447
          ],
          "icd10": "281091000",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 5,
          "offset": 6,
          "x": 20.00000000000002,
          "y": 34.641016151377535,
          "year": 2023
        },
        {
          "date": "2023-05-18",
          "day": 17,
          "description": "S/P coronary artery stent placement",
          "forSVG": [
            99.0100000000001,
            -171.49035045739447
          ],
          "icd10": "128926000",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 5,
          "offset": 6,
          "x": 20.00000000000002,
          "y": 34.641016151377535,
          "year": 2023
        },
        {
          "date": "2023-05-18",
          "day": 17,
          "description": "HFrEF (heart failure with reduced ejection fraction) (*)",
          "forSVG": [
            99.0100000000001,
            -171.49035045739447
          ],
          "icd10": "703272007",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 5,
          "offset": 6,
          "x": 20.00000000000002,
          "y": 34.641016151377535,
          "year": 2023
        },
        {
          "date": "2023-05-18",
          "day": 17,
          "description": "Polyarthritis",
          "forSVG": [
            99.0100000000001,
            -171.49035045739447
          ],
          "icd10": "36186002",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 5,
          "offset": 6,
          "x": 20.00000000000002,
          "y": 34.641016151377535,
          "year": 2023
        },
        {
          "date": "2023-07-12",
          "day": 11,
          "description": "Acute respiratory failure with hypoxia and hypercapnia (*)",
          "forSVG": [
            -99.00999999999983,
            -171.4903504573946
          ],
          "icd10": "735386008",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 6,
          "x": -19.999999999999968,
          "y": 34.64101615137756,
          "year": 2023
        },
        {
          "date": "2023-07-12",
          "day": 11,
          "description": "Acute on chronic respiratory failure with hypoxia and hypercapnia (*)",
          "forSVG": [
            -99.00999999999983,
            -171.4903504573946
          ],
          "icd10": "20091000175107",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 6,
          "x": -19.999999999999968,
          "y": 34.64101615137756,
          "year": 2023
        },
        {
          "date": "2023-07-12",
          "day": 11,
          "description": "Normocytic anemia",
          "forSVG": [
            -99.00999999999983,
            -171.4903504573946
          ],
          "icd10": "300980002",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 6,
          "x": -19.999999999999968,
          "y": 34.64101615137756,
          "year": 2023
        },
        {
          "date": "2023-07-12",
          "day": 11,
          "description": "Chronic systolic heart failure (*)",
          "forSVG": [
            -99.00999999999983,
            -171.4903504573946
          ],
          "icd10": "441481004",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 6,
          "x": -19.999999999999968,
          "y": 34.64101615137756,
          "year": 2023
        },
        {
          "date": "2023-07-12",
          "day": 11,
          "description": "Acute respiratory failure with hypoxia and hypercapnia (*)",
          "forSVG": [
            -99.00999999999983,
            -171.4903504573946
          ],
          "icd10": "735386008",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 6,
          "x": -19.999999999999968,
          "y": 34.64101615137756,
          "year": 2023
        },
        {
          "date": "2023-07-12",
          "day": 11,
          "description": "COPD with acute exacerbation (*)",
          "forSVG": [
            -99.00999999999983,
            -171.4903504573946
          ],
          "icd10": "195951007",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 6,
          "x": -19.999999999999968,
          "y": 34.64101615137756,
          "year": 2023
        },
        {
          "date": "2023-07-24",
          "day": 23,
          "description": "S/P coronary artery stent placement",
          "forSVG": [
            -99.00999999999983,
            -171.4903504573946
          ],
          "icd10": "128926000",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 6,
          "x": -19.999999999999968,
          "y": 34.64101615137756,
          "year": 2023
        },
        {
          "date": "2023-07-24",
          "day": 23,
          "description": "Chronic kidney disease, stage III (moderate)",
          "forSVG": [
            -99.00999999999983,
            -171.4903504573946
          ],
          "icd10": "433144002",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 6,
          "x": -19.999999999999968,
          "y": 34.64101615137756,
          "year": 2023
        },
        {
          "date": "2023-08-23",
          "day": 22,
          "description": "Acute exacerbation of chronic obstructive pulmonary disease (COPD) (*)",
          "forSVG": [
            -171.49035045739458,
            -99.00999999999996
          ],
          "icd10": "195951007",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 6,
          "x": -34.641016151377556,
          "y": 19.999999999999993,
          "year": 2023
        },
        {
          "date": "2023-08-24",
          "day": 23,
          "description": "Pneumonia of right lower lobe due to infectious organism",
          "forSVG": [
            -171.49035045739458,
            -99.00999999999996
          ],
          "icd10": "301001009",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 6,
          "x": -34.641016151377556,
          "y": 19.999999999999993,
          "year": 2023
        },
        {
          "date": "2023-08-24",
          "day": 23,
          "description": "Acute respiratory failure with hypoxia (*)",
          "forSVG": [
            -171.49035045739458,
            -99.00999999999996
          ],
          "icd10": "389086002",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 6,
          "x": -34.641016151377556,
          "y": 19.999999999999993,
          "year": 2023
        },
        {
          "date": "2023-08-24",
          "day": 23,
          "description": "Sepsis, due to unspecified organism, unspecified whether acute organ dysfunction present (*)",
          "forSVG": [
            -171.49035045739458,
            -99.00999999999996
          ],
          "icd10": "91302008",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 6,
          "x": -34.641016151377556,
          "y": 19.999999999999993,
          "year": 2023
        },
        {
          "date": "2023-08-24",
          "day": 23,
          "description": "Chronic hyponatremia",
          "forSVG": [
            -171.49035045739458,
            -99.00999999999996
          ],
          "icd10": "50327002",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 6,
          "x": -34.641016151377556,
          "y": 19.999999999999993,
          "year": 2023
        },
        {
          "date": "2023-08-29",
          "day": 28,
          "description": "Abnormal mammogram",
          "forSVG": [
            -171.49035045739458,
            -99.00999999999996
          ],
          "icd10": "168750009",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 6,
          "x": -34.641016151377556,
          "y": 19.999999999999993,
          "year": 2023
        },
        {
          "date": "2023-08-29",
          "day": 28,
          "description": "Functional urinary incontinence",
          "forSVG": [
            -171.49035045739458,
            -99.00999999999996
          ],
          "icd10": "129847007",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 6,
          "x": -34.641016151377556,
          "y": 19.999999999999993,
          "year": 2023
        },
        {
          "date": "2023-08-29",
          "day": 28,
          "description": "Chronic hypoxemic respiratory failure (*)",
          "forSVG": [
            -171.49035045739458,
            -99.00999999999996
          ],
          "icd10": "428173007",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 6,
          "x": -34.641016151377556,
          "y": 19.999999999999993,
          "year": 2023
        },
        {
          "date": "2023-09-09",
          "day": 8,
          "description": "Respiratory distress",
          "forSVG": [
            -198.01999999999998,
            -0.00000000000007275136775014766
          ],
          "icd10": "271825005",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 9,
          "offset": 6,
          "x": -40,
          "y": 0.000000000000014695761589768237,
          "year": 2023
        },
        {
          "date": "2023-09-10",
          "day": 9,
          "description": "Acute on chronic diastolic heart failure (*)",
          "forSVG": [
            -198.01999999999998,
            -0.00000000000007275136775014766
          ],
          "icd10": "443344007",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 9,
          "offset": 6,
          "x": -40,
          "y": 0.000000000000014695761589768237,
          "year": 2023
        },
        {
          "date": "2023-09-10",
          "day": 9,
          "description": "Pulmonary vascular congestion",
          "forSVG": [
            -198.01999999999998,
            -0.00000000000007275136775014766
          ],
          "icd10": "304523003",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 9,
          "offset": 6,
          "x": -40,
          "y": 0.000000000000014695761589768237,
          "year": 2023
        },
        {
          "date": "2023-09-10",
          "day": 9,
          "description": "Community acquired pneumonia, bilateral",
          "forSVG": [
            -198.01999999999998,
            -0.00000000000007275136775014766
          ],
          "icd10": "407671000",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 9,
          "offset": 6,
          "x": -40,
          "y": 0.000000000000014695761589768237,
          "year": 2023
        },
        {
          "date": "2023-09-10",
          "day": 9,
          "description": "Sepsis due to pneumonia (*)",
          "forSVG": [
            -198.01999999999998,
            -0.00000000000007275136775014766
          ],
          "icd10": "91302008",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 9,
          "offset": 6,
          "x": -40,
          "y": 0.000000000000014695761589768237,
          "year": 2023
        },
        {
          "date": "2023-09-10",
          "day": 9,
          "description": "Chronic anemia",
          "forSVG": [
            -198.01999999999998,
            -0.00000000000007275136775014766
          ],
          "icd10": "191268006",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 9,
          "offset": 6,
          "x": -40,
          "y": 0.000000000000014695761589768237,
          "year": 2023
        },
        {
          "date": "2023-09-10",
          "day": 9,
          "description": "Acute on chronic renal insufficiency",
          "forSVG": [
            -198.01999999999998,
            -0.00000000000007275136775014766
          ],
          "icd10": "723190009",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 9,
          "offset": 6,
          "x": -40,
          "y": 0.000000000000014695761589768237,
          "year": 2023
        },
        {
          "date": "2023-10-01",
          "day": 30,
          "description": "Acute exacerbation of chronic obstructive pulmonary disease (COPD) (*)",
          "forSVG": [
            -198.01999999999998,
            -0.00000000000007275136775014766
          ],
          "icd10": "195951007",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 9,
          "offset": 6,
          "x": -40,
          "y": 0.000000000000014695761589768237,
          "year": 2023
        },
        {
          "date": "2023-10-11",
          "day": 10,
          "description": "Osteoporosis",
          "forSVG": [
            -171.4903504573946,
            99.00999999999983
          ],
          "icd10": "64859006",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 6,
          "x": -34.64101615137756,
          "y": -19.999999999999968,
          "year": 2023
        },
        {
          "date": "2023-10-30",
          "day": 29,
          "description": "Acute on chronic systolic (congestive) heart failure (*)",
          "forSVG": [
            -171.4903504573946,
            99.00999999999983
          ],
          "icd10": "698296002",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 6,
          "x": -34.64101615137756,
          "y": -19.999999999999968,
          "year": 2023
        },
        {
          "date": "2023-10-30",
          "day": 29,
          "description": "Renal insufficiency",
          "forSVG": [
            -171.4903504573946,
            99.00999999999983
          ],
          "icd10": "723188008",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 6,
          "x": -34.64101615137756,
          "y": -19.999999999999968,
          "year": 2023
        },
        {
          "date": "2023-10-30",
          "day": 29,
          "description": "SIRS (systemic inflammatory response syndrome) (*)",
          "forSVG": [
            -171.4903504573946,
            99.00999999999983
          ],
          "icd10": "238149007",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 6,
          "x": -34.64101615137756,
          "y": -19.999999999999968,
          "year": 2023
        },
        {
          "date": "2023-11-12",
          "day": 11,
          "description": "Hypoxia",
          "forSVG": [
            -99.01000000000026,
            171.49035045739438
          ],
          "icd10": "389086002",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 11,
          "offset": 6,
          "x": -20.000000000000053,
          "y": -34.641016151377514,
          "year": 2023
        },
        {
          "date": "2023-11-12",
          "day": 11,
          "description": "Uncontrolled hypertension",
          "forSVG": [
            -99.01000000000026,
            171.49035045739438
          ],
          "icd10": "28876000",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 11,
          "offset": 6,
          "x": -20.000000000000053,
          "y": -34.641016151377514,
          "year": 2023
        },
        {
          "date": "2023-12-06",
          "day": 5,
          "description": "Stage 2 chronic kidney disease",
          "forSVG": [
            -0.00000000000008487659570850562,
            198.01999999999998
          ],
          "icd10": "431856006",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 6,
          "x": -0.000000000000017145055188062946,
          "y": -40,
          "year": 2023
        },
        {
          "date": "2024-01-01",
          "day": 31,
          "description": "Chronic obstructive pulmonary disease, unspecified COPD type (*)",
          "forSVG": [
            -0.00000000000008487659570850562,
            198.01999999999998
          ],
          "icd10": "13645005",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 6,
          "x": -0.000000000000017145055188062946,
          "y": -40,
          "year": 2023
        },
        {
          "date": "2024-01-11",
          "day": 10,
          "description": "B12 deficiency",
          "forSVG": [
            113.86150000000002,
            197.2139030260037
          ],
          "icd10": "190634004",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 0,
          "x": 23.000000000000004,
          "y": -39.837168574084174,
          "year": 2024
        },
        {
          "date": "2024-01-28",
          "day": 27,
          "description": "SVT (supraventricular tachycardia) (*)",
          "forSVG": [
            113.86150000000002,
            197.2139030260037
          ],
          "icd10": "6456007",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 0,
          "x": 23.000000000000004,
          "y": -39.837168574084174,
          "year": 2024
        },
        {
          "date": "2024-01-28",
          "day": 27,
          "description": "Acute on chronic congestive heart failure, unspecified heart failure type (*)",
          "forSVG": [
            113.86150000000002,
            197.2139030260037
          ],
          "icd10": "96311000119109",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 0,
          "x": 23.000000000000004,
          "y": -39.837168574084174,
          "year": 2024
        },
        {
          "date": "2024-06-13",
          "day": 12,
          "description": "Claudication of left lower extremity (*)",
          "forSVG": [
            0.00000000000006972006076055819,
            -227.72299999999998
          ],
          "icd10": "116312005",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 6,
          "offset": 0,
          "x": 0.000000000000014083438190194563,
          "y": 46,
          "year": 2024
        },
        {
          "date": "2024-06-13",
          "day": 12,
          "description": "Pain of left lower extremity",
          "forSVG": [
            0.00000000000006972006076055819,
            -227.72299999999998
          ],
          "icd10": "287047008",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 6,
          "offset": 0,
          "x": 0.000000000000014083438190194563,
          "y": 46,
          "year": 2024
        },
        {
          "date": "2024-07-12",
          "day": 11,
          "description": "Cerebrovascular accident (CVA) (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "230690007",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-12",
          "day": 11,
          "description": "PCO (posterior capsular opacification), bilateral",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "15737281000119100",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-12",
          "day": 11,
          "description": "Early stage nonexudative age-related macular degeneration of both eyes",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "788913001",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-12",
          "day": 11,
          "description": "OAG (open angle glaucoma) suspect, low risk, bilateral",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "1279548003",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-12",
          "day": 11,
          "description": "Pseudophakia of both eyes",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "309523001",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-17",
          "day": 16,
          "description": "Chest pain, unspecified type",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "29857009",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-17",
          "day": 16,
          "description": "Acute respiratory failure with hypoxia (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "389086002",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-17",
          "day": 16,
          "description": "Flash pulmonary edema (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "360371003",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-17",
          "day": 16,
          "description": "Hypertensive emergency",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "132721000119104",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-17",
          "day": 16,
          "description": "Tachycardia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "3424008",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-17",
          "day": 16,
          "description": "Anemia requiring transfusions",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "271737000",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chest pain, unspecified type",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R07.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Acute respiratory failure with hypoxia (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J96.01",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Flash pulmonary edema (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J81.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypertensive emergency",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I16.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Tachycardia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R00.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Anemia requiring transfusions",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "D64.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Cerebrovascular accident (CVA), unspecified mechanism (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I63.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Ischemic cardiomyopathy",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I25.5",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Cerebrovascular accident (CVA), unspecified mechanism (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I63.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "PCO (posterior capsular opacification), bilateral",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "H26.493",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Early stage nonexudative age-related macular degeneration of both eyes",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "H35.3131",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "OAG (open angle glaucoma) suspect, low risk, bilateral",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "H40.013",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Pseudophakia of both eyes",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z96.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Congestive heart failure, unspecified HF chronicity, unspecified heart failure type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I50.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Claudication of left lower extremity (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I73.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Pain of left lower extremity",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M79.605",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Peripheral vascular disease, unspecified (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I73.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Anemia, unspecified type",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "D64.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "B12 deficiency",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E53.8",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Peripheral vascular disease, unspecified (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I73.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Encounter for Medicare annual wellness exam",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z00.00",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic obstructive pulmonary disease, unspecified COPD type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Stage 2 chronic kidney disease",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "N18.2",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "B12 deficiency",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E53.8",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic anemia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "D64.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Coronary artery disease involving native coronary artery of native heart without angina pectoris",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I25.10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Congestive heart failure, unspecified HF chronicity, unspecified heart failure type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I50.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Aortoiliac occlusive disease (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I74.09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic hypoxemic respiratory failure (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "799.02",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Primary malignant neoplasm of female breast (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "C50.919",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Congestive heart failure, unspecified HF chronicity, unspecified heart failure type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I50.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Gastroesophageal reflux disease without esophagitis",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "K21.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Allergic rhinitis due to pollen, unspecified seasonality",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J30.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Systolic congestive heart failure, unspecified HF chronicity (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "428.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Coronary artery disease involving native coronary artery of native heart without angina pectoris",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I25.10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hospital discharge follow-up",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Coronary artery disease involving native coronary artery of native heart without angina pectoris",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I25.10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic obstructive pulmonary disease, unspecified COPD type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Uncontrolled hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic obstructive pulmonary disease, unspecified COPD type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Claudication of left lower extremity (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I73.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Systolic heart failure secondary to hypertension (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "428.20",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Respiratory distress",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R06.03",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "SVT (supraventricular tachycardia) (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I47.10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Acute on chronic congestive heart failure, unspecified heart failure type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I50.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Acute exacerbation of chronic obstructive pulmonary disease (COPD) (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Decreased ambulation status",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z74.09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Anemia, unspecified type",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "D64.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hyperglycemia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R73.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hospital discharge follow-up",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic obstructive pulmonary disease, unspecified COPD type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Uncontrolled hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Stage 2 chronic kidney disease",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "N18.2",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "B12 deficiency",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E53.8",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hyperglycemia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R73.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Anemia, unspecified type",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "D64.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Respiratory distress",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R06.03",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypoxia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R09.02",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic obstructive pulmonary disease, unspecified COPD type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Primary malignant neoplasm of female breast (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "C50.919",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Acute on chronic respiratory failure with hypoxia and hypercapnia (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "786.09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "S/P coronary artery stent placement",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z95.5",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "SIRS (systemic inflammatory response syndrome) (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R65.10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Congestive heart failure, unspecified HF chronicity, unspecified heart failure type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I50.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Acute on chronic renal insufficiency",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "585.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Pulmonary vascular congestion",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R09.89",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Encounter for Medicare annual wellness exam",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z00.00",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic obstructive pulmonary disease, unspecified COPD type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Uncontrolled hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Ischemic cardiomyopathy",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I25.5",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Coronary artery disease involving native coronary artery of native heart without angina pectoris",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I25.10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Stage 2 chronic kidney disease",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "N18.2",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Restless legs",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "G25.81",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Tobacco abuse",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z72.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Acute on chronic respiratory failure with hypoxia and hypercapnia (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "786.09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypoxia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R09.02",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Uncontrolled hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hyponatremia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hospital discharge follow-up",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic obstructive pulmonary disease, unspecified COPD type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hyponatremia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Coronary artery disease involving native coronary artery of native heart without angina pectoris",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I25.10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Normocytic anemia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "D64.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Stopped smoking",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z87.891",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Need for prophylactic vaccination against Streptococcus pneumoniae (pneumococcus)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z23",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "COPD exacerbation (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Congestive heart failure, unspecified HF chronicity, unspecified heart failure type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I50.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Acute exacerbation of chronic obstructive pulmonary disease (COPD) (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Renal insufficiency",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "N28.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "SIRS (systemic inflammatory response syndrome) (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R65.10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "S/P coronary artery stent placement",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z95.5",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Decreased ambulation status",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z74.09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Anemia, unspecified type",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "D64.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hospital discharge follow-up",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic obstructive pulmonary disease, unspecified COPD type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Tobacco abuse",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z72.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Anemia, unspecified type",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "D64.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Coronary artery disease involving native coronary artery of native heart without angina pectoris",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I25.10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Gastroesophageal reflux disease without esophagitis",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "K21.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Acute exacerbation of chronic obstructive pulmonary disease (COPD) (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Respiratory distress",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R06.03",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Acute on chronic diastolic heart failure (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I50.33",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Pulmonary vascular congestion",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R09.89",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "COPD exacerbation (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Community acquired pneumonia, bilateral",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J18.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Sepsis due to pneumonia (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "995.91",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic anemia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "D64.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hyponatremia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Acute on chronic renal insufficiency",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "585.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "History of atrial fibrillation",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z86.79",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hospital discharge follow-up",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic hypoxemic respiratory failure (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "799.02",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Ischemic cardiomyopathy",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I25.5",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Iron deficiency anemia due to chronic blood loss",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "D50.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Tobacco abuse",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z72.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Pneumonia of right lower lobe due to infectious organism",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J18.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Acute exacerbation of chronic obstructive pulmonary disease (COPD) (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Acute respiratory failure with hypoxia (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J96.01",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Sepsis, due to unspecified organism, unspecified whether acute organ dysfunction present (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "995.91",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hyponatremia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Acute on chronic respiratory failure with hypoxia and hypercapnia (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "786.09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Acute exacerbation of chronic obstructive pulmonary disease (COPD) (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Greater trochanteric pain syndrome of left lower extremity",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M25.552",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Sciatica of left side",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M54.32",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Atherosclerosis of native arteries of extremities with rest pain, right leg (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I70.221",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Atherosclerosis of native arteries of extremities with rest pain, right leg (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I70.221",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Atherosclerosis of native arteries of extremities with rest pain, right leg (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I70.221",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Atherosclerosis of native artery of right lower extremity with rest pain (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I70.221",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Claudication of left lower extremity (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I73.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Encounter for screening mammogram for breast cancer",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z12.31",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Encounter for screening mammogram for breast cancer",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z12.31",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hospital discharge follow-up",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hospital discharge follow-up",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "HFrEF (heart failure with reduced ejection fraction) (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I50.20",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Allergic rhinitis due to pollen, unspecified seasonality",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J30.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Coronary artery disease involving native coronary artery of native heart without angina pectoris",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I25.10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Encounter for screening mammogram for breast cancer",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z12.31",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Blood loss anemia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "D50.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "HFrEF (heart failure with reduced ejection fraction) (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I50.20",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Acute respiratory failure with hypoxia and hypercapnia (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J96.01",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "COPD with acute exacerbation (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "DDD (degenerative disc disease), lumbar",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M51.36",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "DDD (degenerative disc disease), lumbar",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M51.36",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Vascular claudication (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I73.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Neurogenic claudication",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R29.818",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Spondylosis of lumbar spine",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M47.816",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Deformity, acquired",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M95.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Lumbar radiculopathy",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M54.16",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "DDD (degenerative disc disease), lumbar",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M51.36",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "ERRONEOUS ENCOUNTER--DISREGARD",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "10000",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hospital discharge follow-up",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Coronary artery disease involving native coronary artery of native heart without angina pectoris",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I25.10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "HFrEF (heart failure with reduced ejection fraction) (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I50.20",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hospital discharge follow-up",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Coronary artery disease involving native coronary artery of native heart without angina pectoris",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I25.10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "S/P coronary artery stent placement",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z95.5",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "HFrEF (heart failure with reduced ejection fraction) (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I50.20",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Polyarthritis",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M13.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic obstructive pulmonary disease, unspecified COPD type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypertensive urgency",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I16.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "NSTEMI (non-ST elevated myocardial infarction) (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I21.4",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "COPD exacerbation (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypoxia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R09.02",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Elevated troponin",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R79.89",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "MI, acute, non ST segment elevation (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I21.4",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Greater trochanteric pain syndrome of left lower extremity",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M25.552",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Sciatica of left side",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M54.32",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Greater trochanteric pain syndrome of left lower extremity",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M25.552",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Sciatica of left side",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M54.32",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Right hip pain",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M25.551",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "DDD (degenerative disc disease), lumbar",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M51.36",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Sciatica associated with disorder of lumbar spine",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M53.86",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Allergic rhinitis due to pollen, unspecified seasonality",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J30.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Lateral knee pain, right",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M25.561",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic pain of right knee",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "338.29",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic pain of both lower extremities",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "338.29",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic pain of both lower extremities",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "338.29",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Right leg pain",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M79.604",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hospital discharge follow-up",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic hyponatremia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "AKI (acute kidney injury) (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "N17.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic obstructive pulmonary disease, unspecified COPD type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Tobacco abuse",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z72.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Acute exacerbation of chronic obstructive pulmonary disease (COPD) (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypertensive urgency",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I16.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypertension, unspecified type",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic diarrhea",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "K52.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Allergic rhinitis due to pollen, unspecified seasonality",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J30.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic obstructive pulmonary disease, unspecified COPD type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Greater trochanteric pain syndrome of left lower extremity",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M25.552",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Sciatica of left side",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M54.32",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Flu vaccine need",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z23",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Diarrhea, unspecified type",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R19.7",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hyponatremia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Vertigo",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R42",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Allergic rhinitis due to pollen, unspecified seasonality",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J30.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Dizziness",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R42",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Iron deficiency anemia secondary to inadequate dietary iron intake",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "D50.8",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Encounter for Medicare annual wellness exam",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z00.00",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic obstructive pulmonary disease, unspecified COPD type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Aortoiliac occlusive disease (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I74.09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Tobacco abuse",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z72.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Iron deficiency anemia secondary to inadequate dietary iron intake",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "D50.8",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Greater trochanteric pain syndrome of left lower extremity",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M25.552",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Sciatica of left side",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M54.32",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Screening for colon cancer",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z12.11",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Iron deficiency anemia, unspecified iron deficiency anemia type",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "D50.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Iron deficiency anemia secondary to inadequate dietary iron intake",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "D50.8",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Tobacco abuse",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z72.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Tobacco abuse",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z72.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Iron deficiency anemia, unspecified iron deficiency anemia type",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "D50.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Migraine without aura and without status migrainosus, not intractable",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "G43.009",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Microcytic anemia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "D50.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypertensive urgency",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I16.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Uncomplicated alcohol dependence (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "F10.20",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Migraine without aura and without status migrainosus, not intractable",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "G43.009",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Microcytic anemia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "D50.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Need for prophylactic vaccination against Streptococcus pneumoniae (pneumococcus)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z23",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hospital discharge follow-up",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hyponatremia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypokalemia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.6",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hospital discharge follow-up",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hyponatremia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypokalemia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.6",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Tobacco abuse",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z72.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Alcoholism (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "F10.20",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Tension headache",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "G44.209",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Migraine without aura and without status migrainosus, not intractable",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "G43.009",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Dizziness",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R42",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypokalemia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.6",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hyponatremia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Serum chloride decreased",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.8",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Elevated troponin",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R79.89",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Uncontrolled stage 2 hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Tobacco abuse",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z72.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Uncomplicated alcohol dependence (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "F10.20",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Asymptomatic hypertensive urgency",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I16.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Tobacco abuse",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z72.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Alcoholism (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "F10.20",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Screening for diabetes mellitus (DM)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z13.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Screening for hyperlipidemia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z13.220",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Need for hepatitis C screening test",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z11.59",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Encounter to establish care with new doctor",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z76.89",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Tobacco abuse",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z72.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Asymptomatic hypertensive urgency",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I16.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic obstructive pulmonary disease, unspecified COPD type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Flu vaccine need",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z23",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Screening for diabetes mellitus (DM)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z13.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Screening for hyperlipidemia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z13.220",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Need for hepatitis C screening test",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z11.59",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Postmenopausal",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z78.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Migraine without aura and without status migrainosus, not intractable",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "G43.009",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Screening for lung cancer",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z12.2",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Left upper quadrant abdominal pain",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R10.12",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Gastritis, presence of bleeding unspecified, unspecified chronicity, unspecified gastritis type",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "K29.70",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Aortoiliac occlusive disease (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I74.09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hyponatremia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypochloremia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.8",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Near syncope",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R55",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Functional diarrhea",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "K59.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Tobacco abuse",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z72.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic obstructive pulmonary disease, unspecified COPD type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Current tobacco use",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z72.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Contact dermatitis due to poison sumac",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "L23.7",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypertensive urgency",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I16.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "COPD with acute exacerbation (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hyponatremia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypoxia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R09.02",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Acute URI",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J06.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Mixed incontinence",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "N39.46",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Obstructive chronic bronchitis with acute exacerbation (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Obstructive chronic bronchitis with acute exacerbation (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Allergic dermatitis due to poison sumac",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "L23.7",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "COPD with acute exacerbation (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypokalemia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.6",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hyponatremia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "On home oxygen therapy",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z99.81",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Nicotine use disorder",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "F17.200",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "History of coronary artery disease",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z86.79",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "COPD with acute exacerbation (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "COPD with acute exacerbation (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypoxia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R09.02",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypokalemia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.6",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic obstructive pulmonary disease, unspecified COPD type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hyponatremia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "COPD exacerbation (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Pneumonia of right lower lobe due to infectious organism",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J18.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Shortness of breath",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R06.02",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypoxia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R09.02",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Tobacco abuse",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z72.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hyponatremia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "COPD exacerbation (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Pulmonary vascular congestion",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R09.89",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Sepsis, due to unspecified organism",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "995.91",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Malignant hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypomagnesemia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E83.42",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Uncomplicated alcohol dependence (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "F10.20",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic obstructive pulmonary disease, unspecified COPD type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Neuralgia of lower extremity, left",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M79.2",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "COPD exacerbation (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "History of COPD",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z87.09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic bronchitis with acute exacerbation (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "491.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hyponatremia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Tobacco dependence",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "F17.200",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypertension, uncontrolled",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "History of hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z86.79",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Musculoskeletal leg pain, left",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M79.605",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypokalemia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.6",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Pneumonia of right upper lobe due to infectious organism",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J18.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chronic obstructive pulmonary disease, unspecified COPD type (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Tobacco abuse",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z72.0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Wrist sprain, right, initial encounter",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "S63.501A",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Essential hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Headache, unspecified headache type",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R51.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Viral meningitis",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "A87.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Neck pain",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M54.2",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Neck stiffness",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "M43.6",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Alcoholism (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "F10.20",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "History of hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "Z86.79",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hyponatremia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "COPD exacerbation (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Bronchitis",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J40",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hyponatremia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Rib contusion",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "S20.219A",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Chest pain, unspecified type",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R07.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Respiratory distress",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R06.03",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Respiratory distress",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R06.03",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Acute on chronic respiratory failure with hypoxia and hypercapnia (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "786.09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "COPD exacerbation (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Acute exacerbation of chronic obstructive pulmonary disease (COPD) (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Respiratory distress",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "R06.03",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Acute on chronic respiratory failure with hypoxia and hypercapnia (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "786.09",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Acute respiratory failure with hypoxia and hypercapnia (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J96.01",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "NSTEMI (non-ST elevated myocardial infarction) (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I21.4",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Acute exacerbation of chronic obstructive pulmonary disease (COPD) (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hyponatremia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hyponatremia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E87.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2017-12-12T18:21:53Z",
          "day": 12,
          "description": "ESBL",
          "icd10": "409802002",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 42,
          "x": -0.0000000000000017145055188062944,
          "y": -4,
          "year": 2017
        },
        {
          "date": "2022-12-10T23:43:42Z",
          "day": 10,
          "description": "C. Difficile Rule Out",
          "forSVG": [
            -0.00000000000007214510635222976,
            168.317
          ],
          "icd10": "439597005",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 12,
          "x": -0.0000000000000145732969098535,
          "y": -34,
          "year": 2022
        },
        {
          "date": "2023-01-26T23:45:01Z",
          "day": 26,
          "description": "COVID-19 Rule Out",
          "forSVG": [
            99.01000000000002,
            171.49035045739453
          ],
          "icd10": "840544004",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 6,
          "x": 20.000000000000004,
          "y": -34.64101615137754,
          "year": 2023
        },
        {
          "date": "2023-07-12T04:07:44Z",
          "day": 11,
          "description": "COVID-19 Rule Out",
          "forSVG": [
            -99.00999999999983,
            -171.4903504573946
          ],
          "icd10": "840544004",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 6,
          "x": -19.999999999999968,
          "y": 34.64101615137756,
          "year": 2023
        },
        {
          "date": "2023-11-12T04:06:11Z",
          "day": 11,
          "description": "C. Difficile Rule Out",
          "forSVG": [
            -99.01000000000026,
            171.49035045739438
          ],
          "icd10": "439597005",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 11,
          "offset": 6,
          "x": -20.000000000000053,
          "y": -34.641016151377514,
          "year": 2023
        },
        {
          "date": "2023-11-12T05:37:59Z",
          "day": 11,
          "description": "COVID-19 Rule Out",
          "forSVG": [
            -99.01000000000026,
            171.49035045739438
          ],
          "icd10": "840544004",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 11,
          "offset": 6,
          "x": -20.000000000000053,
          "y": -34.641016151377514,
          "year": 2023
        },
        {
          "date": "2024-01-01T05:38:12Z",
          "day": 31,
          "description": "COVID-19 Rule Out",
          "forSVG": [
            -0.00000000000008487659570850562,
            198.01999999999998
          ],
          "icd10": "840544004",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 6,
          "x": -0.000000000000017145055188062946,
          "y": -40,
          "year": 2023
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hypertension",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Alcoholism /alcohol abuse",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "IMO0001",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Cancer (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "C80.1",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "COPD (chronic obstructive pulmonary disease) (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "J44.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "CAD (coronary artery disease)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I25.10",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "NSTEMI (non-ST elevated myocardial infarction) (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I21.4",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Cardiomyopathy, ischemic",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I25.5",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "VHD (valvular heart disease)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I38",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Hyperlipidemia",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "E78.5",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "PVD (peripheral vascular disease) (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "I73.9",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-18",
          "day": 17,
          "description": "Breast cancer (*)",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "C50.919",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-17T14:45:13Z",
          "day": 17,
          "description": "Consultation",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "443",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-17T00:00:42Z",
          "day": 16,
          "description": "Chest Pain",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "100000",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-12T17:19:24Z",
          "day": 12,
          "description": "Medication Refill",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "160383",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-07-12T15:33:19Z",
          "day": 12,
          "description": "New Patient",
          "forSVG": [
            -113.86149999999982,
            -197.21390302600383
          ],
          "icd10": "341",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 0,
          "x": -22.999999999999964,
          "y": 39.8371685740842,
          "year": 2024
        },
        {
          "date": "2024-06-13T16:07:07Z",
          "day": 13,
          "description": "Follow-up",
          "forSVG": [
            0.00000000000006972006076055819,
            -227.72299999999998
          ],
          "icd10": "110033",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 6,
          "offset": 0,
          "x": 0.000000000000014083438190194563,
          "y": 46,
          "year": 2024
        },
        {
          "date": "2024-06-05T20:11:18Z",
          "day": 5,
          "description": "Return Phone Call",
          "forSVG": [
            0.00000000000006972006076055819,
            -227.72299999999998
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 6,
          "offset": 0,
          "x": 0.000000000000014083438190194563,
          "y": 46,
          "year": 2024
        },
        {
          "date": "2024-06-03T16:17:07Z",
          "day": 3,
          "description": "Return Phone Call",
          "forSVG": [
            0.00000000000006972006076055819,
            -227.72299999999998
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 6,
          "offset": 0,
          "x": 0.000000000000014083438190194563,
          "y": 46,
          "year": 2024
        },
        {
          "date": "2024-05-23T19:36:28Z",
          "day": 23,
          "description": "Return Phone Call",
          "forSVG": [
            113.86150000000012,
            -197.21390302600366
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 5,
          "offset": 0,
          "x": 23.000000000000025,
          "y": 39.83716857408417,
          "year": 2024
        },
        {
          "date": "2024-05-22T16:24:57Z",
          "day": 22,
          "description": "Abnormal Lab",
          "forSVG": [
            113.86150000000012,
            -197.21390302600366
          ],
          "icd10": "200101",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 5,
          "offset": 0,
          "x": 23.000000000000025,
          "y": 39.83716857408417,
          "year": 2024
        },
        {
          "date": "2024-05-21T18:01:02Z",
          "day": 21,
          "description": "Return Phone Call",
          "forSVG": [
            113.86150000000012,
            -197.21390302600366
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 5,
          "offset": 0,
          "x": 23.000000000000025,
          "y": 39.83716857408417,
          "year": 2024
        },
        {
          "date": "2024-05-20T16:28:02Z",
          "day": 20,
          "description": "Return Phone Call",
          "forSVG": [
            113.86150000000012,
            -197.21390302600366
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 5,
          "offset": 0,
          "x": 23.000000000000025,
          "y": 39.83716857408417,
          "year": 2024
        },
        {
          "date": "2024-05-20T19:13:06Z",
          "day": 20,
          "description": "Check-up",
          "forSVG": [
            113.86150000000012,
            -197.21390302600366
          ],
          "icd10": "405",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 5,
          "offset": 0,
          "x": 23.000000000000025,
          "y": 39.83716857408417,
          "year": 2024
        },
        {
          "date": "2024-04-09T21:35:32Z",
          "day": 9,
          "description": "Return Phone Call",
          "forSVG": [
            197.2139030260037,
            -113.86149999999999
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 4,
          "offset": 0,
          "x": 39.837168574084174,
          "y": 23,
          "year": 2024
        },
        {
          "date": "2024-04-09T21:10:51Z",
          "day": 9,
          "description": "Return Phone Call",
          "forSVG": [
            197.2139030260037,
            -113.86149999999999
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 4,
          "offset": 0,
          "x": 39.837168574084174,
          "y": 23,
          "year": 2024
        },
        {
          "date": "2024-04-09T21:10:26Z",
          "day": 9,
          "description": "Return Phone Call",
          "forSVG": [
            197.2139030260037,
            -113.86149999999999
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 4,
          "offset": 0,
          "x": 39.837168574084174,
          "y": 23,
          "year": 2024
        },
        {
          "date": "2024-04-04T16:33:50Z",
          "day": 4,
          "description": "Medication Refill",
          "forSVG": [
            197.2139030260037,
            -113.86149999999999
          ],
          "icd10": "160383",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 4,
          "offset": 0,
          "x": 39.837168574084174,
          "y": 23,
          "year": 2024
        },
        {
          "date": "2024-03-12T16:53:07Z",
          "day": 12,
          "description": "Return Phone Call",
          "forSVG": [
            227.72299999999998,
            0.000000000000055776048608446543
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 3,
          "offset": 0,
          "x": 46,
          "y": -0.00000000000001126675055215565,
          "year": 2024
        },
        {
          "date": "2024-03-01T20:09:29Z",
          "day": 1,
          "description": "Return Phone Call",
          "forSVG": [
            227.72299999999998,
            0.000000000000055776048608446543
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 3,
          "offset": 0,
          "x": 46,
          "y": -0.00000000000001126675055215565,
          "year": 2024
        },
        {
          "date": "2024-02-20T20:16:28Z",
          "day": 20,
          "description": "Hospital Follow-up",
          "forSVG": [
            197.21390302600366,
            113.8615000000001
          ],
          "icd10": "324",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 2,
          "offset": 0,
          "x": 39.83716857408417,
          "y": -23.00000000000002,
          "year": 2024
        },
        {
          "date": "2024-02-16T18:30:15Z",
          "day": 16,
          "description": "Medication Refill",
          "forSVG": [
            197.21390302600366,
            113.8615000000001
          ],
          "icd10": "160383",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 2,
          "offset": 0,
          "x": 39.83716857408417,
          "y": -23.00000000000002,
          "year": 2024
        },
        {
          "date": "2024-02-08T17:04:21Z",
          "day": 8,
          "description": "Follow-up",
          "forSVG": [
            197.21390302600366,
            113.8615000000001
          ],
          "icd10": "110033",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 2,
          "offset": 0,
          "x": 39.83716857408417,
          "y": -23.00000000000002,
          "year": 2024
        },
        {
          "date": "2024-02-07T20:23:50Z",
          "day": 7,
          "description": "Return Phone Call",
          "forSVG": [
            197.21390302600366,
            113.8615000000001
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 2,
          "offset": 0,
          "x": 39.83716857408417,
          "y": -23.00000000000002,
          "year": 2024
        },
        {
          "date": "2024-02-01T17:32:13Z",
          "day": 1,
          "description": "Return Phone Call",
          "forSVG": [
            197.21390302600366,
            113.8615000000001
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 2,
          "offset": 0,
          "x": 39.83716857408417,
          "y": -23.00000000000002,
          "year": 2024
        },
        {
          "date": "2024-01-28T02:11:25Z",
          "day": 27,
          "description": "Respiratory Distress",
          "forSVG": [
            113.86150000000002,
            197.2139030260037
          ],
          "icd10": "160490",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 0,
          "x": 23.000000000000004,
          "y": -39.837168574084174,
          "year": 2024
        },
        {
          "date": "2024-01-11T19:26:53Z",
          "day": 11,
          "description": "Hospital Follow-up",
          "forSVG": [
            113.86150000000002,
            197.2139030260037
          ],
          "icd10": "324",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 0,
          "x": 23.000000000000004,
          "y": -39.837168574084174,
          "year": 2024
        },
        {
          "date": "2024-01-01T03:22:55Z",
          "day": 31,
          "description": "Respiratory Distress",
          "forSVG": [
            -0.00000000000008487659570850562,
            198.01999999999998
          ],
          "icd10": "160490",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 6,
          "x": -0.000000000000017145055188062946,
          "y": -40,
          "year": 2023
        },
        {
          "date": "2023-12-06T20:06:26Z",
          "day": 6,
          "description": "Hospital Follow-up",
          "forSVG": [
            -0.00000000000008487659570850562,
            198.01999999999998
          ],
          "icd10": "324",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 6,
          "x": -0.000000000000017145055188062946,
          "y": -40,
          "year": 2023
        },
        {
          "date": "2023-11-14T21:35:34Z",
          "day": 14,
          "description": "Return Phone Call",
          "forSVG": [
            -99.01000000000026,
            171.49035045739438
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 11,
          "offset": 6,
          "x": -20.000000000000053,
          "y": -34.641016151377514,
          "year": 2023
        },
        {
          "date": "2023-11-14T20:04:07Z",
          "day": 14,
          "description": "Return Phone Call",
          "forSVG": [
            -99.01000000000026,
            171.49035045739438
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 11,
          "offset": 6,
          "x": -20.000000000000053,
          "y": -34.641016151377514,
          "year": 2023
        },
        {
          "date": "2023-11-12T02:23:26Z",
          "day": 11,
          "description": "Respiratory Distress",
          "forSVG": [
            -99.01000000000026,
            171.49035045739438
          ],
          "icd10": "160490",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 11,
          "offset": 6,
          "x": -20.000000000000053,
          "y": -34.641016151377514,
          "year": 2023
        },
        {
          "date": "2023-11-08T16:19:14Z",
          "day": 8,
          "description": "Hospital Follow-up",
          "forSVG": [
            -99.01000000000026,
            171.49035045739438
          ],
          "icd10": "324",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 11,
          "offset": 6,
          "x": -20.000000000000053,
          "y": -34.641016151377514,
          "year": 2023
        },
        {
          "date": "2023-11-03T18:08:31Z",
          "day": 3,
          "description": "Return Phone Call",
          "forSVG": [
            -99.01000000000026,
            171.49035045739438
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 11,
          "offset": 6,
          "x": -20.000000000000053,
          "y": -34.641016151377514,
          "year": 2023
        },
        {
          "date": "2023-10-30T01:25:20Z",
          "day": 29,
          "description": "Respiratory Distress",
          "forSVG": [
            -171.4903504573946,
            99.00999999999983
          ],
          "icd10": "160490",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 6,
          "x": -34.64101615137756,
          "y": -19.999999999999968,
          "year": 2023
        },
        {
          "date": "2023-10-11T18:07:04Z",
          "day": 11,
          "description": "Hospital Follow-up",
          "forSVG": [
            -171.4903504573946,
            99.00999999999983
          ],
          "icd10": "324",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 6,
          "x": -34.64101615137756,
          "y": -19.999999999999968,
          "year": 2023
        },
        {
          "date": "2023-10-11T18:07:04Z",
          "day": 11,
          "description": "Medication Refill",
          "forSVG": [
            -171.4903504573946,
            99.00999999999983
          ],
          "icd10": "160383",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 6,
          "x": -34.64101615137756,
          "y": -19.999999999999968,
          "year": 2023
        },
        {
          "date": "2023-10-06T18:13:59Z",
          "day": 6,
          "description": "Return Phone Call",
          "forSVG": [
            -171.4903504573946,
            99.00999999999983
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 6,
          "x": -34.64101615137756,
          "y": -19.999999999999968,
          "year": 2023
        },
        {
          "date": "2023-10-02T03:09:18Z",
          "day": 1,
          "description": "Chest Pain",
          "forSVG": [
            -171.4903504573946,
            99.00999999999983
          ],
          "icd10": "100000",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 6,
          "x": -34.64101615137756,
          "y": -19.999999999999968,
          "year": 2023
        },
        {
          "date": "2023-10-02T03:09:18Z",
          "day": 1,
          "description": "COPD",
          "forSVG": [
            -171.4903504573946,
            99.00999999999983
          ],
          "icd10": "362",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 6,
          "x": -34.64101615137756,
          "y": -19.999999999999968,
          "year": 2023
        },
        {
          "date": "2023-10-02T03:09:18Z",
          "day": 1,
          "description": "Atrial Fibrillation",
          "forSVG": [
            -171.4903504573946,
            99.00999999999983
          ],
          "icd10": "80",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 6,
          "x": -34.64101615137756,
          "y": -19.999999999999968,
          "year": 2023
        },
        {
          "date": "2023-10-02T03:09:18Z",
          "day": 1,
          "description": "Respiratory Distress",
          "forSVG": [
            -171.4903504573946,
            99.00999999999983
          ],
          "icd10": "160490",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 6,
          "x": -34.64101615137756,
          "y": -19.999999999999968,
          "year": 2023
        },
        {
          "date": "2023-10-02T03:09:18Z",
          "day": 1,
          "description": "Hypertension",
          "forSVG": [
            -171.4903504573946,
            99.00999999999983
          ],
          "icd10": "160302",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 6,
          "x": -34.64101615137756,
          "y": -19.999999999999968,
          "year": 2023
        },
        {
          "date": "2023-09-15T19:22:15Z",
          "day": 15,
          "description": "Return Phone Call",
          "forSVG": [
            -198.01999999999998,
            -0.00000000000007275136775014766
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 9,
          "offset": 6,
          "x": -40,
          "y": 0.000000000000014695761589768237,
          "year": 2023
        },
        {
          "date": "2023-09-10T01:46:07Z",
          "day": 9,
          "description": "Respiratory Distress",
          "forSVG": [
            -198.01999999999998,
            -0.00000000000007275136775014766
          ],
          "icd10": "160490",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 9,
          "offset": 6,
          "x": -40,
          "y": 0.000000000000014695761589768237,
          "year": 2023
        },
        {
          "date": "2023-09-10T01:46:07Z",
          "day": 9,
          "description": "Atrial Fibrillation",
          "forSVG": [
            -198.01999999999998,
            -0.00000000000007275136775014766
          ],
          "icd10": "80",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 9,
          "offset": 6,
          "x": -40,
          "y": 0.000000000000014695761589768237,
          "year": 2023
        },
        {
          "date": "2023-08-30T21:51:30Z",
          "day": 30,
          "description": "Return Phone Call",
          "forSVG": [
            -171.49035045739458,
            -99.00999999999996
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 6,
          "x": -34.641016151377556,
          "y": 19.999999999999993,
          "year": 2023
        },
        {
          "date": "2023-08-29T14:12:31Z",
          "day": 29,
          "description": "Return Phone Call",
          "forSVG": [
            -171.49035045739458,
            -99.00999999999996
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 6,
          "x": -34.641016151377556,
          "y": 19.999999999999993,
          "year": 2023
        },
        {
          "date": "2023-08-29T16:08:07Z",
          "day": 29,
          "description": "Hospital Follow-up",
          "forSVG": [
            -171.49035045739458,
            -99.00999999999996
          ],
          "icd10": "324",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 6,
          "x": -34.641016151377556,
          "y": 19.999999999999993,
          "year": 2023
        },
        {
          "date": "2023-08-29T16:20:30Z",
          "day": 29,
          "description": "Shortness of Breath",
          "forSVG": [
            -171.49035045739458,
            -99.00999999999996
          ],
          "icd10": "100001",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 6,
          "x": -34.641016151377556,
          "y": 19.999999999999993,
          "year": 2023
        },
        {
          "date": "2023-08-24T01:54:34Z",
          "day": 23,
          "description": "Shortness of Breath",
          "forSVG": [
            -171.49035045739458,
            -99.00999999999996
          ],
          "icd10": "100001",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 6,
          "x": -34.641016151377556,
          "y": 19.999999999999993,
          "year": 2023
        },
        {
          "date": "2023-08-24T01:54:34Z",
          "day": 23,
          "description": "Hypertension",
          "forSVG": [
            -171.49035045739458,
            -99.00999999999996
          ],
          "icd10": "160302",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 6,
          "x": -34.641016151377556,
          "y": 19.999999999999993,
          "year": 2023
        },
        {
          "date": "2023-08-24T01:54:34Z",
          "day": 23,
          "description": "Tachycardia",
          "forSVG": [
            -171.49035045739458,
            -99.00999999999996
          ],
          "icd10": "160481",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 6,
          "x": -34.641016151377556,
          "y": 19.999999999999993,
          "year": 2023
        },
        {
          "date": "2023-08-23T03:59:05Z",
          "day": 22,
          "description": "Shortness of Breath",
          "forSVG": [
            -171.49035045739458,
            -99.00999999999996
          ],
          "icd10": "100001",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 6,
          "x": -34.641016151377556,
          "y": 19.999999999999993,
          "year": 2023
        },
        {
          "date": "2023-08-23T03:59:05Z",
          "day": 22,
          "description": "Chest Pain",
          "forSVG": [
            -171.49035045739458,
            -99.00999999999996
          ],
          "icd10": "100000",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 6,
          "x": -34.641016151377556,
          "y": 19.999999999999993,
          "year": 2023
        },
        {
          "date": "2023-08-23T03:59:05Z",
          "day": 22,
          "description": "Hypertension",
          "forSVG": [
            -171.49035045739458,
            -99.00999999999996
          ],
          "icd10": "160302",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 6,
          "x": -34.641016151377556,
          "y": 19.999999999999993,
          "year": 2023
        },
        {
          "date": "2023-08-11T18:10:31Z",
          "day": 11,
          "description": "Needs Appointment",
          "forSVG": [
            -171.49035045739458,
            -99.00999999999996
          ],
          "icd10": "314",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 6,
          "x": -34.641016151377556,
          "y": 19.999999999999993,
          "year": 2023
        },
        {
          "date": "2023-08-10T14:42:37Z",
          "day": 10,
          "description": "Consultation",
          "forSVG": [
            -171.49035045739458,
            -99.00999999999996
          ],
          "icd10": "443",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 6,
          "x": -34.641016151377556,
          "y": 19.999999999999993,
          "year": 2023
        },
        {
          "date": "2023-07-24T16:44:44Z",
          "day": 24,
          "description": "Follow-up",
          "forSVG": [
            -99.00999999999983,
            -171.4903504573946
          ],
          "icd10": "110033",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 6,
          "x": -19.999999999999968,
          "y": 34.64101615137756,
          "year": 2023
        },
        {
          "date": "2023-07-24T15:53:38Z",
          "day": 24,
          "description": "Transitional Care Management",
          "forSVG": [
            -99.00999999999983,
            -171.4903504573946
          ],
          "icd10": "566",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 6,
          "x": -19.999999999999968,
          "y": 34.64101615137756,
          "year": 2023
        },
        {
          "date": "2023-07-18T18:36:26Z",
          "day": 18,
          "description": "Return Phone Call",
          "forSVG": [
            -99.00999999999983,
            -171.4903504573946
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 6,
          "x": -19.999999999999968,
          "y": 34.64101615137756,
          "year": 2023
        },
        {
          "date": "2023-07-17T16:21:59Z",
          "day": 17,
          "description": "Appointment Information",
          "forSVG": [
            -99.00999999999983,
            -171.4903504573946
          ],
          "icd10": "315",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 6,
          "x": -19.999999999999968,
          "y": 34.64101615137756,
          "year": 2023
        },
        {
          "date": "2023-07-12T17:35:54Z",
          "day": 12,
          "description": "Other",
          "forSVG": [
            -99.00999999999983,
            -171.4903504573946
          ],
          "icd10": "0",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 6,
          "x": -19.999999999999968,
          "y": 34.64101615137756,
          "year": 2023
        },
        {
          "date": "2023-07-12T03:11:15Z",
          "day": 11,
          "description": "Shortness of Breath",
          "forSVG": [
            -99.00999999999983,
            -171.4903504573946
          ],
          "icd10": "100001",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 6,
          "x": -19.999999999999968,
          "y": 34.64101615137756,
          "year": 2023
        },
        {
          "date": "2023-07-10T14:12:28Z",
          "day": 10,
          "description": "Return Phone Call",
          "forSVG": [
            -99.00999999999983,
            -171.4903504573946
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 6,
          "x": -19.999999999999968,
          "y": 34.64101615137756,
          "year": 2023
        },
        {
          "date": "2023-06-27T14:55:31Z",
          "day": 27,
          "description": "Return Phone Call",
          "forSVG": [
            0.00000000000006062613979178972,
            -198.01999999999998
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 6,
          "offset": 6,
          "x": 0.000000000000012246467991473532,
          "y": 40,
          "year": 2023
        },
        {
          "date": "2023-06-12T16:30:05Z",
          "day": 12,
          "description": "Follow-up",
          "forSVG": [
            0.00000000000006062613979178972,
            -198.01999999999998
          ],
          "icd10": "110033",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 6,
          "offset": 6,
          "x": 0.000000000000012246467991473532,
          "y": 40,
          "year": 2023
        },
        {
          "date": "2023-05-18T18:22:17Z",
          "day": 18,
          "description": "Hospital Follow-up",
          "forSVG": [
            99.0100000000001,
            -171.49035045739447
          ],
          "icd10": "324",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 5,
          "offset": 6,
          "x": 20.00000000000002,
          "y": 34.641016151377535,
          "year": 2023
        },
        {
          "date": "2023-05-12T19:22:59Z",
          "day": 12,
          "description": "Appointment Information",
          "forSVG": [
            99.0100000000001,
            -171.49035045739447
          ],
          "icd10": "315",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 5,
          "offset": 6,
          "x": 20.00000000000002,
          "y": 34.641016151377535,
          "year": 2023
        },
        {
          "date": "2023-05-11T14:29:02Z",
          "day": 11,
          "description": "Return Phone Call",
          "forSVG": [
            99.0100000000001,
            -171.49035045739447
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 5,
          "offset": 6,
          "x": 20.00000000000002,
          "y": 34.641016151377535,
          "year": 2023
        },
        {
          "date": "2023-05-11T14:13:53Z",
          "day": 11,
          "description": "Return Phone Call",
          "forSVG": [
            99.0100000000001,
            -171.49035045739447
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 5,
          "offset": 6,
          "x": 20.00000000000002,
          "y": 34.641016151377535,
          "year": 2023
        },
        {
          "date": "2023-05-09T02:57:06Z",
          "day": 8,
          "description": "Shortness of Breath",
          "forSVG": [
            99.0100000000001,
            -171.49035045739447
          ],
          "icd10": "100001",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 5,
          "offset": 6,
          "x": 20.00000000000002,
          "y": 34.641016151377535,
          "year": 2023
        },
        {
          "date": "2023-05-09T02:57:06Z",
          "day": 8,
          "description": "Chest Pain",
          "forSVG": [
            99.0100000000001,
            -171.49035045739447
          ],
          "icd10": "100000",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 5,
          "offset": 6,
          "x": 20.00000000000002,
          "y": 34.641016151377535,
          "year": 2023
        },
        {
          "date": "2023-05-09T02:57:06Z",
          "day": 8,
          "description": "Diarrhea",
          "forSVG": [
            99.0100000000001,
            -171.49035045739447
          ],
          "icd10": "35",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 5,
          "offset": 6,
          "x": 20.00000000000002,
          "y": 34.641016151377535,
          "year": 2023
        },
        {
          "date": "2023-04-24T15:12:17Z",
          "day": 24,
          "description": "Medication Refill",
          "forSVG": [
            171.49035045739453,
            -99.00999999999999
          ],
          "icd10": "160383",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 4,
          "offset": 6,
          "x": 34.64101615137754,
          "y": 20,
          "year": 2023
        },
        {
          "date": "2023-04-21T17:06:35Z",
          "day": 21,
          "description": "Medication Refill",
          "forSVG": [
            171.49035045739453,
            -99.00999999999999
          ],
          "icd10": "160383",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 4,
          "offset": 6,
          "x": 34.64101615137754,
          "y": 20,
          "year": 2023
        },
        {
          "date": "2023-04-13T18:43:02Z",
          "day": 13,
          "description": "Pain",
          "forSVG": [
            171.49035045739453,
            -99.00999999999999
          ],
          "icd10": "136",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 4,
          "offset": 6,
          "x": 34.64101615137754,
          "y": 20,
          "year": 2023
        },
        {
          "date": "2023-04-11T20:12:14Z",
          "day": 11,
          "description": "Return Phone Call",
          "forSVG": [
            171.49035045739453,
            -99.00999999999999
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 4,
          "offset": 6,
          "x": 34.64101615137754,
          "y": 20,
          "year": 2023
        },
        {
          "date": "2023-04-03T15:46:25Z",
          "day": 3,
          "description": "Medication Refill",
          "forSVG": [
            171.49035045739453,
            -99.00999999999999
          ],
          "icd10": "160383",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 4,
          "offset": 6,
          "x": 34.64101615137754,
          "y": 20,
          "year": 2023
        },
        {
          "date": "2023-03-21T21:51:04Z",
          "day": 21,
          "description": "Leg Pain",
          "forSVG": [
            198.01999999999998,
            0.000000000000048500911833431775
          ],
          "icd10": "160357",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 3,
          "offset": 6,
          "x": 40,
          "y": -0.000000000000009797174393178826,
          "year": 2023
        },
        {
          "date": "2023-03-21T20:21:51Z",
          "day": 21,
          "description": "Return Phone Call",
          "forSVG": [
            198.01999999999998,
            0.000000000000048500911833431775
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 3,
          "offset": 6,
          "x": 40,
          "y": -0.000000000000009797174393178826,
          "year": 2023
        },
        {
          "date": "2023-03-13T21:08:08Z",
          "day": 13,
          "description": "Medication Refill",
          "forSVG": [
            198.01999999999998,
            0.000000000000048500911833431775
          ],
          "icd10": "160383",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 3,
          "offset": 6,
          "x": 40,
          "y": -0.000000000000009797174393178826,
          "year": 2023
        },
        {
          "date": "2023-03-06T22:24:05Z",
          "day": 6,
          "description": "Return Phone Call",
          "forSVG": [
            198.01999999999998,
            0.000000000000048500911833431775
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 3,
          "offset": 6,
          "x": 40,
          "y": -0.000000000000009797174393178826,
          "year": 2023
        },
        {
          "date": "2023-03-06T22:23:26Z",
          "day": 6,
          "description": "Return Phone Call",
          "forSVG": [
            198.01999999999998,
            0.000000000000048500911833431775
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 3,
          "offset": 6,
          "x": 40,
          "y": -0.000000000000009797174393178826,
          "year": 2023
        },
        {
          "date": "2023-03-06T16:51:20Z",
          "day": 6,
          "description": "Follow-up",
          "forSVG": [
            198.01999999999998,
            0.000000000000048500911833431775
          ],
          "icd10": "110033",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 3,
          "offset": 6,
          "x": 40,
          "y": -0.000000000000009797174393178826,
          "year": 2023
        },
        {
          "date": "2023-03-03T20:30:12Z",
          "day": 3,
          "description": "Return Phone Call",
          "forSVG": [
            198.01999999999998,
            0.000000000000048500911833431775
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 3,
          "offset": 6,
          "x": 40,
          "y": -0.000000000000009797174393178826,
          "year": 2023
        },
        {
          "date": "2023-03-03T18:45:34Z",
          "day": 3,
          "description": "Return Phone Call",
          "forSVG": [
            198.01999999999998,
            0.000000000000048500911833431775
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 3,
          "offset": 6,
          "x": 40,
          "y": -0.000000000000009797174393178826,
          "year": 2023
        },
        {
          "date": "2023-02-22T17:56:23Z",
          "day": 22,
          "description": "Return Phone Call",
          "forSVG": [
            171.49035045739447,
            99.01000000000009
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 2,
          "offset": 6,
          "x": 34.641016151377535,
          "y": -20.000000000000018,
          "year": 2023
        },
        {
          "date": "2023-02-12T21:55:49Z",
          "day": 12,
          "description": "Leg Pain",
          "forSVG": [
            171.49035045739447,
            99.01000000000009
          ],
          "icd10": "160357",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 2,
          "offset": 6,
          "x": 34.641016151377535,
          "y": -20.000000000000018,
          "year": 2023
        },
        {
          "date": "2023-02-06T16:52:38Z",
          "day": 6,
          "description": "Hospital Follow-up",
          "forSVG": [
            171.49035045739447,
            99.01000000000009
          ],
          "icd10": "324",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 2,
          "offset": 6,
          "x": 34.641016151377535,
          "y": -20.000000000000018,
          "year": 2023
        },
        {
          "date": "2023-02-06T16:52:38Z",
          "day": 6,
          "description": "Hypertension",
          "forSVG": [
            171.49035045739447,
            99.01000000000009
          ],
          "icd10": "160302",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 2,
          "offset": 6,
          "x": 34.641016151377535,
          "y": -20.000000000000018,
          "year": 2023
        },
        {
          "date": "2023-01-30T22:54:03Z",
          "day": 30,
          "description": "Transitional Care Management",
          "forSVG": [
            99.01000000000002,
            171.49035045739453
          ],
          "icd10": "566",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 6,
          "x": 20.000000000000004,
          "y": -34.64101615137754,
          "year": 2023
        },
        {
          "date": "2023-01-26T23:37:18Z",
          "day": 26,
          "description": "Shortness of Breath",
          "forSVG": [
            99.01000000000002,
            171.49035045739453
          ],
          "icd10": "100001",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 6,
          "x": 20.000000000000004,
          "y": -34.64101615137754,
          "year": 2023
        },
        {
          "date": "2023-01-24T17:49:24Z",
          "day": 24,
          "description": "Return Phone Call",
          "forSVG": [
            99.01000000000002,
            171.49035045739453
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 6,
          "x": 20.000000000000004,
          "y": -34.64101615137754,
          "year": 2023
        },
        {
          "date": "2023-01-16T17:20:05Z",
          "day": 16,
          "description": "Referral",
          "forSVG": [
            99.01000000000002,
            171.49035045739453
          ],
          "icd10": "270",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 6,
          "x": 20.000000000000004,
          "y": -34.64101615137754,
          "year": 2023
        },
        {
          "date": "2023-01-16T16:28:00Z",
          "day": 16,
          "description": "Results",
          "forSVG": [
            99.01000000000002,
            171.49035045739453
          ],
          "icd10": "95",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 6,
          "x": 20.000000000000004,
          "y": -34.64101615137754,
          "year": 2023
        },
        {
          "date": "2023-01-13T17:27:10Z",
          "day": 13,
          "description": "Follow-up",
          "forSVG": [
            99.01000000000002,
            171.49035045739453
          ],
          "icd10": "110033",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 6,
          "x": 20.000000000000004,
          "y": -34.64101615137754,
          "year": 2023
        },
        {
          "date": "2023-01-09T18:14:20Z",
          "day": 9,
          "description": "Hypertension",
          "forSVG": [
            99.01000000000002,
            171.49035045739453
          ],
          "icd10": "160302",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 6,
          "x": 20.000000000000004,
          "y": -34.64101615137754,
          "year": 2023
        },
        {
          "date": "2022-12-13T20:34:44Z",
          "day": 13,
          "description": "Hospital Follow-up",
          "forSVG": [
            -0.00000000000007214510635222976,
            168.317
          ],
          "icd10": "324",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 12,
          "x": -0.0000000000000145732969098535,
          "y": -34,
          "year": 2022
        },
        {
          "date": "2022-12-10T22:52:42Z",
          "day": 10,
          "description": "Diarrhea",
          "forSVG": [
            -0.00000000000007214510635222976,
            168.317
          ],
          "icd10": "35",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 12,
          "x": -0.0000000000000145732969098535,
          "y": -34,
          "year": 2022
        },
        {
          "date": "2022-09-06T14:48:44Z",
          "day": 6,
          "description": "Return Phone Call",
          "forSVG": [
            -168.317,
            -0.00000000000006183866258762551
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 9,
          "offset": 12,
          "x": -34,
          "y": 0.000000000000012491397351303002,
          "year": 2022
        },
        {
          "date": "2022-08-08T21:19:19Z",
          "day": 8,
          "description": "Hospital Follow-up",
          "forSVG": [
            -145.7667978887854,
            -84.15849999999996
          ],
          "icd10": "324",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 12,
          "x": -29.44486372867092,
          "y": 16.999999999999993,
          "year": 2022
        },
        {
          "date": "2022-08-08T21:19:19Z",
          "day": 8,
          "description": "Fall",
          "forSVG": [
            -145.7667978887854,
            -84.15849999999996
          ],
          "icd10": "160198",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 12,
          "x": -29.44486372867092,
          "y": 16.999999999999993,
          "year": 2022
        },
        {
          "date": "2022-08-03T18:59:15Z",
          "day": 3,
          "description": "Dizziness",
          "forSVG": [
            -145.7667978887854,
            -84.15849999999996
          ],
          "icd10": "100002",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 12,
          "x": -29.44486372867092,
          "y": 16.999999999999993,
          "year": 2022
        },
        {
          "date": "2022-08-03T18:59:44Z",
          "day": 3,
          "description": "Medication Problem",
          "forSVG": [
            -145.7667978887854,
            -84.15849999999996
          ],
          "icd10": "65",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 12,
          "x": -29.44486372867092,
          "y": 16.999999999999993,
          "year": 2022
        },
        {
          "date": "2022-08-03T18:29:24Z",
          "day": 3,
          "description": "Return Phone Call",
          "forSVG": [
            -145.7667978887854,
            -84.15849999999996
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 12,
          "x": -29.44486372867092,
          "y": 16.999999999999993,
          "year": 2022
        },
        {
          "date": "2022-08-03T15:02:54Z",
          "day": 3,
          "description": "Return Phone Call",
          "forSVG": [
            -145.7667978887854,
            -84.15849999999996
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 12,
          "x": -29.44486372867092,
          "y": 16.999999999999993,
          "year": 2022
        },
        {
          "date": "2022-08-01T14:41:10Z",
          "day": 1,
          "description": "Medicare Annual Wellness Visit",
          "forSVG": [
            -145.7667978887854,
            -84.15849999999996
          ],
          "icd10": "311",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 12,
          "x": -29.44486372867092,
          "y": 16.999999999999993,
          "year": 2022
        },
        {
          "date": "2022-08-01T14:43:37Z",
          "day": 1,
          "description": "Leg Pain",
          "forSVG": [
            -145.7667978887854,
            -84.15849999999996
          ],
          "icd10": "160357",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 12,
          "x": -29.44486372867092,
          "y": 16.999999999999993,
          "year": 2022
        },
        {
          "date": "2022-06-03T17:42:09Z",
          "day": 3,
          "description": "Medication Refill",
          "forSVG": [
            0.000000000000051532218823021265,
            -168.317
          ],
          "icd10": "160383",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 6,
          "offset": 12,
          "x": 0.000000000000010409497792752503,
          "y": 34,
          "year": 2022
        },
        {
          "date": "2022-05-17T16:27:42Z",
          "day": 17,
          "description": "Medication Refill",
          "forSVG": [
            84.15850000000009,
            -145.7667978887853
          ],
          "icd10": "160383",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 5,
          "offset": 12,
          "x": 17.000000000000018,
          "y": 29.444863728670903,
          "year": 2022
        },
        {
          "date": "2022-05-10T18:23:22Z",
          "day": 10,
          "description": "Medication Refill",
          "forSVG": [
            84.15850000000009,
            -145.7667978887853
          ],
          "icd10": "160383",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 5,
          "offset": 12,
          "x": 17.000000000000018,
          "y": 29.444863728670903,
          "year": 2022
        },
        {
          "date": "2022-04-14T15:01:15Z",
          "day": 14,
          "description": "Medication Refill",
          "forSVG": [
            145.76679788878536,
            -84.1585
          ],
          "icd10": "160383",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 4,
          "offset": 12,
          "x": 29.444863728670914,
          "y": 17,
          "year": 2022
        },
        {
          "date": "2022-03-15T15:02:47Z",
          "day": 15,
          "description": "Medication Refill",
          "forSVG": [
            168.317,
            0.00000000000004122577505841701
          ],
          "icd10": "160383",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 3,
          "offset": 12,
          "x": 34,
          "y": -0.000000000000008327598234202001,
          "year": 2022
        },
        {
          "date": "2022-02-25T19:16:05Z",
          "day": 25,
          "description": "Hypertension",
          "forSVG": [
            145.7667978887853,
            84.15850000000007
          ],
          "icd10": "160302",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 2,
          "offset": 12,
          "x": 29.444863728670903,
          "y": -17.000000000000014,
          "year": 2022
        },
        {
          "date": "2022-02-03T22:05:52Z",
          "day": 3,
          "description": "Medicare Annual Wellness Visit",
          "forSVG": [
            145.7667978887853,
            84.15850000000007
          ],
          "icd10": "311",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 2,
          "offset": 12,
          "x": 29.444863728670903,
          "y": -17.000000000000014,
          "year": 2022
        },
        {
          "date": "2022-01-25T15:59:14Z",
          "day": 25,
          "description": "Hypertension",
          "forSVG": [
            84.15850000000002,
            145.76679788878536
          ],
          "icd10": "160302",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 12,
          "x": 17.000000000000004,
          "y": -29.444863728670914,
          "year": 2022
        },
        {
          "date": "2022-01-18T19:00:56Z",
          "day": 18,
          "description": "Medication Refill",
          "forSVG": [
            84.15850000000002,
            145.76679788878536
          ],
          "icd10": "160383",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 12,
          "x": 17.000000000000004,
          "y": -29.444863728670914,
          "year": 2022
        },
        {
          "date": "2022-01-11T15:25:01Z",
          "day": 11,
          "description": "Hypertension",
          "forSVG": [
            84.15850000000002,
            145.76679788878536
          ],
          "icd10": "160302",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 12,
          "x": 17.000000000000004,
          "y": -29.444863728670914,
          "year": 2022
        },
        {
          "date": "2022-01-03T19:46:10Z",
          "day": 3,
          "description": "Medicare Annual Wellness Visit",
          "forSVG": [
            84.15850000000002,
            145.76679788878536
          ],
          "icd10": "311",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 12,
          "x": 17.000000000000004,
          "y": -29.444863728670914,
          "year": 2022
        },
        {
          "date": "2021-12-14T16:16:23Z",
          "day": 14,
          "description": "Hospital Follow-up",
          "forSVG": [
            -0.00000000000005941361699595392,
            138.614
          ],
          "icd10": "324",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 18,
          "x": -0.00000000000001200153863164406,
          "y": -28,
          "year": 2021
        },
        {
          "date": "2021-12-01T20:57:51Z",
          "day": 1,
          "description": "Appointment Information",
          "forSVG": [
            -0.00000000000005941361699595392,
            138.614
          ],
          "icd10": "315",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 18,
          "x": -0.00000000000001200153863164406,
          "y": -28,
          "year": 2021
        },
        {
          "date": "2021-11-29T15:46:02Z",
          "day": 29,
          "description": "Headache",
          "forSVG": [
            -69.30700000000019,
            120.04324532017607
          ],
          "icd10": "52",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 11,
          "offset": 18,
          "x": -14.000000000000037,
          "y": -24.24871130596426,
          "year": 2021
        },
        {
          "date": "2021-11-29T15:46:02Z",
          "day": 29,
          "description": "Dizziness",
          "forSVG": [
            -69.30700000000019,
            120.04324532017607
          ],
          "icd10": "100002",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 11,
          "offset": 18,
          "x": -14.000000000000037,
          "y": -24.24871130596426,
          "year": 2021
        },
        {
          "date": "2021-11-11T16:11:01Z",
          "day": 11,
          "description": "Follow-up",
          "forSVG": [
            -69.30700000000019,
            120.04324532017607
          ],
          "icd10": "110033",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 11,
          "offset": 18,
          "x": -14.000000000000037,
          "y": -24.24871130596426,
          "year": 2021
        },
        {
          "date": "2021-11-11T16:11:01Z",
          "day": 11,
          "description": "Hypertension",
          "forSVG": [
            -69.30700000000019,
            120.04324532017607
          ],
          "icd10": "160302",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 11,
          "offset": 18,
          "x": -14.000000000000037,
          "y": -24.24871130596426,
          "year": 2021
        },
        {
          "date": "2021-10-28T15:31:51Z",
          "day": 28,
          "description": "Follow-up",
          "forSVG": [
            -120.04324532017624,
            69.30699999999989
          ],
          "icd10": "110033",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 18,
          "x": -24.248711305964296,
          "y": -13.999999999999977,
          "year": 2021
        },
        {
          "date": "2021-10-11T15:25:51Z",
          "day": 11,
          "description": "New Patient",
          "forSVG": [
            -120.04324532017624,
            69.30699999999989
          ],
          "icd10": "341",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 18,
          "x": -24.248711305964296,
          "y": -13.999999999999977,
          "year": 2021
        },
        {
          "date": "2021-10-08T19:49:09Z",
          "day": 8,
          "description": "Return Phone Call",
          "forSVG": [
            -120.04324532017624,
            69.30699999999989
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 18,
          "x": -24.248711305964296,
          "y": -13.999999999999977,
          "year": 2021
        },
        {
          "date": "2021-07-14T19:48:07Z",
          "day": 14,
          "description": "Abdominal Pain",
          "forSVG": [
            -69.30699999999989,
            -120.04324532017624
          ],
          "icd10": "110002",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 18,
          "x": -13.999999999999979,
          "y": 24.248711305964296,
          "year": 2021
        },
        {
          "date": "2021-06-22T21:07:15Z",
          "day": 22,
          "description": "Return Phone Call",
          "forSVG": [
            0.00000000000004243829785425281,
            -138.614
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 6,
          "offset": 18,
          "x": 0.000000000000008572527594031473,
          "y": 28,
          "year": 2021
        },
        {
          "date": "2021-02-23T23:02:32Z",
          "day": 23,
          "description": "Diarrhea",
          "forSVG": [
            120.04324532017614,
            69.30700000000006
          ],
          "icd10": "35",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 2,
          "offset": 18,
          "x": 24.248711305964274,
          "y": -14.000000000000012,
          "year": 2021
        },
        {
          "date": "2021-02-19T19:23:42Z",
          "day": 19,
          "description": "Return Phone Call",
          "forSVG": [
            120.04324532017614,
            69.30700000000006
          ],
          "icd10": "360",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 2,
          "offset": 18,
          "x": 24.248711305964274,
          "y": -14.000000000000012,
          "year": 2021
        },
        {
          "date": "2021-02-17T16:48:46Z",
          "day": 17,
          "description": "New Patient - Cardiology",
          "forSVG": [
            120.04324532017614,
            69.30700000000006
          ],
          "icd10": "310",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 2,
          "offset": 18,
          "x": 24.248711305964274,
          "y": -14.000000000000012,
          "year": 2021
        },
        {
          "date": "2021-02-17T16:48:46Z",
          "day": 17,
          "description": "Hypertension",
          "forSVG": [
            120.04324532017614,
            69.30700000000006
          ],
          "icd10": "160302",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 2,
          "offset": 18,
          "x": 24.248711305964274,
          "y": -14.000000000000012,
          "year": 2021
        },
        {
          "date": "2021-01-19T21:38:49Z",
          "day": 19,
          "description": "Rash",
          "forSVG": [
            69.30700000000002,
            120.04324532017617
          ],
          "icd10": "160482",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 18,
          "x": 14.000000000000004,
          "y": -24.24871130596428,
          "year": 2021
        },
        {
          "date": "2020-01-04T17:32:41Z",
          "day": 4,
          "description": "Shortness of Breath",
          "forSVG": [
            54.45550000000001,
            94.31969275156699
          ],
          "icd10": "100001",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 24,
          "x": 11.000000000000002,
          "y": -19.05255888325765,
          "year": 2020
        },
        {
          "date": "2020-01-04T17:32:41Z",
          "day": 4,
          "description": "Cough",
          "forSVG": [
            54.45550000000001,
            94.31969275156699
          ],
          "icd10": "28",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 24,
          "x": 11.000000000000002,
          "y": -19.05255888325765,
          "year": 2020
        },
        {
          "date": "2019-09-23T20:29:09Z",
          "day": 23,
          "description": "Chest Congestion",
          "icd10": "313",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 9,
          "offset": 30,
          "x": -16,
          "y": 0.000000000000005878304635907295,
          "year": 2019
        },
        {
          "date": "2019-09-23T20:29:09Z",
          "day": 23,
          "description": "Cough",
          "icd10": "28",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 9,
          "offset": 30,
          "x": -16,
          "y": 0.000000000000005878304635907295,
          "year": 2019
        },
        {
          "date": "2019-09-23T20:29:09Z",
          "day": 23,
          "description": "Headache",
          "icd10": "52",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 9,
          "offset": 30,
          "x": -16,
          "y": 0.000000000000005878304635907295,
          "year": 2019
        },
        {
          "date": "2019-09-23T20:29:09Z",
          "day": 23,
          "description": "Sneezing",
          "icd10": "323",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 9,
          "offset": 30,
          "x": -16,
          "y": 0.000000000000005878304635907295,
          "year": 2019
        },
        {
          "date": "2019-09-10T15:42:34Z",
          "day": 10,
          "description": "New Patient",
          "icd10": "341",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 9,
          "offset": 30,
          "x": -16,
          "y": 0.000000000000005878304635907295,
          "year": 2019
        },
        {
          "date": "2019-03-06T19:03:54Z",
          "day": 6,
          "description": "Rash",
          "icd10": "160482",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 3,
          "offset": 30,
          "x": 16,
          "y": -0.00000000000000391886975727153,
          "year": 2019
        },
        {
          "date": "2019-01-02T15:40:49Z",
          "day": 2,
          "description": "Shortness of Breath",
          "icd10": "100001",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 30,
          "x": 8.000000000000002,
          "y": -13.856406460551018,
          "year": 2019
        },
        {
          "date": "2019-01-02T15:40:49Z",
          "day": 2,
          "description": "Chest Pain",
          "icd10": "100000",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 30,
          "x": 8.000000000000002,
          "y": -13.856406460551018,
          "year": 2019
        },
        {
          "date": "2018-08-27T14:26:53Z",
          "day": 27,
          "description": "Shortness of Breath",
          "icd10": "100001",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 8,
          "offset": 36,
          "x": -8.660254037844389,
          "y": 4.999999999999998,
          "year": 2018
        },
        {
          "date": "2018-03-23T06:49:17Z",
          "day": 23,
          "description": "Chest Pain",
          "icd10": "100000",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 3,
          "offset": 36,
          "x": 10,
          "y": -0.0000000000000024492935982947065,
          "year": 2018
        },
        {
          "date": "2018-01-09T21:02:30Z",
          "day": 9,
          "description": "Respiratory Distress",
          "icd10": "160490",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 36,
          "x": 5.000000000000001,
          "y": -8.660254037844386,
          "year": 2018
        },
        {
          "date": "2017-12-07T22:00:13Z",
          "day": 7,
          "description": "Shortness of Breath",
          "icd10": "100001",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 12,
          "offset": 42,
          "x": -0.0000000000000017145055188062944,
          "y": -4,
          "year": 2017
        },
        {
          "date": "2017-07-05T18:41:51Z",
          "day": 5,
          "description": "Leg Pain",
          "icd10": "160357",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 42,
          "x": -1.999999999999997,
          "y": 3.4641016151377566,
          "year": 2017
        },
        {
          "date": "2017-05-30T21:42:44Z",
          "day": 30,
          "description": "Cough",
          "icd10": "28",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 5,
          "offset": 42,
          "x": 2.000000000000002,
          "y": 3.4641016151377535,
          "year": 2017
        },
        {
          "date": "2017-05-30T21:42:44Z",
          "day": 30,
          "description": "Shortness of Breath",
          "icd10": "100001",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 5,
          "offset": 42,
          "x": 2.000000000000002,
          "y": 3.4641016151377535,
          "year": 2017
        },
        {
          "date": "2017-02-28T19:06:18Z",
          "day": 28,
          "description": "Cough",
          "icd10": "28",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 2,
          "offset": 42,
          "x": 3.4641016151377535,
          "y": -2.0000000000000018,
          "year": 2017
        },
        {
          "date": "2016-10-12T20:23:34Z",
          "day": 12,
          "description": "Chest Pain",
          "icd10": "100000",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 48,
          "x": 1.7320508075688783,
          "y": 0.9999999999999983,
          "year": 2016
        },
        {
          "date": "2016-10-12T20:23:34Z",
          "day": 12,
          "description": "Shortness of Breath",
          "icd10": "100001",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 48,
          "x": 1.7320508075688783,
          "y": 0.9999999999999983,
          "year": 2016
        },
        {
          "date": "2016-03-09T20:24:32Z",
          "day": 9,
          "description": "Hand Injury",
          "icd10": "160258",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 3,
          "offset": 48,
          "x": -2,
          "y": 0.0000000000000004898587196589413,
          "year": 2016
        },
        {
          "date": "2016-01-06T19:50:46Z",
          "day": 6,
          "description": "Headache",
          "icd10": "52",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 1,
          "offset": 48,
          "x": -1.0000000000000002,
          "y": 1.7320508075688772,
          "year": 2016
        },
        {
          "date": "2014-07-20T21:25:41Z",
          "day": 20,
          "description": "Chills",
          "icd10": "160101",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 7,
          "offset": 60,
          "x": 6.999999999999989,
          "y": -12.124355652982148,
          "year": 2014
        },
        {
          "date": "2014-06-19T22:48:40Z",
          "day": 19,
          "description": "Cough",
          "icd10": "28",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 6,
          "offset": 60,
          "x": -0.0000000000000042862637970157365,
          "y": -14,
          "year": 2014
        },
        {
          "date": "2014-06-19T22:48:40Z",
          "day": 19,
          "description": "Chest Congestion",
          "icd10": "313",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 6,
          "offset": 60,
          "x": -0.0000000000000042862637970157365,
          "y": -14,
          "year": 2014
        },
        {
          "date": "2014-06-19T22:48:40Z",
          "day": 19,
          "description": "Headache",
          "icd10": "52",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 6,
          "offset": 60,
          "x": -0.0000000000000042862637970157365,
          "y": -14,
          "year": 2014
        },
        {
          "date": "2013-10-01T20:08:26Z",
          "day": 1,
          "description": "Fall",
          "icd10": "160198",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 66,
          "x": 17.32050807568878,
          "y": 9.999999999999984,
          "year": 2013
        },
        {
          "date": "2013-10-01T20:08:26Z",
          "day": 1,
          "description": "Chest Pain",
          "icd10": "100000",
          "meta": {},
          "metadata": {
            "bgcolor": "#f1f5f9",
            "bgcolor2": "#cbd5e1",
            "circle": false,
            "color": "#0F8CDB",
            "height": 40,
            "hidden": false,
            "ringcolor": "#DBD93B",
            "width": 40
          },
          "month": 10,
          "offset": 66,
          "x": 17.32050807568878,
          "y": 9.999999999999984,
          "year": 2013
        }
      ]
    }
    
    ```
    
- Problem List sizes post reduction testing (2014 - Encounters are Analog)
    
    75 KB 40 KB 7 KB 1.5 KB 32 KB 27.4 KB 28.7 KB 51 KB 26 KB 17 KB