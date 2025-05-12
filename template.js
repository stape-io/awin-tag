const sendHttpRequest = require('sendHttpRequest');
const setCookie = require('setCookie');
const parseUrl = require('parseUrl');
const JSON = require('JSON');
const getRequestHeader = require('getRequestHeader');
const encodeUriComponent = require('encodeUriComponent');
const getCookieValues = require('getCookieValues');
const getEventData = require('getEventData');
const getAllEventData = require('getAllEventData');
const logToConsole = require('logToConsole');
const getContainerVersion = require('getContainerVersion');
const getType = require('getType');
const makeString = require('makeString');

/**********************************************************************************************/

const isLoggingEnabled = determinateIsLoggingEnabled();
const traceId = getRequestHeader('trace-id');
const eventData = getAllEventData();
const eventName = eventData.event_name;

const PAGE_VIEW_EVENT = data.pageViewEvent || 'page_view';
const PURCHASE_EVENT = data.purchaseEvent || 'purchase';

const url = getEventData('page_location') || getRequestHeader('referer');

if (url && url.lastIndexOf('https://gtm-msr.appspot.com/', 0) === 0) {
  return data.gtmOnSuccess();
}

/**********************************************************************************************/
// Vendor related functions

switch (eventName) {
  case PAGE_VIEW_EVENT:
    if (url) {
      const searchParams = parseUrl(url).searchParams;
      const isJourneyExemptFromConsent =
        !!searchParams.sn && searchParams.sn === '1' && data.enableCashbackTracking;
      const deduplicationParamName = data.deduplicationQueryParameterName || 'source';

      if (isJourneyExemptFromConsent || !isConsentDeclined()) {
        if (searchParams.awc || (searchParams.awaid && searchParams.gclid)) {
          const awcCookieName = isJourneyExemptFromConsent ? 'awin_sn_awc' : 'awin_awc';
          const awcCookieValue = searchParams.awc
            ? searchParams.awc
            : 'gclid_' + searchParams.awaid + '_' + searchParams.gclid;

          const options = {
            domain: data.overridenCookieDomain || 'auto',
            path: '/',
            secure: true,
            httpOnly: !!data.useHttpOnlyCookie,
            'max-age': 31536000 // 1 year
          };

          setCookie(awcCookieName, awcCookieValue, options, false);
        }

        if (searchParams[deduplicationParamName]) {
          const options = {
            domain: data.overridenCookieDomain || 'auto',
            path: '/',
            secure: true,
            httpOnly: !!data.useHttpOnlyCookie,
            'max-age': 31536000 // 1 year
          };

          setCookie('awin_source', searchParams[deduplicationParamName], options, false);
        }
      }
    }

    data.gtmOnSuccess();
    break;
  case PURCHASE_EVENT:
    const commonCookie = eventData.common_cookie || {};

    let awc;
    let source =
      data.channel || getCookieValues('awin_source')[0] || commonCookie.awin_source || 'aw';

    if (!isConsentDeclined()) {
      const awcFromCookie = [getCookieValues('awin_awc')[0], getCookieValues('awin_sn_awc')[0]]
        .filter((cookieValue) => !!cookieValue)
        .join(',');
      const awcFromCommonCookie = [commonCookie.awin_awc, commonCookie.awin_sn_awc]
        .filter((cookieValue) => !!cookieValue)
        .join(',');
      awc = data.clickId || awcFromCookie || awcFromCommonCookie;
    } else if (data.enableCashbackTracking) {
      awc = data.clickId || getCookieValues('awin_sn_awc')[0] || commonCookie.awin_sn_awc || '';
    } else {
      // Do not read the cookies or use the template fields.
      awc = '';
      source = '';
    }

    const orderReference = data.orderReference || eventData.transaction_id;
    let requestUrl =
      'https://www.awin1.com/sread.php?tt=ss&tv=2&merchant=' + enc(data.advertiserId);
    requestUrl = requestUrl + '&amount=' + enc(data.totalAmount);
    requestUrl = requestUrl + '&ch=' + enc(source);
    requestUrl = requestUrl + '&vc=' + enc(data.voucherCode);
    requestUrl = requestUrl + '&cr=' + enc(data.currencyCode);
    requestUrl = requestUrl + '&ref=' + enc(orderReference);
    requestUrl = requestUrl + '&customeracquisition=' + enc(data.customerAcquisition);
    requestUrl = requestUrl + '&testmode=' + (data.isTest ? 1 : 0);
    requestUrl = requestUrl + '&cks=' + enc(awc);

    /**
     * Commission Group
     */
    if (data.commissionGroup && (data.commissionGroup.indexOf(':') !== -1 || data.totalAmount)) {
      const cg =
        data.commissionGroup.indexOf(':') !== -1
          ? data.commissionGroup
          : data.commissionGroup + ':' + data.totalAmount;

      requestUrl = requestUrl + '&parts=' + enc(cg);
    }

    /**
     * Custom Parameters
     */
    const customParameters = [
      { key: '1', value: 'gtm_s2s_stape_' + getContainerVersion().containerId }
    ];
    const allowedTypesForCustomParameters = ['string', 'number', 'boolean'];
    if (getType(data.customParameters) === 'array') {
      data.customParameters.forEach((customParameter, index) => {
        customParameters.push({
          // If user hasn't added the key because of the breaking change when the column was added,
          // we assign it on their behalf based on the order of the parameters.
          // "key" must start at 1, and 1 is always the "gtm_s2s_stape_<Container ID>" param. So, we add 2 to the index.
          key: customParameter.key ? customParameter.key : index + 2,
          value: customParameter.value
        });
      });
    }
    customParameters.forEach((customParameter) => {
      if (allowedTypesForCustomParameters.indexOf(getType(customParameter.value)) !== -1) {
        requestUrl = requestUrl + '&p' + customParameter.key + '=' + enc(customParameter.value);
      }
    });

    /**
     * Product Level Tracking
     */
    let items = data.productsOverride || eventData.items || [];
    if (getType(items) === 'string') items = JSON.parse(items);

    const productRow =
      'AW:P|{{advertiserId}}|{{orderReference}}|{{productId}}|{{productName}}|{{productItemPrice}}|{{productQuantity}}|{{productSku}}|{{commissionGroupCode}}|{{productCategory}}';

    if (getType(items) === 'array') {
      items.forEach((item, index) => {
        let value = productRow.replace(
          '{{advertiserId}}',
          item.advertiser_id || data.advertiserId || ''
        );
        value = value.replace(
          '{{orderReference}}',
          enc(orderReference || item.order_reference || '')
        );
        value = value.replace('{{productId}}', enc(item.item_id || ''));
        value = value.replace('{{productName}}', enc(replacePipeWithUnderscore(item.item_name)));
        value = value.replace('{{productItemPrice}}', getPriceString(item.price));
        value = value.replace('{{productQuantity}}', item.quantity || '');
        value = value.replace('{{productSku}}', enc(item.item_sku || item.item_id || ''));
        value = value.replace('{{commissionGroupCode}}', item.commission_group_code || 'DEFAULT');
        value = value.replace(
          '{{productCategory}}',
          enc(replacePipeWithUnderscore(item.item_category))
        );
        requestUrl = requestUrl + '&bd[' + index + ']=' + value;
      });
    }

    if (isLoggingEnabled) {
      logToConsole(
        JSON.stringify({
          Name: 'Awin',
          Type: 'Request',
          TraceId: traceId,
          EventName: 'Conversion',
          RequestMethod: 'GET',
          RequestUrl: requestUrl
        })
      );
    }

    sendHttpRequest(
      requestUrl,
      (statusCode, headers, body) => {
        if (isLoggingEnabled) {
          logToConsole(
            JSON.stringify({
              Name: 'Awin',
              Type: 'Response',
              TraceId: traceId,
              EventName: 'Conversion',
              ResponseStatusCode: statusCode,
              ResponseHeaders: headers,
              ResponseBody: body
            })
          );
        }

        if (statusCode >= 200 && statusCode < 300) {
          data.gtmOnSuccess();
        } else {
          data.gtmOnFailure();
        }
      },
      { method: 'GET' }
    );
    break;
  default:
    data.gtmOnSuccess();
    break;
}

/**********************************************************************************************/
// Helpers

function isConsentDeclined() {
  const autoConsentParameter = data.consentAutoDetectionParameter;
  if (autoConsentParameter) {
    // Check consent state from Stape's Data Tag
    if (eventData.consent_state && eventData.consent_state[autoConsentParameter] === false) {
      return true;
    }

    // Check consent state from Google Consent Mode
    const gcsPositionMapping = { analytics_storage: 3, ad_storage: 2 };
    const xGaGcs = eventData['x-ga-gcs'] || ''; // x-ga-gcs is a string like "G110"
    if (xGaGcs[gcsPositionMapping[autoConsentParameter]] === '0') {
      return true;
    }
  }

  // Check template field specific consent signal
  const awinConsentSignal = makeString(data.awinConsentSignal || '');
  return ['0', 'false'].indexOf(awinConsentSignal) !== -1;
}

function replacePipeWithUnderscore(data) {
  data = data || '';
  return data.split('|').join('_');
}

function enc(data) {
  return encodeUriComponent((data = data || ''));
}

function getPriceString(price) {
  const priceType = getType(price);
  const isEmptyPrice = priceType === 'undefined' || priceType === 'null';
  return isEmptyPrice ? '' : makeString(price);
}

function determinateIsLoggingEnabled() {
  const containerVersion = getContainerVersion();
  const isDebug = !!(
    containerVersion &&
    (containerVersion.debugMode || containerVersion.previewMode)
  );

  if (!data.logType) {
    return isDebug;
  }

  if (data.logType === 'no') {
    return false;
  }

  if (data.logType === 'debug') {
    return isDebug;
  }

  return data.logType === 'always';
}
