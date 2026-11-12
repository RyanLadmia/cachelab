import Fastify from 'fastify'
import HashMap from './src/services/hashmap.service'


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

    fastify.get('/', async function() {
        return { status: 'OK\n'}
    })

    fastify.get('/keys', async function() {
        return cache.getAllKeys()
    })

    fastify.get<{Params: {key: string } }>('/keys/:key', async function (request, reply) {
        const value = cache.getKeyValue(request.params.key)

        if (value == null) {
            return reply.code(404).send({ error: `Key "${request.params.key}" not found.`})
        }
        return { key: request.params.key, value}
    })

    fastify.post<{ Body: {key: string, value: string } }>('/keys', async function (request, reply) {
        const { key, value } = request.body

        if (!key) {
            return reply.code(400).send({ error: 'key is required' })
        }
        try {
            await cache.insert({ key, value })
            return reply.code(201).send({ key, value })
        }catch (error) {
            return reply.code(409).send({ error: error instanceof Error ? error.message: 'Insertion failed'})
        }
    })

    fastify.put<{ Params: {key: string }, Body: {value: string} }>('/keys/:key', async function (request, reply) {
        const updated = await cache.updateKeyValue(request.params.key, request.body.value)
        if (!updated) {
            return reply.code(404).send({error: `Key "${request.params.key}" not found `})
        }
        return { key: request.params.key, value: request.body.value}
    })

    fastify.delete<{ Params: { key: string }}>('/keys/:key', async function (request, reply) {
        const deleted = await cache.deleteKey(request.params.key)
        if (!deleted) {
            return reply.code(404).send({error: `Key "${request.params.key}" not found`})
        }
        return {deleted : true, key: request.params.key}
    })
    await fastify.listen ({port: 3001, host: '0.0.0.0'})
}

main().catch((err) => {
    console.error(err,  "\n")
    process.exit(1)
})