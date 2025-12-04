// app.js

const API_URL = '/datos';
const form = document.getElementById('carta-crud-form');
const cardListDiv = document.getElementById('card-list');
const submitBtn = document.getElementById('submit-btn');

let isEditing = false; 

// ===================================================================
// 2. READ (LEER - Listar todas las cartas)
// ===================================================================

async function fetchCards() {
    console.log("Intentando obtener cartas de la API...");
    cardListDiv.innerHTML = 'Cargando cartas...';
    
    try {
        const response = await fetch(API_URL);
        
        if (!response.ok) {
            // Esto captura el error HTTP 500 que hemos estado viendo
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const rawCards = await response.json(); 
        
        // Mapeamos los datos. Como la consulta N1QL en server.js ahora devuelve el 
        // documento en la raíz, filtramos por la propiedad 'type' que sabemos que existe.
        const cards = rawCards.filter(card => card.type === 'card');

        renderCardList(cards);
    } catch (error) {
        console.error('Error al conectar con la API de Couchbase:', error);
        cardListDiv.innerHTML = `
            <strong>ERROR DE CONEXIÓN:</strong> 
            Asegúrate de que tu <strong>server.js</strong> esté corriendo con 'node server.js'. 
            Error: ${error.message}
        `;
    }
}

function renderCardList(cards) {
    cardListDiv.innerHTML = '';
    if (cards.length === 0) {
        cardListDiv.innerHTML = '<p>No hay cartas en la base de datos o la API devolvió datos vacíos.</p>';
        return;
    }

    cards.forEach(card => {
        const div = document.createElement('div');
        div.className = 'card-item';

        // La carta tiene los datos en la raíz: card.name, card.elixirCost
        const cardName = card.data ? card.data.name : card.name; // Soporte para estructuras anidadas (JSON original) o planas
        const elixirCost = card.data ? card.data.elixirCost : card.elixirCost;
        const id = card._id || 'ID Desconocido'; // _id solo existe si la consulta N1QL lo trae

        div.innerHTML = `
            <div>
                <strong>${cardName}</strong> (Elixir: ${elixirCost})
            </div>
            <div>
                <button onclick="loadCardForEdit('${id}')">Editar</button>
                <button onclick="deleteCard('${id}')">Borrar</button>
            </div>
        `;
        cardListDiv.appendChild(div);
    });
}

// ===================================================================
// 3. CREATE & UPDATE (Solo CREATE implementado para la prueba inicial)
// ===================================================================

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const elixirCost = parseInt(document.getElementById('elixirCost').value, 10);
    
    // Si usas el JSON original (que tiene el objeto "data" anidado), usa esta estructura:
    const cardData = {
        type: 'card', 
        data: {
            name: name,
            elixirCost: elixirCost,
        }
    };
    
    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing ? `${API_URL}/${document.getElementById('_id').value}` : API_URL;

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cardData)
        });
        
        if (!response.ok) {
            throw new Error('Fallo en la operación de guardado/actualización.');
        }

        console.log(`Carta ${isEditing ? 'actualizada' : 'creada'} con éxito.`);
        
        resetForm();
        fetchCards();
    } catch (error) {
        console.error('Error al guardar o actualizar la carta:', error);
    }
});

// [Funciones de Edición, Borrado y Reset, omitidas por espacio]
function loadCardForEdit(cardId) { alert("Funcionalidad de edición pendiente."); }
function resetForm() { form.reset(); isEditing = false; submitBtn.textContent = 'Crear Carta'; }
function deleteCard(cardId) { 
    // Esta función requiere el endpoint DELETE en server.js
    alert("Funcionalidad de borrado pendiente, pero el servidor está listo para implementarla.");
}


// ===================================================================
// 5. INICIALIZACIÓN
// ===================================================================

document.addEventListener('DOMContentLoaded', fetchCards);