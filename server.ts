import Fastify from 'fastify'
import HashMap from './src/services/CacheService'


const fastify = Fastify({
  logger: true
})

// Declare a route
fastify.get('/', function (request, reply) {
    let toto = new HashMap()
    toto.insert({key: "name", value:"joris"});
    toto.insert({key: "erlkjher", value:"joris"})
    toto.insert({key: "hhhgjf", value:"joris"})
    toto.insert({key: "bnbnb", value:"joris"})
    toto.insert({key: "bnbnb", value:"joris"})
    toto.insert({key: "zzzz", value:"joris"})
    toto.insert({key: "zzzz", value:"joris"})
    toto.insert({key: "zzzz", value:"joris"})
    toto.insert({key: "oooo", value:"joris"})
    
    return "plop"
})

// Run the server
fastify.listen({port: 3001}, function (err, address) {
    if (err) {
        fastify.log.error(err)
        process.exit(1)
    }
})
