// What's inside a bucket
export type HashmapValue<K extends PropertyKey, V> = {
    key: K;
    value: V;
}