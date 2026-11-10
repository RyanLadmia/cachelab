import Fastify from 'fastify'
import HashMap from './src/services/hashmap.service'


const fastify = Fastify({
  logger: true
})

fastify.get('/cached-data', async function (request, reply) {

})

// Run the server
fastify.listen({port: 3001, host: "0.0.0.0"}, function (err, address) {
    if (err) {
        fastify.log.error(err)
        process.exit(1)
    }
})

// Declare a route
fastify.get('/', async function (request, reply) {
    let toto = new HashMap();
    await toto.onStart();
    await toto.insert({key: "name", value:"joris"});
    await toto.insert({key: "erlkjher", value:"ryan"})
    await toto.insert({key: "hhhgjf", value:"batman"})
    await toto.insert({key: "bnbnb", value:"whesh"})
    await toto.insert({key: "zzzz", value:"zidane"})
    await toto.insert({key: "oooo", value:"verguledozone"})
    return "plop"
}) // curl http://127.0.0.1:3001 pour lancer les insertions

fastify.get('/keys', async function (request, reply){
    let map = new HashMap();
    await map.onStart();
    return map.getAllKeys();
})

fastify.get<{ Params: { key: string } }>('/keys/:key', async function (request, reply) {
    let myValue = new HashMap();

    await myValue.onStart();

    return myValue.getKeyValue(request.params.key);
})
