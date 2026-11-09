// Define a bucket
export type Slot<T> = T | T[] | undefined;
// one value, an array or empty

export type MyCollection<T> = Slot<T>[];
