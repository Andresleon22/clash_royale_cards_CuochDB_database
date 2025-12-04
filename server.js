// server.js - Versión para Railway

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const couchbase = require('couchbase');
const { v4: uuidv4 } = require('uuid'); 
const path = require('path'); // <-- NUEVO: Para manejar rutas de archivos

const app = express();
// El puerto de Railway se establece mediante una variable de entorno.
const PORT = process.env.PORT || 3000; 

// --- 🔑 CREDENCIALES DESDE VARIABLES DE ENTORNO 🔑 ---
const connectionString = process.env.CB_CONNECTION_STRING; 
const username = process.env.CB_USERNAME;
const password = process.env.CB_PASSWORD;
const bucketName = process.env.CB_BUCKET_NAME;

// Nombres que no cambian
const scopeName = '_default';
const collectionName = '_default';   

let collection; 
let cluster;    

app.use(cors());
app.use(bodyParser.json());

// --- 🟢 NUEVO: SERVIR ARCHIVOS ESTÁTICOS (index.html, app.js) 🟢 ---
// Esto le dice a Express que sirva todos los archivos del directorio actual
app.use(express.static(path.join(__dirname, '/'))); 

async function connectToCouchbase() {
    // ... (El resto de la función connectToCouchbase queda igual)
    try {
        cluster = await couchbase.connect(connectionString, {
            username: username,
            password: password,
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

// RUTA RAIZ: Ahora sirve index.html directamente (ya que express.static lo hace)
app.get('/', (req, res) => {
    // Ya no es necesario, Express Static lo maneja, pero lo dejamos para asegurar el root
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ... (El resto de las rutas CRUD /datos, /datos/:id quedan IGUAL) ...
// (Asegúrate de copiar todas las rutas CRUD que te proporcioné anteriormente)


connectToCouchbase().then(() => {
    app.listen(PORT, () => {
        console.log(`Servidor Express ejecutándose en el puerto ${PORT}`);
    });
});