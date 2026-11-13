import { createHash } from "crypto";
import DataStorage from "./data-storage.service";
import { HashmapValue, Bucket } from "../types/hashmap.types";
import CollectionIterator from "../iterators/CollectionIterator"; // <-- Ajoutez le bon chemin ici

export default class HashMap<K extends PropertyKey, V> {
    
    private BASE_LENGTH = 8;
    private currentLength = this.BASE_LENGTH;
    private collection: Bucket<K, V>[] = new Array(this.BASE_LENGTH).fill(null);
    private loadFactor: number = 0.75;
    private indexLimitFactor: number = 0; 
    private currentLoad: number = 0; 
    private dataStorage : DataStorage = new DataStorage();

    // Propriété de persistance (RAM vs Disque)
    private isPersistent: boolean;

    // Variables pour le batching en mémoire
    private unsavedInsertions: number = 0;
    private readonly BATCH_SAVE_LIMIT: number = 500;

    // Le constructeur permet d'instancier en mode persistant (défaut) ou 100% RAM (false)
    constructor(isPersistent: boolean = true) {
        this.isPersistent = isPersistent;
    }

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
        // Bloque l'écriture si la HashMap est configurée pour rester uniquement en RAM
        if (!this.isPersistent) return;
        
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
        // Si 100% RAM, pas besoin de charger de fichier
        if (!this.isPersistent) {
            this.computeLoadFactor();
            this.computeCurrentLoad();
            return;
        }

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
        if (!this.isPersistent || this.unsavedInsertions === 0) return;

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

    // ---- NOUVEAU : Méthode pour obtenir l'itérateur ----
    public getIterator(): CollectionIterator<Bucket<K, V>> {
        return new CollectionIterator<Bucket<K, V>>(this.collection);
    }

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
        await this.persist(); // Si isPersistent est false, ça ne fera rien (sécurisé)
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