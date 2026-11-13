export type HashmapValue<K extends PropertyKey, V> = { 
    key: K;
    value: V;
}

export type Bucket<K extends PropertyKey, V> = 
    | HashmapValue<K, V | null> 
    | HashmapValue<K, V | null>[] 
    | null;