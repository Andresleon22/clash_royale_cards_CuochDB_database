// server.js - Versión Final CRUD Completo

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const couchbase = require('couchbase');
const path = require('path'); // Necesario para servir index.html correctamente
const { v4: uuidv4 } = require('uuid'); 

const app = express(); // ⬅️ CRÍTICO: Definición de Express
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// 💡 CORRECCIÓN: Permite que Express sirva archivos estáticos (index.html, app.js, etc.)
app.use(express.static(path.join(__dirname, '/'))); 

// --- 🛑 CREDENCIALES (Railway las usa si están configuradas) 🛑 ---
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
        process.exit(1); // Detiene la app si falla la conexión
    }
}

// --- ENDPOINTS CRUD ---

// 1. READ ALL - Obtiene todas las cartas (Limitado a 50)
app.get('/datos', async (req, res) => {
    try {
        // Traemos el documento completo (d.*) y el ID de metadatos (META(d).id)
        const query = `SELECT d.*, META(d).id FROM \`${bucketName}\` AS d WHERE d.type = 'card' LIMIT 50`; 
        
        const result = await cluster.query(query, { scope: scopeName });
        
        // Mapeamos para que cada objeto retornado tenga el ID y los datos en la raíz
        const rowsWithId = result.rows.map(row => ({
            ...row.d, 
            _id: row.id // Usamos _id para ser consistente con el frontend
        }));

        res.status(200).json(rowsWithId);
    } catch (error) {
        console.error('❌ ERROR FATAL DE N1QL en /datos:', error.message || error);
        res.status(500).json({ error: 'Fallo al recuperar los datos de la base de datos.' });
    }
});


// 2. CREATE - Crea una nueva carta
app.post('/datos', async (req, res) => {
    // Usamos el cuerpo de la petición directamente, asumiendo una estructura plana y limpia
    const { name, elixirCost } = req.body; 
    
    if (!name || !elixirCost) {
        return res.status(400).json({ error: 'Faltan campos requeridos (name, elixirCost).' });
    }
    
    const docId = `card::${uuidv4()}`; 
    const document = {
        type: 'card', 
        name: name,
        elixirCost: elixirCost,
        createdAt: new Date().toISOString()
    };

    try {
        await collection.insert(docId, document);
        res.status(201).json({ message: 'Carta creada con éxito', id: docId });
    } catch (error) {
        console.error('❌ ERROR FATAL en POST /datos:', error.message || error);
        res.status(500).json({ error: 'Fallo al crear la carta.' });
    }
});

// 3. READ ONE - Obtiene una sola carta por ID (Para edición)
app.get('/datos/:id', async (req, res) => {
    const docId = req.params.id;
    try {
        const result = await collection.get(docId);
        // Devolvemos el contenido del documento y el ID de metadatos
        res.status(200).json({ ...result.content, _id: docId });
    } catch (error) {
        if (error instanceof couchbase.DocumentNotFoundError) {
            return res.status(404).json({ error: 'Carta no encontrada.' });
        }
        res.status(500).json({ error: 'Fallo al recuperar la carta.' });
    }
});


// 4. UPDATE - Actualiza una carta existente
app.put('/datos/:id', async (req, res) => {
    const docId = req.params.id;
    const { name, elixirCost } = req.body;
    
    if (!name || !elixirCost) {
        return res.status(400).json({ error: 'Faltan campos requeridos (name, elixirCost).' });
    }

    try {
        // Paso 1: Obtener el documento actual para mantener el metadato 'type' y otras propiedades
        const currentDoc = await collection.get(docId);

        // Paso 2: Crear el nuevo documento con los datos actualizados
        const updatedDocument = {
            ...currentDoc.content, // Mantiene todas las propiedades no enviadas (como 'type' y 'createdAt')
            name: name,
            elixirCost: elixirCost,
            updatedAt: new Date().toISOString()
        };

        // Paso 3: Reemplazar el documento
        await collection.replace(docId, updatedDocument);

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
    console.error('Error final al iniciar el servidor:', err.message);
});