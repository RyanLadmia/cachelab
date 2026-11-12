import { createHash } from "crypto";
import DataStorage from "./data-storage.service";

type HashmapValue<K extends PropertyKey, V> = {
    key: K;
    value: V;
}

type Bucket<K extends PropertyKey, V> = 
    | HashmapValue<K, V | null> 
    | HashmapValue<K, V | null>[] 
    | null;

export default class HashMap<K extends PropertyKey, V> {
    
    private BASE_LENGTH = 8;
    private currentLength = this.BASE_LENGTH;
    private collection: Bucket<K, V>[] = new Array(this.BASE_LENGTH).fill(null);
    private loadFactor: number = 0.75;
    private indexLimitFactor: number = 0; // servira a ne pas tt le temps recalculer et avoir des paliers
    private currentLoad: number = 0; // Va recalculer entierement le load a chaque fois
    // Pourrait être incrémenté depuis le début, mais il y a des risques en cas de coupure
    // Pourra émettre un nombre dans la sauvegarde pour savoir ou on en était 

    private dataStorage : DataStorage = new DataStorage()

    private getIndex(key: K, length: number = this.collection.length): number {
         // Hash the key
         const hash = createHash('sha256').update(String(key));        
         // Convert hash to hexadecimal
         const hashHex = hash.digest("hex");
         // Convert 8 first hex caracters to int
         // total is 10 due to base int16, wich counter out of 16 and not of 10, which add 2 symbols with parsin at the end 
         // slice à 10 a cause de parseInt() 
         const hashToInt = parseInt(hashHex.slice(0, 8), 16); 
         // Keep the index inside the array bounds
         return hashToInt % length; 
    }

    // Find the key and value inside a target bucket
    // Useful to not duplicate the key and for update
    private findEntry(key: K): HashmapValue<K, V | null> | null {
        const index = this.getIndex(key);
        const bucket = this.collection[index];

        if (bucket === null) {
            return null; // bucket is null
        }
        if (Array.isArray(bucket)) {
            for (const entry of bucket) {
                if (entry.key === key) {
                    return entry; // for multiples entry (collision)
                }
            }
            return null; // key doesn't exists in array
        }
        if (bucket.key === key) {
            return bucket; // for a single entry
        }
        return null; // key doen't exists in bucket (no collision)
    }

    // persist the current collection in a DataStorage 
    private async persist(): Promise<void> {
        await this.dataStorage.save(this.collection);
    }


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
        console.log("Current Load au démarrage :", this.currentLoad);
    }

    // restore hashmap from cache.json
    // Merge de load() and onStart() to initialize everything  at start
    async onStart(): Promise<void> {
        const parsedData = await this.dataStorage.load();
        
        if (parsedData) {
            this.collection = parsedData as Bucket<K, V>[];
            this.currentLength = this.collection.length;
            console.log(`Données chargées depuis le cache, taille : ${this.currentLength}`);
        }

        // Recalculate limits and load based on the file just loaded
        this.computeLoadFactor();
        this.computeCurrentLoad();
    }

    async insert(newValue: HashmapValue<K, V | null>): Promise<void> {
        // If key already exists → throw an error
        const existing = this.findEntry(newValue.key);
        if (existing) {
            throw new Error(`Key "${String(newValue.key)}" already exists.`);        }
    
        if (this.currentLoad + 1 > this.indexLimitFactor) {
            this.rehashing();
        }
    
        this.hashEntry(newValue, this.collection);
        this.currentLoad++;
    
        // Save cache.json after insert (and potential rehashing)
        await this.persist();

        console.table(this.collection);
        console.log("\n____________________________________________________________\n");
    }

    // Les méthodes internes de calcul restent synchrones car elles ne touchent qu'à la RAM
    hashEntry(newValue: HashmapValue<K, V | null>, targetArray: Bucket<K, V>[]): void {

       const index = this.getIndex(newValue.key, targetArray.length);
       this.pushOrCollide(index, newValue, targetArray);
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
                } else {
                    this.hashEntry(element, rehashedBucket)
                }
            }
        });

        this.collection = rehashedBucket; // Remplacement final
        this.computeLoadFactor();
    }
    
    verifyLoadFactor(): void {}

    getAllKeys(): K[] {
        const keys: K[] = [];
    
        for (const bucket of this.collection) {
            if (bucket === null) continue;
    
            if (Array.isArray(bucket)) {
                for (const entry of bucket) {
                    keys.push(entry.key);
                }
            } else {
                keys.push(bucket.key);
            }
        }
    
        console.log(keys);
        return keys;
    }

    getBucketsSnapshot() {
        let collisions = 0;
        let occupied = 0;

        const buckets = this.collection.map((bucket, index) => {
            if (bucket === null) {
                return {
                    index,
                    type: "empty" as const,
                    entries: [] as HashmapValue<K, V | null>[],
                };
            }

            occupied += 1;

            if (Array.isArray(bucket)) {
                collisions += 1;
                return {
                    index,
                    type: "collision" as const,
                    entries: bucket.map((entry) => ({
                        key: entry.key,
                        value: entry.value,
                    })),
                };
            }

            return {
                index,
                type: "single" as const,
                entries: [{ key: bucket.key, value: bucket.value }],
            };
        });

        return {
            length: this.currentLength,
            load: this.currentLoad,
            loadFactor: this.loadFactor,
            loadLimit: this.indexLimitFactor,
            occupied,
            collisions,
            buckets,
        };
    }


    getKeyValue(key: K): V | null {
        const entry = this.findEntry(key);
        if (!entry) {
            return null;
        }
        return entry.value;
    }

    async updateKeyValue(key: K, newValue: V): Promise<boolean> {
        const entry = this.findEntry(key);
        if (!entry) {
            return false;
        }
        entry.value = newValue;
        await this.persist();
        return true;
    }

    async deleteKey(key: K): Promise<boolean> {
        const index = this.getIndex(key);
        const bucket = this.collection[index];

        if (bucket === null) {
            return false; // bucket null, stop here
        }
        if (Array.isArray(bucket)) {
            let entryIndex = -1;  // because an array start at 0

            for (let i = 0; i < bucket.length; i++) {
                if (bucket[i].key === key) { // compare bucket's key with target key
                    entryIndex = i; // its position in array 
                    break;
                }
            }

            if (entryIndex === -1) {
                return false; // it doesn't exists
            }

            bucket.splice(entryIndex, 1); // delete from array

            if (bucket.length === 0) {
                this.collection[index] = null; // if bucket is empty -> null
            } else if (bucket.length === 1) { // it has one element, back to a single entry
                this.collection[index] = bucket[0];
            }
            this.currentLoad--; 
            await this.persist();
            return true;
        }

        if (bucket.key !== key) { // if bucket isn't an array 
            return false; // and key aren't the same
        }
        this.collection[index] = null; // if they're the same -> bucket = null
        this.currentLoad--;
        await this.persist();
        return true;
    }
}