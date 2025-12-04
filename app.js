// app.js (MODIFICADO)

const API_URL = '/datos';
const form = document.getElementById('carta-crud-form');
const cardListDiv = document.getElementById('card-list');
const submitBtn = document.getElementById('submit-btn');
const idInput = document.getElementById('_id'); // Campo oculto para guardar el ID

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
        
        // La consulta N1QL ahora devuelve el documento completo con '_id'
        const cards = rawCards.filter(card => card.type === 'card');

        renderCardList(cards);
    } catch (error) {
        console.error('Error al conectar con la API de Couchbase:', error);
        cardListDiv.innerHTML = `
            <strong>ERROR DE CONEXIÓN:</strong> 
            Asegúrate de que tu <strong>server.js</strong> esté corriendo. 
            Error: ${error.message}
        `;
    }
}

function renderCardList(cards) {
    cardListDiv.innerHTML = '';
    if (cards.length === 0) {
        cardListDiv.innerHTML = '<p>No hay cartas en la base de datos.</p>';
        return;
    }

    cards.forEach(card => {
        const div = document.createElement('div');
        div.className = 'card-item';

        // Accedemos a los datos y al ID del documento
        const cardName = card.data ? card.data.name : card.name;
        const elixirCost = card.data ? card.data.elixirCost : card.elixirCost;
        const id = card._id; // El ID ya viene de la consulta N1QL actualizada

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
// 3. CREATE & UPDATE (CREAR y ACTUALIZAR)
// ===================================================================

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const elixirCost = parseInt(document.getElementById('elixirCost').value, 10);
    
    // Estructura que espera el endpoint POST/PUT del servidor
    const cardData = {
        name: name,
        elixirCost: elixirCost,
    };
    
    const method = isEditing ? 'PUT' : 'POST';
    const docId = idInput.value; // El ID solo se usa en PUT
    const url = isEditing ? `${API_URL}/${docId}` : API_URL;

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            // El servidor espera { data: { name: '...', elixirCost: ... } }
            body: JSON.stringify({ data: cardData })
        });
        
        if (!response.ok) {
            throw new Error(`Fallo en la operación. Estado: ${response.status}`);
        }

        console.log(`Carta ${isEditing ? 'actualizada' : 'creada'} con éxito.`);
        
        resetForm();
        fetchCards();
    } catch (error) {
        console.error('Error al guardar o actualizar la carta:', error);
        alert(`Error: ${error.message}. Revisa la consola.`);
    }
});

// ===================================================================
// 4. READ ONE (Cargar para edición)
// ===================================================================

async function loadCardForEdit(cardId) {
    try {
        // Llama al endpoint GET /datos/:id para obtener la carta
        const response = await fetch(`${API_URL}/${cardId}`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const card = await response.json();
        
        // Carga los datos en el formulario
        document.getElementById('name').value = card.data.name;
        document.getElementById('elixirCost').value = card.data.elixirCost;
        
        // Establece el modo edición
        idInput.value = cardId;
        isEditing = true;
        submitBtn.textContent = 'Actualizar Carta';
        window.scrollTo(0, 0); // Lleva al formulario
        
    } catch (error) {
        console.error('Error al cargar la carta para edición:', error);
        alert(`Fallo al cargar: ${error.message}`);
    }
}

// ===================================================================
// 5. DELETE (Borrar)
// ===================================================================

async function deleteCard(cardId) {
    if (!confirm(`¿Estás seguro de que deseas eliminar la carta con ID: ${cardId}?`)) {
        return;
    }

    try {
        // Llama al endpoint DELETE /datos/:id
        const response = await fetch(`${API_URL}/${cardId}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
             throw new Error(`Fallo al eliminar. Estado: ${response.status}`);
        }

        console.log(`Carta eliminada: ${cardId}`);
        fetchCards(); // Recarga la lista

    } catch (error) {
        console.error('Error al eliminar la carta:', error);
        alert(`Error al eliminar: ${error.message}`);
    }
}

// ===================================================================
// 6. UTILIDADES
// ===================================================================

function resetForm() { 
    form.reset(); 
    isEditing = false; 
    idInput.value = ''; // Limpiar el ID
    submitBtn.textContent = 'Crear Carta'; 
}

// ===================================================================
// 7. INICIALIZACIÓN
// ===================================================================

document.addEventListener('DOMContentLoaded', fetchCards);