// server.js - ¡VERSIÓN FINAL Y COMPLETA CON CRUD FUNCIONAL Y ARRANQUE ROBUSTO!

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const couchbase = require('couchbase');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); 

const app = express();
const PORT = process.env.PORT || 3000; // CRÍTICO: Usa el puerto de Railway o 3000

app.use(cors());
app.use(bodyParser.json());

// CRÍTICO: Permite que Express sirva index.html y app.js en la URL raíz (/)
app.use(express.static(path.join(__dirname, '/'))); 

// --- 🛑 CREDENCIALES (Railway usará estas variables de entorno) 🛑 ---
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
            // Timeout de 30s para evitar el 'unambiguous timeout'
            timeouts: {
                connectTimeout: 30000 
            },
            configProfile: 'wanDevelopment' 
        });

        const bucket = cluster.bucket(bucketName);
        const scope = bucket.scope(scopeName);
        collection = scope.collection(collectionName);
        
        console.log('✅ Conexión a Couchbase Capella exitosa.'); 
        return true; 

    } catch (error) {
        // Permitimos que el servidor siga corriendo (Adiós 502 por fallos de DB)
        console.error('❌ ERROR: NO SE PUDO CONECTAR A COUCHBASE. LAS RUTAS CRUD FALLARÁN:', error.message);
        throw error; 
    }
}

// --- ENDPOINTS CRUD ---

// Función de ayuda para verificar la conexión
function checkConnection(res) {
    if (!collection) {
        res.status(503).json({ error: 'Servicio no disponible: Fallo la conexión a la base de datos.' });
        return false;
    }
    return true;
}

// 1. READ ALL - Obtiene todas las cartas (N1QL)
app.get('/datos', async (req, res) => {
    if (!checkConnection(res)) return;
    
    try {
        // CRÍTICO: Traemos d.* y el ID de metadatos (_id).
        const query = `SELECT d.*, META(d).id AS _id FROM \`${bucketName}\` AS d WHERE d.type = 'card' LIMIT 50`; 
        
        const result = await cluster.query(query, { scope: scopeName });
        
        // Mapeo CRÍTICO: Garantiza el formato plano para el frontend.
        const rows = result.rows.map(row => ({
            ...row.d, 
            _id: row._id 
        }));

        res.status(200).json(rows);
    } catch (error) {
        console.error('❌ ERROR FATAL DE N1QL en /datos:', error.message || error);
        res.status(500).json({ error: 'Fallo al recuperar los datos.' });
    }
});


// 2. CREATE - Crea una nueva carta
app.post('/datos', async (req, res) => {
    if (!checkConnection(res)) return;

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
    if (!checkConnection(res)) return;

    const docId = req.params.id;
    try {
        const result = await collection.get(docId);
        // Devolvemos el contenido del documento y el ID
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
    if (!checkConnection(res)) return;

    const docId = req.params.id;
    const { name, elixirCost } = req.body;
    
    if (!name || !elixirCost) {
        return res.status(400).json({ error: 'Faltan campos requeridos (name, elixirCost).' });
    }

    try {
        // Obtener el documento actual para mantener metadatos
        const currentDoc = await collection.get(docId);
        const updatedDocument = {
            ...currentDoc.content, 
            name: name,
            elixirCost: elixirCost,
            updatedAt: new Date().toISOString()
        };

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
    if (!checkConnection(res)) return;

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


// 💡 BLOQUE FINAL: Iniciamos el servidor (no bloqueante)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Express ejecutándose en el puerto ${PORT}.`);
    // Llamar a la conexión de forma asíncrona. 
    // El .catch() asegura que un fallo aquí no detenga el proceso principal de Node.
    connectToCouchbase().catch(err => {
        console.error("⚠️ Aviso: Fallo en la llamada asíncrona de conexión a DB, pero el servidor Express está activo.");
    });
});