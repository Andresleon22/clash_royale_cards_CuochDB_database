// app.js - Versión Final CRUD Completo

const API_URL = '/datos'; // ⬅️ CRÍTICO: RUTA RELATIVA para que funcione en Railway
const form = document.getElementById('carta-crud-form');
const cardListDiv = document.getElementById('card-list');
const submitBtn = document.getElementById('submit-btn');

let isEditing = false; 

// ===================================================================
// 1. UTILIDADES
// ===================================================================

function resetForm() {
    form.reset();
    isEditing = false;
    submitBtn.textContent = 'Crear Carta';
    document.getElementById('_id').value = ''; // Limpia el ID oculto
}

// ===================================================================
// 2. READ (LEER - Listar todas las cartas)
// ===================================================================

async function fetchCards() {
    cardListDiv.innerHTML = 'Cargando cartas...';
    
    try {
        const response = await fetch(API_URL);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const cards = await response.json(); 
        
        renderCardList(cards);
    } catch (error) {
        console.error('Error al conectar con la API de Couchbase:', error);
        cardListDiv.innerHTML = `
            <strong>ERROR DE CONEXIÓN:</strong> 
            Error: ${error.message}. Verifica los logs de Railway.
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

        // Usamos la estructura plana: card.name, card.elixirCost, card._id
        const id = card._id || 'ID Desconocido'; 

        div.innerHTML = `
            <div>
                <strong>${card.name || 'N/A'}</strong> (Elixir: ${card.elixirCost || 'N/A'})
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
// 3. CREATE & UPDATE (Guardar)
// ===================================================================

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const elixirCost = parseInt(document.getElementById('elixirCost').value, 10);
    const cardId = document.getElementById('_id').value;
    
    // El backend espera una estructura plana (sin el objeto 'data' anidado)
    const cardData = { name, elixirCost };
    
    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing ? `${API_URL}/${cardId}` : API_URL;

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

        alert(`Carta ${isEditing ? 'actualizada' : 'creada'} con éxito.`);
        
        resetForm();
        fetchCards(); // Refrescar la lista
    } catch (error) {
        console.error('Error al guardar o actualizar la carta:', error);
        alert(`Error: ${error.message}`);
    }
});


// 4. READ ONE (Cargar para Editar)
async function loadCardForEdit(cardId) {
    try {
        const response = await fetch(`${API_URL}/${cardId}`);
        if (!response.ok) throw new Error('Error al cargar la carta para edición.');
        
        const card = await response.json();
        
        // Cargar los datos en el formulario
        document.getElementById('name').value = card.name;
        document.getElementById('elixirCost').value = card.elixirCost;
        document.getElementById('_id').value = card._id; // Almacena el ID del documento
        
        isEditing = true;
        submitBtn.textContent = 'Actualizar Carta';
        window.scrollTo(0, 0); // Ir al formulario
    } catch (error) {
        console.error('Error al cargar datos de edición:', error);
        alert(`Error: ${error.message}`);
    }
}


// 5. DELETE (Borrar)
async function deleteCard(cardId) { 
    if (!confirm('¿Estás seguro de que quieres eliminar esta carta?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/${cardId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Fallo al eliminar la carta.');
        }

        alert('Carta eliminada con éxito.');
        fetchCards(); // Refrescar la lista
    } catch (error) {
        console.error('Error al eliminar la carta:', error);
        alert(`Error: ${error.message}`);
    }
}


// ===================================================================
// 6. INICIALIZACIÓN
// ===================================================================

document.addEventListener('DOMContentLoaded', fetchCards);