ajk.Util = class
{
    static ensureKey(object, key, defaultValue)
    {
        if (!object.hasOwnProperty(key)) { object[key] = defaultValue; }
        return object[key];
    }
}