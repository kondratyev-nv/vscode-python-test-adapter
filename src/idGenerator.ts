/// <reference lib="es2017.string" />

function* infiniteNumberGenerator(): IterableIterator<number> {
    for (let i = 1; i < Number.MAX_SAFE_INTEGER; i++) {
        yield i++;
    }
}

const idGenerator = infiniteNumberGenerator();
export function nextId() {
    const value = idGenerator.next();
    if (value.done) {
        throw new Error('Generator reached an end');
    }
    return value.value.toString().padStart(16, '0');
}
