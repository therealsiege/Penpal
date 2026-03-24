# Design Options (Back Layouts

Status: On Development
Priority: High
Requirement: For any card, a customer can select 1 of 20 back designs, which are various configurations of 0-9 photos and 0-1 textboxes. The sizes and positions of the photos and textbox are in the attached CSV (Note the “Orientation” column, which will indicate Portrait or Landscape).
Assign: Clint Johnson
Details: For any card, a customer can select 1 of 20 back designs, which are various configurations of 0-9 photos and 0-1 textboxes. The sizes and positions of the photos and textbox are in the attached CSV (Note the “Orientation” column, which will indicate Portrait or Landscape).

As part of Admin Card Configurations, for each Card Front design, I should be able to designate a default (1) background color, (2) text color (for the text in the textbox, if applicable), (3) font-family, and (4) font-size. 

Of those 4 defaults, only the font-size is editable by the customer.

The Card Back Layouts CSV file includes a column for “Background”, which has 2 potential values “Design Pattern” and “Default color” — which refers to the default background color mentioned above and is set as part of each Card Front design.

If a card back layout includes a textbox, two attributes should be default and unchangeable by customer: (1) text-align: center; and (2) vertical-align: middle.

[Card Back Photo Layouts - Landscape CSV.csv](Design%20Options%20(Back%20Layouts/Card_Back_Photo_Layouts_-_Landscape_CSV.csv)

@ANTHONY LADD Do we need Portrait Layouts for the back?

[Card Back Photo Layouts 2025.csv](Design%20Options%20(Back%20Layouts/Card_Back_Photo_Layouts_2025.csv)