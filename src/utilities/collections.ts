export function empty<T>(x: T[]) {
    return !x || !x.length;
}

export function firstNotEmpty<T>(
    fns: (() => T | undefined)[],
    defaultValue: T
): T {
    for (const fn of fns) {
        const result = fn();
        if (result) {
            return result;
        }
    }
    return defaultValue;
}

export function firstOrDefault<T>(values: T[], defaultValue: T): T {
    if (empty(values)) {
        return defaultValue;
    }
    return values[0];
}

export function groupBy<T, U>(values: T[], key: (v: T) => U) {
    return values.reduce((accumulator, x) => {
        const k = key(x);
        return accumulator.set(k, (accumulator.get(k) ?? []).concat([x]));
    }, new Map<U, T[]>());
}

export function distinctBy<T, U>(values: T[], key: (v: T) => U): T[] {
    const byKey = new Map<U, T>();
    values.forEach(x => {
        byKey.set(key(x), x);
    });
    return Array.from(byKey.values());
}
