# Phase 2 Specs

# Connecting eSpiral to the EHR

We want to connect eSpiral to the EHR and leverage contextual data passed through the authorization flow to remove the need to require physicians to search for patients. We can actually embed the eSpiral experience into Epic using Smart on FHIR with the standard authorization flow.

### Open Questions

- What version of Epic is the Infirmary using?
- What is the existing process?

## Timeline

- [x]  eSpiral Epic Smart on FHIR Connector
- [x]  Generate product specifications (1 Week)
- [x]  Add Smart on FHIR to eSpiral (3 legged auth flow) (4 weeks)
- [x]  Get problem list from EHR (1 Week)
- [x]  Smart on FHIR token refresh (1 week)
- [x]  eSpiral FHIR Sandbox testing (1 week)

## Cost

[Untitled](../../../References/eSpiral%20Working%20List/Phase%202%20-%20Smart%20on%20FHIR/Phase%202%20Specs/Untitled.csv)

### Smart on FHIR Connector

![Screenshot 2023-06-19 at 10.36.48 PM.png](../../../References/eSpiral%20Working%20List/Phase%202%20-%20Smart%20on%20FHIR/Phase%202%20Specs/Screenshot_2023-06-19_at_10.36.48_PM.png)

## Research

### Smart on FHIR

Smart on FHIR is an emerging standard for integrating healthcare applications with electronic health records (EHR) systems. It allows developers to build applications that can securely access and exchange health data using the FHIR (Fast Healthcare Interoperability Resources) standard.

Here are some resources that can help you leverage Smart on FHIR for your application:

1. SMART on FHIR Documentation: The official SMART on FHIR website provides comprehensive documentation, tutorials, and examples to help you understand the standard and implement it in your application. You can access the documentation at: [**https://smarthealthit.org/**](https://smarthealthit.org/)
2. FHIR Specification: Familiarize yourself with the FHIR standard by referring to the official FHIR specification. It provides detailed information on the data model, resources, and operations supported by FHIR. You can access the specification at: [**http://hl7.org/fhir/**](http://hl7.org/fhir/)
3. SMART App Gallery: Explore the SMART App Gallery to discover existing applications built on the Smart on FHIR platform. You can find examples of different types of applications and learn from their implementations. The gallery is available at: [**https://apps.smarthealthit.org/**](https://apps.smarthealthit.org/)
4. FHIR Developer Community: Engage with the FHIR developer community to ask questions, seek guidance, and learn from experienced developers. The official FHIR chat forum and mailing list are great places to connect with the community. You can access the forum at: [**https://chat.fhir.org/**](https://chat.fhir.org/)
5. Open-source Libraries and Tools: There are several open-source libraries and tools available to facilitate Smart on FHIR development. For example, the SMART on FHIR JavaScript Client library provides a simplified interface to interact with the SMART API. Explore GitHub repositories and developer communities to find relevant libraries for your preferred programming language.
6. FHIR Sandboxes and Test Servers: Utilize FHIR sandboxes and test servers to experiment with the Smart on FHIR workflow and test your application's interoperability. These environments allow you to simulate interactions with EHR systems without accessing real patient data. Some popular sandboxes include the HAPI FHIR Server ([**https://hapi.fhir.org/**](https://hapi.fhir.org/)) and the SMART Health IT Sandbox ([**https://sandbox.smarthealthit.org/**](https://sandbox.smarthealthit.org/)).
7. Healthcare Interoperability Standards: Gain a broader understanding of healthcare interoperability standards beyond Smart on FHIR. Familiarize yourself with other relevant standards such as HL7, DICOM, and IHE to ensure your application aligns with industry best practices.

Remember that leveraging Smart on FHIR requires a solid understanding of both the FHIR standard and the security considerations involved in accessing and handling sensitive health data. It's essential to prioritize patient privacy and adhere to regulatory requirements such as HIPAA (Health Insurance Portability and Accountability Act) when developing healthcare applications.

### How it works

The SMART App Launch is the standard authorization flow used in Smart on FHIR applications to authenticate users and obtain access to healthcare data. It involves a series of steps to establish trust between the FHIR server or EHR system and the SMART application. Here's an overview of how the SMART App Launch works:

1. User Launches the Application: The user initiates the launch of the SMART application from within the EHR system's user interface or through an external launch mechanism. This could be a button, link, or other user interaction that triggers the launch process.
2. Authorization Request: The SMART application constructs an authorization request URL and redirects the user's web browser to the FHIR server or EHR system's authorization endpoint. The URL includes parameters specifying the application's Client ID, requested scopes, and redirect URL.
3. User Authentication and Consent: The FHIR server or EHR system authenticates the user and prompts them to provide consent for the SMART application to access their healthcare data. The user may be required to enter credentials, authenticate using a single sign-on (SSO) mechanism, or use other authentication methods depending on the system's configuration.
4. Authorization Grant: After the user grants consent, the FHIR server or EHR system generates an authorization grant. This grant is a temporary code that represents the user's consent to access their data. The authorization grant is typically issued as part of the redirect back to the SMART application's specified redirect URL.
5. Token Exchange: The SMART application, upon receiving the authorization grant, sends a token request to the FHIR server or EHR system's token endpoint. The request includes the authorization grant, along with the application's Client ID and Client Secret. This exchange results in the issuance of an access token and, optionally, a refresh token.
6. Accessing Protected Resources: With the access token obtained from the token exchange, the SMART application can make authorized requests to the FHIR server's protected resources. These resources may include patient data, clinical documents, or other healthcare-related information.
7. Refreshing Tokens: Access tokens have a limited lifespan. To continue accessing protected resources beyond the token's expiration, the SMART application can use the refresh token (if provided) to obtain a new access token without requiring user reauthorization. This process is typically handled behind the scenes by the SMART application.

By following the SMART App Launch flow, Smart on FHIR applications can securely authenticate users, obtain access tokens, and interact with FHIR servers or EHR systems to access healthcare data. The launch flow provides a standardized mechanism for integrating applications into the healthcare ecosystem while ensuring user privacy and data security.

### Testing

To test the authentication of your Smart on FHIR application, you can follow these steps:

1. Obtain a Client ID and Client Secret: Register your application with the FHIR server or EHR system you're integrating with to obtain a Client ID and Client Secret. These credentials are used to authenticate your application.
2. Configure Authorization: Implement the necessary authorization flow based on the SMART on FHIR specification. The most common authorization flow is the SMART App Launch, which involves redirecting users to the FHIR server for authentication and authorization. During this process, your application will receive an authorization code or access token.
3. Test Authorization Flow: Use a tool like Postman or a web browser to simulate the authorization flow. Make a request to the FHIR server's authorization endpoint with the necessary parameters, including the Client ID, redirect URL, and requested scopes. Verify that you receive the authorization code or access token in response.
4. Exchange Authorization Code for Access Token: Once you have obtained the authorization code, you need to exchange it for an access token. Send a request to the FHIR server's token endpoint with the authorization code, Client ID, Client Secret, and other required parameters. Validate that you receive a valid access token in response.
5. Test Access to Protected Resources: With the access token, make requests to the FHIR server's protected resources, such as patient data or other FHIR resources. Ensure that you can successfully retrieve the requested data and that the authorization is enforced correctly.
6. Handle Token Expiration and Refresh: Test the handling of token expiration and refresh. Tokens typically have a limited lifespan, so your application needs to handle the renewal of tokens when they expire. Verify that your app can detect token expiration, refresh the token using the refresh token (if supported), and continue accessing protected resources seamlessly.
7. Error Handling: Test error scenarios such as invalid credentials, expired tokens, or insufficient privileges. Ensure that your application handles these errors gracefully and provides appropriate feedback to the user.
8. Security Considerations: Pay attention to security aspects during testing. Ensure that sensitive credentials, such as the Client Secret, are securely stored and not exposed in client-side code or publicly accessible locations.
9. Test on Multiple FHIR Servers: It's a good practice to test your Smart on FHIR authentication on multiple FHIR servers or EHR systems to validate interoperability and ensure compatibility with different implementations.

By following these steps and thoroughly testing the authentication flow, you can ensure that your Smart on FHIR application securely integrates with the FHIR server or EHR system and provides the expected functionality.

### Passing context

In the Smart on FHIR framework, context is passed through the launch context parameters. These parameters contain information about the context of the user's session, such as the patient, encounter, or other relevant details. The launch context is typically provided during the initial authorization process and is passed to the SMART application as part of the launch URL or in subsequent requests.

Here's an overview of how context is passed for Smart on FHIR:

1. Launch Context Parameters: When a user initiates the launch of a Smart on FHIR application, the FHIR server or EHR system includes launch context parameters in the authorization URL. These parameters are specific to the SMART on FHIR specification and allow the server to communicate relevant context information to the application.
2. Authorization Process: During the authorization process, the user is redirected to the FHIR server or EHR system to grant consent and authenticate. The launch context parameters, including patient, encounter, or other relevant information, are typically included in the authorization request as query parameters.
3. Authorization Callback: Once the user grants consent and authentication is successful, the FHIR server redirects the user back to the SMART application using the redirect URL specified during the application registration process. The launch context parameters are included in the callback URL as query parameters.
4. Accessing Launch Context: In the SMART application, the launch context parameters can be accessed from the URL query parameters of the callback URL. The application extracts the launch context information from the query parameters and processes it accordingly. The specific implementation details may vary depending on the programming language or framework you are using.
5. Using Launch Context: The launch context parameters provide valuable information about the user's session, such as the patient ID, encounter ID, or other contextual data. The SMART application can leverage this information to personalize the user experience, retrieve relevant patient data, or perform specific actions within the FHIR server or EHR system.

It's important to note that the launch context parameters are defined by the SMART on FHIR specification and can vary depending on the capabilities and configuration of the FHIR server or EHR system. When integrating with different systems, it's necessary to understand their specific implementation details and the launch context parameters they support.

By utilizing the launch context parameters, Smart on FHIR applications can access and utilize contextual information to enhance the functionality and usability of healthcare applications.