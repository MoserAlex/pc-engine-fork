import { CULLFACE_NONE, PRIMITIVE_TRISTRIP, SEMANTIC_POSITION, TYPE_FLOAT32, BUFFER_STATIC } from '../../platform/graphics/constants.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';

// Primitive for drawFullscreenQuad
const primitive = {
    type: PRIMITIVE_TRISTRIP,
    base: 0,
    count: 4,
    indexed: false
};

/**
 * Base class for all post effects. Post effects take a a render target as input apply effects to
 * it and then render the result to an output render target or the screen if no output is
 * specified.
 */
class PostEffect {
    /**
     * Create a new PostEffect instance.
     *
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice -
     * The graphics device of the application.
     */
    constructor(graphicsDevice) {
        /**
         * The graphics device of the application.
         *
         * @type {import('../../platform/graphics/graphics-device.js').GraphicsDevice}
         */
        this.device = graphicsDevice;

        /**
         * The shader definition for the fullscreen quad. Needs to be set by the custom post effect
         * (default is null). Used when calling {@link drawFullscreenQuad}.
         *
         * @type {import('../../platform/graphics/shader.js').Shader|null}
         */
        this.shader = null;

        /**
         * The vertex buffer for the fullscreen quad. Used when calling {@link drawFullscreenQuad}.
         *
         * @type {VertexBuffer}
         */
        this.vertexBuffer = createFullscreenQuad(graphicsDevice);

        /**
         * The property that should to be set to `true` (by the custom post effect) if a depth map
         * is necessary (default is false).
         *
         * @type {boolean}
         */
        this.needsDepthBuffer = false;

        this.depthMap = null;
    }

    /**
     * Render the post effect using the specified inputTarget to the specified outputTarget.
     *
     * @param {import('../../platform/graphics/render-target.js').RenderTarget} inputTarget - The
     * input render target.
     * @param {import('../../platform/graphics/render-target.js').RenderTarget} outputTarget - The
     * output render target. If null then this will be the screen.
     * @param {import('../../core/math/vec4.js').Vec4} [rect] - The rect of the current camera. If
     * not specified, it will default to [0, 0, 1, 1].
     */
    render(inputTarget, outputTarget, rect) {
    }
}

/**
 * Create a vertex buffer with 4 vertices representing a fullscreen quad.
 *
 * @param {import('../../platform//graphics/graphics-device.js').GraphicsDevice} device - The
 * graphics device.
 * @returns {VertexBuffer} - The fullscreen quad vertex buffer.
 * @ignore
 */
function createFullscreenQuad(device) {
    // Create the vertex format
    const vertexFormat = new VertexFormat(device, [
        { semantic: SEMANTIC_POSITION, components: 2, type: TYPE_FLOAT32 }
    ]);

    // Create a vertex buffer
    const data = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    return new VertexBuffer(device, vertexFormat, 4, BUFFER_STATIC, data.buffer);
}

/**
 * Draw a screen-space rectangle in a render target. Primarily meant to be used in custom post
 * effects based on {@link PostEffect}.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
 * graphics device of the application.
 * @param {import('../../platform/graphics/render-target.js').RenderTarget} target - The output
 * render target.
 * @param {VertexBuffer} vertexBuffer - The vertex buffer for the rectangle mesh. When calling from
 * a custom post effect, pass the field {@link PostEffect#vertexBuffer}.
 * @param {import('../../platform/graphics/shader.js').Shader} shader - The shader to be used for
 * drawing the rectangle. When calling from a custom post effect, pass the field
 * {@link PostEffect#shader}.
 * @param {import('../../core/math/vec4.js').Vec4} [rect] - The normalized screen-space position
 * (rect.x, rect.y) and size (rect.z, rect.w) of the rectangle. Default is [0, 0, 1, 1].
 */
function drawFullscreenQuad(device, target, vertexBuffer, shader, rect) {
    const oldRt = device.getRenderTarget();
    device.setRenderTarget(target);
    device.updateBegin();

    let w = target ? target.width : device.width;
    let h = target ? target.height : device.height;
    let x = 0;
    let y = 0;

    if (rect) {
        x = rect.x * w;
        y = rect.y * h;
        w *= rect.z;
        h *= rect.w;
    }

    const oldVx = device.vx;
    const oldVy = device.vy;
    const oldVw = device.vw;
    const oldVh = device.vh;
    device.setViewport(x, y, w, h);
    const oldSx = device.sx;
    const oldSy = device.sy;
    const oldSw = device.sw;
    const oldSh = device.sh;
    device.setScissor(x, y, w, h);

    const oldBlending = device.getBlending();
    const oldDepthTest = device.getDepthTest();
    const oldDepthWrite = device.getDepthWrite();
    const oldCullMode = device.getCullMode();
    const oldWR = device.writeRed;
    const oldWG = device.writeGreen;
    const oldWB = device.writeBlue;
    const oldWA = device.writeAlpha;
    device.setBlending(false);
    device.setDepthTest(false);
    device.setDepthWrite(false);
    device.setCullMode(CULLFACE_NONE);
    device.setColorWrite(true, true, true, true);

    device.setVertexBuffer(vertexBuffer, 0);
    device.setShader(shader);

    device.draw(primitive);

    device.setBlending(oldBlending);
    device.setDepthTest(oldDepthTest);
    device.setDepthWrite(oldDepthWrite);
    device.setCullMode(oldCullMode);
    device.setColorWrite(oldWR, oldWG, oldWB, oldWA);

    device.updateEnd();

    device.setRenderTarget(oldRt);
    device.updateBegin();

    device.setViewport(oldVx, oldVy, oldVw, oldVh);
    device.setScissor(oldSx, oldSy, oldSw, oldSh);
}

export { createFullscreenQuad, drawFullscreenQuad, PostEffect };
