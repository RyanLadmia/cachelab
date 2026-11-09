import { MyCollection } from "../model/CollectionType";
import { createHash } from "crypto";

type HashmapValue<K extends PropertyKey, V> = {
    key: K;
    value: V;
}

type Bucket<K extends PropertyKey, V> = HashmapValue<K, V | null> | HashmapValue<K, V | null>[] | null;

export default class HashMap<K extends PropertyKey, V> {
    
    private BASE_LENGTH = 8;
    private currentLength = this.BASE_LENGTH;
    private collection: Bucket<K, V>[] = new Array(this.BASE_LENGTH).fill(null);
    private loadFactor: number = 0.75;
    private indexLimitFactor: number = 0; // servira a ne pas tt le temps recalculer et avoir des paliers
    private currentLoad: number = 0; // Va recalculer entierement le load a chaque fois
    // Pourrait être incrémenté depuis le début, mais il y a des risques en cas de coupure
    // Pourra émettre un nombre dans la sauvegarde pour savoir ou on en était 


    computeLoadFactor(): void {
        this.indexLimitFactor = this.currentLength * this.loadFactor;
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

    // Nouvelle méthode insert (refacto dont tu parlais dans tes commentaires)
    insert(newValue: HashmapValue<K, V | null>): void {
        if (this.currentLoad + 1 > this.indexLimitFactor) {
            this.rehashing();
        }
        this.hashEntry(newValue, this.collection);
        this.currentLoad++; 
    }

    hashEntry(newValue: HashmapValue<K, V | null>, targetArray: Bucket<K, V>[]): number {

        const key = String(newValue.key);
        const hash = createHash('sha256').update(key);        
        const hashHex = hash.digest("hex");
        // slice à 10 a cause de parseInt() 
        const hashToInt = parseInt(hashHex.slice(0, 8), 16); 
        const index = hashToInt % targetArray.length; // Modifié : utilise targetArray au lieu de this.collection
        
        this.pushOrCollide(index, newValue, targetArray);
        console.log(this.collection)
        // ou currentLoad++ // modifier au onStart()
        return 0 // a changé
    }

    pushOrCollide(index: number, newValue: HashmapValue<K, V | null>, targetArray: Bucket<K, V>[]): void {

        const currentBucket = targetArray[index]; // On récupère la case cible

        if (currentBucket !== null) {
            
            if (!Array.isArray(currentBucket)) { // transform to array
                console.log("convertir to array");
                targetArray[index] = [currentBucket, newValue];
            } else {
                currentBucket.push(newValue); // push in array
            }
            
        } else { // no collide 
            targetArray[index] = newValue;
        }
    }

    rehashing(): void {
        this.currentLength = this.currentLength * 2
        let previousBucket: Bucket<K, V>[] =  this.collection
        let rehashedBucket: Bucket<K, V>[] =  new Array(this.currentLength).fill(null) // a été mutiplié par 2
        // comparer aussi les collisions

        previousBucket.forEach((element) => {
            if (element !== null) {
                if(Array.isArray(element)){
                    element.forEach((subElement) => {
                        this.hashEntry(subElement, rehashedBucket)
                    });
                    // utiliser la logique de hashEntry, mais d'abord refacto insert pour adapter l'insertion sur la collection
                } else {
                    this.hashEntry(element, rehashedBucket)
                }
            }
        });

        this.collection = rehashedBucket; // Remplacement final
    }
    
    verifyLoadFactor(): void {}
    onStart(): void {
        this.computeLoadFactor();
    }
}