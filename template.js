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
      const value = parseUrl(url).searchParams.awc;

      if (value) {
        const options = {
          domain: 'auto',
          path: '/',
          secure: true,
          httpOnly: true,
          'max-age': 31536000, // 1 year
        };

        setCookie('awin_awc', value, options, false);
      }
    }

    data.gtmOnSuccess();
    break;
  case PURCHASE_EVENT:
    const awc = getCookieValues('awin_awc')[0] || '';
    if (awc) {
      let requestUrl =
        'https://www.awin1.com/sread.php?tt=ss&tv=2&merchant=' +
        enc(data.advertiserId);
      requestUrl = requestUrl + '&amount=' + enc(data.totalAmount);
      requestUrl = requestUrl + '&ch=' + enc(data.channel || 'aw');
      requestUrl = requestUrl + '&vc=' + enc(data.voucherCode);
      requestUrl = requestUrl + '&cr=' + enc(data.currencyCode);
      requestUrl = requestUrl + '&ref=' + enc(data.orderReference);
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
          allowedTypesForCustomParameters.indexOf(getType(customParameter)) !==
          -1
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
            item.order_reference || eventData.transaction_id || ''
          );
          value = value.replace('{{productId}}', item.item_id || '');
          value = value.replace('{{productName}}', item.item_name || '');
          value = value.replace('{{productItemPrice}}', item.price || '');
          value = value.replace('{{productQuantity}}', item.quantity || '');
          value = value.replace(
            '{{productSku}}',
            item.item_sku || item.item_id || ''
          );
          value = value.replace(
            '{{commissionGroupCode}}',
            item.commission_group_code || 'DEFAULT'
          );
          value = value.replace(
            '{{productCategory}}',
            item.item_category || ''
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
    } else {
      data.gtmOnSuccess();
    }
    break;
  default:
    data.gtmOnSuccess();
    break;
}

function enc(data) {
  data = data || '';
  return encodeUriComponent(data);
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
