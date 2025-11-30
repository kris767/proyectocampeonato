document.addEventListener('DOMContentLoaded', () => {

    // ⚡️ PASO CLAVE: REEMPLAZA 'REEMPLAZAR_URL_DE_RENDER' con la URL real de tu Web Service (ej: https://micampeonato-api-xxxx.onrender.com/api)
    // Asegúrate de que termine en /api
     const API_BASE_URL = 'https://campeonato-api-t44y.onrender.com/api'; 
    
    // --- API URLs ---
    const API_URL_LOGIN = `${API_BASE_URL}/usuarios/login`;
    const API_URL_REGISTER = `${API_BASE_URL}/usuarios/registrar`;
    const API_URL_POSICIONES = `${API_BASE_URL}/reportes/tabla-posiciones`;
    const API_URL_DASHBOARD_STATS = `${API_BASE_URL}/dashboard/stats`;
    // URL para futuras acciones de generación de reportess
    const API_URL_REPORTES = `${API_BASE_URL}/reportes`; 
    // --- URLs de otras secciones ---
    const API_URL_EQUIPOS = `${API_BASE_URL}/equipos`;
    const API_URL_JUGADORES = `${API_BASE_URL}/jugadores`;
    const API_URL_PARTIDOS = `${API_BASE_URL}/partidos`;
    const API_URL_ARBITROS = `${API_BASE_URL}/arbitros`;
    const API_URL_CANCHAS = `${API_BASE_URL}/canchas`;
    const API_URL_GOLES = `${API_BASE_URL}/goles`; 
    const API_URL_TARJETAS = `${API_BASE_URL}/tarjetas`;



    const currentPage = window.location.pathname.split('/').pop() || '';
    
    // Referencias globales para la navegación dinámica
    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.page-content');
    let teamsCache = []; // Cache para equipos
    let arbitrosCache = []; // Cache para árbitros
    let canchasCache = []; // Cache para canchas
    let partidosCache = []; // Cache para partidos

    // =================================== LÓGICA DE AUTENTICACIÓN ===================================

    const verificarAutenticacion = () => {
        const token = localStorage.getItem('token'); 
        const paginasPublicas = ['login.html', 'registro.html', '']; 

        if (!token && !paginasPublicas.includes(currentPage)) {
            window.location.href = 'login.html';
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    };

    const handleLoginFormSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const nombre_usuario = form.username.value; 
        const contrasena = form.password.value; 
        const errorContainer = document.getElementById('message-area'); 

        try {
            const response = await fetch(API_URL_LOGIN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre_usuario, contrasena })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Credenciales inválidas.');
            
            localStorage.setItem('token', data.token); 
            window.location.href = 'dashboard.html'; 
        } catch (error) {
            errorContainer.textContent = error.message;
            errorContainer.style.display = 'block';
        }
    };
    
    const handleRegisterFormSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const nombre_usuario = form.nombre_usuario.value;
        const contrasena = form.contrasena.value;
        const confirmar_contrasena = form.confirmar_contrasena.value;
        const errorContainer = document.getElementById('error-message');
        const errorText = document.getElementById('error-text');
        const registroBtn = document.getElementById('registro-btn');

        errorContainer.classList.add('hidden');
        registroBtn.disabled = true;

        if (contrasena !== confirmar_contrasena) {
            errorText.textContent = 'Las contraseñas no coinciden.';
            errorContainer.classList.remove('hidden');
            registroBtn.disabled = false;
            return;
        }

        try {
            const response = await fetch(API_URL_REGISTER, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre_usuario, contrasena })
            });

            if (response.ok) {
                alert('Felicidades, Registro exitoso. Por favor, inicia sesión.');
                window.location.href = 'dashboard.html';
            } else {
                const errorData = await response.json();
                errorText.textContent = errorData.message || 'Error desconocido al registrar.';
                errorContainer.classList.remove('hidden');
            }
        } catch (error) {
            errorText.textContent = 'Error de conexión con el servidor. Asegúrate de que el backend esté corriendo en http://localhost:3000.';
            errorContainer.classList.remove('hidden');
        } finally {
            registroBtn.disabled = false;
        }
    };

    // =================================== HELPERS Y FETCH CON AUTH ===================================
    
    const fetchWithAuth = async (url, options = {}) => {
        const token = localStorage.getItem('token'); 
        if (!options.headers) { options.headers = {}; }
        options.headers['Authorization'] = `Bearer ${token}`;
        
        // Establecer Content-Type para solicitudes con body (POST/PUT)
        if (options.method && options.method !== 'GET' && options.method !== 'HEAD' && options.method !== 'DELETE') {
             options.headers['Content-Type'] = 'application/json';
        }
        
        const response = await fetch(url, options);
        
        if (response.status === 401 || response.status === 403) { 
            handleLogout();
            throw new Error('Sesión inválida o expirada.');
        }
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ 
                message: `Error ${response.status}: Error de servidor` 
            }));
            throw new Error(errorData.message);
        }
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            return response.json();
        }
        // Manejar respuestas sin contenido (e.g., 204 No Content)
        return;
    };
    
    // FUNCIÓN DE DASHBOARD
    const cargarDashboardStats = async () => {
        try {
            const data = await fetchWithAuth(API_URL_DASHBOARD_STATS, { headers: {} }); 
            
            document.getElementById('stat-equipos').textContent = data.equipos;
            document.getElementById('stat-jugadores').textContent = data.jugadores;
            document.getElementById('stat-partidos').textContent = data.partidos; 
            
        } catch (error) {
            console.error('Error al cargar estadísticas del dashboard:', error.message);
            const fallback = 'N/A'; 
            document.getElementById('stat-equipos').textContent = fallback;
            document.getElementById('stat-jugadores').textContent = fallback;
            document.getElementById('stat-partidos').textContent = fallback;
        }
    };
    

// =================================== FUNCIÓN ESTILIZADA: TOP GOLEADORES (AZUL CELESTE) ===================================
    const cargarTopGoleadores = async () => {
        const contenedor = document.getElementById('top-goleadores-placeholder');
        contenedor.classList.add('flex', 'items-center', 'justify-center');
        contenedor.innerHTML = 'Cargando datos de goles...';

        try {
            const goles = await fetchWithAuth(API_URL_GOLES, { headers: {} });
            
            // 🚨 VALIDACIÓN CLAVE: Aseguramos que goles es un array antes de usar forEach
            if (!Array.isArray(goles)) {
                 throw new Error("La API devolvió un formato de datos inesperado.");
            }
            
            // 1. Acumular goles por jugador y equipo
            const conteo = {};
            goles.forEach(gol => {
                // El backend proporciona 'nombre_goleador' y 'equipo_goleador'
                const clave = `${gol.nombre_goleador}||${gol.equipo_goleador}`;
                
                // Aseguramos que la propiedad 'equipo' se inicialice
                if (!conteo[clave]) conteo[clave] = { 
                    nombre: gol.nombre_goleador, 
                    // Usamos la clave 'equipo_goleador' del Back-end
                    equipo: gol.equipo_goleador, 
                    goles: 0 
                };
                conteo[clave].goles++;
            });
            
            // 2. Ordenar y armar ranking
            const topArr = Object.values(conteo)
                .sort((a, b) => b.goles - a.goles)
                .slice(0, 5);
            
            if (topArr.length > 0) {
                contenedor.classList.remove('flex', 'items-center', 'justify-center');
            } else {
                contenedor.innerHTML = '<p class="text-gray-500 py-6">No hay goles registrados para el ranking.</p>';
                return;
            }

            // 3. Renderizar con estilos de Tailwind
            let html = `
                <div class="overflow-x-auto">
                    <table class="min-w-full text-left table-auto border-separate border-spacing-0">
                        <thead>
                            <tr class="bg-sky-100 border-b border-sky-300 rounded-t-xl overflow-hidden">
                                <th class="px-3 py-2 text-sm font-semibold text-sky-700 rounded-tl-lg">#</th>
                                <th class="px-3 py-2 text-sm font-semibold text-sky-700">Jugador</th>
                                <th class="px-3 py-2 text-sm font-semibold text-sky-700">Equipo</th>
                                <th class="px-3 py-2 text-sm font-semibold text-sky-700 text-center rounded-tr-lg">Goles</th>
                            </tr>
                        </thead>
                        <tbody>`;
            topArr.forEach((g, idx) => {
                html += `
                            <tr class="border-b border-sky-200 hover:bg-sky-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-sky-50'}">
                                <td class="px-3 py-2 text-sm font-bold text-gray-700">${idx+1}</td>
                                <td class="px-3 py-2 text-sm text-gray-800">${g.nombre}</td>
                                <td class="px-3 py-2 text-sm text-gray-600">
                                    <span class="font-medium text-blue-600">${g.equipo || 'Sin Equipo'}</span> 
                                </td>
                                <td class="px-3 py-2 text-sm font-extrabold text-sky-700 text-center">${g.goles}</td>
                            </tr>`;
            });
            html += `
                        </tbody>
                    </table>
                </div>`;
            contenedor.innerHTML = html;
        } catch (e) {
            // El error es capturado aquí y mostrado en el dashboard
            console.error('Error al cargar top goleadores:', e);
            contenedor.innerHTML = `<p class="text-red-500 py-6">Error al cargar máximos goleadores: ${e.message}</p>`;
        }
    };

// =================================== FUNCIÓN ESTILIZADA: TABLA DE POSICIONES (TURQUESA) ===================================

async function cargarTablaPosiciones() {
    const tablaHead = document.querySelector('#tabla-posiciones thead');
    const tablaBody = document.getElementById('cuerpo-tabla-posiciones');
    
    // Encabezado de la tabla con estilos mejorados (Turquesa)
    tablaHead.innerHTML = `
        <tr class="bg-cyan-100 text-xs sm:text-sm text-teal-800 uppercase tracking-wider border-b border-teal-300">
            <th class="px-2 py-2 text-center">#</th>
            <th class="px-3 py-2 text-left">Equipo</th>
            <th class="px-1 py-2 text-center hidden sm:table-cell">PJ</th>
            <th class="px-1 py-2 text-center">G</th>
            <th class="px-1 py-2 text-center">E</th>
            <th class="px-1 py-2 text-center">P</th>
            <th class="px-1 py-2 text-center">GF</th>
            <th class="px-1 py-2 text-center hidden sm:table-cell">GC</th>
            <th class="px-2 py-2 text-center font-extrabold">Pts</th>
        </tr>
    `;

    tablaBody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-gray-500">Cargando tabla de posiciones...</td></tr>`;

    try {
        const posiciones = await fetchWithAuth(API_URL_POSICIONES, { headers: {} });

        if (posiciones.length === 0) {
            tablaBody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-gray-500">No hay equipos registrados.</td></tr>`;
            return;
        }
        
        let rank = 1;

        tablaBody.innerHTML = posiciones.map((fila, i) => {
            const rowClass = i % 2 === 0 ? 'bg-white' : 'bg-cyan-50'; 
            const isTop = rank <= 4 ? 'border-l-4 border-teal-500' : 'border-l-4 border-transparent'; 
            
            const equipoNombre = fila.nombre || 'Equipo Desconocido';

            const htmlRow = `
                <tr class="${rowClass} border-b border-gray-200 hover:bg-teal-50 transition duration-150 ${isTop}">
                    <td class="text-center text-sm font-bold text-gray-700 py-2">${rank++}</td>
                    <td class="px-3 py-2 text-sm font-semibold text-gray-900">${equipoNombre}</td>
                    <td class="px-1 py-2 text-center text-sm hidden sm:table-cell">${fila.partidos_jugados ?? 0}</td>
                    <td class="px-1 py-2 text-center text-sm text-green-600">${fila.ganados ?? 0}</td>
                    <td class="px-1 py-2 text-center text-sm text-yellow-600">${fila.empatados ?? 0}</td>
                    <td class="px-1 py-2 text-center text-sm text-red-600">${fila.perdidos ?? 0}</td>
                    <td class="px-1 py-2 text-center text-sm">${fila.goles_favor ?? 0}</td>
                    <td class="px-1 py-2 text-center text-sm hidden sm:table-cell">${fila.goles_contra ?? 0}</td>
                    <td class="px-2 py-2 text-center text-sm font-extrabold text-teal-600">${fila.puntos ?? 0}</td>
                </tr>
            `;
            return htmlRow;
        }).join('');
        
        tablaBody.innerHTML = tablaBody.innerHTML; 
    } catch (err) {
        console.error("Error detallado al cargar posiciones:", err);
        tablaBody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-red-600">Error al cargar la tabla de posiciones.</td></tr>`;
    }
}


// =================================== LÓGICA DE REPORTES (FILTROS Y GENERACIÓN) ===================================

const poblarSelector = (selectId, data, idField, nameField) => {
    const select = document.getElementById(selectId);
    if (!select) return;

    // Guardar la opción actual (Todos los Equipos) si existe
    const defaultOption = select.querySelector('option[value=""]') || new Option("Todos los Equipos", "");
    select.innerHTML = '';
    select.appendChild(defaultOption);

    if (data.length === 0) {
        return;
    }

    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item[idField];
        option.textContent = item[nameField];
        select.appendChild(option);
    });
};

const cargarReportesPage = async () => {
    const reportesContent = document.getElementById('page-reportes'); 
    if (!reportesContent) return;

    // 1. Cargar cache de equipos si está vacía
    if (teamsCache.length === 0) {
        await cargarTablaEquipos(); 
    }
    
    // 2. Poblar el selector de equipos en la sección de reportes
    poblarSelector('filtro-equipo', teamsCache, 'id_equipo', 'nombre');

    // 3. Renderizar el área de resultados como placeholder
    const contenedorReporteDatos = document.getElementById('contenedor-reporte-datos');
    if (contenedorReporteDatos) {
        contenedorReporteDatos.innerHTML = `
             <p class="text-center text-gray-500 py-4">Selecciona las opciones y haz clic en "Generar CSV" para ver o descargar los datos.</p>
        `;
    }
};

// FUNCIÓN DE GENERACIÓN DE REPORTE (Añadida al window para que pueda ser llamada desde el HTML con onclick)
window.generarReporte = (tipo, formato) => {
    // 1. Obtener el token de autenticación
    const token = localStorage.getItem('token');
    
    if (!token) {
        alert("Error: No se encontró el token de sesión. Por favor, inicie sesión.");
        return;
    }
    
    // 2. Obtener el filtro de equipo (Opcional)
    const filtroEquipoSelect = document.getElementById('filtro-equipo');
    const id_equipo = filtroEquipoSelect ? filtroEquipoSelect.value : '';
    
    // 3. Construir la URL con el token y el filtro de equipo
    let url = `${API_URL_REPORTES}/generar/${tipo}?formato=${formato}&token=${token}`;
    
    // 4. Abrir la URL en una nueva pestaña para forzar la descarga
    window.open(url, '_blank');
};


// =================================== LÓGICA DE GESTIÓN DE EQUIPOS (CRUD) ===================================

const renderizarEquipos = (equipos) => {
    const tbody = document.getElementById('cuerpo-tabla-equipos');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!Array.isArray(equipos) || equipos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">No hay equipos registrados.</td></tr>';
        return;
    }

    const htmlContent = equipos.map((equipo, i) => {
        const rowClass = i % 2 === 0 ? 'bg-white' : 'bg-gray-50';
        return `
            <tr class="border-b border-gray-200 hover:bg-gray-100 ${rowClass}">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${equipo.id_equipo}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold">${equipo.nombre}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${equipo.ciudad}</td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <button onclick="handleEditarEquipo(${equipo.id_equipo}, '${equipo.nombre}', '${equipo.ciudad}')" 
                            class="text-yellow-600 hover:text-yellow-900 mr-2 transition duration-150">Editar</button>
                    <button onclick="handleEliminarEquipo(${equipo.id_equipo}, '${equipo.nombre}')" 
                            class="text-red-600 hover:text-red-900 transition duration-150">Eliminar</button>
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = htmlContent;
};

const cargarTablaEquipos = async () => {
    const tbody = document.getElementById('cuerpo-tabla-equipos');
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Cargando equipos...</td></tr>';
    
    try {
        const data = await fetchWithAuth(API_URL_EQUIPOS, { headers: {} }); 
        teamsCache = data; 
        renderizarEquipos(data);
        cargarDashboardStats(); 
        return data;
    } catch (error) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-red-500">Error al cargar el listado: ${error.message}</td></tr>`;
        console.error('Error al cargar equipos:', error);
        return [];
    }
};

const handleCrearEquipo = async (e) => {
    e.preventDefault();
    const form = e.target;
    const nombre = form.querySelector('#nombre-equipo').value;
    const ciudad = form.querySelector('#ciudad-equipo').value;
    
    try {
        await fetchWithAuth(API_URL_EQUIPOS, {
            method: 'POST',
            body: JSON.stringify({ nombre, ciudad })
        });
        alert(`Equipo "${nombre}" creado con éxito.`);
        form.reset();
        cargarTablaEquipos(); 
    } catch (error) {
        alert(`Error al crear equipo: ${error.message}`); 
    }
};

window.handleEliminarEquipo = async (id, nombre) => {
    if (!confirm(`¿Está seguro de eliminar el equipo "${nombre}" (ID: ${id})? Esta acción es irreversible si hay dependencias.`)) {
        return;
    }

    try {
        await fetchWithAuth(`${API_URL_EQUIPOS}/${id}`, { method: 'DELETE' });
        alert(`Equipo "${nombre}" eliminado correctamente.`);
        cargarTablaEquipos(); 
        cargarTablaJugadores(); 
    } catch (error) {
        alert(`Error al eliminar equipo: ${error.message}`); 
    }
};

/**
 * NUEVA FUNCIÓN: Muestra el modal de edición y precarga los datos.
 */
window.handleEditarEquipo = (id, nombre, ciudad) => {
    const modal = document.getElementById('modal-editar-equipo');
    const form = document.getElementById('formulario-editar-equipo');

    if (!modal || !form) {
         alert("Error: El modal de edición no está definido en el HTML.");
         return;
    }
    
    // 1. Pre-cargar el formulario del modal
    document.getElementById('edit-id-equipo').value = id;
    document.getElementById('edit-nombre-equipo').value = nombre;
    document.getElementById('edit-ciudad-equipo').value = ciudad;
    
    // 2. Mostrar el modal
    modal.classList.remove('hidden'); 
    modal.classList.add('flex'); // Asume que quieres usar 'flex' para centrar el modal

    // 3. Asignar el evento de submit. 
    // Se usa 'window.handleSubmitEditarEquipo' porque ya lo añadiste al scope global
    form.removeEventListener('submit', window.handleSubmitEditarEquipo); 
    form.addEventListener('submit', window.handleSubmitEditarEquipo);
};

/**
 * NUEVA FUNCIÓN: Maneja el envío del formulario de edición (PUT/PATCH).
 */
window.handleSubmitEditarEquipo = async (e) => {
    e.preventDefault();
    const form = e.target;
    
    const id = form.querySelector('#edit-id-equipo').value;
    const nombre = form.querySelector('#edit-nombre-equipo').value;
    const ciudad = form.querySelector('#edit-ciudad-equipo').value;

    try {
        // Método PUT para actualizar el recurso completo
        await fetchWithAuth(`${API_URL_EQUIPOS}/${id}`, {
            method: 'PUT', 
            body: JSON.stringify({ nombre, ciudad })
        });
        
        // Cierra el modal y actualiza la tabla
        window.cerrarModalEditarEquipo();
        alert(`Equipo "${nombre}" actualizado con éxito.`);
        cargarTablaEquipos(); 
        
    } catch (error) {
        alert(`Error al actualizar equipo: ${error.message}`);
    }
};

/**
 * Función auxiliar para cerrar el modal de edición.
 */
window.cerrarModalEditarEquipo = () => {
    const modal = document.getElementById('modal-editar-equipo');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};


// Renderiza la tabla de árbitros
const renderizarArbitros = (arbitros) => {
    const tbody = document.getElementById('cuerpo-tabla-arbitros');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!Array.isArray(arbitros) || arbitros.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">No hay árbitros registrados.</td></tr>';
    }
    
    const htmlContent = arbitros.map((arbitro, i) => {
        const rowClass = i % 2 === 0 ? 'bg-white' : 'bg-gray-50';
        return `
            <tr class="border-b border-gray-200 hover:bg-gray-100 ${rowClass}">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${arbitro.id_arbitro}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold">${arbitro.nombre_completo}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">${arbitro.funcion}</td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <button onclick="handleEditarArbitro(${arbitro.id_arbitro}, '${arbitro.nombre_completo}')"
                         class="text-yellow-600 hover:text-yellow-900 mr-2 transition duration-150">Editar</button>

                    <button onclick="handleEliminarArbitro(${arbitro.id_arbitro}, '${arbitro.nombre_completo}')"
                        class="text-red-600 hover:text-red-900 transition duration-150">Eliminar</button>
                </td>
            </tr>
        `;
    }).join('');
    
    if (arbitros.length > 0) {
        tbody.innerHTML = htmlContent;
    }
};

// Cargar la tabla de árbitros desde la API
const cargarTablaArbitros = async () => {
    const tbody = document.getElementById('cuerpo-tabla-arbitros');
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Cargando árbitros...</td></tr>';
    try {
        const data = await fetchWithAuth(API_URL_ARBITROS, { headers: {} });
        arbitrosCache = data; 
        renderizarArbitros(data);
    } catch (error) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-red-500">Error al cargar árbitros: ${error.message}</td></tr>`;
        console.error('Error al cargar árbitros:', error);
    }
};

// Registrar nuevo árbitro
const handleCrearArbitro = async (e) => {
    e.preventDefault();
    const form = e.target;
    const nombre_completo = form.querySelector('#nombre-arbitro').value;
    const funcion = form.querySelector('#funcion-arbitro').value;
    if (!nombre_completo || !funcion) {
        alert('Completa todos los campos');
        return;
    }
    try {
        await fetchWithAuth(API_URL_ARBITROS, {
            method: 'POST',
            body: JSON.stringify({ nombre_completo, funcion })
        });
        alert(`Árbitro registrado con éxito.`);
        form.reset();
        cargarTablaArbitros();
    } catch (error) {
        alert(`Error al registrar árbitro: ${error.message}`);
    }
};

// Eliminar árbitro
window.handleEliminarArbitro = async (id, nombre) => {
    if (!confirm(`¿Está seguro de eliminar al árbitro "${nombre}" (ID: ${id})?`)) return;
    try {
        await fetchWithAuth(`${API_URL_ARBITROS}/${id}`, { method: 'DELETE' });
        alert('Árbitro eliminado correctamente.');
        cargarTablaArbitros();
    } catch (error) {
        alert(`Error al eliminar árbitro: ${error.message}`);
    }
};

// Sustitución de la alerta por una función de Edición Pendiente para Arbitros (si usas mi sugerencia, este es el código base a actualizar)
window.handleEditarArbitro = (id, nombre) => {
    alert(`Funcionalidad de Edición Pendiente para el árbitro: ${nombre} (ID: ${id})`);
};


// =================================== LÓGICA DE GESTIÓN DE JUGADORES (CRUD) ===================================

const poblarSelectorEquiposJugador = () => {
    const select = document.getElementById('select-equipo-jugador');
    if (!select) return;

    select.innerHTML = '<option value="">Selecciona un Equipo</option>';
    if (teamsCache.length === 0) {
        select.innerHTML = '<option value="">No hay equipos disponibles</option>';
        return;
    }

    teamsCache.forEach(team => {
        const option = document.createElement('option');
        const teamId = team.id_equipo;
        option.value = teamId;
        option.textContent = team.nombre;
        select.appendChild(option);
    });
};

const renderizarJugadores = (jugadores) => {
    const tbody = document.getElementById('cuerpo-tabla-jugadores');
    const totalSpan = document.getElementById('total-jugadores-lista');
    if (!tbody || !totalSpan) return;

    tbody.innerHTML = '';
    totalSpan.textContent = jugadores.length;
    
    if (jugadores.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No hay jugadores registrados.</td></tr>';
        return;
    }
    
    const htmlContent = jugadores.map((jugador, i) => {
        const teamName = jugador.nombre_equipo || 'Sin Equipo';
        const fechaFormateada = jugador.fecha_nacimiento ? jugador.fecha_nacimiento.split('T')[0] : 'N/A';
        const rowClass = i % 2 === 0 ? 'bg-white' : 'bg-gray-50';
        
        return `
            <tr class="border-b border-gray-200 hover:bg-gray-100 ${rowClass}">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${jugador.id_jugador}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold">${jugador.nombre_completo}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${teamName}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${jugador.posicion}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${fechaFormateada}</td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <button onclick="handleEditarJugador(${jugador.id_jugador})" 
                            class="text-yellow-600 hover:text-yellow-900 mr-2 transition duration-150">Editar</button>
                    <button onclick="handleEliminarJugador(${jugador.id_jugador}, '${jugador.nombre_completo}')" 
                            class="text-red-600 hover:text-red-900 transition duration-150">Eliminar</button>
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = htmlContent;
};

const cargarTablaJugadores = async () => {
    const tbody = document.getElementById('cuerpo-tabla-jugadores');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Cargando jugadores...</td></tr>';
    
    try {
        const data = await fetchWithAuth(API_URL_JUGADORES, { headers: {} }); 
        renderizarJugadores(data);
        cargarDashboardStats(); 
    } catch (error) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-red-500">Error al cargar el listado de jugadores: ${error.message}</td></tr>`;
        console.error('Error al cargar jugadores:', error);
    }
};
    
const handleCrearJugador = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {
        nombre_completo: form.querySelector('#nombre-completo-jugador').value,
        posicion: form.querySelector('#posicion-jugador').value,
        fecha_nacimiento: form.querySelector('#fecha-nacimiento-jugador').value,
        id_equipo: parseInt(form.querySelector('#select-equipo-jugador').value) 
    };
    
    try {
        await fetchWithAuth(API_URL_JUGADORES, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        alert(`Jugador "${data.nombre_completo}" registrado con éxito.`);
        form.reset();
        cargarTablaJugadores(); 
    } catch (error) {
         alert(`Error al registrar jugador: ${error.message}`);
    }
};
    
window.handleEliminarJugador = async (id, nombre) => {
    if (!confirm(`¿Está seguro de eliminar al jugador "${nombre}" (ID: ${id})?`)) {
        return;
    }

    try {
        await fetchWithAuth(`${API_URL_JUGADORES}/${id}`, { method: 'DELETE' });
        alert(`Jugador "${nombre}" eliminado correctamente.`);
        cargarTablaJugadores(); 
    } catch (error) {
        alert(`Error al eliminar jugador: ${error.message}`);
    }
};

window.handleEditarJugador = (id) => {
    alert(`Funcionalidad de Edición de Jugador (ID: ${id}) Pendiente. Debe implementarse un modal similar al de Equipos.`);
};

// ====== TARJETAS: cargar partidos, jugadores, registrar/eliminar y renderizar =====

const poblarSelectPartidosTarjeta = async () => {
    const select = document.getElementById('select-partido-tarjeta');
    if (!select) return;
    select.innerHTML = '<option value="">Cargando partidos...</option>';
    try {
        if (!partidosCache || partidosCache.length === 0) {
            partidosCache = await fetchWithAuth(API_URL_PARTIDOS, { headers: {} });
        }
        if (!Array.isArray(partidosCache) || partidosCache.length === 0) {
            select.innerHTML = '<option value="">No hay partidos disponibles</option>';
            return;
        }
        select.innerHTML = '<option value="">Selecciona un Partido</option>';
        partidosCache.forEach((partido) => {
            const option = document.createElement('option');
            option.value = partido.id_partido;
            option.textContent = `${partido.nombre_equipo_local} vs ${partido.nombre_equipo_visitante} - ${new Date(partido.fecha).toLocaleDateString()}`;
            select.appendChild(option);
        });
    } catch (error) {
        select.innerHTML = `<option value="">Error al cargar partidos</option>`;
        console.error('Error al cargar partidos para tarjetas:', error);
    }
};

const poblarSelectJugadoresTarjeta = async (id_partido) => {
    const select = document.getElementById('select-jugador-tarjeta');
    if (!select) return;
    select.innerHTML = '<option value="">Cargando jugadores...</option>';
    if (!id_partido) {
        select.innerHTML = '<option value="">Primero elige un Partido</option>';
        return;
    }
    try {
        const API_URL_JUGADORES_POR_PARTIDO = `${API_URL_PARTIDOS}/${id_partido}/jugadores`;
        const jugadores = await fetchWithAuth(API_URL_JUGADORES_POR_PARTIDO, { headers: {} });
        if (!Array.isArray(jugadores) || jugadores.length === 0) {
            select.innerHTML = '<option value="">No hay jugadores disponibles</option>';
            return;
        }
        select.innerHTML = '<option value="">Selecciona Jugador</option>';
        jugadores.forEach((jugador) => {
            const option = document.createElement('option');
            option.value = jugador.id_jugador;
            option.textContent = `${jugador.nombre_completo} (${jugador.nombre_equipo})`;
            select.appendChild(option);
        });
    } catch (error) {
        select.innerHTML = `<option value="">Error al cargar jugadores</option>`;
        console.error('Error al cargar jugadores de partido para tarjetas:', error);
    }
};

const renderizarTarjetas = (tarjetas) => {
    const tbody = document.getElementById('cuerpo-tabla-tarjetas');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!Array.isArray(tarjetas) || tarjetas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4">No hay tarjetas registradas.</td></tr>';
        return;
    }
    
    const htmlContent = tarjetas.map((tarjeta, i) => {
        const rowClass = i % 2 === 0 ? 'bg-white' : 'bg-gray-50';
        const tipoClass = tarjeta.tipo_tarjeta === 'Roja' ? 'font-bold text-red-600' : 'font-medium text-yellow-600';
        
        return `
            <tr class="border-b border-gray-200 hover:bg-gray-100 ${rowClass}">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${tarjeta.id_tarjeta}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">${tarjeta.nombre_partido || tarjeta.id_partido}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">${tarjeta.nombre_jugador || tarjeta.id_jugador}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${tarjeta.nombre_equipo || ''}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm ${tipoClass}">${tarjeta.tipo_tarjeta}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${tarjeta.minuto}</td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <button onclick="handleEliminarTarjeta(${tarjeta.id_tarjeta})"
                        class="text-red-600 hover:text-red-900">Eliminar</button>
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = htmlContent;
};

// Cargar histórico de tarjetas
const cargarHistoricoTarjetas = async () => {
    const tbody = document.getElementById('cuerpo-tabla-tarjetas');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4">Cargando histórico de tarjetas...</td></tr>';
    try {
        const tarjetas = await fetchWithAuth(API_URL_TARJETAS, { headers: {} }); 
        renderizarTarjetas(tarjetas);
    } catch (error) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-red-500">Error: ${error.message}</td></tr>`;
        console.error('Error historial tarjetas:', error);
    }
};

// Registrar nueva tarjeta (submit)
const handleCrearTarjeta = async (e) => {
    e.preventDefault();
    const form = e.target;
    const id_partido = form.querySelector('#select-partido-tarjeta').value;
    const id_jugador = form.querySelector('#select-jugador-tarjeta').value;
    const tipo_tarjeta = form.querySelector('#select-tipo-tarjeta').value; 
    const minuto = form.querySelector('#minuto-tarjeta').value;
    if (!id_partido || !id_jugador || !tipo_tarjeta || !minuto) {
        alert('Completa todos los campos.');
        return;
    }
    try {
        await fetchWithAuth(API_URL_TARJETAS, { 
            method: 'POST',
            body: JSON.stringify({
                id_partido: parseInt(id_partido),
                id_jugador: parseInt(id_jugador),
                tipo_tarjeta,
                minuto: parseInt(minuto)
            })
        });
        alert('Tarjeta registrada con éxito.');
        form.reset();
        cargarHistoricoTarjetas();
    } catch (error) {
        alert(`Error al registrar tarjeta: ${error.message}`);
    }
};

// Eliminar tarjeta
window.handleEliminarTarjeta = async (id) => {
    if (!confirm('¿Está seguro de eliminar esta tarjeta?')) return;
    try {
        await fetchWithAuth(`${API_URL_TARJETAS}/${id}`, { method: 'DELETE' });
        alert('Tarjeta eliminada.');
        cargarHistoricoTarjetas();
    } catch (error) {
        alert(`Error al eliminar tarjeta: ${error.message}`);
    }
};

// =================================== LÓGICA DE GESTIÓN DE PARTIDOS (CRUD) ===================================

const cargarCacheArbitros = async () => {
    try {
        arbitrosCache = await fetchWithAuth(API_URL_ARBITROS, { headers: {} });
        return arbitrosCache;
    } catch (error) {
        console.error('Error al cargar árbitros:', error);
        return [];
    }
};

const cargarCacheCanchas = async () => {
    try {
        canchasCache = await fetchWithAuth(API_URL_CANCHAS, { headers: {} });
        return canchasCache;
    } catch (error) {
        console.error('Error al cargar canchas:', error);
        return [];
    }
};

const cargarCachePartidos = async () => {
    try {
        partidosCache = await fetchWithAuth(API_URL_PARTIDOS, { headers: {} });
        return partidosCache;
    } catch (error) {
        console.error('Error al cargar cache de partidos:', error);
        return [];
    }
}

const poblarSelectorGenerico = (selectId, data, idField, nameField) => {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = `<option value="">Selecciona ${nameField}...</option>`;
    if (data.length === 0) {
        select.innerHTML = `<option value="" disabled>No hay ${nameField} disponibles</option>`;
        return;
    }

    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item[idField];
        option.textContent = item[nameField];
        select.appendChild(option);
    });
};

const cargarSelectoresPartidos = async () => {
    if (teamsCache.length === 0) await cargarTablaEquipos(); 
    
    await Promise.all([cargarCacheArbitros(), cargarCacheCanchas()]);
    
    poblarSelectorGenerico('select-equipo-local', teamsCache, 'id_equipo', 'nombre');
    poblarSelectorGenerico('select-equipo-visitante', teamsCache, 'id_equipo', 'nombre');
    poblarSelectorGenerico('select-arbitro-partido', arbitrosCache, 'id_arbitro', 'nombre_completo'); 
    poblarSelectorGenerico('select-cancha-partido', canchasCache, 'id_cancha', 'nombre');
};

const renderizarPartidos = (partidos) => {
    const tbody = document.getElementById('cuerpo-tabla-partidos');
    const totalSpan = document.getElementById('total-partidos-lista');
    if (!tbody || !totalSpan) return;

    tbody.innerHTML = '';
    totalSpan.textContent = partidos.length;
    
    if (partidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No hay partidos registrados.</td></tr>';
        return;
    }
    
    const htmlContent = partidos.map((partido, i) => {
        const fechaHora = new Date(partido.fecha).toLocaleDateString('es-ES', { 
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
        const rowClass = i % 2 === 0 ? 'bg-white' : 'bg-gray-50';
        
        return `
            <tr class="border-b border-gray-200 hover:bg-gray-100 ${rowClass}">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${partido.id_partido}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold">${partido.nombre_equipo_local} vs ${partido.nombre_equipo_visitante}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${partido.goles_local || 0} - ${partido.goles_visitante || 0}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${fechaHora}</td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <button onclick="handleEditarPartido(${partido.id_partido})" 
                            class="text-yellow-600 hover:text-yellow-900 mr-2 transition duration-150">Editar</button>
                    <button onclick="handleEliminarPartido(${partido.id_partido})" 
                            class="text-red-600 hover:text-red-900 transition duration-150">Eliminar</button>
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = htmlContent;
};

const cargarTablaPartidos = async () => {
    const tbody = document.getElementById('cuerpo-tabla-partidos');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Cargando partidos...</td></tr>';
    
    try {
        const data = await cargarCachePartidos(); 
        renderizarPartidos(data);
        cargarDashboardStats(); 
    } catch (error) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-500">Error al cargar el listado de partidos: ${error.message}</td></tr>`;
        console.error('Error al cargar partidos:', error);
    }
};

const handleCrearPartido = async (e) => {
    e.preventDefault();
    const form = e.target;
    
    const fechaHoraValue = form.querySelector('#fecha-hora-partido').value;

    const data = {
        id_equipo_local: parseInt(form.querySelector('#select-equipo-local').value),
        id_equipo_visitante: parseInt(form.querySelector('#select-equipo-visitante').value),
        id_arbitro: parseInt(form.querySelector('#select-arbitro-partido').value),
        id_cancha: parseInt(form.querySelector('#select-cancha-partido').value),
        fecha: fechaHoraValue.split('T')[0], 
        hora: fechaHoraValue.split('T')[1],
    };

    if (data.id_equipo_local === data.id_equipo_visitante) {
        alert('Error: Los equipos local y visitante no pueden ser el mismo.');
        return;
    }
    
    try {
        await fetchWithAuth(API_URL_PARTIDOS, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        alert('Partido programado con éxito.');
        form.reset();
        cargarTablaPartidos(); 
    } catch (error) {
         alert(`Error al programar partido: ${error.message}`);
    }
};
    
window.handleEliminarPartido = async (id) => {
    if (!confirm(`¿Está seguro de eliminar el Partido con ID: ${id}? Esta acción es irreversible.`)) {
        return;
    }

    try {
        await fetchWithAuth(`${API_URL_PARTIDOS}/${id}`, { method: 'DELETE' });
        alert('Partido eliminado correctamente.');
        cargarTablaPartidos(); 
    } catch (error) {
        alert(`Error al eliminar partido: ${error.message}`);
    }
};

window.handleEditarPartido = (id) => {
    alert(`Funcionalidad de Edición/Gestión de Partido (ID: ${id}) Pendiente. Debe implementarse un modal.`);
};

// =================================== LÓGICA DE GESTIÓN DE GOLES ===================================
    
// Función para renderizar el histórico de goles
const cargarHistoricoGoles = async () => {
    const tbody = document.getElementById('cuerpo-tabla-goles');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Cargando goles...</td></tr>';

    try {
        const goles = await fetchWithAuth(API_URL_GOLES, { headers: {} });
        
        tbody.innerHTML = '';
        if (goles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No hay goles registrados.</td></tr>';
            return;
        }
        
        const htmlContent = goles.map((gol, i) => {
            const partidoStr = `${gol.nombre_equipo_local} vs ${gol.nombre_equipo_visitante}`; 
            const asistenciaStr = gol.nombre_asistencia ? `Asist. de ${gol.nombre_asistencia}` : 'Ninguna';
            const rowClass = i % 2 === 0 ? 'bg-white' : 'bg-gray-50';
            
            return `
                <tr class="border-b border-gray-200 hover:bg-gray-100 ${rowClass}">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${gol.id_gol}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${partidoStr}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">${gol.nombre_goleador}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${gol.minuto}'</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${asistenciaStr}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <button onclick="handleEliminarGol(${gol.id_gol})" 
                            class="text-red-600 hover:text-red-900 transition duration-150">Eliminar</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        tbody.innerHTML = htmlContent;

    } catch (error) {
        console.error('Error al cargar el histórico de goles:', error);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-red-500">Error: ${error.message}</td></tr>`;
    }
};
    
// Función manejadora del evento change del select de Partido (añadida para consistencia)
const handlePartidoChange = (e) => {
    const selectedId = e.target.value;
    if(selectedId) {
        cargarJugadoresPorPartido(selectedId);
    } else {
        limpiarSelectsGoleadorAsistencia();
    }
};


const cargarSelectPartidoParaGoles = async () => {
    const selectPartido = document.getElementById('select-partido-gol'); 
    
    if (!selectPartido) {
        console.warn("Elemento select-partido-gol no encontrado. Ignorando carga.");
        return; 
    }
    
    selectPartido.innerHTML = '<option value="" selected disabled>Cargando Partidos...</option>';
    
    try {
        if (partidosCache.length === 0) await cargarCachePartidos(); 
        
        selectPartido.innerHTML = '<option value="" selected disabled>Selecciona un Partido</option>';
        
        if (partidosCache.length === 0) {
            selectPartido.innerHTML = '<option value="" disabled>No hay partidos disponibles</option>';
            return;
        }

        partidosCache.forEach(partido => {
            const option = document.createElement('option');
            option.value = partido.id_partido; 
            option.textContent = `${partido.nombre_equipo_local} vs ${partido.nombre_equipo_visitante} - ${new Date(partido.fecha).toLocaleDateString()}`;
            selectPartido.appendChild(option);
        });
        
        selectPartido.removeEventListener('change', handlePartidoChange); 
        selectPartido.addEventListener('change', handlePartidoChange);

    } catch (error) {
        console.error('Error al cargar partidos para el registro de goles:', error);
        selectPartido.innerHTML = '<option value="" disabled>Error al cargar partidos</option>';
    }
};
    
// Función de ayuda para limpiar los selects
const limpiarSelectsGoleadorAsistencia = () => {
    const selectGoleador = document.getElementById('select-goleador'); 
    const selectAsistencia = document.getElementById('select-asistencia');
    if (selectGoleador) selectGoleador.innerHTML = '<option value="" selected disabled>Selecciona Jugador</option>';
    if (selectAsistencia) selectAsistencia.innerHTML = '<option value="" selected>Ninguno (Opcional)</option>';
};

// Función para cargar jugadores basándose en el partido seleccionado
const cargarJugadoresPorPartido = async (id_partido) => {
    const selectGoleador = document.getElementById('select-goleador'); 
    const selectAsistencia = document.getElementById('select-asistencia'); 

    if (!selectGoleador || !selectAsistencia) return;
    
    selectGoleador.innerHTML = '<option value="" selected disabled>Cargando jugadores...</option>';
    selectAsistencia.innerHTML = '<option value="" selected>Ninguno (Opcional)</option>';

    if (!id_partido) return limpiarSelectsGoleadorAsistencia();

    try {
        const API_URL_JUGADORES_POR_PARTIDO = `${API_URL_PARTIDOS}/${id_partido}/jugadores`;
        const jugadores = await fetchWithAuth(API_URL_JUGADORES_POR_PARTIDO, { headers: {} }); 

        selectGoleador.innerHTML = '<option value="" selected disabled>Selecciona Jugador</option>';
        selectAsistencia.innerHTML = '<option value="" selected>Ninguno (Opcional)</option>';
        
        if (jugadores.length === 0) {
             selectGoleador.innerHTML = '<option value="" disabled>No hay jugadores en el partido</option>';
             return;
        }
        
        jugadores.forEach(jugador => {
            const optionGoleador = document.createElement('option');
            optionGoleador.value = jugador.id_jugador;
            optionGoleador.textContent = `${jugador.nombre_completo} (${jugador.nombre_equipo})`;
            selectGoleador.appendChild(optionGoleador);

            const optionAsistencia = optionGoleador.cloneNode(true);
            selectAsistencia.appendChild(optionAsistencia);
        });

    } catch (error) {
        console.error('Error al cargar jugadores por partido:', error);
        selectGoleador.innerHTML = `<option value="" disabled>Error: ${error.message}</option>`;
        selectAsistencia.innerHTML = '<option value="" selected>Ninguno (Error de carga)</option>';
    }
};
    
const handleRegistrarGol = async (e) => {
    e.preventDefault();
    const form = e.target;

    const id_partido = form.querySelector('#select-partido-gol').value;
    const id_goleador = form.querySelector('#select-goleador').value;
    const minuto = form.querySelector('#minuto-gol').value; 
    const id_asistencia = form.querySelector('#select-asistencia').value;

    const data = {
        id_partido: parseInt(id_partido),
        id_goleador: parseInt(id_goleador),
        minuto: parseInt(minuto),
        id_asistencia: id_asistencia ? parseInt(id_asistencia) : null 
    };

    if (!data.id_partido || !data.id_goleador || isNaN(data.minuto)) {
        alert('Por favor, completa los campos requeridos: Partido, Goleador y Minuto.');
        return;
    }

    try {
        await fetchWithAuth(API_URL_GOLES, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        alert('¡Gol registrado con éxito!');
        form.reset();
        limpiarSelectsGoleadorAsistencia(); 
        cargarHistoricoGoles(); 
        cargarDashboardStats(); 
        cargarTopGoleadores(); 
        cargarTablaPosiciones(); 
    } catch (error) {
        alert(`Error al registrar gol: ${error.message}`);
    }
};

window.handleEliminarGol = async (id) => {
    if (!confirm(`¿Está seguro de eliminar el Gol con ID: ${id}? Esta acción es irreversible y afectará el marcador.`)) return;
    try {
        await fetchWithAuth(`${API_URL_GOLES}/${id}`, { method: 'DELETE' });
        alert('Gol eliminado correctamente.');
        cargarHistoricoGoles(); 
        cargarDashboardStats(); 
        cargarTopGoleadores(); 
        cargarTablaPosiciones(); 
    } catch (error) {
        alert(`Error al eliminar el gol: ${error.message}`);
    }
};


// =================================== LÓGICA DE GESTIÓN DE CANCHAS (CRUD) ===================================
    
const renderizarCanchas = (canchas) => {
    const tbody = document.getElementById('cuerpo-tabla-canchas');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!Array.isArray(canchas) || canchas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">No hay canchas registradas.</td></tr>';
        return;
    }
    
    const htmlContent = canchas.map((cancha, i) => {
        const rowClass = i % 2 === 0 ? 'bg-white' : 'bg-gray-50';
        return `
            <tr class="border-b border-gray-200 hover:bg-gray-100 ${rowClass}">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${cancha.id_cancha}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold">${cancha.nombre}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${cancha.ubicacion}</td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <button onclick="handleEditarCancha(${cancha.id_cancha}, '${cancha.nombre}')" 
                            class="text-yellow-600 hover:text-yellow-900 mr-2 transition duration-150">Editar</button>
                    <button onclick="handleEliminarCancha(${cancha.id_cancha}, '${cancha.nombre}')" 
                            class="text-red-600 hover:text-red-900 transition duration-150">Eliminar</button>
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = htmlContent;
};

const cargarTablaCanchas = async () => {
    const tbody = document.getElementById('cuerpo-tabla-canchas');
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Cargando canchas...</td></tr>';
    
    try {
        const data = await fetchWithAuth(API_URL_CANCHAS, { headers: {} });
        canchasCache = data; 
        renderizarCanchas(data);
        cargarDashboardStats(); 
    } catch (error) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-red-500">Error al cargar el listado: ${error.message}</td></tr>`;
        console.error('Error al cargar canchas:', error);
    }
};


const handleCrearCancha = async (e) => {
    e.preventDefault();
    const form = e.target;
    const nombre = form.querySelector('#nombre-cancha').value;
    const ubicacion = form.querySelector('#ubicacion-cancha').value;
    
    try {
        await fetchWithAuth(API_URL_CANCHAS, {
            method: 'POST',
            body: JSON.stringify({ nombre, ubicacion })
        });
        alert(`Cancha "${nombre}" registrada con éxito.`);
        form.reset();
        cargarTablaCanchas(); 
    } catch (error) {
        alert(`Error al registrar cancha: ${error.message}`); 
    }
};

window.handleEditarCancha = (id, nombre) => {
    alert(`Funcionalidad de Edición Pendiente para la cancha: ${nombre}. Debe implementarse un modal.`);
};
    
window.handleEliminarCancha = async (id, nombre) => {
    if (!confirm(`¿Está seguro de eliminar la cancha "${nombre}" (ID: ${id})?`)) {
        return;
    }

    try {
        await fetchWithAuth(`${API_URL_CANCHAS}/${id}`, { method: 'DELETE' });
        alert(`Cancha "${nombre}" eliminada correctamente.`);
        cargarTablaCanchas(); 
    } catch (error) {
        alert(`Error al eliminar cancha: ${error.message}`); 
    }
};
    
// =================================== LÓGICA DE NAVEGACIÓN DINÁMICA (SPA) ===================================

const showPage = (pageName) => {
    contentSections.forEach(section => {
        section.classList.add('hidden');
        section.classList.remove('block');
    });

    const selectedSection = document.getElementById(`page-${pageName}`);
    if (selectedSection) {
        selectedSection.classList.remove('hidden');
        selectedSection.classList.add('block');
        // Aquí podrías actualizar un título dinámico, si lo tienes
        // document.getElementById('page-title').textContent = pageName.charAt(0).toUpperCase() + pageName.slice(1);
    }
    
    navItems.forEach(item => item.classList.remove('active'));
    const navItem = document.querySelector(`[data-page="${pageName}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }

    // Llamar a la lógica de carga de datos específica
    if (pageName === 'dashboard') {
        cargarDashboardStats(); 
        cargarTablaPosiciones(); 
        cargarTopGoleadores();
    } else if (pageName === 'equipos') {
        cargarTablaEquipos(); 
    } else if (pageName === 'jugadores') {
        cargarTablaEquipos().then(() => {
            poblarSelectorEquiposJugador();
            cargarTablaJugadores(); 
        });
    } else if (pageName === 'partidos') {
        cargarSelectoresPartidos().then(() => {
            cargarTablaPartidos();
        }); 
    } else if (pageName === 'canchas') {
        cargarTablaCanchas();
    } else if (pageName === 'goles') { 
        cargarSelectPartidoParaGoles().then(limpiarSelectsGoleadorAsistencia); 
        cargarHistoricoGoles(); 
    }

    else if (pageName === 'tarjetas') {
        poblarSelectPartidosTarjeta();
        cargarHistoricoTarjetas();
        const selectPartidoTarjeta = document.getElementById('select-partido-tarjeta');
        if (selectPartidoTarjeta) {
            selectPartidoTarjeta.addEventListener('change', (e) => {
                poblarSelectJugadoresTarjeta(e.target.value);
            });
        }
    }
    
    else if (pageName === 'reportes') {
        cargarReportesPage(); 
    }


    else if (pageName === 'arbitros') {
    cargarTablaArbitros();
    }

};

// =================================== INICIALIZACIÓN ===================================
const initPage = () => {
    verificarAutenticacion();
    
    if (currentPage === 'login.html') {
        document.getElementById('login-form')?.addEventListener('submit', handleLoginFormSubmit);
        document.getElementById('message-area').style.display = 'none';
        return;
    }

    if (currentPage === 'registro.html') {
        document.getElementById('registro-form')?.addEventListener('submit', handleRegisterFormSubmit);
        document.getElementById('error-message').classList.add('hidden'); 
        return;
    }

    // --- Lógica de Dashboard y Menú (Páginas Protegidas) ---
    if (currentPage === 'dashboard.html') {
         // Asignar Event Listeners al Menú lateral
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const pageName = item.dataset.page;
                showPage(pageName);
            });
        });
        
        // Enlazar formularios CRUD
        const formEquipo = document.getElementById('formulario-equipo');
        if (formEquipo) formEquipo.addEventListener('submit', handleCrearEquipo);
        
        const formJugador = document.getElementById('formulario-jugador');
        if (formJugador) formJugador.addEventListener('submit', handleCrearJugador);

        const formPartido = document.getElementById('formulario-partido');
        if (formPartido) formPartido.addEventListener('submit', handleCrearPartido);

        const formCancha = document.getElementById('formulario-cancha');
        if (formCancha) formCancha.addEventListener('submit', handleCrearCancha);
        
        const formGol = document.getElementById('formulario-gol');
        if (formGol) {
            formGol.addEventListener('submit', handleRegistrarGol);
        }

        const formArbitro = document.getElementById('formulario-arbitro');
        if (formArbitro) formArbitro.addEventListener('submit', handleCrearArbitro);

        const formTarjeta = document.getElementById('formulario-tarjeta');
        if (formTarjeta) formTarjeta.addEventListener('submit', handleCrearTarjeta);

        // Enlazar la lógica de generación del reporte (Descarga CSV y Simulación PDF)
        const btnGenerarCSV = document.getElementById('btn-generar-reporte-csv');
        const btnExportarPDF = document.getElementById('btn-exportar-pdf-simulado');
        const tipoReporteSelect = document.getElementById('tipo-reporte');

        if (btnGenerarCSV) {
            btnGenerarCSV.addEventListener('click', () => {
                const tipo = tipoReporteSelect.value;
                window.generarReporte(tipo, 'CSV');
            });
        }
        
        if (btnExportarPDF) {
            btnExportarPDF.addEventListener('click', () => {
                const tipo = tipoReporteSelect.value;
                alert(`Simulación de descarga de ${tipo.toUpperCase()} en PDF. La funcionalidad real debe implementarse en el servidor.`);
            });
        }

        // Cargar la página inicial (Dashboard)
        showPage('dashboard');

        // Asignar el evento al botón de cierre del modal de edición de equipo (si tienes un botón con ese ID)
        document.getElementById('cerrar-modal-editar-equipo')?.addEventListener('click', window.cerrarModalEditarEquipo);
    }


    
    // Asignar evento de logout
    document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
    
};
    
initPage();
});
