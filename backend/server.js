const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Módulo para generar contenido CSV
const { stringify } = require('csv-stringify'); 

const app = express();
const port = process.env.PORT || 3000;

// Es crucial usar una clave secreta fuerte en producción
const JWT_SECRET = 'tu_secreto_super_secreto_y_largo_que_nadie_debe_saber';

// ⚡️ CORRECCIÓN FINAL Y DEFINITIVA: USAR LAS VARIABLES EXPLÍCITAS DE POSTGRES + SSL
const pool = new Pool({
    // Render proporciona PGUSER, PGPASSWORD, PGDATABASE, PGHOST, PGPORT
    // Si estás en Render, estas variables existen.
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
    
    // Configuración SSL requerida para conectarse al PostgreSQL de Render
    ssl: {
        rejectUnauthorized: false
    }
});

// Prueba de conexión
pool.query('SELECT NOW()', (err, res) => {
    if (err) console.error('*** ERROR FATAL DE CONEXIÓN A POSTGRESQL ***', err.stack);
    else console.log('--- CONEXIÓN A BD EXITOSA --- Hora del Servidor: ', res.rows[0].now);
});


// Middlewares
app.use(cors());
app.use(express.json());

// ... (El resto del código del servidor es el mismo)
// ... (Tus rutas y el código final)

// --- MIDDLEWARE DE AUTENTICACIÓN ---
const verificarToken = (req, res, next) => {
    // 1. Primero busca el token en la cabecera Authorization (opción segura)
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1]; 
    // 2. Si no lo encuentra, busca el token en los parámetros de consulta (req.query.token)
    if (!token && req.query.token) {
        token = req.query.token;
    }
    
    if (token == null) return res.status(401).json({ message: 'Acceso denegado. No se proporcionó token.' });
    
    jwt.verify(token, process.env.JWT_SECRET || JWT_SECRET, (err, usuario) => {
        if (err) {
            console.error('Error de verificación de JWT:', err.message); 
            return res.status(403).json({ message: 'Token inválido o expirado.' }); 
        }
        req.usuario = usuario;
        
        // Limpiamos el token de la URL para evitar pasarlo a las funciones siguientes
        if (req.query.token) delete req.query.token;
        next();
    });
};

// =============================== RUTAS PÚBLICAS Y AUTENTICACIÓN (sin cambios) ===============================

app.post('/api/usuarios/registrar', async (req, res) => {
    const { nombre_usuario, contrasena } = req.body;
    if (!nombre_usuario || !contrasena) return res.status(400).json({ message: 'El nombre de usuario y la contraseña son obligatorios.' });
    try {
        const salt = await bcrypt.genSalt(10);
        const contrasenaEncriptada = await bcrypt.hash(contrasena, salt);
        const query = 'INSERT INTO usuarios (nombre_usuario, contrasena, rol) VALUES ($1, $2, $3) RETURNING id_usuario, nombre_usuario, rol';
        const result = await pool.query(query, [nombre_usuario, contrasenaEncriptada, 'usuario']); 
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'El nombre de usuario ya existe.' });
        res.status(500).json({ message: 'Error del servidor al registrar el usuario.', error: err.message });
    }
});

app.post('/api/usuarios/login', async (req, res) => {
    const { nombre_usuario, contrasena } = req.body;
    if (!nombre_usuario || !contrasena) return res.status(400).json({ message: 'El nombre de usuario y la contraseña son obligatorios.' });
    try {
        const query = 'SELECT * FROM usuarios WHERE nombre_usuario = $1';
        const result = await pool.query(query, [nombre_usuario]);
        if (result.rows.length === 0) return res.status(401).json({ message: 'Credenciales inválidas.' });
        
        const usuario = result.rows[0];
        const esValida = await bcrypt.compare(contrasena, usuario.contrasena);
        
        if (!esValida) return res.status(401).json({ message: 'Credenciales inválidas.' });
        
        const payload = { id_usuario: usuario.id_usuario, rol: usuario.rol };
        const token = jwt.sign(payload, process.env.JWT_SECRET || JWT_SECRET, { expiresIn: '1h' }); 
        
        res.json({ message: 'Inicio de sesión exitoso.', token: token }); 
    } catch (err) {
        res.status(500).json({ message: 'Error del servidor al iniciar sesión.', error: err.message });
    }
});

// =============================== RUTA DASHBOARD PROTEGIDA (sin cambios) ===============================
app.get('/api/dashboard/stats', verificarToken, async (req, res) => {
    try {
        const [jugadores, equipos, partidos] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM jugador'),
            pool.query('SELECT COUNT(*) FROM equipo'),
            pool.query('SELECT COUNT(*) FROM partido'),
        ]);

        res.json({
            jugadores: parseInt(jugadores.rows[0].count),
            equipos: parseInt(equipos.rows[0].count),
            partidos: parseInt(partidos.rows[0].count),
        });
    } catch (err) {
        console.error('Error al obtener estadísticas del dashboard:', err.message);
        res.status(500).json({ message: 'Error del servidor al obtener estadísticas', error: err.message });
    }
});

// =============================== RUTAS DE EQUIPOS (CRUD) (sin cambios) ===============================

app.get('/api/equipos', verificarToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM equipo ORDER BY nombre');
        res.json(result.rows);
    } catch (err) {
        console.error('Error del servidor al obtener equipos:', err.message);
        res.status(500).json({ message: 'Error del servidor al obtener equipos', error: err.message });
    }
});

app.post('/api/equipos', verificarToken, async (req, res) => {
    const { nombre, ciudad } = req.body;
    if (!nombre || !ciudad) return res.status(400).json({ message: 'El nombre y la ciudad son obligatorios.' });
    try {
        const query = 'INSERT INTO equipo (nombre, ciudad) VALUES ($1, $2) RETURNING id_equipo, nombre, ciudad';
        const result = await pool.query(query, [nombre, ciudad]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'El nombre del equipo ya existe.' });
        res.status(500).json({ message: 'Error del servidor al crear el equipo', error: err.message });
    }
});

/**
 * RUTA AGREGADA: Actualiza un equipo por ID (PUT /api/equipos/:id)
 */
app.put('/api/equipos/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { nombre, ciudad } = req.body;

    if (!nombre || !ciudad) {
        return res.status(400).json({ message: 'El nombre y la ciudad son obligatorios para la actualización.' });
    }
    
    try {
        const query = 'UPDATE equipo SET nombre = $1, ciudad = $2 WHERE id_equipo = $3 RETURNING *';
        const result = await pool.query(query, [nombre, ciudad, id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: `Equipo con ID ${id} no encontrado para actualizar.` });
        }
        res.status(200).json(result.rows[0]); // Devuelve el equipo actualizado
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'El nombre del equipo ya existe.' });
        console.error(`Error al actualizar equipo con ID ${id}:`, err.message);
        res.status(500).json({ message: 'Error de servidor al actualizar el equipo.', error: err.message });
    }
});

app.delete('/api/equipos/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM equipo WHERE id_equipo = $1 RETURNING *', [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: `Equipo con ID ${id} no encontrado.` });
        res.status(204).send();
    } catch (err) {
        if (err.code === '23503') return res.status(409).json({ message: 'No se puede eliminar el equipo. Aún tiene dependencias (jugadores/partidos).' });
        res.status(500).json({ message: 'Error del servidor al intentar eliminar el equipo.', error: err.message });
    }
});

// =============================== RUTAS DE JUGADORES (CRUD) (sin cambios) ===============================

app.get('/api/jugadores', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT j.id_jugador, j.nombre_completo, j.fecha_nacimiento, j.posicion, e.nombre AS nombre_equipo, j.id_equipo
            FROM jugador j
            LEFT JOIN equipo e ON j.id_equipo = e.id_equipo
            ORDER BY j.nombre_completo
        `;
        const result = await pool.query(query);
        res.json(result.rows); 
    } catch (err) {
        console.error('Error FATAL del servidor al obtener jugadores:', err.message);
        res.status(500).json({ message: 'Error del servidor al obtener jugadores. Verifique la estructura de su base de datos.', error: err.message });
    }
});

app.post('/api/jugadores', verificarToken, async (req, res) => {
    const { nombre_completo, fecha_nacimiento, posicion, id_equipo } = req.body;
    if (!nombre_completo || !fecha_nacimiento || !posicion || !id_equipo) {
        return res.status(400).json({ message: 'Todos los campos de jugador son obligatorios.' });
    }
    try {
        const query = 'INSERT INTO jugador (nombre_completo, fecha_nacimiento, posicion, id_equipo) VALUES ($1, $2, $3, $4) RETURNING *';
        const result = await pool.query(query, [nombre_completo, fecha_nacimiento, posicion, id_equipo]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error al crear el jugador:', err.message);
        res.status(400).json({ message: 'Error al crear el jugador. Verifique el ID del equipo.', error: err.message });
    }
});

app.delete('/api/jugadores/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM jugador WHERE id_jugador = $1 RETURNING *', [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: `Jugador con ID ${id} no encontrado.` });
        res.status(204).send();
    } catch (err) {
        console.error(`Error al eliminar jugador con ID ${id}:`, err.message);
        res.status(500).json({ message: 'Error del servidor al eliminar el jugador.', error: err.message });
    }
});

// =============================== RUTAS DE PARTIDOS (CRUD) (sin cambios) ===============================

// Ruta para obtener todos los partidos (usada para la tabla y el select de goles)
app.get('/api/partidos', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                p.id_partido, 
                p.fecha, 
                p.hora, 
                p.goles_local, 
                p.goles_visitante,
                p.id_equipo_local, 
                p.id_equipo_visitante, 
                e_local.nombre AS nombre_equipo_local,
                e_visit.nombre AS nombre_equipo_visitante
            FROM partido p
            JOIN equipo e_local ON p.id_equipo_local = e_local.id_equipo
            JOIN equipo e_visit ON p.id_equipo_visitante = e_visit.id_equipo
            ORDER BY p.fecha DESC, p.hora DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error del servidor al obtener partidos:', err.message);
        res.status(500).json({ message: 'Error del servidor al obtener partidos.', error: err.message });
    }
});

// NUEVA RUTA: Obtener jugadores que participan en un partido específico
app.get('/api/partidos/:id/jugadores', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Obtener los IDs de los equipos del partido
        const partidoResult = await pool.query(
            'SELECT id_equipo_local, id_equipo_visitante FROM partido WHERE id_partido = $1',
            [id]
        );
        
        if (partidoResult.rows.length === 0) {
            return res.status(404).json({ message: `Partido con ID ${id} no encontrado.` });
        }
        
        const { id_equipo_local, id_equipo_visitante } = partidoResult.rows[0];

        // 2. Obtener todos los jugadores de esos dos equipos
        const jugadoresQuery = `
            SELECT 
                j.id_jugador, 
                j.nombre_completo, 
                e.nombre AS nombre_equipo,
                j.id_equipo
            FROM jugador j
            JOIN equipo e ON j.id_equipo = e.id_equipo
            WHERE j.id_equipo IN ($1, $2)
            ORDER BY e.nombre, j.nombre_completo;
        `;
        
        const jugadoresResult = await pool.query(jugadoresQuery, [id_equipo_local, id_equipo_visitante]);

        res.json(jugadoresResult.rows);

    } catch (err) {
        console.error(`Error al obtener jugadores del partido ${id}:`, err.message);
        res.status(500).json({ message: 'Error del servidor al obtener jugadores del partido.', error: err.message });
    }
});


// Ruta para crear un nuevo partido
app.post('/api/partidos', verificarToken, async (req, res) => {
    const { id_equipo_local, id_equipo_visitante, id_arbitro, id_cancha, fecha, hora } = req.body;
    const goles_local = 0;
    const goles_visitante = 0;

    if (!id_equipo_local || !id_equipo_visitante || !id_arbitro || !id_cancha || !fecha || !hora) {
        return res.status(400).json({ message: 'Todos los campos del partido son obligatorios.' });
    }

    try {
        const query = `
            INSERT INTO partido (id_equipo_local, id_equipo_visitante, id_arbitro, id_cancha, fecha, hora, goles_local, goles_visitante) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
        `;
        const result = await pool.query(query, [id_equipo_local, id_equipo_visitante, id_arbitro, id_cancha, fecha, hora, goles_local, goles_visitante]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error al crear el partido:', err.message);
        res.status(400).json({ message: 'Error al crear el partido. Verifique las claves foráneas.', error: err.message });
    }
});

// Ruta para eliminar un partido
app.delete('/api/partidos/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM partido WHERE id_partido = $1 RETURNING *', [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: `Partido con ID ${id} no encontrado.` });
        res.status(204).send();
    } catch (err) {
        if (err.code === '23503') return res.status(409).json({ message: 'No se puede eliminar el partido. Tiene goles o tarjetas asociadas.' });
        console.error(`Error al eliminar partido con ID ${id}:`, err.message);
        res.status(500).json({ message: 'Error del servidor al eliminar el partido.', error: err.message });
    }
});

// =============================== RUTAS DE GOLES (CRUD) (sin cambios) ===============================

app.get('/api/goles', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                g.id_gol, 
                g.minuto, 
                g.id_partido,
                j_gol.nombre_completo AS nombre_goleador,
                j_asistencia.nombre_completo AS nombre_asistencia,
                p.nombre_equipo_local,
                p.nombre_equipo_visitante
            FROM gol g
            JOIN jugador j_gol ON g.id_jugador = j_gol.id_jugador
            LEFT JOIN jugador j_asistencia ON g.id_asistencia = j_asistencia.id_jugador
            JOIN (
                SELECT id_partido, id_equipo_local, id_equipo_visitante, e1.nombre AS nombre_equipo_local, e2.nombre AS nombre_equipo_visitante
                FROM partido 
                JOIN equipo e1 ON id_equipo_local = e1.id_equipo
                JOIN equipo e2 ON id_equipo_visitante = e2.id_equipo
            ) p ON g.id_partido = p.id_partido
            ORDER BY g.id_partido, g.minuto ASC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error del servidor al obtener goles:', err.message);
        res.status(500).json({ message: 'Error del servidor al obtener goles.', error: err.message });
    }
});

// RUTA ACTUALIZADA: Registra gol y actualiza marcador del partido
app.post('/api/goles', verificarToken, async (req, res) => {
    const { id_partido, id_goleador, minuto, id_asistencia } = req.body;
    
    // El frontend envía id_goleador, pero la BD usa id_jugador para el goleador
    const id_jugador = id_goleador; 
    
    if (!id_partido || !id_jugador || !minuto) {
        return res.status(400).json({ message: 'El partido, jugador y minuto son obligatorios.' });
    }

    try {
        // Iniciar una transacción para asegurar la consistencia
        await pool.query('BEGIN');

        // 1. Obtener el ID del equipo del jugador que anotó
        const equipoJugadorResult = await pool.query(
            'SELECT id_equipo FROM jugador WHERE id_jugador = $1',
            [id_jugador]
        );

        if (equipoJugadorResult.rows.length === 0) {
             await pool.query('ROLLBACK');
             return res.status(404).json({ message: 'Goleador no encontrado.' });
        }
        const id_equipo_goleador = equipoJugadorResult.rows[0].id_equipo;

        // 2. Obtener el partido para saber qué equipo es local/visitante
        const partidoResult = await pool.query(
            'SELECT id_equipo_local, id_equipo_visitante FROM partido WHERE id_partido = $1',
            [id_partido]
        );
        
        if (partidoResult.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: 'Partido no encontrado.' });
        }
        
        const { id_equipo_local, id_equipo_visitante } = partidoResult.rows[0];
        
        // 3. Determinar si el gol es local o visitante y actualizar el marcador
        let updateQuery;
        if (id_equipo_goleador === id_equipo_local) {
            updateQuery = 'UPDATE partido SET goles_local = goles_local + 1 WHERE id_partido = $1 RETURNING *';
        } else if (id_equipo_goleador === id_equipo_visitante) {
            updateQuery = 'UPDATE partido SET goles_visitante = goles_visitante + 1 WHERE id_partido = $1 RETURNING *';
        } else {
            // Este caso no debería ocurrir si el frontend valida que el jugador es del partido
            await pool.query('ROLLBACK');
            return res.status(400).json({ message: 'El jugador no pertenece a ninguno de los equipos del partido.' });
        }

        await pool.query(updateQuery, [id_partido]);

        // 4. Registrar el gol en la tabla 'gol'
        const golQuery = 'INSERT INTO gol (id_partido, id_jugador, minuto, id_asistencia) VALUES ($1, $2, $3, $4) RETURNING *';
        const result = await pool.query(golQuery, [id_partido, id_jugador, minuto, id_asistencia || null]);
        
        // 5. Confirmar transacción
        await pool.query('COMMIT');
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Error al registrar gol y actualizar marcador:', err.message);
        res.status(500).json({ message: 'Error del servidor al registrar el gol.', error: err.message });
    }
});

app.delete('/api/goles/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM gol WHERE id_gol = $1 RETURNING *', [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: `Gol con ID ${id} no encontrado.` });
        res.status(204).send();
    } catch (err) {
        console.error(`Error al eliminar gol con ID ${id}:`, err.message);
        res.status(500).json({ message: 'Error del servidor al eliminar el gol.', error: err.message });
    }
});

// ===================== RUTAS DE TARJETAS (CRUD) (sin cambios) =====================

// Obtener histórico de tarjetas
app.get('/api/tarjetas', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT t.id_tarjeta, t.id_partido, t.id_jugador, t.tipo_tarjeta, t.minuto,
                p.fecha,
                j.nombre_completo AS nombre_jugador,
                e.nombre AS nombre_equipo,
                CONCAT(e_local.nombre, ' vs ', e_visit.nombre, ' - ', to_char(p.fecha, 'DD/MM/YYYY')) AS nombre_partido
            FROM tarjeta t
            JOIN partido p ON t.id_partido = p.id_partido
            JOIN jugador j ON t.id_jugador = j.id_jugador
            JOIN equipo e ON j.id_equipo = e.id_equipo
            JOIN equipo e_local ON p.id_equipo_local = e_local.id_equipo
            JOIN equipo e_visit ON p.id_equipo_visitante = e_visit.id_equipo
            ORDER BY t.id_tarjeta DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener tarjetas:', err.message);
        res.status(500).json({ message: 'Error del servidor al obtener tarjetas.', error: err.message });
    }
});

// Registrar nueva tarjeta
app.post('/api/tarjetas', verificarToken, async (req, res) => {
    const { id_partido, id_jugador, tipo_tarjeta, minuto } = req.body;
    if (!id_partido || !id_jugador || !tipo_tarjeta || !minuto) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }
    try {
        const query = 'INSERT INTO tarjeta (id_partido, id_jugador, tipo_tarjeta, minuto) VALUES ($1, $2, $3, $4) RETURNING *';
        const result = await pool.query(query, [id_partido, id_jugador, tipo_tarjeta, minuto]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error al registrar tarjeta:', err.message);
        res.status(500).json({ message: 'Error del servidor al registrar la tarjeta.', error: err.message });
    }
});

// Eliminar tarjeta
app.delete('/api/tarjetas/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM tarjeta WHERE id_tarjeta = $1 RETURNING *', [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Tarjeta no encontrada.' });
        res.status(204).send();
    } catch (err) {
        console.error('Error al eliminar tarjeta:', err.message);
        res.status(500).json({ message: 'Error del servidor al eliminar la tarjeta.', error: err.message });
    }
});

// =============================== RUTA DE TABLA DE POSICIONES (sin cambios) ===============================

app.get('/api/reportes/tabla-posiciones', verificarToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT e.nombre,
                COUNT(p.id_partido) AS partidos_jugados,
                SUM(
                  CASE
                    WHEN (p.id_equipo_local = e.id_equipo AND p.goles_local > p.goles_visitante)
                    OR (p.id_equipo_visitante = e.id_equipo AND p.goles_visitante > p.goles_local) THEN 1
                    ELSE 0
                  END
                ) AS ganados,
                SUM(
                  CASE
                    WHEN p.goles_local = p.goles_visitante AND p.id_partido IS NOT NULL THEN 1
                    ELSE 0
                  END
                ) AS empatados,
                SUM(
                  CASE
                    WHEN (p.id_equipo_local = e.id_equipo AND p.goles_local < p.goles_visitante)
                    OR (p.id_equipo_visitante = e.id_equipo AND p.goles_visitante < p.goles_local) THEN 1
                    ELSE 0
                  END
                ) AS perdidos,
                SUM(
                  CASE
                    WHEN p.id_equipo_local = e.id_equipo THEN p.goles_local
                    WHEN p.id_equipo_visitante = e.id_equipo THEN p.goles_visitante
                    ELSE 0
                  END
                ) AS goles_favor,
                SUM(
                  CASE
                    WHEN p.id_equipo_local = e.id_equipo THEN p.goles_visitante
                    WHEN p.id_equipo_visitante = e.id_equipo THEN p.goles_local
                    ELSE 0
                  END
                ) AS goles_contra,
                SUM(
                  CASE
                    WHEN (p.id_equipo_local = e.id_equipo AND p.goles_local > p.goles_visitante)
                    OR (p.id_equipo_visitante = e.id_equipo AND p.goles_visitante > p.goles_local) THEN 3
                    WHEN p.goles_local = p.goles_visitante AND p.id_partido IS NOT NULL THEN 1
                    ELSE 0
                  END
                ) AS puntos
            FROM equipo e
            LEFT JOIN partido p ON e.id_equipo = p.id_equipo_local OR e.id_equipo = p.id_equipo_visitante
            GROUP BY e.id_equipo
            ORDER BY puntos DESC, (SUM(
                    CASE
                      WHEN p.id_equipo_local = e.id_equipo THEN p.goles_local
                      WHEN p.id_equipo_visitante = e.id_equipo THEN p.goles_visitante
                      ELSE 0
                    END
                  ) - SUM(
                    CASE
                      WHEN p.id_equipo_local = e.id_equipo THEN p.goles_visitante
                      WHEN p.id_equipo_visitante = e.id_equipo THEN p.goles_local
                      ELSE 0
                    END
                  )) DESC,
                SUM(
                  CASE
                    WHEN p.id_equipo_local = e.id_equipo THEN p.goles_local
                    WHEN p.id_equipo_visitante = e.id_equipo THEN p.goles_visitante
                    ELSE 0
                  END
                ) DESC;
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('ERROR AL CONSULTAR TABLA DE POSICIONES:', err.message, err.stack);
        res.status(500).json({ message: 'Error al obtener tabla de posiciones', error: err.message });
    }
});


// =============================== RUTAS DE CACHE (ÁRBITROS Y CANCHAS) (sin cambios) ===============================

app.get('/api/arbitros', verificarToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT id_arbitro, nombre_completo, funcion FROM arbitro ORDER BY nombre_completo');
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener árbitros:', err.message);
        res.status(500).json({ message: 'Error del servidor al obtener árbitros.', error: err.message });
    }
});

app.post('/api/arbitros', verificarToken, async (req, res) => {
    const { nombre_completo, funcion } = req.body;
    if (!nombre_completo || !funcion) return res.status(400).json({ message: 'El nombre y la función son obligatorios.' });
    try {
        const query = 'INSERT INTO arbitro (nombre_completo, funcion) VALUES ($1, $2) RETURNING id_arbitro, nombre_completo, funcion';
        const result = await pool.query(query, [nombre_completo, funcion]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error al crear el árbitro:', err.message);
        res.status(400).json({ message: 'Error al crear el árbitro.', error: err.message });
    }
});

app.delete('/api/arbitros/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM arbitro WHERE id_arbitro = $1 RETURNING *', [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: `Árbitro con ID ${id} no encontrado.` });
        res.status(204).send();
    } catch (err) {
        if (err.code === '23503') return res.status(409).json({ message: 'No se puede eliminar el árbitro. Está asignado a partidos.' });
        console.error(`Error al eliminar árbitro con ID ${id}:`, err.message);
        res.status(500).json({ message: 'Error del servidor al eliminar el árbitro.', error: err.message });
    }
});

app.get('/api/canchas', verificarToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT id_cancha, nombre, ubicacion FROM cancha ORDER BY nombre');
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener canchas:', err.message);
        res.status(500).json({ message: 'Error del servidor al obtener canchas.', error: err.message });
    }
});

app.post('/api/canchas', verificarToken, async (req, res) => {
    const { nombre, ubicacion } = req.body;
    if (!nombre || !ubicacion) return res.status(400).json({ message: 'El nombre y la ubicación son obligatorios.' });
    try {
        const query = 'INSERT INTO cancha (nombre, ubicacion) VALUES ($1, $2) RETURNING id_cancha, nombre, ubicacion';
        const result = await pool.query(query, [nombre, ubicacion]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error al crear la cancha:', err.message);
        res.status(400).json({ message: 'Error al crear la cancha.', error: err.message });
    }
});

app.delete('/api/canchas/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM cancha WHERE id_cancha = $1 RETURNING *', [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: `Cancha con ID ${id} no encontrada.` });
        res.status(204).send();
    } catch (err) {
        if (err.code === '23503') return res.status(409).json({ message: 'No se puede eliminar la cancha. Está asignada a partidos.' });
        console.error(`Error al eliminar cancha con ID ${id}:`, err.message);
        res.status(500).json({ message: 'Error del servidor al eliminar la cancha.', error: err.message });
    }
});


// =============================== RUTA DE GENERACIÓN DE REPORTES (sin cambios) ===============================

/**
 * Función para obtener datos de la base de datos según el tipo de reporte.
 * @param {string} tipo - Tipo de reporte ('posiciones', 'goleadores', 'tarjetas', 'historico').
 * @returns {Promise<Array<Object>>} Datos del reporte.
 */
const obtenerDatosReporte = async (tipo) => {
    let query;

    switch (tipo) {
        case 'posiciones':
            query = `
                SELECT e.nombre AS "Equipo",
                    COUNT(p.id_partido) AS partidos_jugados,
                    SUM(CASE WHEN (p.id_equipo_local = e.id_equipo AND p.goles_local > p.goles_visitante) OR (p.id_equipo_visitante = e.id_equipo AND p.goles_visitante > p.goles_local) THEN 1 ELSE 0 END) AS Ganados,
                    SUM(CASE WHEN p.goles_local = p.goles_visitante AND p.id_partido IS NOT NULL THEN 1 ELSE 0 END) AS Empatados,
                    SUM(CASE WHEN (p.id_equipo_local = e.id_equipo AND p.goles_local < p.goles_visitante) OR (p.id_equipo_visitante = e.id_equipo AND p.goles_visitante < p.goles_local) THEN 1 ELSE 0 END) AS Perdidos,
                    SUM(CASE WHEN p.id_equipo_local = e.id_equipo THEN p.goles_local WHEN p.id_equipo_visitante = e.id_equipo THEN p.goles_visitante ELSE 0 END) AS Goles_favor,
                    SUM(CASE WHEN p.id_equipo_local = e.id_equipo THEN p.goles_visitante WHEN p.id_equipo_visitante = e.id_equipo THEN p.goles_local ELSE 0 END) AS Goles_contra,
                    SUM(CASE WHEN (p.id_equipo_local = e.id_equipo AND p.goles_local > p.goles_visitante) OR (p.id_equipo_visitante = e.id_equipo AND p.goles_visitante > p.goles_local) THEN 3 WHEN p.goles_local = p.goles_visitante AND p.id_partido IS NOT NULL THEN 1 ELSE 0 END) AS Puntos
                FROM equipo e
                LEFT JOIN partido p ON e.id_equipo = p.id_equipo_local OR e.id_equipo = p.id_equipo_visitante
                GROUP BY e.id_equipo
                ORDER BY Puntos DESC, (SUM(
                    CASE
                      WHEN p.id_equipo_local = e.id_equipo THEN p.goles_local
                      WHEN p.id_equipo_visitante = e.id_equipo THEN p.goles_visitante
                      ELSE 0
                    END
                  ) - SUM(
                    CASE
                      WHEN p.id_equipo_local = e.id_equipo THEN p.goles_visitante
                      WHEN p.id_equipo_visitante = e.id_equipo THEN p.goles_local
                      ELSE 0
                    END
                  )) DESC,
                SUM(
                  CASE
                    WHEN p.id_equipo_local = e.id_equipo THEN p.goles_local
                    WHEN p.id_equipo_visitante = e.id_equipo THEN p.goles_visitante
                    ELSE 0
                  END
                ) DESC;
            `;
            break;

        case 'goleadores':
            query = `
                SELECT 
                    j.nombre_completo AS Jugador,
                    e.nombre AS Equipo,
                    COUNT(g.id_gol) AS "Goles Totales"
                FROM gol g
                JOIN jugador j ON g.id_jugador = j.id_jugador
                JOIN equipo e ON j.id_equipo = e.id_equipo
                GROUP BY j.id_jugador, e.nombre
                ORDER BY "Goles Totales" DESC;
            `;
            break;

        case 'tarjetas':
            query = `
                SELECT 
                    t.id_tarjeta AS "ID Tarjeta",
                    j.nombre_completo AS Jugador,
                    e.nombre AS Equipo,
                    t.tipo_tarjeta AS Tipo,
                    t.minuto AS Minuto,
                    CONCAT(e_local.nombre, ' vs ', e_visit.nombre) AS Partido,
                    to_char(p.fecha, 'DD-MM-YYYY') AS "Fecha del Partido" 
                FROM tarjeta t
                JOIN partido p ON t.id_partido = p.id_partido
                JOIN jugador j ON t.id_jugador = j.id_jugador
                JOIN equipo e ON j.id_equipo = e.id_equipo
                JOIN equipo e_local ON p.id_equipo_local = e_local.id_equipo
                JOIN equipo e_visit ON p.id_equipo_visitante = e_visit.id_equipo
                ORDER BY p.fecha DESC, t.minuto ASC; 
            `;
            break;

        case 'historico': 
            query = `
                SELECT
                    p.id_partido AS "ID Partido",
                    e_local.nombre AS "Equipo Local",
                    p.goles_local AS "Goles Local",
                    p.goles_visitante AS "Goles Visitante",
                    e_visit.nombre AS "Equipo Visitante",
                    a.nombre_completo AS Árbitro,
                    c.nombre AS Cancha,
                    to_char(p.fecha, 'DD-MM-YYYY') AS Fecha,
                    p.hora AS Hora
                FROM partido p
                JOIN equipo e_local ON p.id_equipo_local = e_local.id_equipo
                JOIN equipo e_visit ON p.id_equipo_visitante = e_visit.id_equipo
                JOIN arbitro a ON p.id_arbitro = a.id_arbitro
                JOIN cancha c ON p.id_cancha = c.id_cancha
                ORDER BY p.fecha DESC, p.hora DESC;
            `;
            break;

        default:
            throw new Error(`Tipo de reporte no soportado: ${tipo}`);
    }

    const result = await pool.query(query);
    return result.rows;
};


/**
 * Genera el stream de CSV a partir de un array de objetos.
 * @param {Array<Object>} data - Datos del reporte (ej: resultados de la query de DB).
 * @returns {Promise<Buffer>} Buffer del archivo CSV.
 */
const generarCsvBuffer = (data) => {
    return new Promise((resolve, reject) => {
        // Obtenemos los nombres de las columnas para usarlos como encabezados
        const columns = Object.keys(data[0] || {}).map(key => ({ key, header: key }));

        stringify(data, { header: true, columns, delimiter: ',' }, (err, output) => {
            if (err) return reject(err);
            // Convertir la salida string a Buffer
            resolve(Buffer.from(output, 'utf8')); 
        });
    });
};


app.get('/api/reportes/generar/:tipo', verificarToken, async (req, res) => {
    const { tipo } = req.params;     
    const { formato } = req.query; 

    if (!formato) {
        return res.status(400).json({ message: 'El formato de reporte (formato=CSV) es obligatorio.' });
    }

    try {
        const datos = await obtenerDatosReporte(tipo);

        if (datos.length === 0) {
            return res.status(404).json({ message: `No se encontraron datos para el reporte de ${tipo}.` });
        }
        
        const nombreBase = `reporte_${tipo}_${new Date().toISOString().split('T')[0]}`;
        
        if (formato.toUpperCase() === 'CSV') {
            const buffer = await generarCsvBuffer(datos);
            
            // Configurar cabeceras para descarga de CSV
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=${nombreBase}.csv`);
            res.send(buffer);
            
        } else if (formato.toUpperCase() === 'PDF') {
            res.status(200).json({ 
                message: `Reporte de ${tipo} en PDF simulado.`,
                nota: 'Implementar la generación de PDF requiere librerías como pdfkit o html-pdf en el servidor.'
            });
            
        } else {
            res.status(400).json({ message: 'Formato de reporte no soportado.' });
        }

    } catch (error) {
        console.error(`Error en la ruta /api/reportes/generar/${tipo}:`, error);
        res.status(500).json({ message: 'Error del servidor al generar el reporte.', error: error.message });
    }
});

// --- SERVIR ARCHIVOS ESTÁTICOS DEL FRONTEND ---
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

// --- RUTA CATCH-ALL (Fallback para rutas no encontradas) ---
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'login.html'));
});


// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});
