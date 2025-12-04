// app.js (MODIFICADO)

const API_URL = '/datos';
const form = document.getElementById('carta-crud-form');
const cardListDiv = document.getElementById('card-list');
const submitBtn = document.getElementById('submit-btn');
const idInput = document.getElementById('_id'); 

let isEditing = false; 

// URL de fallback en caso de error de imagen
const FALLBACK_IMAGE_URL = 'https://via.placeholder.com/50?text=N/A';

// Función auxiliar para renderizar una imagen
function renderImage(url, altText) {
    if (!url || url.includes('placeholder.com?text=N/A')) return '';
    return `<img src="${url}" alt="${altText}" class="card-image" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE_URL.replace('N/A', 'Err')}'">`;
}

// ===================================================================
// 2. READ (LEER - Listar todas las cartas)
// ===================================================================

async function fetchCards() {
    console.log("Intentando obtener cartas de la API...");
    cardListDiv.innerHTML = 'Cargando cartas...';
    
    try {
        const response = await fetch(API_URL);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const rawCards = await response.json(); 
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
    
    const ul = document.createElement('ul');

    cards.forEach(card => {
        const li = document.createElement('li'); 
        li.className = 'card-item';

        const cardData = card.data || {}; 
        const id = card._id; 

        // Datos a mostrar
        const name = cardData.name || 'Desconocido';
        const elixir = cardData.elixirCost || '?';
        const rarity = cardData.rarity || 'N/A';
        const type = cardData.type || 'N/A';
        
        // URLs de la imagen: compatibilidad con datos existentes y nuevos campos
        const normalUrl = cardData.imageUrl || cardData.iconUrls?.medium || FALLBACK_IMAGE_URL;
        const evolutionUrl = cardData.evolutionImageUrl || cardData.iconUrls?.evolutionMedium || '';
        const extraUrl = cardData.extraImageUrl || '';

        // Contenedor de imágenes
        const imagesHtml = `
            <div class="card-images-container">
                ${renderImage(normalUrl, `Imagen Normal de ${name}`)}
                ${renderImage(evolutionUrl, `Imagen Evolución de ${name}`)}
                ${renderImage(extraUrl, `Imagen Héroe de ${name}`)}
            </div>
        `;


        li.innerHTML = `
            <div class="card-info">
                ${imagesHtml}
                <div>
                    <strong>${name}</strong> | Elixir: ${elixir} | Rareza: ${rarity} | Tipo: ${type}
                </div>
            </div>
            <div>
                <button onclick="loadCardForEdit('${id}')">Editar</button>
                <button onclick="deleteCard('${id}')">Borrar</button>
            </div>
        `;
        ul.appendChild(li); 
    });
    
    cardListDiv.appendChild(ul); 
}

// ===================================================================
// 3. CREATE & UPDATE (CREAR y ACTUALIZAR)
// ===================================================================

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const elixirCost = parseInt(document.getElementById('elixirCost').value, 10);
    const rarity = document.getElementById('rarity').value;
    const type = document.getElementById('type').value;
    
    // CAPTURA DE LAS TRES URLS
    const imageUrl = document.getElementById('imageUrl').value;
    const evolutionImageUrl = document.getElementById('evolutionImageUrl').value;
    const extraImageUrl = document.getElementById('extraImageUrl').value;
    
    // Aseguramos que la URL principal es obligatoria
    if (!imageUrl) {
        alert('La URL de la Imagen (Normal) es obligatoria.');
        return;
    }
    
    const cardData = {
        name: name,
        elixirCost: elixirCost,
        rarity: rarity, 
        type: type,     
        imageUrl: imageUrl, 
        evolutionImageUrl: evolutionImageUrl, // Nuevo
        extraImageUrl: extraImageUrl,         // Nuevo
    };
    
    const method = isEditing ? 'PUT' : 'POST';
    const docId = idInput.value; 
    const url = isEditing ? `${API_URL}/${docId}` : API_URL;

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
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
        const response = await fetch(`${API_URL}/${cardId}`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const card = await response.json();
        const cardData = card.data || {};
        
        // Carga los datos en el formulario
        document.getElementById('name').value = cardData.name;
        document.getElementById('elixirCost').value = cardData.elixirCost;
        document.getElementById('rarity').value = cardData.rarity;
        document.getElementById('type').value = cardData.type;
        
        // Carga de las tres URLs (compatibilidad con datos existentes)
        document.getElementById('imageUrl').value = cardData.imageUrl || cardData.iconUrls?.medium || '';
        document.getElementById('evolutionImageUrl').value = cardData.evolutionImageUrl || cardData.iconUrls?.evolutionMedium || '';
        document.getElementById('extraImageUrl').value = cardData.extraImageUrl || '';
        
        // Establece el modo edición
        idInput.value = cardId;
        isEditing = true;
        submitBtn.textContent = 'Actualizar Carta';
        window.scrollTo(0, 0); 
        
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
    idInput.value = ''; 
    submitBtn.textContent = 'Crear Carta'; 
}

// ===================================================================
// 7. INICIALIZACIÓN
// ===================================================================

document.addEventListener('DOMContentLoaded', fetchCards);