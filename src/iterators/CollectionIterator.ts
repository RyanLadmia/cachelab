// collection-iterator.ts
import { MyCollection, Slot } from "../models/CollectionType";

export default class CollectionIterator<T> {

    private collection: Array<T>; // Adapté pour être générique
    private index = 0;

    constructor(collection: Array<T>){
        this.collection = collection;
    }

    // Récupère l'élément actuel
    getCurrent(): T {
        return this.collection[this.index];
    }

    // Avance d'un cran et retourne la valeur (très utile pour les boucles while)
    next(): T | null {
        if (!this.isValid()) return null;
        const value = this.collection[this.index];
        this.index++;
        return value;
    }

    isValid(): boolean {
        return this.index < this.collection.length; // Plus sécurisé contre les index out of bounds
    }

    rewind(): void {
        this.index = 0;
    }
}