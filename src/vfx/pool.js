import * as THREE from 'three';

// Generic pooled instanced-quad ring buffer. `attrs` is a list of attribute names, each a vec4. Row = attrs.length*4 floats.
// The subclass writes rows through `row(i)` -> Float32Array + offset; the pool tracks the dirty range and uploads once.
export class QuadPool {
  constructor(parent, max, attrs, vertexShader, fragmentShader, uniforms, matOpts = {}, { order = 15, name = 'pool' } = {}) {
    this.max = max; this.attrs = attrs; this.stride = attrs.length * 4; this.head = 0; this.hwm = 0; this.dmin = Infinity; this.dmax = -1;
    this.data = new Float32Array(max * this.stride);
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    g.setAttribute('corner', new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.buf = new THREE.InstancedInterleavedBuffer(this.data, this.stride, 1); this.buf.setUsage(THREE.DynamicDrawUsage);
    attrs.forEach((n, i) => g.setAttribute(n, new THREE.InterleavedBufferAttribute(this.buf, 4, i * 4)));
    g.instanceCount = 0; this.geometry = g;
    this.material = new THREE.ShaderMaterial(Object.assign({
      vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    }, matOpts));
    this.mesh = new THREE.Mesh(g, this.material); this.mesh.frustumCulled = false; this.mesh.renderOrder = order; this.mesh.name = name; this.mesh.matrixAutoUpdate = false;
    parent.add(this.mesh);
  }
  /** Reserve the next row; returns its float offset into `this.data`. Caller fills all `stride` floats. */
  next() {
    const i = this.head; this.head = (i + 1) % this.max; if (i + 1 > this.hwm) this.hwm = i + 1;
    if (i < this.dmin) this.dmin = i; if (i > this.dmax) this.dmax = i;
    return i * this.stride;
  }
  flush() {
    if (this.dmax >= 0) { this.buf.addUpdateRange(this.dmin * this.stride, (this.dmax - this.dmin + 1) * this.stride); this.buf.needsUpdate = true; this.dmin = Infinity; this.dmax = -1; }
    this.geometry.instanceCount = this.hwm; this.mesh.visible = this.hwm > 0;
  }
  clear(birthCol = 3, deadValue = -1e6) { const s = this.stride; for (let i = 0; i < this.max; i++) this.data[i * s + birthCol] = deadValue; this.dmin = 0; this.dmax = this.max - 1; }
  dispose() { this.mesh.parent?.remove(this.mesh); this.geometry.dispose(); this.material.dispose(); }
}
