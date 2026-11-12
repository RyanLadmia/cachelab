import path from "path";
import { promises as fs } from "fs";


export default class DataSeeder {

    public DATA_DIR = path.join(process.cwd(), "data/seed"); // ok 

    public DATA_FILE: string = "init.json"; // by default

    async seedFile(numberOfInsertion: number) { // multiple de 8
        try {
            console.log(numberOfInsertion, "numberOfInsertion");
            this.selectDataFile("init.json");
            console.log(this.DATA_DIR, this.DATA_FILE, 'yooo ');

            let array = [];

                // i < numberOfInsertion au lieu de <=
            for (let i = 0; i < numberOfInsertion; i++) { 
                array.push({key: `product-${i}`, value: i});
            }

            if (this.DATA_DIR) {
                await fs.mkdir(this.DATA_DIR, { recursive: true });
            }

            await fs.writeFile(this.DATA_FILE, JSON.stringify(array), "utf-8");
            
            console.log('yo');
            return true;
        } catch (error) {
            console.error("Erreur lors de la création du fichier :", error);
            return false;
        }
    }

    selectDataFile(value: string){
        this.DATA_FILE = path.join(this.DATA_DIR, value);    
    }

    async getSeedFile() {
        try {
            const data = await fs.readFile(this.DATA_FILE, 'utf-8'); 
            
            const fileSeedResult = JSON.parse(data); 
            console.log(fileSeedResult); 
            return fileSeedResult;

        } catch (error: any) {
            if (error.code === 'ENOENT') {
                console.log("Le fichier n'existe pas, création d'un fichier par défaut...");

                if (this.DATA_DIR) {
                    await fs.mkdir(this.DATA_DIR, { recursive: true });
                }

                const emptyData: any[] = []; 
                await fs.writeFile(this.DATA_FILE, JSON.stringify(emptyData), "utf-8"); // enlevé null 2 pour éviter les doublons lors de l'écriture
                // solution alternative
                return emptyData;
            }

            console.error("Erreur inattendue lors de la lecture :", error);
            return null; 
        }
    }

    async deleteDataFile(value: string) {
        const fileToDelete = path.join(this.DATA_DIR, value);

        try {
            await fs.unlink(fileToDelete); // suppr
            console.log(`Le fichier ${value} a été supprimé`);
            
            if (this.DATA_FILE === fileToDelete) {
                this.DATA_FILE = path.join(this.DATA_DIR, "cache.json"); // on revient au cache par defaut 
                // ou alors on pourrait reset la value a ""
            }
            } catch (error) {
                console.error(`Impossible de supprimer le fichier ${value} :`, error);
            }
        }
    }