import { ASPECT_AUTO, LAYERID_UI, LAYERID_DEPTH } from '../../../scene/constants.js';
import { Camera } from '../../../scene/camera.js';

import { Component } from '../component.js';

import { PostEffectQueue } from './post-effect-queue.js';
import { Debug } from '../../../core/debug.js';

// note: when this list is modified, the copy() function needs to be adjusted
const properties = [
    { name: 'aspectRatio', readonly: false },
    { name: 'aspectRatioMode', readonly: false },
    { name: 'calculateProjection', readonly: false },
    { name: 'calculateTransform', readonly: false },
    { name: 'clearColor', readonly: false },
    { name: 'cullFaces', readonly: false },
    { name: 'farClip', readonly: false },
    { name: 'flipFaces', readonly: false },
    { name: 'fov', readonly: false },
    { name: 'frustumCulling', readonly: false },
    { name: 'horizontalFov', readonly: false },
    { name: 'nearClip', readonly: false },
    { name: 'orthoHeight', readonly: false },
    { name: 'projection', readonly: false },
    { name: 'scissorRect', readonly: false },
    { name: 'aperture', readonly: false },
    { name: 'shutter', readonly: false },
    { name: 'sensitivity', readonly: false }
];

/**
 * Callback used by {@link CameraComponent#calculateTransform} and {@link CameraComponent#calculateProjection}.
 *
 * @callback CalculateMatrixCallback
 * @param {import('../../../core/math/mat4.js').Mat4} transformMatrix - Output of the function.
 * @param {number} view - Type of view. Can be {@link VIEW_CENTER}, {@link VIEW_LEFT} or {@link VIEW_RIGHT}. Left and right are only used in stereo rendering.
 */

/**
 * The Camera Component enables an Entity to render the scene. A scene requires at least one
 * enabled camera component to be rendered. Note that multiple camera components can be enabled
 * simultaneously (for split-screen or offscreen rendering, for example).
 *
 * ```javascript
 * // Add a pc.CameraComponent to an entity
 * var entity = new pc.Entity();
 * entity.addComponent('camera', {
 *     nearClip: 1,
 *     farClip: 100,
 *     fov: 55
 * });
 *
 * // Get the pc.CameraComponent on an entity
 * var cameraComponent = entity.camera;
 *
 * // Update a property on a camera component
 * entity.camera.nearClip = 2;
 * ```
 *
 * @property {number} projection The type of projection used to render the camera. Can be:
 *
 * - {@link PROJECTION_PERSPECTIVE}: A perspective projection. The camera frustum
 * resembles a truncated pyramid.
 * - {@link PROJECTION_ORTHOGRAPHIC}: An orthographic projection. The camera
 * frustum is a cuboid.
 *
 * Defaults to {@link PROJECTION_PERSPECTIVE}.
 * @property {number} aspectRatio The aspect ratio (width divided by height) of the camera. If
 * aspectRatioMode is {@link ASPECT_AUTO}, then this value will be automatically calculated every
 * frame, and you can only read it. If it's ASPECT_MANUAL, you can set the value.
 * @property {number} aspectRatioMode The aspect ratio mode of the camera. Can be:
 *
 * - {@link ASPECT_AUTO}: aspect ratio will be calculated from the current render
 * target's width divided by height.
 * - {@link ASPECT_MANUAL}: use the aspectRatio value.
 *
 * Defaults to {@link ASPECT_AUTO}.
 * @property {import('../../../core/math/color.js').Color} clearColor The color used to clear the
 * canvas to before the camera starts to render. Defaults to [0.75, 0.75, 0.75, 1].
 * @property {number} farClip The distance from the camera after which no rendering will take
 * place. Defaults to 1000.
 * @property {number} fov The field of view of the camera in degrees. Usually this is the Y-axis
 * field of view, see {@link CameraComponent#horizontalFov}. Used for
 * {@link PROJECTION_PERSPECTIVE} cameras only. Defaults to 45.
 * @property {boolean} horizontalFov Set which axis to use for the Field of View calculation.
 * Defaults to false.
 * @property {number} nearClip The distance from the camera before which no rendering will take
 * place. Defaults to 0.1.
 * @property {number} orthoHeight The half-height of the orthographic view window (in the Y-axis).
 * Used for {@link PROJECTION_ORTHOGRAPHIC} cameras only. Defaults to 10.
 * @property {import('../../../core/math/vec4.js').Vec4}} scissorRect Clips all pixels which are
 * not in the rectangle. The order of the values is [x, y, width, height]. Defaults to [0, 0, 1, 1].
 * @property {boolean} frustumCulling Controls the culling of mesh instances against the camera
 * frustum, i.e. if objects outside of camera should be omitted from rendering. If false, all mesh
 * instances in the scene are rendered by the camera, regardless of visibility. Defaults to false.
 * @property {CalculateMatrixCallback} calculateTransform Custom function you can provide to
 * calculate the camera transformation matrix manually. Can be used for complex effects like
 * reflections. Function is called using component's scope. Arguments:
 *
 * - {@link Mat4} transformMatrix: output of the function.
 * - view: Type of view. Can be {@link VIEW_CENTER}, {@link VIEW_LEFT} or {@link VIEW_RIGHT}.
 *
 * Left and right are only used in stereo rendering.
 * @property {CalculateMatrixCallback} calculateProjection Custom function you can provide to
 * calculate the camera projection matrix manually. Can be used for complex effects like doing
 * oblique projection. Function is called using component's scope. Arguments:
 *
 * - {@link Mat4} transformMatrix: output of the function
 * - view: Type of view. Can be {@link VIEW_CENTER}, {@link VIEW_LEFT} or {@link VIEW_RIGHT}.
 *
 * Left and right are only used in stereo rendering.
 * @property {boolean} cullFaces If true the camera will take material.cull into account. Otherwise
 * both front and back faces will be rendered. Defaults to true.
 * @property {boolean} flipFaces If true the camera will invert front and back faces. Can be useful
 * for reflection rendering. Defaults to false.
 * @augments Component
 */
class CameraComponent extends Component {
    /**
     * Custom function that is called when postprocessing should execute.
     *
     * @type {Function}
     * @ignore
     */
    onPostprocessing = null;

    /**
     * Custom function that is called before the camera renders the scene.
     *
     * @type {Function}
     */
    onPreRender = null;

    /**
     * Custom function that is called after the camera renders the scene.
     *
     * @type {Function}
     */
    onPostRender = null;

    /**
     * A counter of requests of depth map rendering.
     *
     * @type {number}
     * @private
     */
    _renderSceneDepthMap = 0;

    /**
     * A counter of requests of color map rendering.
     *
     * @type {number}
     * @private
     */
    _renderSceneColorMap = 0;

    /**
     * Create a new CameraComponent instance.
     *
     * @param {import('./system.js').CameraComponentSystem} system - The ComponentSystem that
     * created this Component.
     * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
     * attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        this._camera = new Camera();
        this._camera.node = entity;

        this._priority = 0;

        // layer id at which the postprocessing stops for the camera
        this._disablePostEffectsLayer = LAYERID_UI;

        // postprocessing management
        this._postEffects = new PostEffectQueue(system.app, this);

        this._sceneDepthMapRequested = false;
        this._sceneColorMapRequested = false;
    }

    /**
     * Queries the camera component's underlying Camera instance.
     *
     * @type {Camera}
     * @ignore
     */
    get camera() {
        return this._camera;
    }

    /**
     * If true the camera will clear the color buffer to the color set in clearColor. Defaults to true.
     *
     * @type {boolean}
     */
    set clearColorBuffer(value) {
        this._camera.clearColorBuffer = value;
        this.dirtyLayerCompositionCameras();
    }

    get clearColorBuffer() {
        return this._camera.clearColorBuffer;
    }

    /**
     * If true the camera will clear the depth buffer. Defaults to true.
     *
     * @type {boolean}
     */
    set clearDepthBuffer(value) {
        this._camera.clearDepthBuffer = value;
        this.dirtyLayerCompositionCameras();
    }

    get clearDepthBuffer() {
        return this._camera.clearDepthBuffer;
    }

    /**
     * If true the camera will clear the stencil buffer. Defaults to true.
     *
     * @type {boolean}
     */
    set clearStencilBuffer(value) {
        this._camera.clearStencilBuffer = value;
        this.dirtyLayerCompositionCameras();
    }

    get clearStencilBuffer() {
        return this._camera.clearStencilBuffer;
    }

    /**
     * Layer ID of a layer on which the postprocessing of the camera stops being applied to.
     * Defaults to LAYERID_UI, which causes post processing to not be applied to UI layer and any
     * following layers for the camera. Set to undefined for post-processing to be applied to all
     * layers of the camera.
     *
     * @type {number}
     */
    set disablePostEffectsLayer(layer) {
        this._disablePostEffectsLayer = layer;
        this.dirtyLayerCompositionCameras();
    }

    get disablePostEffectsLayer() {
        return this._disablePostEffectsLayer;
    }

    // based on the value, the depth layer's enable counter is incremented or decremented
    _enableDepthLayer(value) {
        const hasDepthLayer = this.layers.find(layerId => layerId === LAYERID_DEPTH);
        if (hasDepthLayer) {

            /** @type {import('../../../scene/layer.js').Layer} */
            const depthLayer = this.system.app.scene.layers.getLayerById(LAYERID_DEPTH);

            if (value) {
                depthLayer?.incrementCounter();
            } else {
                depthLayer?.decrementCounter();
            }
        } else if (value) {
            return false;
        }

        return true;
    }

    /**
     * Request the scene to generate a texture containing the scene color map. Note that this call
     * is accummulative, and for each enable request, a disable request need to be called.
     *
     * @param {boolean} enabled - True to request the generation, false to disable it.
     */
    requestSceneColorMap(enabled) {
        this._renderSceneColorMap += enabled ? 1 : -1;
        Debug.assert(this._renderSceneColorMap >= 0);
        const ok = this._enableDepthLayer(enabled);
        if (!ok) {
            Debug.warnOnce('CameraComponent.requestSceneColorMap was called, but the camera does not have a Depth layer, ignoring.');
        }
    }

    set renderSceneColorMap(value) {
        if (value && !this._sceneColorMapRequested) {
            this.requestSceneColorMap(true);
            this._sceneColorMapRequested = true;
        } else if (this._sceneColorMapRequested) {
            this.requestSceneColorMap(false);
            this._sceneColorMapRequested = false;
        }
    }

    get renderSceneColorMap() {
        return this._renderSceneColorMap > 0;
    }

    /**
     * Request the scene to generate a texture containing the scene depth map. Note that this call
     * is accummulative, and for each enable request, a disable request need to be called.
     *
     * @param {boolean} enabled - True to request the generation, false to disable it.
     */
    requestSceneDepthMap(enabled) {
        this._renderSceneDepthMap += enabled ? 1 : -1;
        Debug.assert(this._renderSceneDepthMap >= 0);
        const ok = this._enableDepthLayer(enabled);
        if (!ok) {
            Debug.warnOnce('CameraComponent.requestSceneDepthMap was called, but the camera does not have a Depth layer, ignoring.');
        }
    }

    set renderSceneDepthMap(value) {
        if (value && !this._sceneDepthMapRequested) {
            this.requestSceneDepthMap(true);
            this._sceneDepthMapRequested = true;
        } else if (this._sceneDepthMapRequested) {
            this.requestSceneDepthMap(false);
            this._sceneDepthMapRequested = false;
        }
    }

    get renderSceneDepthMap() {
        return this._renderSceneDepthMap > 0;
    }

    /**
     * Queries the camera's frustum shape.
     *
     * @type {import('../../../core/shape/frustum.js').Frustum}
     */
    get frustum() {
        return this._camera.frustum;
    }

    /**
     * An array of layer IDs ({@link Layer#id}) to which this camera should belong. Don't push,
     * pop, splice or modify this array, if you want to change it, set a new one instead. Defaults
     * to [LAYERID_WORLD, LAYERID_DEPTH, LAYERID_SKYBOX, LAYERID_UI, LAYERID_IMMEDIATE].
     *
     * @type {number[]}
     */
    set layers(newValue) {
        const layers = this._camera.layers;
        for (let i = 0; i < layers.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(layers[i]);
            if (!layer) continue;
            layer.removeCamera(this);
        }

        this._camera.layers = newValue;

        if (!this.enabled || !this.entity.enabled) return;

        for (let i = 0; i < newValue.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(newValue[i]);
            if (!layer) continue;
            layer.addCamera(this);
        }
    }

    get layers() {
        return this._camera.layers;
    }

    get layersSet() {
        return this._camera.layersSet;
    }

    /**
     * The post effects queue for this camera. Use this to add or remove post effects from the camera.
     *
     * @type {PostEffectQueue}
     */
    get postEffectsEnabled() {
        return this._postEffects.enabled;
    }

    get postEffects() {
        return this._postEffects;
    }

    /**
     * Controls the order in which cameras are rendered. Cameras with smaller values for priority
     * are rendered first. Defaults to 0.
     *
     * @type {number}
     */
    set priority(newValue) {
        this._priority = newValue;
        this.dirtyLayerCompositionCameras();
    }

    get priority() {
        return this._priority;
    }

    /**
     * Queries the camera's projection matrix.
     *
     * @type {import('../../../core/math/mat4.js').Mat4}
     */
    get projectionMatrix() {
        return this._camera.projectionMatrix;
    }

    /**
     * Set camera aperture in f-stops, the default value is 16.0. Higher value means less exposure.
     *
     * @type {number}
     */
    set aperture(newValue) {
        this._camera.aperture = newValue;
    }

    get aperture() {
        return this._camera.aperture;
    }

    /**
     * Set camera sensitivity in ISO, the default value is 1000. Higher value means more exposure.
     *
     * @type {number}
     */
    set sensitivity(newValue) {
        this._camera.sensitivity = newValue;
    }

    get sensitivity() {
        return this._camera.sensitivity;
    }

    /**
     * Set camera shutter speed in seconds, the default value is 1/1000s. Longer shutter means more exposure.
     *
     * @type {number}
     */
    set shutter(newValue) {
        this._camera.shutter = newValue;
    }

    get shutter() {
        return this._camera.shutter;
    }

    /**
     * Controls where on the screen the camera will be rendered in normalized screen coordinates.
     * Defaults to [0, 0, 1, 1].
     *
     * @type {import('../../../core/math/vec4.js').Vec4}
     */
    set rect(value) {
        this._camera.rect = value;
        this.fire('set:rect', this._camera.rect);
    }

    get rect() {
        return this._camera.rect;
    }

    /**
     * Render target to which rendering of the cameras is performed. If not set, it will render
     * simply to the screen.
     *
     * @type {import('../../../platform/graphics/render-target.js').RenderTarget}
     */
    set renderTarget(value) {
        this._camera.renderTarget = value;
        this.dirtyLayerCompositionCameras();
    }

    get renderTarget() {
        return this._camera.renderTarget;
    }

    /**
     * Queries the camera's view matrix.
     *
     * @type {import('../../../core/math/mat4.js').Mat4}
     */
    get viewMatrix() {
        return this._camera.viewMatrix;
    }

    dirtyLayerCompositionCameras() {
        // layer composition needs to update order
        const layerComp = this.system.app.scene.layers;
        layerComp._dirtyCameras = true;
    }

    /**
     * Convert a point from 2D screen space to 3D world space.
     *
     * @param {number} screenx - X coordinate on PlayCanvas' canvas element. Should be in the range
     * 0 to `canvas.offsetWidth` of the application's canvas element.
     * @param {number} screeny - Y coordinate on PlayCanvas' canvas element. Should be in the range
     * 0 to `canvas.offsetHeight` of the application's canvas element.
     * @param {number} cameraz - The distance from the camera in world space to create the new
     * point.
     * @param {import('../../../core/math/vec3.js').Vec3} [worldCoord] - 3D vector to receive world
     * coordinate result.
     * @example
     * // Get the start and end points of a 3D ray fired from a screen click position
     * var start = entity.camera.screenToWorld(clickX, clickY, entity.camera.nearClip);
     * var end = entity.camera.screenToWorld(clickX, clickY, entity.camera.farClip);
     *
     * // Use the ray coordinates to perform a raycast
     * app.systems.rigidbody.raycastFirst(start, end, function (result) {
     *     console.log("Entity " + result.entity.name + " was selected");
     * });
     * @returns {import('../../../core/math/vec3.js').Vec3} The world space coordinate.
     */
    screenToWorld(screenx, screeny, cameraz, worldCoord) {
        const device = this.system.app.graphicsDevice;
        const w = device.clientRect.width;
        const h = device.clientRect.height;
        return this._camera.screenToWorld(screenx, screeny, cameraz, w, h, worldCoord);
    }

    /**
     * Convert a point from 3D world space to 2D screen space.
     *
     * @param {import('../../../core/math/vec3.js').Vec3} worldCoord - The world space coordinate.
     * @param {import('../../../core/math/vec3.js').Vec3} [screenCoord] - 3D vector to receive
     * screen coordinate result.
     * @returns {import('../../../core/math/vec3.js').Vec3} The screen space coordinate.
     */
    worldToScreen(worldCoord, screenCoord) {
        const device = this.system.app.graphicsDevice;
        const w = device.clientRect.width;
        const h = device.clientRect.height;
        return this._camera.worldToScreen(worldCoord, w, h, screenCoord);
    }

    // called before application renders the scene
    onAppPrerender() {
        this._camera._viewMatDirty = true;
        this._camera._viewProjMatDirty = true;
    }

    addCameraToLayers() {
        const layers = this.layers;
        for (let i = 0; i < layers.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(layers[i]);
            if (layer) {
                layer.addCamera(this);
            }
        }
    }

    removeCameraFromLayers() {
        const layers = this.layers;
        for (let i = 0; i < layers.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(layers[i]);
            if (layer) {
                layer.removeCamera(this);
            }
        }
    }

    onLayersChanged(oldComp, newComp) {
        this.addCameraToLayers();
        oldComp.off('add', this.onLayerAdded, this);
        oldComp.off('remove', this.onLayerRemoved, this);
        newComp.on('add', this.onLayerAdded, this);
        newComp.on('remove', this.onLayerRemoved, this);
    }

    onLayerAdded(layer) {
        const index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        layer.addCamera(this);
    }

    onLayerRemoved(layer) {
        const index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        layer.removeCamera(this);
    }

    onEnable() {
        const system = this.system;
        const scene = system.app.scene;
        const layers = scene.layers;

        system.addCamera(this);

        scene.on('set:layers', this.onLayersChanged, this);
        if (layers) {
            layers.on('add', this.onLayerAdded, this);
            layers.on('remove', this.onLayerRemoved, this);
        }

        if (this.enabled && this.entity.enabled) {
            this.addCameraToLayers();
        }

        this.postEffects.enable();
    }

    onDisable() {
        const system = this.system;
        const scene = system.app.scene;
        const layers = scene.layers;

        this.postEffects.disable();

        this.removeCameraFromLayers();

        scene.off('set:layers', this.onLayersChanged, this);
        if (layers) {
            layers.off('add', this.onLayerAdded, this);
            layers.off('remove', this.onLayerRemoved, this);
        }

        system.removeCamera(this);
    }

    onRemove() {
        this.onDisable();
        this.off();
    }

    /**
     * Calculates aspect ratio value for a given render target.
     *
     * @param {import('../../../platform/graphics/render-target.js').RenderTarget} [rt] - Optional
     * render target. If unspecified, the backbuffer is used.
     * @returns {number} The aspect ratio of the render target (or backbuffer).
     */
    calculateAspectRatio(rt) {
        const device = this.system.app.graphicsDevice;
        const width = rt ? rt.width : device.width;
        const height = rt ? rt.height : device.height;
        return (width * this.rect.z) / (height * this.rect.w);
    }

    /**
     * Prepare the camera for frame rendering.
     *
     * @param {import('../../../platform/graphics/render-target.js').RenderTarget} rt - Render
     * target to which rendering will be performed. Will affect camera's aspect ratio, if
     * aspectRatioMode is {@link ASPECT_AUTO}.
     * @ignore
     */
    frameUpdate(rt) {
        if (this.aspectRatioMode === ASPECT_AUTO) {
            this.aspectRatio = this.calculateAspectRatio(rt);
        }
    }

    /**
     * Attempt to start XR session with this camera.
     *
     * @param {string} type - The type of session. Can be one of the following:
     *
     * - {@link XRTYPE_INLINE}: Inline - always available type of session. It has limited feature
     * availability and is rendered into HTML element.
     * - {@link XRTYPE_VR}: Immersive VR - session that provides exclusive access to the VR device
     * with the best available tracking features.
     * - {@link XRTYPE_AR}: Immersive AR - session that provides exclusive access to the VR/AR
     * device that is intended to be blended with the real-world environment.
     *
     * @param {string} spaceType - Reference space type. Can be one of the following:
     *
     * - {@link XRSPACE_VIEWER}: Viewer - always supported space with some basic tracking
     * capabilities.
     * - {@link XRSPACE_LOCAL}: Local - represents a tracking space with a native origin near the
     * viewer at the time of creation. It is meant for seated or basic local XR sessions.
     * - {@link XRSPACE_LOCALFLOOR}: Local Floor - represents a tracking space with a native origin
     * at the floor in a safe position for the user to stand. The y-axis equals 0 at floor level.
     * Floor level value might be estimated by the underlying platform. It is meant for seated or
     * basic local XR sessions.
     * - {@link XRSPACE_BOUNDEDFLOOR}: Bounded Floor - represents a tracking space with its native
     * origin at the floor, where the user is expected to move within a pre-established boundary.
     * - {@link XRSPACE_UNBOUNDED}: Unbounded - represents a tracking space where the user is
     * expected to move freely around their environment, potentially long distances from their
     * starting point.
     *
     * @param {object} [options] - Object with options for XR session initialization.
     * @param {string[]} [options.optionalFeatures] - Optional features for XRSession start. It is
     * used for getting access to additional WebXR spec extensions.
     * @param {boolean} [options.imageTracking] - Set to true to attempt to enable {@link XrImageTracking}.
     * @param {boolean} [options.planeDetection] - Set to true to attempt to enable {@link XrPlaneDetection}.
     * @param {import('../../xr/xr-manager.js').XrErrorCallback} [options.callback] - Optional
     * callback function called once the session is started. The callback has one argument Error -
     * it is null if the XR session started successfully.
     * @param {object} [options.depthSensing] - Optional object with depth sensing parameters to
     * attempt to enable {@link XrDepthSensing}.
     * @param {string} [options.depthSensing.usagePreference] - Optional usage preference for depth
     * sensing, can be 'cpu-optimized' or 'gpu-optimized' (XRDEPTHSENSINGUSAGE_*), defaults to
     * 'cpu-optimized'. Most preferred and supported will be chosen by the underlying depth sensing
     * system.
     * @param {string} [options.depthSensing.dataFormatPreference] - Optional data format
     * preference for depth sensing. Can be 'luminance-alpha' or 'float32' (XRDEPTHSENSINGFORMAT_*),
     * defaults to 'luminance-alpha'. Most preferred and supported will be chosen by the underlying
     * depth sensing system.
     * @example
     * // On an entity with a camera component
     * this.entity.camera.startXr(pc.XRTYPE_VR, pc.XRSPACE_LOCAL, {
     *     callback: function (err) {
     *         if (err) {
     *             // failed to start XR session
     *         } else {
     *             // in XR
     *         }
     *     }
     * });
     */
    startXr(type, spaceType, options) {
        this.system.app.xr.start(this, type, spaceType, options);
    }

    /**
     * Attempt to end XR session of this camera.
     *
     * @param {import('../../xr/xr-manager.js').XrErrorCallback} [callback] - Optional callback
     * function called once session is ended. The callback has one argument Error - it is null if
     * successfully ended XR session.
     * @example
     * // On an entity with a camera component
     * this.entity.camera.endXr(function (err) {
     *     // not anymore in XR
     * });
     */
    endXr(callback) {
        if (!this._camera.xr) {
            if (callback) callback(new Error('Camera is not in XR'));
            return;
        }

        this._camera.xr.end(callback);
    }

    // function to copy properties from the source CameraComponent.
    // properties not copied: postEffects
    // inherited properties not copied (all): system, entity, enabled)
    copy(source) {

        // copy data driven properties
        properties.forEach((property) => {
            if (!property.readonly) {
                const name = property.name;
                this[name] = source[name];
            }
        });

        // other properties
        this.clearColorBuffer = source.clearColorBuffer;
        this.clearDepthBuffer = source.clearDepthBuffer;
        this.clearStencilBuffer = source.clearStencilBuffer;
        this.disablePostEffectsLayer = source.disablePostEffectsLayer;
        this.layers = source.layers;
        this.priority = source.priority;
        this.renderTarget = source.renderTarget;
        this.rect = source.rect;
        this.aperture = source.aperture;
        this.sensitivity = source.sensitivity;
        this.shutter = source.shutter;
    }
}

// for common properties, create getters and setters which use this._camera as a storage for their values
properties.forEach(function (property) {
    const name = property.name;
    const options = {};

    // getter
    options.get = function () {
        return this._camera[name];
    };

    // setter
    if (!property.readonly) {
        options.set = function (newValue) {
            this._camera[name] = newValue;
        };
    }

    Object.defineProperty(CameraComponent.prototype, name, options);
});

export { CameraComponent };
