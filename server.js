// server.js (MODIFICADO)

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const couchbase = require('couchbase');
const { v4: uuidv4 } = require('uuid'); 

const app = express(); 
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

app.use(express.static(__dirname)); 

// --- 🛑 CREDENCIALES FINALES DE PRUEBA (¡CONFIGURA EN RAILWAY!) 🛑 ---
const connectionString = process.env.CB_CONNECTION_STRING || 'couchbases://cb.cvm3woykexh3g6ja.cloud.couchbase.com'; 
const username = process.env.CB_USERNAME || 'Caballero';
const password = process.env.CB_PASSWORD || 'MiniPekka1?';
const bucketName = process.env.CB_BUCKET_NAME || 'ClashRoyale'; 
const scopeName = '_default';
const collectionName = '_default';   

let collection; 
let cluster;    

async function connectToCouchbase() {
    try {
        cluster = await couchbase.connect(connectionString, {
            username: username,
            password: password,
            timeouts: {
                connectTimeout: 30000 
            },
            configProfile: 'wanDevelopment' 
        });

        const bucket = cluster.bucket(bucketName);
        const scope = bucket.scope(scopeName);
        collection = scope.collection(collectionName);
        
        console.log('✅ Conexión a Couchbase Capella exitosa.'); 

    } catch (error) {
        console.error('❌ Error CRÍTICO al conectar a Couchbase Capella:', error.message);
        process.exit(1);
    }
}

// --- ENDPOINTS CRUD ---

// 1. READ ALL - Obtiene todas las cartas (N1QL)
app.get('/datos', async (req, res) => {
    console.log("-> RECIBIDA Petición GET /datos. Iniciando DB Query.");

    try {
        // MODIFICACIÓN CRÍTICA: Añadimos META(d).id AS _id (para CRUD) y eliminamos LIMIT 50.
        const query = `SELECT META(d).id AS _id, d.* FROM \`${bucketName}\` AS d WHERE d.type = 'card'`; 
        
        const result = await cluster.query(query, { scope: scopeName });
        
        console.log(`[GET /datos] Éxito. Documentos encontrados: ${result.rows.length}`);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('❌ ERROR FATAL DE N1QL en /datos:', error.message || error);
        res.status(500).json({ error: 'Fallo al recuperar los datos de la base de datos.' });
    }
});


// 2. CREATE - Crea una nueva carta
app.post('/datos', async (req, res) => {
    const cardData = req.body.data;
    // MODIFICACIÓN: Validar todos los campos nuevos
    if (!cardData || !cardData.name || !cardData.elixirCost || !cardData.rarity || !cardData.type || !cardData.imageUrl) {
        return res.status(400).json({ error: 'Faltan campos requeridos (name, elixirCost, rarity, type, imageUrl).' });
    }
    
    const docId = `card::${uuidv4()}`;
    const document = {
        type: 'card', 
        data: cardData,
        createdAt: new Date().toISOString()
    };

    try {
        await collection.insert(docId, document);
        console.log(`[POST /datos] Éxito. Carta creada con ID: ${docId}`);
        res.status(201).json({ message: 'Carta creada con éxito', id: docId });
    } catch (error) {
        console.error('❌ ERROR FATAL en POST /datos:', error.message || error);
        res.status(500).json({ error: 'Fallo al crear la carta.' });
    }
});


// 3. READ ONE - Obtiene una sola carta por ID 
app.get('/datos/:id', async (req, res) => {
    const docId = req.params.id;
    try {
        const result = await collection.get(docId);
        console.log(`[GET /datos/:id] Éxito. Carta encontrada: ${docId}`);
        res.status(200).json(result.content);
    } catch (error) {
        if (error instanceof couchbase.DocumentNotFoundError) {
            return res.status(404).json({ error: 'Carta no encontrada.' });
        }
        console.error('❌ ERROR FATAL en GET /datos/:id:', error.message || error);
        res.status(500).json({ error: 'Fallo al recuperar la carta.' });
    }
});


// 4. UPDATE - Actualiza una carta existente
app.put('/datos/:id', async (req, res) => {
    const docId = req.params.id;
    const cardData = req.body.data;
    // MODIFICACIÓN: Validar todos los campos nuevos
    if (!cardData || !cardData.name || !cardData.elixirCost || !cardData.rarity || !cardData.type || !cardData.imageUrl) {
        return res.status(400).json({ error: 'Faltan campos requeridos (name, elixirCost, rarity, type, imageUrl).' });
    }

    try {
        const currentDoc = await collection.get(docId);
        const newDocument = {
            ...currentDoc.content, 
            data: cardData, 
            updatedAt: new Date().toISOString()
        };

        await collection.replace(docId, newDocument);

        console.log(`[PUT /datos/:id] Éxito. Carta actualizada: ${docId}`);
        res.status(200).json({ message: 'Carta actualizada con éxito', id: docId });
    } catch (error) {
        if (error instanceof couchbase.DocumentNotFoundError) {
            return res.status(404).json({ error: 'Carta no encontrada para actualizar.' });
        }
        console.error('❌ ERROR FATAL en PUT /datos/:id:', error.message || error);
        res.status(500).json({ error: 'Fallo al actualizar la carta.' });
    }
});


// 5. DELETE - Borra una carta
app.delete('/datos/:id', async (req, res) => {
    const docId = req.params.id;
    try {
        await collection.remove(docId);
        console.log(`[DELETE /datos/:id] Éxito. Carta eliminada: ${docId}`);
        res.status(200).json({ message: 'Carta eliminada con éxito', id: docId });
    } catch (error) {
        if (error instanceof couchbase.DocumentNotFoundError) {
            return res.status(404).json({ error: 'Carta ya eliminada o no existe.' });
        }
        console.error('❌ ERROR FATAL en DELETE /datos/:id:', error.message || error);
        res.status(500).json({ error: 'Fallo al eliminar la carta.' });
    }
});


// 💡 INICIO DEL SERVIDOR
connectToCouchbase().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Servidor Express ejecutándose en el puerto ${PORT} (Conexión Capella OK).`);
    });
}).catch(err => {
    console.error('Error final al iniciar el servidor:', err.message);
});