import { groupBy, empty } from './collections';

export function getTestOutputBySplittingString(
    output: string,
    stringToSplitWith: string
): string {
    const split = output.split(stringToSplitWith);
    return (split && split.pop()) || '';
}

export function setDescriptionForEqualLabels(
    values: { id: string; label: string; description?: string }[],
    idSeparator: string
) {
    const updatedLabels = mapUniqueLabelsById(
        values
            .filter(v => v.id.endsWith(v.label)) // Assuming label is last part of id
            .map(v => ({ ...v, prefix: '' })),
        idSeparator
    );
    values
        .filter(v => updatedLabels.has(v.id))
        .filter(v => updatedLabels.get(v.id)!.prefix)
        .forEach(v => {
            v.description = `${updatedLabels.get(v.id)!.prefix}`;
        });
}

function mapUniqueLabelsById(
    values: { id: string; prefix: string | undefined; label: string }[],
    idSeparator: string
) {
    const uniqueLabelsById = new Map<
        string,
        { id: string; prefix: string | undefined; label: string }
    >();
    const labelGroups = groupBy(values, v =>
        prependPrefix(v.prefix, idSeparator, v.label)
    );
    Array.from(labelGroups.entries())
        .filter(([_, group]) => group.length > 1)
        .map(([label, group]) => {
            const extendedPrefixGroup = group.map(v => {
                const idPrefix = v.id.substring(
                    0,
                    v.id.length - label.length - idSeparator.length
                );
                const labelPrefix = extractLastElement(
                    idPrefix.split(idSeparator)
                );
                return {
                    id: v.id,
                    prefix: v.prefix
                        ? prependPrefix(labelPrefix, idSeparator, v.prefix)
                        : labelPrefix,
                    label: v.label,
                };
            });
            extendedPrefixGroup.forEach(v => uniqueLabelsById.set(v.id, v));
            mapUniqueLabelsById(extendedPrefixGroup, idSeparator).forEach(
                (v, k) => uniqueLabelsById.set(k, v)
            );
        });
    return uniqueLabelsById;
}

function prependPrefix(
    prefix: string | undefined,
    idSeparator: string,
    value: string
) {
    return (prefix ? prefix + idSeparator : '') + value;
}

function extractLastElement(values: string[]) {
    if (empty(values)) {
        return undefined;
    }
    return values[values.length - 1];
}
