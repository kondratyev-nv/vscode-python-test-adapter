
/**
 * HACK: for #232.
 * For some <insert bad word here> reason String.startsWith method is being replaced in
 * VSCode/some extension/some npm package with method that is not respecting offset.
 * Current behaviour is like this: ƒ (e){return this.substring(0,e.length)===e} (copied from debugger)
 * This is a quick fix for the issue.
 *
 * @param s String to search in.
 * @param p The characters to be searched for at the start of this string.
 * @param offset The position in this string at which to begin searching for searchString. Defaults to 0.
 * @returns true if the given characters are found at the beginning of the string; otherwise, false.
 */
export function startsWith(s: string, p: string, offset = 0): boolean {
    return s.substring(offset).startsWith(p);
}

/**
 * Contatenate non-empty strings of an array into a single string, separated by the specified glue string.
 *
 * @param glue A string used to separate one element of the array from the next in the resulting string.
 * @param s List of strings to filter and concatenate.
 * @returns All non-empty strings of an array contatenated into a string, separated by the specified glue string.
 */
export function concatNonEmpty(glue: string, ...s: string[]): string {
    return s.filter(p => p).join(glue);
}