export function readString(data, start, end) {
    const str = String.fromCharCode.apply(null, data.subarray(start, end));
    const nullLocation = str.indexOf("\u0000");
    if (nullLocation > 0) {
        return str.substr(0, nullLocation);
    }
    return str;
}
//# sourceMappingURL=readString.js.map