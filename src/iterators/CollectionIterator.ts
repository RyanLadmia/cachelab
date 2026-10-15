import { MyCollection, Slot } from "../model/CollectionType";

class IterableCollection<T>{

    private collection: MyCollection<T>;
    private index = 0;

    constructor(collection: Array<T>){
        this.collection = collection;

    }

    getNext(){
        return this.collection[this.index + 1];
    };

    getIndex(){
        return this.collection[this.index];
    };

    isValid(): boolean{
        if (this.collection[this.index]) return true
        else return false
    }

    rewind(){
        this.index = 0;
    }

}