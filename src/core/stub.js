// Null-object module for pieces not built yet. Builders replace the file that calls this.
export function stub(name) { return { __stub: true, name, fixedUpdate() {}, update() {}, dispose() {} }; }
