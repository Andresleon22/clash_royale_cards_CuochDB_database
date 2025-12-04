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
        return true; // Retorna true si fue exitosa

    } catch (error) {
        // Permitimos que el servidor siga corriendo (¡Adiós 502!)
        console.error('❌ ERROR: NO SE PUDO CONECTAR A COUCHBASE. LAS RUTAS CRUD FALLARÁN:', error.message);
        throw error; // Propagar el error para que el .catch() del app.listen lo maneje
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
        // CRÍTICO: Traemos el documento completo (d.*) y el ID de metadatos (META(d).id AS _id)
        // Se filtra por type='card' para asegurar que solo se traigan los documentos correctos
        const query = `SELECT d.*, META(d).id AS _id FROM \`${bucketName}\` AS d WHERE d.type = 'card' LIMIT 50`; 
        
        const result = await cluster.query(query, { scope: scopeName });
        
        // Mapeo CRÍTICO: Extraemos el objeto 'd' y el ID.
        // Esto garantiza que el frontend reciba objetos planos como: { name: '...', elixirCost: N, _id: '...' }
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
        name: name, // Guardado plano
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
        // Obtener el documento actual para mantener metadatos como 'type' y 'createdAt'
        const currentDoc = await collection.get(docId);
        const updatedDocument = {
            ...currentDoc.content, 
            name: name,
            elixirCost: elixirCost,
            updatedAt: new Date().toISOString()
        };

        await collection.replace(docId, updatedDocument);

        res.status(200).json({ message: 'Carta actualizada con éxito', id