/**
 * Object.fromEntries ponyfill
 * @source https://github.com/feross/fromentries/
 * @param entries
 */
export const fromEntries = <T = unknown>(
  entries: Iterable<readonly [PropertyKey, T]>
): { [k in PropertyKey]: T } => {
  return [...entries].reduce((obj, [key, val]) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    obj[key] = val;
    return obj;
  }, {});
};
