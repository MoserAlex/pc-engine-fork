import { Vec3 } from './vec3.js';

/**
 * A 3x3 matrix.
 */
class Mat3 {
    /**
     * Create a new Mat3 instance. It is initialized to the identity matrix.
     */
    constructor() {
        // Create an identity matrix. Note that a new Float32Array has all elements set
        // to zero by default, so we only need to set the relevant elements to one.
        const data = new Float32Array(9);
        data[0] = data[4] = data[8] = 1;

        /**
         * Matrix elements in the form of a flat array.
         *
         * @type {Float32Array}
         */
        this.data = data;
    }

    /**
     * Creates a duplicate of the specified matrix.
     *
     * @returns {this} A duplicate matrix.
     * @example
     * var src = new pc.Mat3().translate(10, 20, 30);
     * var dst = src.clone();
     * console.log("The two matrices are " + (src.equals(dst) ? "equal" : "different"));
     */
    clone() {
        /** @type {this} */
        const cstr = this.constructor;
        return new cstr().copy(this);
    }

    /**
     * Copies the contents of a source 3x3 matrix to a destination 3x3 matrix.
     *
     * @param {Mat3} rhs - A 3x3 matrix to be copied.
     * @returns {Mat3} Self for chaining.
     * @example
     * var src = new pc.Mat3().translate(10, 20, 30);
     * var dst = new pc.Mat3();
     * dst.copy(src);
     * console.log("The two matrices are " + (src.equals(dst) ? "equal" : "different"));
     */
    copy(rhs) {
        const src = rhs.data;
        const dst = this.data;

        dst[0] = src[0];
        dst[1] = src[1];
        dst[2] = src[2];
        dst[3] = src[3];
        dst[4] = src[4];
        dst[5] = src[5];
        dst[6] = src[6];
        dst[7] = src[7];
        dst[8] = src[8];

        return this;
    }

    /**
     * Copies the contents of a source array[9] to a destination 3x3 matrix.
     *
     * @param {number[]} src - An array[9] to be copied.
     * @returns {Mat3} Self for chaining.
     * @example
     * var dst = new pc.Mat3();
     * dst.set([0, 1, 2, 3, 4, 5, 6, 7, 8]);
     */
    set(src) {
        const dst = this.data;

        dst[0] = src[0];
        dst[1] = src[1];
        dst[2] = src[2];
        dst[3] = src[3];
        dst[4] = src[4];
        dst[5] = src[5];
        dst[6] = src[6];
        dst[7] = src[7];
        dst[8] = src[8];

        return this;
    }

    /**
     * Reports whether two matrices are equal.
     *
     * @param {Mat3} rhs - The other matrix.
     * @returns {boolean} True if the matrices are equal and false otherwise.
     * @example
     * var a = new pc.Mat3().translate(10, 20, 30);
     * var b = new pc.Mat3();
     * console.log("The two matrices are " + (a.equals(b) ? "equal" : "different"));
     */
    equals(rhs) {
        const l = this.data;
        const r = rhs.data;

        return ((l[0] === r[0]) &&
                (l[1] === r[1]) &&
                (l[2] === r[2]) &&
                (l[3] === r[3]) &&
                (l[4] === r[4]) &&
                (l[5] === r[5]) &&
                (l[6] === r[6]) &&
                (l[7] === r[7]) &&
                (l[8] === r[8]));
    }

    /**
     * Reports whether the specified matrix is the identity matrix.
     *
     * @returns {boolean} True if the matrix is identity and false otherwise.
     * @example
     * var m = new pc.Mat3();
     * console.log("The matrix is " + (m.isIdentity() ? "identity" : "not identity"));
     */
    isIdentity() {
        const m = this.data;
        return ((m[0] === 1) &&
                (m[1] === 0) &&
                (m[2] === 0) &&
                (m[3] === 0) &&
                (m[4] === 1) &&
                (m[5] === 0) &&
                (m[6] === 0) &&
                (m[7] === 0) &&
                (m[8] === 1));
    }

    /**
     * Sets the matrix to the identity matrix.
     *
     * @returns {Mat3} Self for chaining.
     * @example
     * m.setIdentity();
     * console.log("The matrix is " + (m.isIdentity() ? "identity" : "not identity"));
     */
    setIdentity() {
        const m = this.data;
        m[0] = 1;
        m[1] = 0;
        m[2] = 0;

        m[3] = 0;
        m[4] = 1;
        m[5] = 0;

        m[6] = 0;
        m[7] = 0;
        m[8] = 1;

        return this;
    }

    /**
     * Converts the matrix to string form.
     *
     * @returns {string} The matrix in string form.
     * @example
     * var m = new pc.Mat3();
     * // Outputs [1, 0, 0, 0, 1, 0, 0, 0, 1]
     * console.log(m.toString());
     */
    toString() {
        return '[' + this.data.join(', ') + ']';
    }

    /**
     * Generates the transpose of the specified 3x3 matrix.
     *
     * @returns {Mat3} Self for chaining.
     * @example
     * var m = new pc.Mat3();
     *
     * // Transpose in place
     * m.transpose();
     */
    transpose() {
        const m = this.data;

        let tmp;
        tmp = m[1]; m[1] = m[3]; m[3] = tmp;
        tmp = m[2]; m[2] = m[6]; m[6] = tmp;
        tmp = m[5]; m[5] = m[7]; m[7] = tmp;

        return this;
    }

    /**
     * Converts the specified 4x4 matrix to a Mat3.
     *
     * @param {import('./mat4.js').Mat4} m - The 4x4 matrix to convert.
     * @returns {Mat3} Self for chaining.
     */
    setFromMat4(m) {
        const src = m.data;
        const dst = this.data;

        dst[0] = src[0];
        dst[1] = src[1];
        dst[2] = src[2];

        dst[3] = src[4];
        dst[4] = src[5];
        dst[5] = src[6];

        dst[6] = src[8];
        dst[7] = src[9];
        dst[8] = src[10];

        return this;
    }

    /**
     * Transforms a 3-dimensional vector by a 3x3 matrix.
     *
     * @param {Vec3} vec - The 3-dimensional vector to be transformed.
     * @param {Vec3} [res] - An optional 3-dimensional vector to receive the result of the
     * transformation.
     * @returns {Vec3} The input vector v transformed by the current instance.
     */
    transformVector(vec, res = new Vec3()) {
        const m = this.data;

        const x = vec.x;
        const y = vec.y;
        const z = vec.z;

        res.x = x * m[0] + y * m[3] + z * m[6];
        res.y = x * m[1] + y * m[4] + z * m[7];
        res.z = x * m[2] + y * m[5] + z * m[8];

        return res;
    }

    /**
     * A constant matrix set to the identity.
     *
     * @type {Mat3}
     * @readonly
     */
    static IDENTITY = Object.freeze(new Mat3());

    /**
     * A constant matrix with all elements set to 0.
     *
     * @type {Mat3}
     * @readonly
     */
    static ZERO = Object.freeze(new Mat3().set([0, 0, 0, 0, 0, 0, 0, 0, 0]));
}

export { Mat3 };
