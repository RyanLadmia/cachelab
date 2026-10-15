import Fastify from 'fastify'

const fastify = Fastify({
  logger: true
})

// Declare a route
fastify.get('/', function (request, reply) {
    reply.send({ hello: 'worldo' })
} )

// Run the server
fastify.listen({port: 3001}, function (err, address) {
    if (err) {
        fastify.log.error(err)
        process.exit(1)
    }
})