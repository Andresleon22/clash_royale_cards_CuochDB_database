// server.js

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const couchbase = require('couchbase');
const { v4: uuidv4 } = require('uuid'); 

const app = express(); // ⬅️ CRÍTICO: Definición de Express
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// 💡 CORRECCIÓN: Permite que Express sirva archivos estáticos como index.html
app.use(express.static(__dirname)); 

// --- 🛑 CREDENCIALES FINALES DE PRUEBA (¡CONFIGURA EN RAILWAY!) 🛑 ---
// Las variables de entorno son la mejor práctica. Si las tienes en Railway, 
// se usarán automáticamente. Si no, usa estos valores de fallback.
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
            // 💡 CORRECCIÓN: Aumentamos el timeout para evitar "unambiguous timeout"
            timeouts: {
                connectTimeout: 30000 // 30 segundos
            },
            configProfile: 'wanDevelopment' 
        });

        const bucket = cluster.bucket(bucketName);
        const scope = bucket.scope(scopeName);
        collection = scope.collection(collectionName);
        
        console.log('✅ Conexión a Couchbase Capella exitosa.'); 

    } catch (error) {
        console.error('❌ Error CRÍTICO al conectar a Couchbase Capella:', error.message);
        process.exit(1); // Detiene la app si falla la conexión (para notificar a Railway)
    }
}

// --- ENDPOINTS CRUD ---

// 1. READ ALL - Obtiene todas las cartas (N1QL)
app.get('/datos', async (req, res) => {
    console.log("-> RECIBIDA Petición GET /datos. Iniciando DB Query.");

    try {
        // La consulta trae todos los documentos del bucket con el tipo 'card'
        // Esto es una buena práctica para filtrar solo los documentos relevantes
        const query = `SELECT d.* FROM \`${bucketName}\` AS d WHERE d.type = 'card' LIMIT 50`; 
        
        // Ejecutamos la consulta en el scope_default
        const result = await cluster.query(query, { scope: scopeName });
        
        console.log(`[GET /datos] Éxito. Documentos encontrados: ${result.rows.length}`);

        // Devuelve el JSON puro de los documentos
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('❌ ERROR FATAL DE N1QL en /datos:', error.message || error);
        res.status(500).json({ error: 'Fallo al recuperar los datos de la base de datos.' });
    }
});


// 2. CREATE - Crea una nueva carta
app.post('/datos', async (req, res) => {
    const cardData = req.body.data;
    if (!cardData || !cardData.name || !cardData.elixirCost) {
        return res.status(400).json({ error: 'Faltan campos requeridos (name, elixirCost).' });
    }
    
    const docId = `card::${uuidv4()}`; // Crea un ID único
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


// 3. READ ONE - Obtiene una sola carta por ID (opcional, para edición)
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
    if (!cardData || !cardData.name || !cardData.elixirCost) {
        return res.status(400).json({ error: 'Faltan campos requeridos (name, elixirCost).' });
    }

    // Nota: Para la edición real se recomienda usar replace y el CAS (Check And Swap)
    try {
        // Obtenemos el documento actual para mantener el metadato 'type'
        const currentDoc = await collection.get(docId);
        const newDocument = {
            ...currentDoc.content, // Mantenemos las propiedades existentes
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


// 💡 INICIO DEL SERVIDOR: SOLO DESPUÉS DE CONECTAR A COUCHBASE
connectToCouchbase().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Servidor Express ejecutándose en el puerto ${PORT} (Conexión Capella OK).`);
    });
}).catch(err => {
    // Esto solo se ejecuta si la función connectToCouchbase NO lanzó process.exit(1)
    console.error('Error final al iniciar el servidor:', err.message);
});