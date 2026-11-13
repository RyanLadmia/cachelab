import { MyCollection, Slot } from "../models/CollectionType";

export default class CollectionIterator<T> {

    private collection: Array<T>; // Adapté pour être générique
    private index = 0;

    constructor(collection: Array<T>){
        this.collection = collection;
    }

    getCurrent(): T {
        return this.collection[this.index];
    }

    next(): T | null {
        if (!this.isValid()) return null;
        const value = this.collection[this.index];
        this.index++;
        return value;
    }

    isValid(): boolean {
        return this.index < this.collection.length; 
    }

    rewind(): void {
        this.index = 0;
    }
}