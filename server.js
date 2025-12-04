// server.js - Versión Final con Mapeo de Datos Corregido

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const couchbase = require('couchbase');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); 

const app = express();
const PORT = process.env.PORT || 3000; // Usa la variable de Railway o 3000 como fallback

app.use(cors());
app.use(bodyParser.json());

// CRÍTICO: Sirve index.html y app.js en la raíz (/)
app.use(express.static(path.join(__dirname, '/'))); 

// --- CREDENCIALES ---
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
        // Permitimos que el servidor siga corriendo
        console.error('❌ ERROR: NO SE PUDO CONECTAR A COUCHBASE. LAS RUTAS CRUD FALLARÁN:', error.message);
    }
}

// 1. READ ALL - Obtiene todas las cartas (N1QL)
app.get('/datos', async (req, res) => {
    if (!collection) {
        return res.status(503).json({ error: 'Servicio no disponible: Fallo la conexión a la base de datos.' });
    }
    
    try {
        // 💡 CORRECCIÓN CRÍTICA: Seleccionar las propiedades específicas y el ID (META(d).id)
        // Esto asegura que el frontend reciba un objeto plano y predecible.
        const query = `SELECT d.name, d.elixirCost, META(d).id AS _id FROM \`${bucketName}\` AS d WHERE d.type = 'card' LIMIT 50`; 
        
        const result = await cluster.query(query, { scope: scopeName });
        
        // El resultado de N1QL SELECT d.name, d.elixirCost ya es plano
        // Ejemplo: [{ name: 'Giant', elixirCost: 5, _id: 'card::uuid' }]
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('❌ ERROR FATAL DE N1QL en /datos:', error.message || error);
        res.status(500).json({ error: 'Fallo al recuperar los datos.' });
    }
});

// 2. CREATE - Crea una nueva carta
app.post('/datos', async (req, res) => {
    if (!collection) {
        return res.status(503).json({ error: 'Servicio no disponible: Fallo la conexión a la base de datos.' });
    }
    const { name, elixirCost } = req.body; 
    
    if (!name || !elixirCost) {
        return res.status(400).json({ error: 'Faltan campos requeridos (name, elixirCost).' });
    }
    
    const docId = `card::${uuidv4()}`; 
    const document = {
        type: 'card', 
        name: name, // Datos planos para que la consulta SELECT d.name funcione
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
// ... (Tus rutas PUT/DELETE/GET ONE deben usar la misma estructura plana para funcionar) ...

// BLOQUE FINAL: Iniciamos el servidor y luego intentamos la conexión DB
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Express ejecutándose en el puerto ${PORT}.`);
    connectToCouchbase(); 
});