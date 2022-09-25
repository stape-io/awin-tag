const sendHttpRequest = require('sendHttpRequest');
const setCookie = require('setCookie');
const parseUrl = require('parseUrl');
const JSON = require('JSON');
const getRequestHeader = require('getRequestHeader');
const encodeUriComponent = require('encodeUriComponent');
const getCookieValues = require('getCookieValues');
const getEventData = require('getEventData');

const logToConsole = require('logToConsole');
const getContainerVersion = require('getContainerVersion');
const containerVersion = getContainerVersion();
const isDebug = containerVersion.debugMode;
const isLoggingEnabled = determinateIsLoggingEnabled();
const traceId = getRequestHeader('trace-id');

if (data.type === 'page_view') {
    const url = getEventData('page_location') || getRequestHeader('referer');

    if (url) {
        const value = parseUrl(url).searchParams.awc;

        if (value) {
            const options = {
                domain: 'auto',
                path: '/',
                secure: true,
                httpOnly: !!data.useHttpOnlyCookie
            };

            if (data.expiration > 0) options['max-age'] = data.expiration;

            setCookie('awin_awc', value, options, false);
        }
    }

    data.gtmOnSuccess();
} else {
    const awc = getCookieValues('awin_awc')[0] || '';

    let requestUrl = 'https://www.awin1.com/sread.php?tt=ss&tv=2&merchant=' + enc(data.advertiserId);
        requestUrl = requestUrl + '&amount=' + enc(data.totalAmount);
        requestUrl = requestUrl + '&ch=' + enc(data.channel);
        requestUrl = requestUrl + '&vc=' + enc(data.voucherCode);
        requestUrl = requestUrl + '&cr=' + enc(data.currencyCode);
        requestUrl = requestUrl + '&ref=' + enc(data.orderReference);
        requestUrl = requestUrl + '&testmode=' + (data.isTest ? 1:0);

    if (data.commissionGroup && data.totalAmount) {
        requestUrl = requestUrl + '&parts=' + enc(data.commissionGroup) + ':' + enc(data.totalAmount);
    }

    if (awc) {
        requestUrl = requestUrl + '&cks=' + enc(awc);
    }

    if (isLoggingEnabled) {
        logToConsole(JSON.stringify({
            'Name': 'Awin',
            'Type': 'Request',
            'TraceId': traceId,
            'EventName': 'Conversion',
            'RequestMethod': 'GET',
            'RequestUrl': requestUrl,
        }));
    }

    sendHttpRequest(requestUrl, (statusCode, headers, body) => {
        if (isLoggingEnabled) {
            logToConsole(JSON.stringify({
                'Name': 'Awin',
                'Type': 'Response',
                'TraceId': traceId,
                'EventName': 'Conversion',
                'ResponseStatusCode': statusCode,
                'ResponseHeaders': headers,
                'ResponseBody': body,
            }));
        }

        if (statusCode >= 200 && statusCode < 300) {
            data.gtmOnSuccess();
        } else {
            data.gtmOnFailure();
        }
    }, {method: 'GET'});
}

function enc(data) {
    data = data || '';
    return encodeUriComponent(data);
}

function determinateIsLoggingEnabled() {
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
