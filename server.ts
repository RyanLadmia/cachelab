import Fastify from 'fastify'
import HashMap from './src/services/hashmap.service'
import { MyHashMapController } from './src/controllers/hashmap-controllers'


const fastify = Fastify({
  logger: true,
})

async function main(){
    const cache = new HashMap<string, string>()
    await cache.onStart();

    // Optional seeds
    const seeds = [
        { key: 'name', value: 'joris' },
        { key: 'erlkjher', value: 'ryan' },
        { key: 'hhhgjf', value: 'batman' },
        { key: 'bnbnb', value: 'whesh' },
        { key: 'zzzz', value: 'zidane' },
        { key: 'oooo', value: 'verguledozone' },
    ]
    for (const seed of seeds) {
        try {
            await cache.insert(seed)
        } catch (error) {
            // key already exist -> skip this step
            console.log(error instanceof Error ? error.message : error, "\n")
        }
    }

    const hashMapController = MyHashMapController(cache)

    fastify.get('/', async function() {
        return { status: 'OK\n'}
    })

    fastify.get('/keys', hashMapController.getAll)
    fastify.get('/keys/:key', hashMapController.getOne)
    fastify.post('/keys', hashMapController.create)
    fastify.put('/keys/:key', hashMapController.update)
    fastify.delete('/keys/:key', hashMapController.remove)

    await fastify.listen ({port: 3001, host: '0.0.0.0'})
}

main().catch((err) => {
    console.error(err,  "\n")
    process.exit(1)
})

/**
 * Curl for update and delete
 * 
 * Update :
 *      curl -X PUT http://127.0.0.1:3001/keys/name \
        -H "Content-Type: application/json" \
        -d '{"value":"new_value"}'

    Delete :
        curl -X DELETE http://127.0.0.1:3001/keys/name
 */