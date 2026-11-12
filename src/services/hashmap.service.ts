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
    private indexLimitFactor: number = 0; 
    private currentLoad: number = 0; 
    private dataStorage : DataStorage = new DataStorage();

    // Variables pour le batching en mémoire
    private unsavedInsertions: number = 0;
    private readonly BATCH_SAVE_LIMIT: number = 500;

    private getIndex(key: K, length: number = this.collection.length): number {
         const hash = createHash('sha256').update(String(key));        
         const hashHex = hash.digest("hex");
         const hashToInt = parseInt(hashHex.slice(0, 8), 16); 
         return hashToInt % length; 
    }

    private findEntry(key: K): HashmapValue<K, V | null> | null {
        const index = this.getIndex(key);
        const bucket = this.collection[index];

        if (bucket === null) {
            return null;
        }
        if (Array.isArray(bucket)) {
            for (const entry of bucket) {
                if (entry.key === key) {
                    return entry; 
                }
            }
            return null; 
        }
        if (bucket.key === key) {
            return bucket;
        }
        return null; 
    }

    private async persist(): Promise<void> {
        await this.dataStorage.save(this.collection);
    }

    computeLoadFactor(): void {
        this.indexLimitFactor = this.currentLength * this.loadFactor;
    }

    setStorageFile(filePath: string): void {
        this.dataStorage.selectDataFile(filePath);
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

    async onStart(): Promise<void> {
        const parsedData = await this.dataStorage.load();
        
        if (parsedData) {
            this.collection = parsedData as Bucket<K, V>[];
            this.currentLength = this.collection.length;
            console.log(`Données chargées depuis le cache, taille : ${this.currentLength}`);
        }

        this.computeLoadFactor();
        this.computeCurrentLoad();
    }

    async insert(newValue: HashmapValue<K, V | null>): Promise<void> {
        
        const existing = this.findEntry(newValue.key);
        if (existing) {
            throw new Error(`Key "${String(newValue.key)}" already exists.`);        
        }
    
        if (this.currentLoad + 1 > this.indexLimitFactor) {
            this.rehashing();
        }
    
        this.hashEntry(newValue, this.collection);
        this.currentLoad++;
        this.unsavedInsertions++;

        if (this.unsavedInsertions >= this.BATCH_SAVE_LIMIT) {
            await this.saveToDisk();
        }
    }

    async saveToDisk(): Promise<void> {
        if (this.unsavedInsertions === 0) return;

        await this.persist();
        
        console.log(`[Batch] Sauvegarde effectuée : ${this.unsavedInsertions} éléments enregistrés sur le disque.`);
        console.log("\n____________________________________________________________\n");
        this.unsavedInsertions = 0; 
    }

    hashEntry(newValue: HashmapValue<K, V | null>, targetArray: Bucket<K, V>[]): void {
       const index = this.getIndex(newValue.key, targetArray.length);
       this.pushOrCollide(index, newValue, targetArray);
    }

    pushOrCollide(index: number, newValue: HashmapValue<K, V | null>, targetArray: Bucket<K, V>[]): void {
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

    rehashing(): void {
        this.currentLength = this.currentLength * 2
        let previousBucket: Bucket<K, V>[] =  this.collection
        let rehashedBucket: Bucket<K, V>[] =  new Array(this.currentLength).fill(null) 

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

        this.collection = rehashedBucket; 
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
            return false;
        }
        if (Array.isArray(bucket)) {
            let entryIndex = -1;  

            for (let i = 0; i < bucket.length; i++) {
                if (bucket[i].key === key) { 
                    entryIndex = i; 
                    break;
                }
            }

            if (entryIndex === -1) {
                return false; 
            }

            bucket.splice(entryIndex, 1); 

            if (bucket.length === 0) {
                this.collection[index] = null; 
            } else if (bucket.length === 1) { 
                this.collection[index] = bucket[0];
            }
            this.currentLoad--; 
            await this.persist();
            return true;
        }

        if (bucket.key !== key) { 
            return false; 
        }
        this.collection[index] = null; 
        this.currentLoad--;
        await this.persist();
        return true;
    }
}