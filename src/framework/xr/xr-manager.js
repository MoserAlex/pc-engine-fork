import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { Mat3 } from '../../core/math/mat3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';

import { XRTYPE_INLINE, XRTYPE_VR, XRTYPE_AR, XRDEPTHSENSINGUSAGE_CPU, XRDEPTHSENSINGFORMAT_L8A8 } from './constants.js';
import { XrDepthSensing } from './xr-depth-sensing.js';
import { XrDomOverlay } from './xr-dom-overlay.js';
import { XrHitTest } from './xr-hit-test.js';
import { XrImageTracking } from './xr-image-tracking.js';
import { XrInput } from './xr-input.js';
import { XrLightEstimation } from './xr-light-estimation.js';
import { XrPlaneDetection } from './xr-plane-detection.js';

/**
 * Callback used by {@link XrManager#endXr} and {@link XrManager#startXr}.
 *
 * @callback XrErrorCallback
 * @param {Error|null} err - The Error object or null if operation was successful.
 */

/**
 * Manage and update XR session and its states.
 *
 * @augments EventHandler
 */
class XrManager extends EventHandler {
    /**
     * @type {import('../app-base.js').AppBase}
     * @ignore
     */
    app;

    /**
     * @type {boolean}
     * @private
     */
    _supported = platform.browser && !!navigator.xr;

    /**
     * @type {Object<string, boolean>}
     * @private
     */
    _available = {};

    /**
     * @type {string|null}
     * @private
     */
    _type = null;

    /**
     * @type {string|null}
     * @private
     */
    _spaceType = null;

    /**
     * @type {XRSession|null}
     * @private
     */
    _session = null;

    /**
     * @type {XRWebGLLayer|null}
     * @private
     */
    _baseLayer = null;

    /**
     * @type {XRReferenceSpace|null}
     * @private
     */
    _referenceSpace = null;

    /**
     * Provides access to depth sensing capabilities.
     *
     * @type {XrDepthSensing}
     * @ignore
     */
    depthSensing;

    /**
     * Provides access to DOM overlay capabilities.
     *
     * @type {XrDomOverlay}
     * @ignore
     */
    domOverlay;

    /**
     * Provides the ability to perform hit tests on the representation of real world geometry
     * of the underlying AR system.
     *
     * @type {XrHitTest}
     */
    hitTest;

    /**
     * Provides access to image tracking capabilities.
     *
     * @type {XrImageTracking}
     * @ignore
     */
    imageTracking;

    /**
     * Provides access to plane detection capabilities.
     *
     * @type {XrPlaneDetection}
     * @ignore
     */
    planeDetection;

    /**
     * Provides access to Input Sources.
     *
     * @type {XrInput}
     */
    input;

    /**
     * Provides access to light estimation capabilities.
     *
     * @type {XrLightEstimation}
     * @ignore
     */
    lightEstimation;

    /**
     * @type {import('../components/camera/component.js').CameraComponent}
     * @private
     */
    _camera = null;

    /**
     * @type {Array<*>}
     * @ignore
     */
    views = [];

    /**
     * @type {Array<*>}
     * @ignore
     */
    viewsPool = [];

    /**
     * @type {Vec3}
     * @private
     */
    _localPosition = new Vec3();

    /**
     * @type {Quat}
     * @private
     */
    _localRotation = new Quat();

    /**
     * @type {number}
     * @private
     */
    _depthNear = 0.1;

    /**
     * @type {number}
     * @private
     */
    _depthFar = 1000;

    /**
     * @type {number}
     * @private
     */
    _width = 0;

    /**
     * @type {number}
     * @private
     */
    _height = 0;

    /**
     * Create a new XrManager instance.
     *
     * @param {import('../app-base.js').AppBase} app - The main application.
     * @hideconstructor
     */
    constructor(app) {
        super();

        this.app = app;

        // Add all the supported session types
        this._available[XRTYPE_INLINE] = false;
        this._available[XRTYPE_VR] = false;
        this._available[XRTYPE_AR] = false;

        this.depthSensing = new XrDepthSensing(this);
        this.domOverlay = new XrDomOverlay(this);
        this.hitTest = new XrHitTest(this);
        this.imageTracking = new XrImageTracking(this);
        this.planeDetection = new XrPlaneDetection(this);
        this.input = new XrInput(this);
        this.lightEstimation = new XrLightEstimation(this);

        // TODO
        // 1. HMD class with its params
        // 2. Space class
        // 3. Controllers class

        if (this._supported) {
            navigator.xr.addEventListener('devicechange', () => {
                this._deviceAvailabilityCheck();
            });
            this._deviceAvailabilityCheck();
        }
    }

    /**
     * Fired when availability of specific XR type is changed.
     *
     * @event XrManager#available
     * @param {string} type - The session type that has changed availability.
     * @param {boolean} available - True if specified session type is now available.
     * @example
     * app.xr.on('available', function (type, available) {
     *     console.log('"' + type + '" XR session is now ' + (available ? 'available' : 'unavailable'));
     * });
     */

    /**
     * Fired when availability of specific XR type is changed.
     *
     * @event XrManager#available:[type]
     * @param {boolean} available - True if specified session type is now available.
     * @example
     * app.xr.on('available:' + pc.XRTYPE_VR, function (available) {
     *     console.log('Immersive VR session is now ' + (available ? 'available' : 'unavailable'));
     * });
     */

    /**
     * Fired when XR session is started.
     *
     * @event XrManager#start
     * @example
     * app.xr.on('start', function () {
     *     // XR session has started
     * });
     */

    /**
     * Fired when XR session is ended.
     *
     * @event XrManager#end
     * @example
     * app.xr.on('end', function () {
     *     // XR session has ended
     * });
     */

    /**
     * Fired when XR session is updated, providing relevant XRFrame object.
     *
     * @event XrManager#update
     * @param {object} frame - [XRFrame](https://developer.mozilla.org/en-US/docs/Web/API/XRFrame)
     * object that can be used for interfacing directly with WebXR APIs.
     * @example
     * app.xr.on('update', function (frame) {
     *
     * });
     */

    /**
     * Fired when XR session is failed to start or failed to check for session type support.
     *
     * @event XrManager#error
     * @param {Error} error - Error object related to failure of session start or check of session
     * type support.
     * @example
     * app.xr.on('error', function (ex) {
     *     // XR session has failed to start, or failed to check for session type support
     * });
     */

    /**
     * Destroys the XrManager instance.
     *
     * @ignore
     */
    destroy() {
        this.depthSensing.destroy();
        this.depthSensing = null;
    }

    /**
     * Attempts to start XR session for provided {@link CameraComponent} and optionally fires
     * callback when session is created or failed to create. Integrated XR APIs need to be enabled
     * by providing relevant options.
     *
     * @param {import('../components/camera/component.js').CameraComponent} camera - It will be
     * used to render XR session and manipulated based on pose tracking.
     * @param {string} type - Session type. Can be one of the following:
     *
     * - {@link XRTYPE_INLINE}: Inline - always available type of session. It has limited features
     * availability and is rendered into HTML element.
     * - {@link XRTYPE_VR}: Immersive VR - session that provides exclusive access to VR device with
     * best available tracking features.
     * - {@link XRTYPE_AR}: Immersive AR - session that provides exclusive access to VR/AR device
     * that is intended to be blended with real-world environment.
     *
     * @param {string} spaceType - Reference space type. Can be one of the following:
     *
     * - {@link XRSPACE_VIEWER}: Viewer - always supported space with some basic tracking
     * capabilities.
     * - {@link XRSPACE_LOCAL}: Local - represents a tracking space with a native origin near the
     * viewer at the time of creation. It is meant for seated or basic local XR sessions.
     * - {@link XRSPACE_LOCALFLOOR}: Local Floor - represents a tracking space with a native origin
     * at the floor in a safe position for the user to stand. The y axis equals 0 at floor level.
     * Floor level value might be estimated by the underlying platform. It is meant for seated or
     * basic local XR sessions.
     * - {@link XRSPACE_BOUNDEDFLOOR}: Bounded Floor - represents a tracking space with its native
     * origin at the floor, where the user is expected to move within a pre-established boundary.
     * - {@link XRSPACE_UNBOUNDED}: Unbounded - represents a tracking space where the user is
     * expected to move freely around their environment, potentially long distances from their
     * starting point.
     *
     * @param {object} [options] - Object with additional options for XR session initialization.
     * @param {string[]} [options.optionalFeatures] - Optional features for XRSession start. It is
     * used for getting access to additional WebXR spec extensions.
     * @param {boolean} [options.imageTracking] - Set to true to attempt to enable
     * {@link XrImageTracking}.
     * @param {boolean} [options.planeDetection] - Set to true to attempt to enable
     * {@link XrPlaneDetection}.
     * @param {XrErrorCallback} [options.callback] - Optional callback function called once session
     * is started. The callback has one argument Error - it is null if successfully started XR
     * session.
     * @param {object} [options.depthSensing] - Optional object with depth sensing parameters to
     * attempt to enable {@link XrDepthSensing}.
     * @param {string} [options.depthSensing.usagePreference] - Optional usage preference for depth
     * sensing, can be 'cpu-optimized' or 'gpu-optimized' (XRDEPTHSENSINGUSAGE_*), defaults to
     * 'cpu-optimized'. Most preferred and supported will be chosen by the underlying depth sensing
     * system.
     * @param {string} [options.depthSensing.dataFormatPreference] - Optional data format
     * preference for depth sensing, can be 'luminance-alpha' or 'float32'
     * (XRDEPTHSENSINGFORMAT_*), defaults to 'luminance-alpha'. Most preferred and supported will
     * be chosen by the underlying depth sensing system.
     * @example
     * button.on('click', function () {
     *     app.xr.start(camera, pc.XRTYPE_VR, pc.XRSPACE_LOCALFLOOR);
     * });
     * @example
     * button.on('click', function () {
     *     app.xr.start(camera, pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
     *         depthSensing: { }
     *     });
     * });
     */
    start(camera, type, spaceType, options) {
        let callback = options;

        if (typeof options === 'object')
            callback = options.callback;

        if (!this._available[type]) {
            if (callback) callback(new Error('XR is not available'));
            return;
        }

        if (this._session) {
            if (callback) callback(new Error('XR session is already started'));
            return;
        }

        this._camera = camera;
        this._camera.camera.xr = this;
        this._type = type;
        this._spaceType = spaceType;

        this._setClipPlanes(camera.nearClip, camera.farClip);

        // TODO
        // makeXRCompatible
        // scenario to test:
        // 1. app is running on integrated GPU
        // 2. XR device is connected, to another GPU
        // 3. probably immersive-vr will fail to be created
        // 4. call makeXRCompatible, very likely will lead to context loss

        const opts = {
            requiredFeatures: [spaceType],
            optionalFeatures: []
        };

        if (type === XRTYPE_AR) {
            opts.optionalFeatures.push('light-estimation');
            opts.optionalFeatures.push('hit-test');

            if (options) {
                if (options.imageTracking && this.imageTracking.supported)
                    opts.optionalFeatures.push('image-tracking');

                if (options.planeDetection)
                    opts.optionalFeatures.push('plane-detection');
            }

            if (this.domOverlay.supported && this.domOverlay.root) {
                opts.optionalFeatures.push('dom-overlay');
                opts.domOverlay = { root: this.domOverlay.root };
            }

            if (options && options.depthSensing && this.depthSensing.supported) {
                opts.optionalFeatures.push('depth-sensing');

                const usagePreference = [XRDEPTHSENSINGUSAGE_CPU];
                const dataFormatPreference = [XRDEPTHSENSINGFORMAT_L8A8];

                if (options.depthSensing.usagePreference) {
                    const ind = usagePreference.indexOf(options.depthSensing.usagePreference);
                    if (ind !== -1) usagePreference.splice(ind, 1);
                    usagePreference.unshift(options.depthSensing.usagePreference);
                }

                if (options.depthSensing.dataFormatPreference) {
                    const ind = dataFormatPreference.indexOf(options.depthSensing.dataFormatPreference);
                    if (ind !== -1) dataFormatPreference.splice(ind, 1);
                    dataFormatPreference.unshift(options.depthSensing.dataFormatPreference);
                }

                opts.depthSensing = {
                    usagePreference: usagePreference,
                    dataFormatPreference: dataFormatPreference
                };
            }
        } else if (type === XRTYPE_VR) {
            opts.optionalFeatures.push('hand-tracking');
        }

        if (options && options.optionalFeatures)
            opts.optionalFeatures = opts.optionalFeatures.concat(options.optionalFeatures);

        if (this.imageTracking.supported && this.imageTracking.images.length) {
            this.imageTracking.prepareImages((err, trackedImages) => {
                if (err) {
                    if (callback) callback(err);
                    this.fire('error', err);
                    return;
                }

                if (trackedImages !== null)
                    opts.trackedImages = trackedImages;

                this._onStartOptionsReady(type, spaceType, opts, callback);
            });
        } else {
            this._onStartOptionsReady(type, spaceType, opts, callback);
        }
    }

    /**
     * @param {string} type - Session type.
     * @param {string} spaceType - Reference space type.
     * @param {*} options - Session options.
     * @param {XrErrorCallback} callback - Error callback.
     * @private
     */
    _onStartOptionsReady(type, spaceType, options, callback) {
        navigator.xr.requestSession(type, options).then((session) => {
            this._onSessionStart(session, spaceType, callback);
        }).catch((ex) => {
            this._camera.camera.xr = null;
            this._camera = null;
            this._type = null;
            this._spaceType = null;

            if (callback) callback(ex);
            this.fire('error', ex);
        });
    }

    /**
     * Attempts to end XR session and optionally fires callback when session is ended or failed to
     * end.
     *
     * @param {XrErrorCallback} [callback] - Optional callback function called once session is
     * started. The callback has one argument Error - it is null if successfully started XR
     * session.
     * @example
     * app.keyboard.on('keydown', function (evt) {
     *     if (evt.key === pc.KEY_ESCAPE && app.xr.active) {
     *         app.xr.end();
     *     }
     * });
     */
    end(callback) {
        if (!this._session) {
            if (callback) callback(new Error('XR Session is not initialized'));
            return;
        }

        if (callback) this.once('end', callback);

        this._session.end();
    }

    /**
     * Check if specific type of session is available.
     *
     * @param {string} type - Session type. Can be one of the following:
     *
     * - {@link XRTYPE_INLINE}: Inline - always available type of session. It has limited features
     * availability and is rendered into HTML element.
     * - {@link XRTYPE_VR}: Immersive VR - session that provides exclusive access to VR device with
     * best available tracking features.
     * - {@link XRTYPE_AR}: Immersive AR - session that provides exclusive access to VR/AR device
     * that is intended to be blended with real-world environment.
     *
     * @example
     * if (app.xr.isAvailable(pc.XRTYPE_VR)) {
     *     // VR is available
     * }
     * @returns {boolean} True if specified session type is available.
     */
    isAvailable(type) {
        return this._available[type];
    }

    /** @private */
    _deviceAvailabilityCheck() {
        for (const key in this._available) {
            this._sessionSupportCheck(key);
        }
    }

    /**
     * @param {string} type - Session type.
     * @private
     */
    _sessionSupportCheck(type) {
        navigator.xr.isSessionSupported(type).then((available) => {
            if (this._available[type] === available)
                return;

            this._available[type] = available;
            this.fire('available', type, available);
            this.fire('available:' + type, available);
        }).catch((ex) => {
            this.fire('error', ex);
        });
    }

    /**
     * @param {XRSession} session - XR session.
     * @param {string} spaceType - Space type to request for the session.
     * @param {Function} callback - Callback to call when session is started.
     * @private
     */
    _onSessionStart(session, spaceType, callback) {
        let failed = false;

        this._session = session;

        const onVisibilityChange = () => {
            this.fire('visibility:change', session.visibilityState);
        };

        const onClipPlanesChange = () => {
            this._setClipPlanes(this._camera.nearClip, this._camera.farClip);
        };

        // clean up once session is ended
        const onEnd = () => {
            if (this._camera) {
                this._camera.off('set_nearClip', onClipPlanesChange);
                this._camera.off('set_farClip', onClipPlanesChange);

                this._camera.camera.xr = null;
                this._camera = null;
            }

            session.removeEventListener('end', onEnd);
            session.removeEventListener('visibilitychange', onVisibilityChange);

            if (!failed) this.fire('end');

            this._session = null;
            this._referenceSpace = null;
            this.views = [];
            this._width = 0;
            this._height = 0;
            this._type = null;
            this._spaceType = null;

            // old requestAnimationFrame will never be triggered,
            // so queue up new tick
            this.app.tick();
        };

        session.addEventListener('end', onEnd);
        session.addEventListener('visibilitychange', onVisibilityChange);

        this._camera.on('set_nearClip', onClipPlanesChange);
        this._camera.on('set_farClip', onClipPlanesChange);

        this._baseLayer = new XRWebGLLayer(session, this.app.graphicsDevice.gl, {
            alpha: true,
            depth: true,
            stencil: true
        });

        session.updateRenderState({
            baseLayer: this._baseLayer,
            depthNear: this._depthNear,
            depthFar: this._depthFar
        });

        // request reference space
        session.requestReferenceSpace(spaceType).then((referenceSpace) => {
            this._referenceSpace = referenceSpace;

            // old requestAnimationFrame will never be triggered,
            // so queue up new tick
            this.app.tick();

            if (callback) callback(null);
            this.fire('start');
        }).catch((ex) => {
            failed = true;
            session.end();
            if (callback) callback(ex);
            this.fire('error', ex);
        });
    }

    /**
     * @param {number} near - Near plane distance.
     * @param {number} far - Far plane distance.
     * @private
     */
    _setClipPlanes(near, far) {
        if (this._depthNear === near && this._depthFar === far)
            return;

        this._depthNear = near;
        this._depthFar = far;

        if (!this._session)
            return;

        // if session is available,
        // queue up render state update
        this._session.updateRenderState({
            depthNear: this._depthNear,
            depthFar: this._depthFar
        });
    }

    /**
     * @param {*} frame - XRFrame from requestAnimationFrame callback.
     *
     * @returns {boolean} True if update was successful, false otherwise.
     * @ignore
     */
    update(frame) {
        if (!this._session) return false;

        // canvas resolution should be set on first frame availability or resolution changes
        const width = frame.session.renderState.baseLayer.framebufferWidth;
        const height = frame.session.renderState.baseLayer.framebufferHeight;
        if (this._width !== width || this._height !== height) {
            this._width = width;
            this._height = height;
            this.app.graphicsDevice.setResolution(width, height);
        }

        const pose = frame.getViewerPose(this._referenceSpace);

        if (!pose) return false;

        const lengthNew = pose.views.length;

        if (lengthNew > this.views.length) {
            // add new views into list
            for (let i = 0; i <= (lengthNew - this.views.length); i++) {
                let view = this.viewsPool.pop();
                if (!view) {
                    view = {
                        viewport: new Vec4(),
                        projMat: new Mat4(),
                        viewMat: new Mat4(),
                        viewOffMat: new Mat4(),
                        viewInvMat: new Mat4(),
                        viewInvOffMat: new Mat4(),
                        projViewOffMat: new Mat4(),
                        viewMat3: new Mat3(),
                        position: new Float32Array(3),
                        rotation: new Quat()
                    };
                }

                this.views.push(view);
            }
        } else if (lengthNew <= this.views.length) {
            // remove views from list into pool
            for (let i = 0; i < (this.views.length - lengthNew); i++) {
                this.viewsPool.push(this.views.pop());
            }
        }

        // reset position
        const posePosition = pose.transform.position;
        const poseOrientation = pose.transform.orientation;
        this._localPosition.set(posePosition.x, posePosition.y, posePosition.z);
        this._localRotation.set(poseOrientation.x, poseOrientation.y, poseOrientation.z, poseOrientation.w);

        const layer = frame.session.renderState.baseLayer;

        for (let i = 0; i < pose.views.length; i++) {
            // for each view, calculate matrices
            const viewRaw = pose.views[i];
            const view = this.views[i];
            const viewport = layer.getViewport(viewRaw);

            view.viewport.x = viewport.x;
            view.viewport.y = viewport.y;
            view.viewport.z = viewport.width;
            view.viewport.w = viewport.height;

            view.projMat.set(viewRaw.projectionMatrix);
            view.viewMat.set(viewRaw.transform.inverse.matrix);
            view.viewInvMat.set(viewRaw.transform.matrix);
        }

        // position and rotate camera based on calculated vectors
        this._camera.camera._node.setLocalPosition(this._localPosition);
        this._camera.camera._node.setLocalRotation(this._localRotation);

        this.input.update(frame);

        if (this._type === XRTYPE_AR) {
            if (this.hitTest.supported)
                this.hitTest.update(frame);

            if (this.lightEstimation.supported)
                this.lightEstimation.update(frame);

            if (this.depthSensing.supported)
                this.depthSensing.update(frame, pose && pose.views[0]);

            if (this.imageTracking.supported)
                this.imageTracking.update(frame);

            if (this.planeDetection.supported)
                this.planeDetection.update(frame);
        }

        this.fire('update', frame);

        return true;
    }

    /**
     * True if XR is supported.
     *
     * @type {boolean}
     */
    get supported() {
        return this._supported;
    }

    /**
     * True if XR session is running.
     *
     * @type {boolean}
     */
    get active() {
        return !!this._session;
    }

    /**
     * Returns type of currently running XR session or null if no session is running. Can be any of
     * XRTYPE_*.
     *
     * @type {string|null}
     */
    get type() {
        return this._type;
    }

    /**
     * Returns reference space type of currently running XR session or null if no session is
     * running. Can be any of XRSPACE_*.
     *
     * @type {string|null}
     */
    get spaceType() {
        return this._spaceType;
    }

    /**
     * Provides access to XRSession of WebXR.
     *
     * @type {object|null}
     */
    get session() {
        return this._session;
    }

    /**
     * Active camera for which XR session is running or null.
     *
     * @type {import('../entity.js').Entity|null}
     */
    get camera() {
        return this._camera ? this._camera.entity : null;
    }

    /**
     * Indicates whether WebXR content is currently visible to the user, and if it is, whether it's
     * the primary focus. Can be 'hidden', 'visible' or 'visible-blurred'.
     *
     * @type {string}
     * @ignore
     */
    get visibilityState() {
        if (!this._session)
            return null;

        return this._session.visibilityState;
    }
}

export { XrManager };
