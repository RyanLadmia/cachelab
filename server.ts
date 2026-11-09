import Fastify from 'fastify'
import HashMap from './src/services/CacheService'


const fastify = Fastify({
  logger: true
})

// Declare a route
fastify.get('/', async function (request, reply) {
    let toto = new HashMap()
    await toto.insert({key: "name", value:"joris"});
    await toto.insert({key: "erlkjher", value:"joris"})
    await toto.insert({key: "hhhgjf", value:"joris"})
    await toto.insert({key: "bnbnb", value:"joris"})
    await toto.insert({key: "zzzz", value:"joris"})
    await toto.insert({key: "oooo", value:"joris"})
    return "plop"
})

// Run the server
fastify.listen({port: 3001, host: "0.0.0.0"}, function (err, address) {
    if (err) {
        fastify.log.error(err)
        process.exit(1)
    }
})
// curl http://127.0.0.1:3001 pour lancer les insertions
