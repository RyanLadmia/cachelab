import { MyCollection } from "./collectionType";
import { createHash } from "crypto";

type HashmapValue = {
    key: PropertyKey;
    value: PropertyKey;
}

class HashMap<T> {

    private collection : MyCollection<T> = Array(8);
    private loadFactor = 0.75;
    private hashMapLenght = this.collection.length;



    insert(newValue: HashmapValue){
        //to do : verifier le load factor
        let key =  Object.keys(newValue)[0];
        console.log(key);
        
        let hash = createHash("aes-192-cbc");
        hash.update(key);

        const hashSlice = hash.digest().subarray(0, this.hashMapLenght);
        console.log(hash);

        const hashToInt = parseInt(hashSlice, 16)

        let hashSplit = hash.split()


    }  

}