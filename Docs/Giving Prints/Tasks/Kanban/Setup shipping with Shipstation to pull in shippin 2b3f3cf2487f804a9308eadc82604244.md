# Setup shipping with Shipstation to pull in shipping cost.

Status: On Development
Priority: High
Requirement: Background Context:
We need to integrate with ShipStation (formerly ShipEngine) to get shipping options & costs for the customer and generate the shipping label. 

Actions: 
1. Integrate with Shipstation (formerly known as ShipEngine, and some documentation still refers to ShipEngine) to pull in shipping costs to present to Customer during checkout.

ShipStation documentation is located at https://www.shipengine.com/docs/rates/

Sandbox API Key is: TEST_SKYZ7J0SkXiCwAXZYoygDx//0745dnmzoznrFPSx3WQ

Production API Key is: lFRtg7D8rhERihZc0ykF5wdr6WDnVVGVp3miFMT5xMs

2. On the Customer Checkout UI, customer must enter Shipping Address. Allow only US addresses. Validate the address.

3. Display only UPS carrier options to the customer (In ShipEngine, the Carrier ID is se-3487522).  Do not include other carriers.

Customer must select a shipping option (include all UPS carrier options, including UPS Ground, UPS 3-day, UPS 2-day and Overnight). 

Box Dimensions and weights based on order quantity up to 1000 cards are in the attached CSV file (”2025 Shipping Weights.csv”).

Orders ship from 1422 Lebanon Pike, Nashville, TN 37210.

For orders over 1000 cards, assume 1000 cards weights and box dimensions.

4. Charge shipping on all orders (do not include a free option).

5. Add the generated shipping label image to the Combined Packing Slip and Shipping Label.

6. Add the tracking number to the Order ID in the Order Management screen for Admins.

7. Include the Tracking Number in the customer order confirmation email.
Assign: Clint Johnson
Release: 1.0

[2025 Shipping Weights.csv](Setup%20shipping%20with%20Shipstation%20to%20pull%20in%20shippin/2025_Shipping_Weights.csv)