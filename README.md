# Awin tag for Google Tag Manager Server Side

There are two types of events that Awin tag supports: PageView and Conversion. 

- **Page View event** stores the awc URL parameter inside the awin_awc cookie. 
- **Conversion event** sends the HTTP request with the specified conversion data to Awin.

## How to use the Awin tag:

1. Create an Awin tag and add Page View and Purchase triggers
2. Add the only required field for the conversion event - Merchant ID, other fields are optional.

**Merchant ID** -  advertiser program ID

**Order Reference** - booking or transaction ID.

**Total Order Value** - value excluding taxes, delivery, and discounts. For a lead-based campaign or program, the value should be the number of leads; for example, "1". Tag will ignore the value if multiple commission groups are specified in the Commission Group Code field.

**Currency Code** -  currency code in ISO standard (e.g., "GBP").

**Commission Group Code** - The code for the commission group you want to base the commission calculation on. The value can be either a single group name (e.g., "CD") or a complete set of groups and the commission value for each group (e.g., "CD:11.10|DVD:14.99").

**Discount Code** - promo code applied on the check-out.

**Last Paid Click Referring Channel** - The value utilized to determine how AWIN should process the incoming transaction requests.

**In test mode** - use to test the setup. Conversion in the test mode will be ignored.


### Useful links:

- [Awin server-to-server tracking using server Google Tag Manager](https://stape.io/blog/awin-server-to-server-tracking-using-server-google-tag-manager)

## Open Source

Awin Tag for GTM Server Side is developed and maintained by [Stape Team](https://stape.io/) under the Apache 2.0 license.
