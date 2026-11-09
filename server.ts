import Fastify from 'fastify'
import HashMap from './src/services/CacheService'


const fastify = Fastify({
  logger: true
})

// Declare a route
fastify.get('/', function (request, reply) {
    return new HashMap().insert({key: "name", value:"joris"});
})

// Run the server
fastify.listen({port: 3001}, function (err, address) {
    if (err) {
        fastify.log.error(err)
        process.exit(1)
    }
})