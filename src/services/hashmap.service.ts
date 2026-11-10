import { MyCollection } from './../model/CollectionType';
import { createHash } from "crypto";
import { promises as fs } from "fs";
import DataStorage from "./data-storage.service";

type HashmapValue<K extends PropertyKey, V> = {
    key: K;
    value: V;
}

type Bucket<K extends PropertyKey, V> = HashmapValue<K, V | null> | HashmapValue<K, V | null>[] | null;



//define class 
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

    // resature hashmap from cache.json
    // Fusion de load() et onStart() pour tout initialiser correctement au démarrage
    async onStart(): Promise<void> {
        await this.dataStorage.ensureStore();
        
        const file = await fs.readFile(this.dataStorage.DATA_FILE, "utf-8");
        if (file.trim()) {
            const parsedData = JSON.parse(file);
            this.collection = parsedData;
            this.currentLength = this.collection.length;
            console.log(`Données chargées depuis le cache, taille : ${this.currentLength}`);
        }

        // On recalcule les limites et la charge basées sur le fichier qu'on vient de charger
        this.computeLoadFactor();
        this.computeCurrentLoad();
    }

    async insert(newValue: HashmapValue<K, V | null>): Promise<void> {
        // Check data folder and cache.json exists
        await this.dataStorage.ensureStore();

        if (this.currentLoad + 1 > this.indexLimitFactor) {
            this.rehashing();
        }
        
        this.hashEntry(newValue, this.collection);
        this.currentLoad++; 

        // Edit the cache.json file après l'insertion (et le potentiel rehashing)
        await fs.writeFile(
            this.dataStorage.DATA_FILE,
            JSON.stringify(this.collection, null, 2),
            "utf-8"
        );

        console.table(this.collection);
        console.log("\n_________________________________________________________________________________________________________________________\n");
    }

    // Les méthodes internes de calcul restent synchrones car elles ne touchent qu'à la RAM
    hashEntry(newValue: HashmapValue<K, V | null>, targetArray: Bucket<K, V>[]): void {

        // Get the key
        const key = String(newValue.key);
        // Hash the key
        const hash = createHash('sha256').update(key);        
        // Convert hash to hexadecimal
        const hashHex = hash.digest("hex");
        // Convert 8 first hex caracters to int
        // total is 10 due to base int16, wich counter out of 16 and not of 10, which add 2 symbols with parsin at the end 
        // slice à 10 a cause de parseInt() 
        const hashToInt = parseInt(hashHex.slice(0, 8), 16); 
        // Calculate index
        const index = hashToInt % targetArray.length; // Modifié : utilise targetArray au lieu de this.collection
        
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
    }
    
    verifyLoadFactor(): void {}



    // getAllEntries(): HashmapValue<K, V | null> [] {
    //     let allEntries = this.collection
    //     if (allEntries == null){
    //         return
    //     }
         
    // }
}