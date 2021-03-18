
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
export function startsWith(s: string, p: string, offset: number = 0): boolean {
    return s.substring(offset).startsWith(p);
}
