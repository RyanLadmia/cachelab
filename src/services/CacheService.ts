import { MyCollection } from "../model/CollectionType";
import { createHash } from "crypto";


type HashmapValue<K extends PropertyKey, V> = {
    key: K;
    value: V;
}

type Bucket<K extends PropertyKey, V> = HashmapValue<K, V> | HashmapValue<K, V>[] | undefined;

export default class HashMap<K extends PropertyKey, V> {
    
    private collection: Bucket<K, V>[] = new Array(8).fill(undefined);
    private loadFactor = 0.75;
    private indexFactor;
    
    computeLoadFactor(){
        this.indexFactor = this.collection.length * this.loadFactor
    }

    insert(newValue: HashmapValue<K, V>) {

        const key = String(newValue.key);
        const hash = createHash('sha256').update(key);        
        const hashHex = hash.digest("hex");
        // slice à 10 a cause de parseInt() 
        const hashToInt = parseInt(hashHex.slice(0, 8), 16); 
        const index = hashToInt % this.collection.length;
        
        this.collisionManagement(index, newValue);
        console.log(this.collection)
        return 0
    }

    collisionManagement(index: number, newValue: HashmapValue<K, V>): void {
        const currentBucket = this.collection[index];

        if (currentBucket !== undefined) {
            
            if (!Array.isArray(currentBucket)) {
                console.log("convertir to array");
                this.collection[index] = [currentBucket, newValue];
            } else {
                currentBucket.push(newValue);
            }
            
        } else {
            this.collection[index] = newValue;
        }
    }

    verifyLoadFactor(){

    }
}