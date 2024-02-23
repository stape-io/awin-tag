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

const isLoggingEnabled = determinateIsLoggingEnabled();
const traceId = getRequestHeader('trace-id');
const eventData = getAllEventData();
const eventName = eventData.event_name;

const PAGE_VIEW_EVENT = data.pageViewEvent || 'page_view';
const PURCHASE_EVENT = data.purchaseEvent || 'purchase';

switch (eventName) {
  case PAGE_VIEW_EVENT:
    const url = getEventData('page_location') || getRequestHeader('referer');

    if (url) {
      const searchParams = parseUrl(url).searchParams;
      const deduplicationParamName =
        data.deduplicationQueryParameterName || 'source';
      if (searchParams.awc) {
        const options = {
          domain: 'auto',
          path: '/',
          secure: true,
          httpOnly: true,
          'max-age': 31536000, // 1 year
        };

        setCookie('awin_awc', searchParams.awc, options, false);
      }
      if (searchParams[deduplicationParamName]) {
        const options = {
          domain: 'auto',
          path: '/',
          secure: true,
          httpOnly: true,
          'max-age': 31536000, // 1 year
        };

        setCookie(
          'awin_source',
          searchParams[deduplicationParamName],
          options,
          false
        );
      }
    }

    data.gtmOnSuccess();
    break;
  case PURCHASE_EVENT:
    const consentSignal = makeString(data.consentSignal || '');
    const consentDeclined = ['0', 'false'].indexOf(consentSignal) !== -1;
    const awc = consentDeclined ? '' : getCookieValues('awin_awc')[0] || '';
    const source = getCookieValues('awin_source')[0];
    let requestUrl =
      'https://www.awin1.com/sread.php?tt=ss&tv=2&merchant=' +
      enc(data.advertiserId);
    requestUrl = requestUrl + '&amount=' + enc(data.totalAmount);
    requestUrl = requestUrl + '&ch=' + enc(data.channel || source || 'aw');
    requestUrl = requestUrl + '&vc=' + enc(data.voucherCode);
    requestUrl = requestUrl + '&cr=' + enc(data.currencyCode);
    requestUrl = requestUrl + '&ref=' + enc(data.orderReference);
    requestUrl =
      requestUrl + '&customeracquisition=' + enc(data.customerAcquisition);
    requestUrl = requestUrl + '&testmode=' + (data.isTest ? 1 : 0);

    requestUrl = requestUrl + '&cks=' + enc(awc);

    /**
     * Commission Group
     */
    if (
      data.commissionGroup &&
      (data.commissionGroup.indexOf(':') !== -1 || data.totalAmount)
    ) {
      const cg =
        data.commissionGroup.indexOf(':') !== -1
          ? data.commissionGroup
          : data.commissionGroup + ':' + data.totalAmount;

      requestUrl = requestUrl + '&parts=' + enc(cg);
    }

    /**
     * Custom Parameters
     */
    const customParameters = ['gtm_s2s_stape'];
    const allowedTypesForCustomParameters = ['string', 'number', 'boolean'];
    if (getType(data.customParameters) === 'array') {
      data.customParameters.forEach((customParameter) => {
        customParameters.push(customParameter.value);
      });
    }
    customParameters.forEach((customParameter, index) => {
      if (
        allowedTypesForCustomParameters.indexOf(getType(customParameter)) !== -1
      ) {
        requestUrl = requestUrl + '&p' + (index + 1) + '=' + customParameter;
      }
    });

    /**
     * Product Level Tracking
     */
    const items = data.productsOverride || eventData.items || [];
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
          enc(item.order_reference || eventData.transaction_id || '')
        );
        value = value.replace('{{productId}}', enc(item.item_id || ''));
        value = value.replace('{{productName}}', enc(item.item_name || ''));
        value = value.replace(
          '{{productItemPrice}}',
          getPriceString(item.price)
        );
        value = value.replace('{{productQuantity}}', item.quantity || '');
        value = value.replace(
          '{{productSku}}',
          enc(item.item_sku || item.item_id || '')
        );
        value = value.replace(
          '{{commissionGroupCode}}',
          item.commission_group_code || 'DEFAULT'
        );
        value = value.replace(
          '{{productCategory}}',
          enc(item.item_category || '')
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
          RequestUrl: requestUrl,
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
              ResponseBody: body,
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

function enc(data) {
  data = data || '';
  return encodeUriComponent(data);
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
