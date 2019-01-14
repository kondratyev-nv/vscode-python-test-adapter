
export function empty<T>(x: T[]) {
    return !x || !x.length;
}

export function getTestOutputBySplittingString(output: string, stringToSplitWith: string): string {
    const split = output.split(stringToSplitWith);
    return split && split.pop() || '';
}

export function groupBy<T, U>(values: T[], key: (v: T) => U) {
    return values.reduce((accumulator, x) => {
        if (accumulator.has(key(x))) {
            accumulator.get(key(x))!.push(x);
        } else {
            accumulator.set(key(x), [x]);
        }
        return accumulator;
    }, new Map<U, T[]>());
}
