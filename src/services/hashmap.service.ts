import { createHash } from "crypto";
import { promises as fs } from "fs";
import DataStorage from "./data-storage.service";

type HashmapValue<K extends PropertyKey, V> = { // a refacto ailleurs
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

    private dataStorage : DataStorage = new DataStorage()


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

    // resature hashmap from cache.json // ou d'autre a voir
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

// Nouvelles variables à ajouter en haut de votre classe HashMap
    private unsavedInsertions: number = 0;
    private readonly BATCH_SAVE_LIMIT: number = 500; // Sauvegarde tous les 500 éléments

    async insert(newValue: HashmapValue<K, V | null>): Promise<void> {

        // SUPPRIMÉ : await this.dataStorage.ensureStore(); (c'est déjà fait dans onStart !)

        if (this.currentLoad + 1 > this.indexLimitFactor) {
            this.rehashing();
        }
        
        this.hashEntry(newValue, this.collection);
        this.currentLoad++;
        this.unsavedInsertions++;

        // SUPPRIMÉ : console.table(this.collection); (C'est ce qui faisait figer votre terminal)

        // On n'écrit sur le disque que si on atteint la limite
        if (this.unsavedInsertions >= this.BATCH_SAVE_LIMIT) {
            await this.saveToDisk();
        }
    }

    // Nouvelle méthode dédiée à la sauvegarde
    async saveToDisk(): Promise<void> {
        if (this.unsavedInsertions === 0) return;

        await this.dataStorage.ensureStore(); // Vérification de sécurité
        await fs.writeFile(
            this.dataStorage.DATA_FILE,
            JSON.stringify(this.collection),
            "utf-8"
        );
        
        console.log(`[Batch] Sauvegarde effectuée : ${this.unsavedInsertions} éléments enregistrés sur le disque.`);
        this.unsavedInsertions = 0; // Remise à zéro
    }

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
        const index = hashToInt % targetArray.length; 
        
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
}