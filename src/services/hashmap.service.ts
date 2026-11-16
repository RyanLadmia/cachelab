import { createHash } from "crypto";
import { HashmapValue, Bucket } from "../types/hashmap.types";
import CollectionIterator from "../iterators/CollectionIterator";

export default class HashMap<K extends PropertyKey, V> {
    
    private BASE_LENGTH = 8;
    private currentLength = this.BASE_LENGTH;
    private collection: Bucket<K, V>[] = new Array(this.BASE_LENGTH).fill(null);
    private loadFactor = 0.75;
    private currentLoad = 0; 

    // Les limites se calculent toutes seules à la volée
    private get indexLimitFactor(): number {
        return this.currentLength * this.loadFactor;
    }

    public get rawData(): Bucket<K, V>[] {
        return this.collection;
    }

    // Permet à l'Agrégateur d'injecter un fichier dans la RAM au démarrage
    public loadRawData(data: Bucket<K, V>[]): void {
        this.collection = data;
        this.currentLength = data.length;
        
        // Recompte de la charge
        this.currentLoad = this.collection.reduce((acc, bucket) => {
            if (bucket === null) return acc;
            return acc + (Array.isArray(bucket) ? bucket.length : 1);
        }, 0);
        console.log(`[RAM] Données chargées. Taille : ${this.currentLength}, Éléments: ${this.currentLoad}`);
    }

    private getIndex(key: K, length: number = this.currentLength): number {
         const hash = createHash('sha256').update(String(key));        
         const hashHex = hash.digest("hex");
         const hashToInt = parseInt(hashHex.slice(0, 8), 16); 
         return hashToInt % length; 
    }

    private findEntry(key: K): HashmapValue<K, V | null> | null {
        const index = this.getIndex(key);
        const bucket = this.collection[index];

        if (bucket === null) return null;
        
        if (Array.isArray(bucket)) {
            for (const entry of bucket) {
                if (entry.key === key) return entry; 
            }
            return null; 
        }
        
        if (bucket.key === key) return bucket;
        return null; 
    }

    public insert(newValue: HashmapValue<K, V | null>): void {
        const existing = this.findEntry(newValue.key);
        if (existing) {
            throw new Error(`Key "${String(newValue.key)}" already exists.`);        
        }
    
        if (this.currentLoad + 1 > this.indexLimitFactor) {
            this.rehashing();
        }
    
        this.hashEntry(newValue, this.collection);
        this.currentLoad++;
    }

    private hashEntry(newValue: HashmapValue<K, V | null>, targetArray: Bucket<K, V>[]): void {
       const index = this.getIndex(newValue.key, targetArray.length);
       this.pushOrCollide(index, newValue, targetArray);
    }

    private pushOrCollide(index: number, newValue: HashmapValue<K, V | null>, targetArray: Bucket<K, V>[]): void {
        const currentBucket = targetArray[index]; 

        if (currentBucket !== null) {
            if (!Array.isArray(currentBucket)) { 
                targetArray[index] = [currentBucket, newValue];
            } else {
                currentBucket.push(newValue); 
            }
        } else { 
            targetArray[index] = newValue;
        }
    }

    private rehashing(): void {
        this.currentLength *= 2;
        let rehashedBucket: Bucket<K, V>[] = new Array(this.currentLength).fill(null);

        this.collection.forEach((element) => {
            if (element !== null) {
                if(Array.isArray(element)){
                    element.forEach((sub) => this.hashEntry(sub, rehashedBucket));
                } else {
                    this.hashEntry(element, rehashedBucket);
                }
            }
        });

        this.collection = rehashedBucket; 
    }

    public getIterator(): CollectionIterator<Bucket<K, V>> {
        return new CollectionIterator<Bucket<K, V>>(this.collection);
    }

    public getAllKeys(): K[] {
        const keys: K[] = [];
        for (const bucket of this.collection) {
            if (bucket === null) continue;
            if (Array.isArray(bucket)) {
                for (const entry of bucket) keys.push(entry.key);
            } else {
                keys.push(bucket.key);
            }
        }
        return keys;
    }

    public getBucketsSnapshot() {
        let collisions = 0;
        let occupied = 0;

        const buckets = this.collection.map((bucket, index) => {
            if (bucket === null) {
                return { index, type: "empty" as const, entries: [] };
            }
            occupied += 1;
            if (Array.isArray(bucket)) {
                collisions += 1;
                return {
                    index, type: "collision" as const,
                    entries: bucket.map(e => ({ key: e.key, value: e.value }))
                };
            }
            return {
                index, type: "single" as const,
                entries: [{ key: bucket.key, value: bucket.value }]
            };
        });

        return {
            length: this.currentLength, load: this.currentLoad,
            loadFactor: this.loadFactor, loadLimit: this.indexLimitFactor,
            occupied, collisions, buckets
        };
    }

    public getKeyValue(key: K): V | null {
        const entry = this.findEntry(key);
        return entry ? entry.value : null;
    }

    public updateKeyValue(key: K, newValue: V): boolean {
        const entry = this.findEntry(key);
        if (!entry) return false;
        
        entry.value = newValue;
        return true; 
    }

    public deleteKey(key: K): boolean {
        const index = this.getIndex(key);
        const bucket = this.collection[index];

        if (bucket === null) return false;
        
        if (Array.isArray(bucket)) {
            let entryIndex = -1;  
            for (let i = 0; i < bucket.length; i++) {
                if (bucket[i].key === key) { 
                    entryIndex = i; break; 
                }
            }
            if (entryIndex === -1) return false; 

            bucket.splice(entryIndex, 1); 

            if (bucket.length === 0) this.collection[index] = null; 
            else if (bucket.length === 1) this.collection[index] = bucket[0];
            
            this.currentLoad--; 
            return true;
        }

        if (bucket.key !== key) return false; 
        
        this.collection[index] = null; 
        this.currentLoad--;
        return true;
    }
}