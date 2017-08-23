import AWS from 'aws-sdk/dist/aws-sdk-react-native';
import Storage from './Storage';
import StorageKeys from './StorageKeys.js';
import Util from'./MobileAnalyticsUtilities';
const DeviceInfo = require('react-native-device-info');

/**
 * @typedef AMA.Client.Options
 * @property {string}                     appId - The Application ID from the Amazon Mobile Analytics Console
 * @property {string}                     [apiVersion=2014-06-05] - The version of the Mobile Analytics API to submit to.
 * @property {object}                     [provider=AWS.config.credentials] - Credentials to use for submitting events.
 *                                                                            **Never check in credentials to source
 *                                                                            control.
 * @property {boolean}                    [autoSubmitEvents=true] - Automatically Submit Events, Default: true
 * @property {number}                     [autoSubmitInterval=10000] - Interval to try to submit events in ms,
 *                                                                     Default: 10s
 * @property {number}                     [batchSizeLimit=256000] - Batch Size in Bytes, Default: 256Kb
 * @property {AMA.Client.SubmitCallback}  [submitCallback=] - Callback function that is executed when events are
 *                                                            successfully submitted
 * @property {AMA.Client.Attributes}      [globalAttributes=] - Attribute to be applied to every event, may be
 *                                                              overwritten with a different value when recording events.
 * @property {AMA.Client.Metrics}         [globalMetrics=] - Metric to be applied to every event, may be overwritten
 *                                                           with a different value when recording events.
 * @property {string}                     [clientId=GUID()] - A unique identifier representing this installation instance
 *                                                            of your app. This will be managed and persisted by the SDK
 *                                                            by default.
 * @property {string}                     [appTitle=] - The title of your app. For example, My App.
 * @property {string}                     [appVersionName=] - The version of your app. For example, V2.0.
 * @property {string}                     [appVersionCode=] - The version code for your app. For example, 3.
 * @property {string}                     [appPackageName=] - The name of your package. For example, com.example.my_app.
 * @property {string}                     [platform=] - The operating system of the device. For example, iPhoneOS.
 * @property {string}                     [plaformVersion=] - The version of the operating system of the device.
 *                                                            For example, 4.0.4.
 * @property {string}                     [model=] - The model of the device. For example, Nexus.
 * @property {string}                     [make=] - The manufacturer of the device. For example, Samsung.
 * @property {string}                     [locale=] - The locale of the device. For example, en_US.
 * @property {AMA.Client.Logger}          [logger=] - Object of logger functions
 * @property {AMA.Storage}                [storage=] - Storage client to persist events, will create a new AMA.Storage if not provided
 * @property {Object}                     [clientOptions=] - Low level client options to be passed to the AWS.MobileAnalytics low level SDK
 */

/**
 * @typedef AMA.Client.Logger
 * @description Uses Javascript Style log levels, one function for each level.  Basic usage is to pass the console object
 *              which will output directly to browser developer console.
 * @property {Function} [log=] - Logger for client log level messages
 * @property {Function} [info=] - Logger for interaction level messages
 * @property {Function} [warn=] - Logger for warn level messages
 * @property {Function} [error=] - Logger for error level messages
 */
/**
 * @typedef AMA.Client.Attributes
 * @type {object}
 * @description A collection of key-value pairs that give additional context to the event. The key-value pairs are
 *              specified by the developer.
 */
/**
 * @typedef AMA.Client.Metrics
 * @type {object}
 * @description A collection of key-value pairs that gives additional measurable context to the event. The pairs
 *              specified by the developer.
 */
/**
 * @callback AMA.Client.SubmitCallback
 * @param {Error} err
 * @param {Null} data
 * @param {string} batchId
 */
/**
 * @typedef AMA.Client.Event
 * @type {object}
 * @description A JSON object representing an event occurrence in your app and consists of the following:
 * @property {string} eventType - A name signifying an event that occurred in your app. This is used for grouping and
 *                                aggregating like events together for reporting purposes.
 * @property {string} timestamp - The time the event occurred in ISO 8601 standard date time format.
 *                                For example, 2014-06-30T19:07:47.885Z
 * @property {AMA.Client.Attributes} [attributes=] - A collection of key-value pairs that give additional context to
 *                                                   the event. The key-value pairs are specified by the developer.
 *                                                   This collection can be empty or the attribute object can be omitted.
 * @property {AMA.Client.Metrics} [metrics=] - A collection of key-value pairs that gives additional measurable context
 *                                             to the event. The pairs specified by the developer.
 * @property {AMA.Session} session - Describes the session. Session information is required on ALL events.
 */
/**
 * @name AMA.Client
 * @namespace AMA.Client
 * @constructor
 * @param {AMA.Client.Options} options - A configuration map for the AMA.Client
 * @returns A new instance of the Mobile Analytics Mid Level Client
 */
export default class MobileAnalyticsClient {

    constructor(options, callback) {

        this.options = options || {};
        this.options.logger = this.options.logger || {};
        this.logger = {
            log  : this.options.logger.log || Util.NOP,
            info : this.options.logger.info || Util.NOP,
            warn : this.options.logger.warn || Util.NOP,
            error: this.options.logger.error || Util.NOP
        };
        this.logger.log = this.logger.log.bind(this.options.logger);
        this.logger.info = this.logger.info.bind(this.options.logger);
        this.logger.warn = this.logger.warn.bind(this.options.logger);
        this.logger.error = this.logger.error.bind(this.options.logger);

        this.logger.log('[Function:(AMA)Client Constructor]' +
            (options ? '\noptions:' + JSON.stringify(options) : ''));

        this.initOptions(options);

        this.storage = this.options.storage || new Storage(options.appId);
        this.storage.reload(()=>{
            this.initStorage(callback);
        });


    }

    initStorage(callback) {
        this.storage.setLogger(this.logger);

        this.storage.set(
            StorageKeys.GLOBAL_ATTRIBUTES,
            Util.mergeObjects(this.options.globalAttributes,
                this.storage.get(StorageKeys.GLOBAL_ATTRIBUTES) || {})
        );
        this.storage.set(
            StorageKeys.GLOBAL_METRICS,
            Util.mergeObjects(this.options.globalMetrics,
                this.storage.get(StorageKeys.GLOBAL_METRICS) || {})
        );

        this.storage.set(StorageKeys.CLIENT_ID, DeviceInfo.getUniqueID());

        this.StorageKeys = {
            'EVENTS'     : 'AWSMobileAnalyticsEventStorage',
            'BATCHES'    : 'AWSMobileAnalyticsBatchStorage',
            'BATCH_INDEX': 'AWSMobileAnalyticsBatchIndexStorage'
        };

        this.outputs = {};
        this.outputs.MobileAnalytics = new AWS.MobileAnalytics(this.options.clientOptions);
        this.outputs.timeoutReference = null;
        this.outputs.batchesInFlight = {};

        this.outputs.events = this.storage.get(this.StorageKeys.EVENTS) || [];
        this.outputs.batches = this.storage.get(this.StorageKeys.BATCHES) || {};
        this.outputs.batchIndex = this.storage.get(this.StorageKeys.BATCH_INDEX) || [];

        if (this.options.autoSubmitEvents) {
            this.submitEvents();
        }

        callback();
    }


    initOptions(options) {

        if (options.appId === undefined) {
            this.logger.error('AMA.Client must be initialized with an appId');
            return null; //No need to run rest of init since appId is required
        }
        if (options.platform === undefined) {
            this.logger.error('AMA.Client must be initialized with a platform');
        }

        this.options.apiVersion = this.options.apiVersion || '2014-06-05';
        this.options.provider = this.options.provider || AWS.config.credentials;
        this.options.autoSubmitEvents = options.autoSubmitEvents !== false;
        this.options.autoSubmitInterval = this.options.autoSubmitInterval || 10000;
        this.options.batchSizeLimit = this.options.batchSizeLimit || 256000;
        this.options.submitCallback = this.options.submitCallback || Util.NOP;
        this.options.globalAttributes = this.options.globalAttributes || {};
        this.options.globalMetrics = this.options.globalMetrics || {};
        this.options.clientOptions = this.options.clientOptions || {};
        this.options.clientOptions.provider = this.options.clientOptions.provider || this.options.provider;
        this.options.clientOptions.apiVersion = this.options.clientOptions.apiVersion || this.options.apiVersion;
        this.options.clientOptions.correctClockSkew = this.options.clientOptions.correctClockSkew !== false;
        this.options.clientOptions.retryDelayOptions = this.options.clientOptions.retryDelayOptions || {};
        this.options.clientOptions.retryDelayOptions.base = this.options.clientOptions.retryDelayOptions.base || 3000;


        this.options.clientContext = this.options.clientContext || {
                'client'  : {
                    'client_id'       : DeviceInfo.getUniqueID(),
                    'app_title'       : this.options.appTitle,
                    'app_version_name': this.options.appVersionName,
                    'app_version_code': this.options.appVersionCode,
                    'app_package_name': this.options.appPackageName
                },
                'env'     : {
                    'platform'        : this.options.platform,
                    'platform_version': this.options.platformVersion,
                    'model'           : this.options.model,
                    'make'            : this.options.make,
                    'locale'          : this.options.locale
                },
                'services': {
                    'mobile_analytics': {
                        'app_id'     : this.options.appId,
                        'sdk_name'   : 'aws-sdk-mobile-analytics-js',
                        'sdk_version': '0.9.2' + ':' + AWS.VERSION
                    }
                },
                'custom'  : {}
            };
    }


    validateEvent(event) {
        let invalidMetrics = [];

        function customNameErrorFilter(name) {
            if (name.length === 0) {
                return true;
            }
            return name.length > 50;
        }

        function customAttrValueErrorFilter(name) {
            return event.attributes[name] && event.attributes[name].length > 200;
        }

        function validationError(errorMsg) {
            this.logger.error(errorMsg);
            return null;
        }

        invalidMetrics = Object.keys(event.metrics).filter(function (metricName) {
            return typeof event.metrics[metricName] !== 'number';
        });
        if (event.version !== 'v2.0') {
            return validationError('Event must have version v2.0');
        }
        if (typeof event.eventType !== 'string') {
            return validationError('Event Type must be a string');
        }
        if (invalidMetrics.length > 0) {
            return validationError('Event Metrics must be numeric (' + invalidMetrics[0] + ')');
        }
        if (Object.keys(event.metrics).length + Object.keys(event.attributes).length > 40) {
            return validationError('Event Metric and Attribute Count cannot exceed 40');
        }
        if (Object.keys(event.attributes).filter(customNameErrorFilter).length) {
            return validationError('Event Attribute names must be 1-50 characters');
        }
        if (Object.keys(event.metrics).filter(customNameErrorFilter).length) {
            return validationError('Event Metric names must be 1-50 characters');
        }
        if (Object.keys(event.attributes).filter(customAttrValueErrorFilter).length) {
            return validationError('Event Attribute values cannot be longer than 200 characters');
        }
        return event;
    }


    /**
     * AMA.Client.createEvent
     * @param {string} eventType - Custom Event Type to be displayed in Console
     * @param {AMA.Session} session - Session Object (required for use within console)
     * @param {string} session.id - Identifier for current session
     * @param {string} session.startTimestamp - Timestamp that indicates the start of the session
     * @param [attributes=] - Custom attributes
     * @param [metrics=] - Custom metrics
     * @returns {AMA.Event}
     */
    createEvent(eventType, session, attributes, metrics) {
        this.logger.log('[Function:(AMA.Client).createEvent]' +
            (eventType ? '\neventType:' + eventType : '') +
            (session ? '\nsession:' + session : '') +
            (attributes ? '\nattributes:' + JSON.stringify(attributes) : '') +
            (metrics ? '\nmetrics:' + JSON.stringify(metrics) : ''));
        attributes = attributes || {};
        metrics = metrics || {};

        Util.mergeObjects(attributes, this.options.globalAttributes);
        Util.mergeObjects(metrics, this.options.globalMetrics);

        Object.keys(attributes).forEach(function (name) {
            if (typeof attributes[name] !== 'string') {
                try {
                    attributes[name] = JSON.stringify(attributes[name]);
                } catch (e) {
                    this.logger.warn('Error parsing attribute ' + name);
                }
            }
        });
        let event = {
            eventType : eventType,
            timestamp : new Date().toISOString(),
            session   : {
                id            : session.id,
                startTimestamp: session.startTimestamp
            },
            version   : 'v2.0',
            attributes: attributes,
            metrics   : metrics
        };
        if (session.stopTimestamp) {
            event.session.stopTimestamp = session.stopTimestamp;
            event.session.duration = new Date(event.stopTimestamp).getTime() - new Date(event.startTimestamp).getTime();
        }
        return this.validateEvent(event);
    }


    /**
     * AMA.Client.pushEvent
     * @param {AMA.Event} event - event to be pushed onto queue
     * @returns {int} Index of event in outputs.events
     */
    pushEvent(event) {
        if (!event) {
            return -1;
        }
        this.logger.log('[Function:(AMA.Client).pushEvent]' +
            (event ? '\nevent:' + JSON.stringify(event) : ''));
        //Push adds to the end of array and returns the size of the array
        let eventIndex = this.outputs.events.push(event);
        this.storage.set(this.StorageKeys.EVENTS, this.outputs.events);
        return (eventIndex - 1);
    }

    /**
     * Helper to record events, will automatically submit if the events exceed batchSizeLimit
     * @param {string}                eventType - Custom event type name
     * @param {AMA.Session}           session - Session object
     * @param {AMA.Client.Attributes} [attributes=] - Custom attributes
     * @param {AMA.Client.Metrics}    [metrics=] - Custom metrics
     * @returns {AMA.Event} The event that was recorded
     */
    recordEvent(eventType, session, attributes, metrics) {
        this.logger.log('[Function:(AMA.Client).recordEvent]' +
            (eventType ? '\neventType:' + eventType : '') +
            (session ? '\nsession:' + session : '') +
            (attributes ? '\nattributes:' + JSON.stringify(attributes) : '') +
            (metrics ? '\nmetrics:' + JSON.stringify(metrics) : ''));
        let index, event = this.createEvent(eventType, session, attributes, metrics);
        if (event) {
            index = this.pushEvent(event);
            if (Util.getRequestBodySize(this.outputs.events) >= this.options.batchSizeLimit) {
                this.submitEvents();
            }
            return this.outputs.events[index];
        }
        return null;
    }


    /**
     * recordMonetizationEvent
     * @param session
     * @param {Object}        monetizationDetails - Details about Monetization Event
     * @param {string}        monetizationDetails.currency - ISO Currency of event
     * @param {string}        monetizationDetails.productId - Product Id of monetization event
     * @param {number}        monetizationDetails.quantity - Quantity of product in transaction
     * @param {string|number} monetizationDetails.price - Price of product either ISO formatted string, or number
     *                                                    with associated ISO Currency
     * @param {AMA.Client.Attributes} [attributes=] - Custom attributes
     * @param {AMA.Client.Metrics}    [metrics=] - Custom metrics
     * @returns {event} The event that was recorded
     */
    recordMonetizationEvent(session, monetizationDetails, attributes, metrics) {
        this.logger.log('[Function:(AMA.Client).recordMonetizationEvent]' +
            (session ? '\nsession:' + session : '') +
            (monetizationDetails ? '\nmonetizationDetails:' + JSON.stringify(monetizationDetails) : '') +
            (attributes ? '\nattributes:' + JSON.stringify(attributes) : '') +
            (metrics ? '\nmetrics:' + JSON.stringify(metrics) : ''));

        attributes = attributes || {};
        metrics = metrics || {};
        attributes._currency = monetizationDetails.currency || attributes._currency;
        attributes._product_id = monetizationDetails.productId || attributes._product_id;
        metrics._quantity = monetizationDetails.quantity || metrics._quantity;
        if (typeof monetizationDetails.price === 'number') {
            metrics._item_price = monetizationDetails.price || metrics._item_price;
        } else {
            attributes._item_price_formatted = monetizationDetails.price || attributes._item_price_formatted;
        }
        return this.recordEvent('_monetization.purchase', session, attributes, metrics);
    }


    /**
     * submitEvents
     * @param {Object} [options=] - options for submitting events
     * @param {Object} [options.clientContext=this.options.clientContext] - clientContext to submit with defaults
     *                                                                      to options.clientContext
     * @param {SubmitCallback} [options.submitCallback=this.options.submitCallback] - Callback function that is executed
     *                                                                                when events are successfully
     *                                                                                submitted
     * @returns {Array} Array of batch indices that were submitted
     */
    submitEvents(options) {
        options = options || {};
        options.submitCallback = options.submitCallback || this.options.submitCallback;
        this.logger.log('[Function:(AMA.Client).submitEvents]' +
            (options ? '\noptions:' + JSON.stringify(options) : ''));


        if (this.options.autoSubmitEvents) {
            clearTimeout(this.outputs.timeoutReference);
            this.outputs.timeoutReference = setTimeout(this.submitEvents.bind(this), this.options.autoSubmitInterval);
        }
        let warnMessage;
        //Get distribution of retries across clients by introducing a weighted rand.
        //Probability will increase over time to an upper limit of 60s
        if (this.outputs.isThrottled && this.throttlingSuppressionFunction() < Math.random()) {
            warnMessage = 'Prevented submission while throttled';
        } else if (Object.keys(this.outputs.batchesInFlight).length > 0) {
            warnMessage = 'Prevented submission while batches are in flight';
        } else if (this.outputs.batches.length === 0 && this.outputs.events.length === 0) {
            warnMessage = 'No batches or events to be submitted';
        } else if (this.outputs.lastSubmitTimestamp && Util.timestamp() - this.outputs.lastSubmitTimestamp < 1000) {
            warnMessage = 'Prevented multiple submissions in under a second';
        }
        if (warnMessage) {
            this.logger.warn(warnMessage);
            return [];
        }
        this.generateBatches();

        this.outputs.lastSubmitTimestamp = Util.timestamp();
        if (this.outputs.isThrottled) {
            //Only submit the first batch if throttled
            this.logger.warn('Is throttled submitting first batch');
            options.batchId = this.outputs.batchIndex[0];
            return [this.submitBatchById(options)];
        }

        return this.submitAllBatches(options);
    }

    throttlingSuppressionFunction(timestamp) {
        timestamp = timestamp || Util.timestamp();
        return Math.pow(timestamp - this.outputs.lastSubmitTimestamp, 2) / Math.pow(60000, 2);
    }


    generateBatches() {
        while (this.outputs.events.length > 0) {
            let lastIndex = this.outputs.events.length;
            this.logger.log(this.outputs.events.length + ' events to be submitted');
            while (lastIndex > 1 &&
            Util.getRequestBodySize(this.outputs.events.slice(0, lastIndex)) > this.options.batchSizeLimit) {
                this.logger.log('Finding Batch Size (' + this.options.batchSizeLimit + '): ' + lastIndex + '(' +
                    Util.getRequestBodySize(this.outputs.events.slice(0, lastIndex)) + ')');
                lastIndex -= 1;
            }
            if (this.persistBatch(this.outputs.events.slice(0, lastIndex))) {
                //Clear event queue
                this.outputs.events.splice(0, lastIndex);
                this.storage.set(this.StorageKeys.EVENTS, this.outputs.events);
            }
        }
    }


    persistBatch(eventBatch) {
        this.logger.log(eventBatch.length + ' events in batch');
        if (Util.getRequestBodySize(eventBatch) < 512000) {
            let batchId = Util.GUID();
            //Save batch so data is not lost.
            this.outputs.batches[batchId] = eventBatch;
            this.storage.set(this.StorageKeys.BATCHES, this.outputs.batches);
            this.outputs.batchIndex.push(batchId);
            this.storage.set(this.StorageKeys.BATCH_INDEX, this.outputs.batchIndex);
            return true;
        }
        this.logger.error('Events too large');
        return false;
    }

    submitAllBatches(options) {
        options.submitCallback = options.submitCallback || this.options.submitCallback;
        this.logger.log('[Function:(AMA.Client).submitAllBatches]' +
            (options ? '\noptions:' + JSON.stringify(options) : ''));
        let indices = [],
            that    = this;
        this.outputs.batchIndex.forEach(function (batchIndex) {
            options.batchId = batchIndex;
            options.clientContext = options.clientContext || that.options.clientContext;
            if (!that.outputs.batchesInFlight[batchIndex]) {
                indices.push(that.submitBatchById(options));
            }
        });
        return indices;
    }


    submitBatchById(options) {
        if (typeof(options) !== 'object' || !options.batchId) {
            this.logger.error('Invalid Options passed to submitBatchById');
            return;
        }
        options.submitCallback = options.submitCallback || this.options.submitCallback;
        this.logger.log('[Function:(AMA.Client).submitBatchById]' +
            (options ? '\noptions:' + JSON.stringify(options) : ''));
        let eventBatch = {
            'events'       : this.outputs.batches[options.batchId],
            'clientContext': JSON.stringify(options.clientContext || this.options.clientContext)
        };
        this.outputs.batchesInFlight[options.batchId] = Util.timestamp();
        this.outputs.MobileAnalytics.putEvents(eventBatch,
            this.handlePutEventsResponse(options.batchId, options.submitCallback));
        return options.batchId;
    }


    handlePutEventsResponse(batchId, callback) {
        const NON_RETRYABLE_EXCEPTIONS = ['BadRequestException', 'SerializationException', 'ValidationException'];
        let self = this;
        return function (err, data) {
            let clearBatch = true,
                wasThrottled = self.outputs.isThrottled;
            if (err) {
                self.logger.error(err, data);
                if (err.statusCode === undefined || err.statusCode === 400) {
                    if (NON_RETRYABLE_EXCEPTIONS.indexOf(err.code) < 0) {
                        clearBatch = false;
                    }
                    self.outputs.isThrottled = err.code === 'ThrottlingException';
                    if (self.outputs.isThrottled) {
                        self.logger.warn('Application is currently throttled');
                    }
                }
            } else {
                self.logger.info('Events Submitted Successfully');
                self.outputs.isThrottled = false;
            }
            if (clearBatch) {
                self.clearBatchById(batchId);
            }
            delete self.outputs.batchesInFlight[batchId];
            callback(err, data, batchId);
            if (wasThrottled && !self.outputs.isThrottled) {
                self.logger.warn('Was throttled flushing remaining batches', callback);
                self.submitAllBatches({
                    submitCallback: callback
                });
            }
        };
    }


    clearBatchById(batchId) {
        this.logger.log('[Function:(AMA.Client).clearBatchById]' +
            (batchId ? '\nbatchId:' + batchId : ''));
        if (this.outputs.batchIndex.indexOf(batchId) !== -1) {
            delete this.outputs.batches[batchId];
            this.outputs.batchIndex.splice(this.outputs.batchIndex.indexOf(batchId), 1);

            // Persist latest batches / events
            this.storage.set(this.StorageKeys.BATCH_INDEX, this.outputs.batchIndex);
            this.storage.set(this.StorageKeys.BATCHES, this.outputs.batches);
        }
    }



}