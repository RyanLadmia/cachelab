import { MyCollection } from "../model/CollectionType";
import { createHash } from "crypto";

type HashmapValue<K extends PropertyKey, V> = {
    key: K;
    value: V;
}

type Bucket<K extends PropertyKey, V> = HashmapValue<K, V> | HashmapValue<K, V>[] | null;

export default class HashMap<K extends PropertyKey, V> {
    
    private collection: Bucket<K, V>[] = new Array(8).fill(null);
    private loadFactor: number = 0.75;
    private indexLimitFactor: number = 0;
    private currentLoad: number = 0; // Va recalculer entierement le load a chaque fois
    // Pourrait être incrémenté depuis le début, mais il y a des risques en cas de coupure
    // Pourra émettre un nombre dans la sauvegarde pour savoir ou on en était 

    computeLoadFactor(): void {
        this.indexLimitFactor = this.collection.length * this.loadFactor;
    }

    computeCurrentLoad(): void {
        let load = 0;

        for (const bucket of this.collection) {
            if (bucket !== null) {
                if (Array.isArray(bucket)) {
                    load += bucket.length;
                } else {
                    load += 1;
                }
            }
        }
        
        this.currentLoad = load;
        console.log(this.currentLoad);
    }

    insert(newValue: HashmapValue<K, V>): number {

        const key = String(newValue.key);
        const hash = createHash('sha256').update(key);        
        const hashHex = hash.digest("hex");
        // slice à 10 a cause de parseInt() 
        const hashToInt = parseInt(hashHex.slice(0, 8), 16); 
        const index = hashToInt % this.collection.length;
        
        this.collisionManagement(index, newValue);
        console.log(this.collection)
        this.computeCurrentLoad(); // ou currentLoad++ // modifier au onStart()
        return 0 // a changé
    }

    collisionManagement(index: number, newValue: HashmapValue<K, V>): void {
        const currentBucket = this.collection[index];

        if (currentBucket !== null) {
            
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

    verifyLoadFactor(): void {
        
    }

    onStart():void{

    }
}