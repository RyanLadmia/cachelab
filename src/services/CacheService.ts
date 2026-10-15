import { MyCollection } from "../model/CollectionType";
import { createHash } from "crypto";

// type HashmapValue = {
//     key: PropertyKey;
//     value: PropertyKey;
// }

// class HashMap<T> {

//     private collection : MyCollection<T> = Array(8);
//     private loadFactor = 0.75;
//     private hashMapLenght = this.collection.length;

//     insert(newValue: HashmapValue){
//         //to do : verifier le load factor
//         let key =  Object.keys(newValue)[0];
//         console.log(key);
        
//         // Le hashage attend une string
//         let hash = createHash("aes-192-cbc");
//         hash.update(key);

//         const hashSlice = hash.digest().subarray(0, this.hashMapLenght);
//         console.log(hash);

//         const hashToInt = parseInt(hashSlice, 16)

//         let hashSplit = hash.split()
//     }  



// Steps :

// To type
type HashmapValue<K extends PropertyKey, V> = {
    key: K;
    value: V;
}

//define class 
class HashMap<K extends PropertyKey, V>{
    private collection: MyCollection<HashmapValue<K, V>> = Array(8).fill(undefined)
    private loadFactor = 0.75;

    insert(newValue: HashmapValue<K, V>) {

        // Get the key
        const key = String(newValue.key);
        console.log(key);

        // Hash the key
        const hash = createHash(key);
        console.log(hash);
        // Convert hash to hexadecimal
        const hashHex = hash.digest("hex");
        console.log(hashHex);

        // Convert 8 first hex caracters to int
        const hashToInt = parseInt(hashHex.slice(0, 8), 16);
        console.log(hashToInt);

        // Calculate index
        const index = hashToInt % this.collection.length;
        console.log(index);
    }
}