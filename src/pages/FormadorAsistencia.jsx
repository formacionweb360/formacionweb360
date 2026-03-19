// src/components/quality/DotacionTable.jsx
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { logUpdate } from '../../utils/logger';

// ──────────────────────────────────────────────────────────────────────────────
// 📋 LISTA MAESTRA DE CAMPAÑAS (INDEPENDIENTE DE LA BD)
// ✅ Editable: Agrega o quita campañas aquí
// ──────────────────────────────────────────────────────────────────────────────
const CAMPANAS_DISPONIBLES = [
  'Portabilidad',
  'Blindaje',
  'Caribu_phx',
  'Caeq_phx',
  'Caribu',
  'Capl',
  'MT',
  'SBK_TC',
  'Senati',
  'SBK_PLD',
  'Migraciones Tigo'
].sort();

// ──────────────────────────────────────────────────────────────────────────────
// 🔧 HELPER: Formatear fecha desde string YYYY-MM-DD o timestamp a DD/MM/YYYY
// ──────────────────────────────────────────────────────────────────────────────
const formatDate = (dateString) => {
  if (!dateString) return '—';
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  }
  if (dateString.includes('/')) {
    return dateString;
  }
  if (typeof dateString === 'string' && dateString.includes('T')) {
    const fecha = dateString.split('T')[0];
    const [year, month, day] = fecha.split('-');
    return `${day}/${month}/${year}`;
  }
  return dateString;
};

// ──────────────────────────────────────────────────────────────────────────────
// 🔧 HELPER: Calcular antigüedad desde string YYYY-MM-DD (USANDO UTC)
// ──────────────────────────────────────────────────────────────────────────────
const calculateSeniority = (dateString) => {
  if (!dateString) return '—';
  let year, month, day;
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    [year, month, day] = dateString.split('-').map(Number);
  } else if (dateString.includes('/')) {
    [day, month, year] = dateString.split('/').map(Number);
  } else if (dateString.includes('T')) {
    const fecha = dateString.split('T')[0];
    [year, month, day] = fecha.split('-').map(Number);
  } else {
    return 'FECHA INVÁLIDA';
  }
  const ingresoDate = new Date(Date.UTC(year, month - 1, day));
  const today = new Date();
  let years = today.getUTCFullYear() - ingresoDate.getUTCFullYear();
  let months = today.getUTCMonth() - ingresoDate.getUTCMonth();
  if (months < 0) { years--; months += 12; }
  if (years < 0) return 'FECHA FUTURA';
  if (years === 0 && months === 0) return 'MENOS DE 1 MES';
  const yearText = years === 1 ? 'AÑO' : 'AÑOS';
  const monthText = months === 1 ? 'MES' : 'MESES';
  return `${years} ${yearText} ${months} ${monthText}`;
};

// ──────────────────────────────────────────────────────────────────────────────
/** Normalizar strings para búsqueda */
const normalizeStr = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// ──────────────────────────────────────────────────────────────────────────────
/** Collator español */
const esCollator = new Intl.Collator('es', { sensitivity: 'base' });

// ──────────────────────────────────────────────────────────────────────────────
// Orden cliente
// ──────────────────────────────────────────────────────────────────────────────
const sortItemsClient = (items, sortConfig) => {
  if (!sortConfig?.key) return items;
  const { key, direction } = sortConfig;
  const asc = direction === 'asc';
  return [...items].sort((a, b) => {
    const va = a?.[key], vb = b?.[key];
    const dateFields = new Set(['FECHA_ING', 'FECHA_BAJ', 'created_at', 'updated_at']);
    if (dateFields.has(key)) {
      if (typeof va === 'string' && typeof vb === 'string') {
        return asc ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return 0;
    }
    const na = typeof va === 'number' || (!isNaN(Number(va)) && va !== null && va !== '');
    const nb = typeof vb === 'number' || (!isNaN(Number(vb)) && vb !== null && vb !== '');
    if (na && nb) return asc ? Number(va) - Number(vb) : Number(vb) - Number(va);
    const sa = String(va ?? ''), sb = String(vb ?? '');
    const cmp = esCollator.compare(sa, sb);
    return asc ? cmp : -cmp;
  });
};

// ──────────────────────────────────────────────────────────────────────────────
// CAMPOS EDITABLES EN EL MODAL
// ──────────────────────────────────────────────────────────────────────────────
const BULK_FIELDS = [
  { key: 'ESTADO', label: 'Estado', type: 'select', options: ['ACTIVO', 'ACTIVO_R', 'BAJA', 'PENDIENTE'] },
  { key: 'MODALIDAD', label: 'Modalidad', type: 'select', options: ['FULL TIME', 'MINI FULL', 'MINI FULL_40', 'PART TIME'], auto: true },
  { key: 'HORAS', label: 'Horas', type: 'select', options: ['24 HORAS', '36 HORAS', '40 HORAS', '48 HORAS'], auto: true },
  { key: 'INGRESO', label: 'Ingreso', type: 'select', options: ['08:00', '09:00', '10:00', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:30', '16:00'], auto: true },
  { key: 'HORARIO', label: 'Horario', type: 'select', options: ['08:00-12:30','08:00-14:30','08:00-15:30','08:00-17:00','09:00-12:50','09:00-15:30','09:00-16:30','09:00-17:00','09:00-18:00','10:00-16:30','10:00-17:30','11:00-17:30','11:00-18:30','11:00-20:00','11:30-18:00','12:00-18:30','12:00-19:30','12:30-19:00','13:00-19:00','13:30-20:00','14:00-20:00','14:30-21:00','15:30-19:00','16:00-19:50','16:00-20:00'] },
  { key: 'TURNO', label: 'Turno', type: 'select', options: ['TURNO MAÑANA', 'TURNO TARDE'], auto: true },
  { key: 'FECHA_BAJ', label: 'Fecha Baja', type: 'date' },
  { key: 'TIPO_PLANIL', label: 'Tipo Planilla', type: 'select', options: ['PLANILLA', 'RXH'] },
  { key: 'DNI_SUP', label: 'DNI Líder', type: 'leader' },
  { key: 'SUPERVISOR', label: 'Supervisor', type: 'text', placeholder: 'Se autocompleta' },
  { key: 'COORDINADOR', label: 'Coordinador', type: 'select', options: [
    'Alvarez Maza Miguel Angel',
    'Anaya Rojas Sofia Vanessa',
    'Cardenas Acaro Aldo Junior',
    'Fernandez Aguilar Juan Armando',
    'Fernandez Arroyo Andy Williams',
    'Gonzalez Yaro Cesar Eduardo',
    'Pamela Ortega Corrales',
    'Talavera Manrique Angel Eduardo',
    'Vargaz Zapatel Miguel Alexander'
  ]},
  { key: 'CAMPANA', label: 'Campaña', type: 'select-dynamic' },
  { key: 'SUBMOTIVO1', label: 'Submotivo 1', type: 'text' },
  { key: 'SUBMOTIVO2', label: 'Submotivo 2', type: 'text' },
];

// ✨ NUEVO: Campos exclusivos de BAJA
const BAJA_ONLY_FIELDS = new Set(['FECHA_BAJ', 'SUBMOTIVO1', 'SUBMOTIVO2']);

export default function DotacionTable() {
  // ─── ESTADOS ───────────────────────────────────────────────────────────────
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(30);
  const [totalItems, setTotalItems] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: 'NOMBRE', direction: 'asc' });

  // ─── FILTROS DEPENDIENTES ──────────────────────────────────────────────────
  const [campanaFilter, setCampanaFilter] = useState('');
  const [coordinadorFilter, setCoordinadorFilter] = useState('');
  const [supervisorFilter, setSupervisorFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('Todos');

  // ─── OPCIONES PARA FILTROS ─────────────────────────────────────────────────
  // ✅ CAMPAÑAS: Ahora usa la lista fija en lugar de cargar desde BD
  const [distinctCampanas] = useState(CAMPANAS_DISPONIBLES);
  const [distinctCoordinadores, setDistinctCoordinadores] = useState([]);
  const [distinctSupervisores, setDistinctSupervisores] = useState([]);
  const [distinctEstados] = useState(['Todos', 'ACTIVO', 'ACTIVO_R', 'BAJA', 'PENDIENTE']);
  const [filteredCoordinadores, setFilteredCoordinadores] = useState([]);
  const [filteredSupervisores, setFilteredSupervisores] = useState([]);
  const [filteredEstados, setFilteredEstados] = useState(['Todos', 'ACTIVO', 'ACTIVO_R', 'BAJA', 'PENDIENTE']);

  // ─── SELECCIÓN Y MODAL ─────────────────────────────────────────────────────
  const [selectedItems, setSelectedItems] = useState([]);
  const selectAllRef = useRef(null);
  const [estructuraData, setEstructuraData] = useState([]);
  const [loadingEstructura, setLoadingEstructura] = useState(true);
  const [errorEstructura, setErrorEstructura] = useState(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState(() =>
    Object.fromEntries(BULK_FIELDS.map((f) => [f.key, '']))
  );
  const [bulkApply, setBulkApply] = useState(() =>
    Object.fromEntries(BULK_FIELDS.map((f) => [f.key, false]))
  );
  const [isSaving, setIsSaving] = useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // 🔑 ESTADOS para caché de horarios
  // ───────────────────────────────────────────────────────────────────────────
  const [horariosMap, setHorariosMap] = useState({});
  const [loadingHorarios, setLoadingHorarios] = useState(true);

  // ✨ NUEVO: Modo BAJA
  const isBajaMode = (bulkForm.ESTADO || '').toString().trim().toUpperCase() === 'BAJA';

  // ✨ NUEVO: ¿Mostrar campo en el modal?
  const shouldShowField = (key) => {
    if (key === 'ESTADO') return true;
    return isBajaMode ? BAJA_ONLY_FIELDS.has(key) : !BAJA_ONLY_FIELDS.has(key);
  };

  // ✨ NUEVO: Al entrar/salir de BAJA, desmarcar "Aplicar" de campos ocultos
  useEffect(() => {
    setBulkApply(prev => {
      const next = { ...prev };
      BULK_FIELDS.forEach(f => {
        if (!shouldShowField(f.key)) next[f.key] = false;
      });
      return next;
    });
    if (!isBajaMode) {
      setBulkForm(prev => ({ ...prev, FECHA_BAJ: '', SUBMOTIVO1: '', SUBMOTIVO2: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBajaMode]);

  const MAX_ROWS_FOR_CLIENT_SEARCH = 5000;

  // ───────────────────────────────────────────────────────────────────────────
  // 🔑 Cargar tabla horarios al montar
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchHorarios = async () => {
      try {
        const { data, error } = await supabase
          .from('horarios')
          .select('id, horario, ingreso, turno, horas, modalidad');
        if (error) throw error;
        const map = {};
        (data || []).forEach(h => {
          const key = (h.horario || '').toString().trim().normalize('NFC');
          map[key] = {
            ingreso: h.ingreso,
            turno: h.turno,
            horas: h.horas,
            modalidad: h.modalidad
          };
        });
        setHorariosMap(map);
      } catch (err) {
        console.warn('⚠️ No se pudo cargar la tabla horarios.', err);
      } finally {
        setLoadingHorarios(false);
      }
    };
    fetchHorarios();
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // 🔑 HELPER - Auto-completar campos de horario
  // ───────────────────────────────────────────────────────────────────────────
  const autoFillHorarioFields = (horarioValue) => {
    if (!horarioValue) return {};
    const key = (horarioValue || '').toString().trim().normalize('NFC');
    const match = horariosMap[key];
    if (!match) return {};
    return {
      INGRESO: match.ingreso,
      TURNO: match.turno,
      HORAS: match.horas,
      MODALIDAD: match.modalidad
    };
  };

  // ───────────────────────────────────────────────────────────────────────────
  // OBTENER DATOS DE dotacion_movistar
  // ───────────────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      let baseQuery = supabase
        .from('dotacion_movistar')
        .select(
          [
            'id','DNI','NOMBRE','APELLIDO','ESTADO','MODALIDAD','HORAS','INGRESO',
            'HORARIO','TURNO','FECHA_ING','FECHA_BAJ','TIPO_PLANIL',
            'DNI_SUP','SUPERVISOR','COORDINADOR','CELULAR','CORREO',
            'CAMPANA','SUBMOTIVO1','SUBMOTIVO2','PERIODO','created_at','updated_at',
          ].join(','),
          { count: 'exact' }
        );
      if (campanaFilter) baseQuery = baseQuery.eq('CAMPANA', campanaFilter);
      if (coordinadorFilter) baseQuery = baseQuery.eq('COORDINADOR', coordinadorFilter);
      if (supervisorFilter) baseQuery = baseQuery.eq('SUPERVISOR', supervisorFilter);
      if (estadoFilter && estadoFilter !== 'Todos') baseQuery = baseQuery.eq('ESTADO', estadoFilter);
      if (!searchQuery.trim()) {
        const { data: result, error, count } = await baseQuery
          .order(sortConfig.key, { ascending: sortConfig.direction === 'asc' })
          .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);
        if (error) throw error;
        setData(result || []);
        setTotalItems(count || 0);
        return;
      }
      const { data: allResult, error } = await baseQuery
        .order(sortConfig.key, { ascending: sortConfig.direction === 'asc' })
        .limit(MAX_ROWS_FOR_CLIENT_SEARCH);
      if (error) throw error;
      const q = normalizeStr(searchQuery);
      const filtered = (allResult || []).filter((r) => {
        const nom = normalizeStr(r.NOMBRE || '');
        const ape = normalizeStr(r.APELLIDO || '');
        const doc = normalizeStr(r.DNI || '');
        return nom.includes(q) || ape.includes(q) || doc.includes(q);
      });
      const sorted = sortItemsClient(filtered, sortConfig);
      const start = (currentPage - 1) * itemsPerPage;
      setData(sorted.slice(start, start + itemsPerPage));
      setTotalItems(sorted.length);
    } catch (err) {
      console.error('Error al cargar datos:', err);
      setError('No se pudieron cargar los datos de dotación. Verifica tu conexión.');
      setData([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // ✅ OBTENER VALORES ÚNICOS MAESTROS - COORDINADORES Y SUPERVISORES DESDE BD
  // ✅ CAMPAÑAS: Ahora usa lista fija (no necesita query)
  // ───────────────────────────────────────────────────────────────────────────
  const fetchDistinctValues = async () => {
    try {
      // ✅ COORDINADORES - AGREGAR .limit(10000)
      const { data: coordData } = await supabase
        .from('dotacion_movistar')
        .select('COORDINADOR')
        .not('COORDINADOR', 'is', null)
        .order('COORDINADOR')
        .limit(10000);
      
      if (coordData) {
        const unique = [...new Set(coordData.map(x => `${x.COORDINADOR}`.trim()).filter(Boolean))].sort();
        setDistinctCoordinadores(unique);
      }

      // ✅ SUPERVISORES - AGREGAR .limit(10000)
      const { data: supData } = await supabase
        .from('dotacion_movistar')
        .select('SUPERVISOR')
        .not('SUPERVISOR', 'is', null)
        .order('SUPERVISOR')
        .limit(10000);
      
      if (supData) {
        const unique = [...new Set(supData.map(x => `${x.SUPERVISOR}`.trim()).filter(Boolean))].sort();
        setDistinctSupervisores(unique);
      }
    } catch (err) {
      console.error('Error al cargar valores únicos:', err);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 🔑 FILTRAR COORDINADORES POR CAMPAÑA
  // ───────────────────────────────────────────────────────────────────────────
  const fetchCoordinadoresByCampana = async (campana) => {
    if (!campana) {
      setFilteredCoordinadores(distinctCoordinadores);
      return;
    }
    try {
      const { data } = await supabase
        .from('dotacion_movistar')
        .select('COORDINADOR')
        .eq('CAMPANA', campana)
        .not('COORDINADOR', 'is', null)
        .order('COORDINADOR')
        .limit(10000);
      
      if (data) {
        const unique = [...new Set(data.map(x => `${x.COORDINADOR}`.trim()).filter(Boolean))].sort();
        setFilteredCoordinadores(unique);
      }
    } catch (err) {
      console.error('Error filtrando coordinadores:', err);
      setFilteredCoordinadores(distinctCoordinadores);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 🔑 FILTRAR SUPERVISORES POR COORDINADOR + CAMPAÑA
  // ───────────────────────────────────────────────────────────────────────────
  const fetchSupervisoresByCoordinador = async (coordinador, campana) => {
    if (!coordinador) {
      if (campana) {
        try {
          const { data } = await supabase
            .from('dotacion_movistar')
            .select('SUPERVISOR')
            .eq('CAMPANA', campana)
            .not('SUPERVISOR', 'is', null)
            .order('SUPERVISOR')
            .limit(10000);
          
          if (data) {
            const unique = [...new Set(data.map(x => `${x.SUPERVISOR}`.trim()).filter(Boolean))].sort();
            setFilteredSupervisores(unique);
          }
        } catch (err) {
          console.error('Error filtrando supervisores:', err);
          setFilteredSupervisores(distinctSupervisores);
        }
      } else {
        setFilteredSupervisores(distinctSupervisores);
      }
      return;
    }
    try {
      let query = supabase
        .from('dotacion_movistar')
        .select('SUPERVISOR')
        .not('SUPERVISOR', 'is', null);
      if (campana) query = query.eq('CAMPANA', campana);
      query = query.eq('COORDINADOR', coordinador).order('SUPERVISOR').limit(10000);
      const { data } = await query;
      if (data) {
        const unique = [...new Set(data.map(x => `${x.SUPERVISOR}`.trim()).filter(Boolean))].sort();
        setFilteredSupervisores(unique);
      }
    } catch (err) {
      console.error('Error filtrando supervisores:', err);
      setFilteredSupervisores(distinctSupervisores);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 🔑 FILTRAR ESTADOS POR SUPERVISOR + COORDINADOR + CAMPAÑA
  // ───────────────────────────────────────────────────────────────────────────
  const fetchEstadosBySupervisor = async (supervisor, coordinador, campana) => {
    try {
      let query = supabase.from('dotacion_movistar').select('ESTADO');
      if (campana) query = query.eq('CAMPANA', campana);
      if (coordinador) query = query.eq('COORDINADOR', coordinador);
      if (supervisor) query = query.eq('SUPERVISOR', supervisor);
      const { data } = await query.not('ESTADO', 'is', null).limit(10000);
      if (data) {
        const unique = [...new Set(data.map(x => `${x.ESTADO}`.trim()).filter(Boolean))].sort();
        setFilteredEstados(['Todos', ...unique]);
      }
    } catch (err) {
      console.error('Error filtrando estados:', err);
      setFilteredEstados(['Todos', 'ACTIVO', 'ACTIVO_R', 'BAJA', 'PENDIENTE']);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 🔑 CARGAR ESTRUCTURA
  // ───────────────────────────────────────────────────────────────────────────
  const fetchEstructura = async () => {
    try {
      setLoadingEstructura(true);
      setErrorEstructura(null);
      const { data, error } = await supabase
        .from('estructura')
        .select('supervisor, dni, coordinador, jefatura')
        .order('supervisor');
      if (error) throw error;
      setEstructuraData(data || []);
    } catch (err) {
      console.error('Error al cargar estructura:', err);
      setErrorEstructura('No se pudo cargar la tabla estructura. Verifica tu conexión.');
    } finally {
      setLoadingEstructura(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // EFECTOS PARA FILTROS DEPENDIENTES
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchDistinctValues();
    fetchEstructura();
  }, []);

  useEffect(() => {
    setCoordinadorFilter('');
    setSupervisorFilter('');
    setEstadoFilter('Todos');
    setCurrentPage(1);
    fetchCoordinadoresByCampana(campanaFilter);
  }, [campanaFilter]);

  useEffect(() => {
    setSupervisorFilter('');
    setEstadoFilter('Todos');
    setCurrentPage(1);
    fetchSupervisoresByCoordinador(coordinadorFilter, campanaFilter);
  }, [coordinadorFilter, campanaFilter]);

  useEffect(() => {
    setEstadoFilter('Todos');
    setCurrentPage(1);
    fetchEstadosBySupervisor(supervisorFilter, coordinadorFilter, campanaFilter);
  }, [supervisorFilter, coordinadorFilter, campanaFilter]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchQuery, sortConfig, campanaFilter, coordinadorFilter, supervisorFilter, estadoFilter]);

  // ───────────────────────────────────────────────────────────────────────────
  // UTILS: Buscar líder por DNI
  // ───────────────────────────────────────────────────────────────────────────
  const getEstructuraByDni = (dni) =>
    (estructuraData || []).find((e) => (e.dni || '').toString().trim() === (dni || '').toString().trim());

  // ───────────────────────────────────────────────────────────────────────────
  // HANDLERS GENERALES
  // ───────────────────────────────────────────────────────────────────────────
  const handleSearch = (e) => { setSearchQuery(e.target.value); setCurrentPage(1); };
  
  const clearFilters = () => {
    setCampanaFilter('');
    setCoordinadorFilter('');
    setSupervisorFilter('');
    setEstadoFilter('Todos');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  // ───────────────────────────────────────────────────────────────────────────
  // SELECCIÓN DE FILAS
  // ───────────────────────────────────────────────────────────────────────────
  const toggleSelectAll = (checked) => {
    if (checked) { setSelectedItems(data.map(item => item.id)); }
    else { setSelectedItems([]); }
  };

  const handleSelectItem = (id) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // ✅ NUEVO: Limpiar selección
  const clearSelection = () => {
    setSelectedItems([]);
    if (selectAllRef.current) {
      selectAllRef.current.checked = false;
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // MODAL: ABRIR/CERRAR
  // ───────────────────────────────────────────────────────────────────────────
  const openBulkModal = () => {
    if (selectedItems.length === 0) { alert('⚠️ Selecciona al menos 1 registro.'); return; }
    const initialForm = {};
    const initialApply = {};
    BULK_FIELDS.forEach((field) => {
      initialForm[field.key] = '';
      initialApply[field.key] = false;
    });
    setBulkForm(initialForm);
    setBulkApply(initialApply);
    setIsBulkModalOpen(true);
  };

  const closeBulkModal = () => setIsBulkModalOpen(false);
  const setBulkField = (key, value) => setBulkForm(prev => ({ ...prev, [key]: value }));
  const toggleBulkApply = (key, checked) => setBulkApply(prev => ({ ...prev, [key]: checked }));

  // ───────────────────────────────────────────────────────────────────────────
  // 🔑 HANDLER: DNI_SUP → AUTOCOMPLETA (SOLO SUPERVISOR Y COORDINADOR)
  // ───────────────────────────────────────────────────────────────────────────
  const handleBulkLeaderSelect = (dniLeader) => {
    if (!dniLeader) return;
    const estructura = getEstructuraByDni(dniLeader);
    setBulkApply(prev => ({ ...prev, DNI_SUP: true, SUPERVISOR: true }));
    if (estructura) {
      setBulkForm(prev => ({
        ...prev,
        DNI_SUP: estructura.dni,
        SUPERVISOR: estructura.supervisor,
        COORDINADOR: estructura.coordinador,
      }));
    } else {
      setBulkForm(prev => ({ ...prev, DNI_SUP: dniLeader, SUPERVISOR: '', COORDINADOR: '' }));
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 🔑 HANDLER: SUBMOTIVO1
  // ───────────────────────────────────────────────────────────────────────────
  const handleBulkSubmotivo1Change = (tipo) => {
    setBulkField('SUBMOTIVO1', tipo);
    setBulkApply(prev => ({ ...prev, SUBMOTIVO1: true }));
    setBulkField('SUBMOTIVO2', '');
    setBulkApply(prev => ({ ...prev, SUBMOTIVO2: false }));
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 🔑 HANDLER: SUBMOTIVO2
  // ───────────────────────────────────────────────────────────────────────────
  const handleBulkSubmotivo2Change = (motivo) => {
    setBulkField('SUBMOTIVO2', motivo);
    setBulkApply(prev => ({ ...prev, SUBMOTIVO2: true }));
  };

  // ───────────────────────────────────────────────────────────────────────────
  // GUARDAR EDICIÓN MASIVA
  // ───────────────────────────────────────────────────────────────────────────
  const saveBulkModal = async () => {
    try {
      if (selectedItems.length === 0) { alert('No hay registros seleccionados.'); return; }
      const payload = {};
      for (const f of BULK_FIELDS) {
        if (!bulkApply[f.key]) continue;
        let v = bulkForm[f.key];
        if (v === '') v = null;
        payload[f.key] = v;
      }
      if (Object.keys(payload).length === 0) {
        alert('Marca "Aplicar" en al menos un campo para guardar.');
        return;
      }
      setIsSaving(true);
      const { data: currentRecords, error: fetchError } = await supabase
        .from('dotacion_movistar').select('*').in('id', selectedItems);
      if (fetchError) throw fetchError;
      const { error: updateError } = await supabase
        .from('dotacion_movistar').update(payload).in('id', selectedItems);
      if (updateError) throw updateError;
      const diffs = (currentRecords || [])
        .map((rec) => {
          const changes = {};
          for (const k of Object.keys(payload)) {
            const oldValue = rec[k];
            const newValue = payload[k];
            if (oldValue !== newValue) changes[k] = { from: oldValue, to: newValue };
          }
          return { record_id: rec.id?.substring(0, 8), dni: rec.DNI, changes };
        })
        .filter((d) => Object.keys(d.changes).length > 0) || [];
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      if (currentUser.dni) {
        await logUpdate(currentUser.dni, {
          action: 'bulk_update_modal',
          records_updated: selectedItems.length,
          changes: diffs,
          filters_applied: { campana: campanaFilter, coordinador: coordinadorFilter, supervisor: supervisorFilter, estado: estadoFilter },
          applied_fields: Object.keys(payload),
          timestamp: new Date().toISOString(),
        });
      }
      closeBulkModal();
      setSelectedItems([]);
      await fetchData();
      alert(`✅ Cambios aplicados a ${selectedItems.length} registro(s).`);
    } catch (err) {
      console.error('Error en edición masiva (modal):', err);
      alert(`❌ Error al guardar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // COLUMNAS DE LA TABLA
  // ───────────────────────────────────────────────────────────────────────────
  const columns = [
    { key: 'seleccion', label: 'Sel.', sortable: false },
    { key: 'id', label: 'ID', sortable: false },
    { key: 'PERIODO', label: 'Período', sortable: true },
    { key: 'DNI', label: 'DNI', sortable: true },
    { key: 'NOMBRE', label: 'Nombres', sortable: true },
    { key: 'APELLIDO', label: 'Apellidos', sortable: true },
    { key: 'ESTADO', label: 'Estado', sortable: true },
    { key: 'MODALIDAD', label: 'Modalidad', sortable: true },
    { key: 'HORARIO', label: 'Horario', sortable: true },
    { key: 'TURNO', label: 'Turno', sortable: true },
    { key: 'FECHA_ING', label: 'Fecha Ingreso', sortable: true },
    { key: 'FECHA_BAJ', label: 'Fecha Baja', sortable: true },
    { key: 'TIPO_PLANIL', label: 'Tipo Planilla', sortable: true },
    { key: 'DNI_SUP', label: 'DNI Líder', sortable: true },
    { key: 'SUPERVISOR', label: 'Líder', sortable: true },
    { key: 'COORDINADOR', label: 'Coordinador', sortable: true },
    { key: 'CELULAR', label: 'Celular', sortable: true },
    { key: 'CORREO', label: 'Correo', sortable: true },
    { key: 'CAMPANA', label: 'Campaña', sortable: true },
    { key: 'SUBMOTIVO1', label: 'Submotivo 1', sortable: true },
    { key: 'SUBMOTIVO2', label: 'Submotivo 2', sortable: true },
    { key: 'created_at', label: 'Creado En', sortable: true },
    { key: 'updated_at', label: 'Actualizado En', sortable: true },
  ];

  // ───────────────────────────────────────────────────────────────────────────
  // OPCIONES PARA SUBMOTIVO1/SUBMOTIVO2
  // ───────────────────────────────────────────────────────────────────────────
  const MOTIVOS_VOLUNTARIO = [
    'Mejor oferta laboral', 'Ambiente laboral', 'Estudios', 'Viaje', 'Salud',
    'Sobrecarga laboral', 'Motivos personales o familiares', 'Cambio de campaña',
    'Falta de oportunidades de crecimiento', 'Abandono laboral'
  ];
  const MOTIVOS_INVOLUNTARIO = [
    'No superación de prueba', 'Por faltas injustificadas', 'Por exceso de tardanzas',
    'Cierre de campaña', 'Robo o fraude comprobado', 'Violación de normas internas',
    'Reducción de personal', 'Incumplimiento de metas', 'No renovación de contrato',
    'Faltas disciplinarias graves'
  ];

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      {/* ✅ CONTADOR DE SELECCIÓN GLOBAL - NUEVO */}
      {selectedItems.length > 0 && (
        <div className="px-4 py-2 bg-gradient-to-r from-cyan-50 to-teal-50 border-b border-cyan-200 flex items-center justify-between">
          <span className="text-[10px] text-cyan-800 font-medium flex items-center gap-2">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <strong>{selectedItems.length}</strong> registro(s) seleccionado(s) para edición masiva
            <span className="text-cyan-600">(pueden estar en diferentes búsquedas/páginas)</span>
          </span>
          <button
            onClick={clearSelection}
            className="text-[10px] text-cyan-600 hover:text-cyan-800 underline font-medium px-2 py-1 rounded hover:bg-cyan-100 transition"
          >
            Limpiar selección
          </button>
        </div>
      )}

      {/* Header: búsqueda y filtros */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-cyan-50 to-teal-50">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div className="relative w-full md:w-140">
            <input
              type="text"
              placeholder="Buscar por DNI o Nombre"
              value={searchQuery}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all shadow-sm text-sm"
            />
            <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 gap-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="h-4 w-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span>Total: <span className="font-bold text-cyan-700">{totalItems}</span> agentes</span>
            </div>
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-1 w-fit"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* FILTROS */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-medium text-gray-700 mb-1">1. Campaña</label>
            <select
              value={campanaFilter}
              onChange={(e) => setCampanaFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors focus:ring-1 focus:ring-cyan-500"
            >
              <option value="">Todas</option>
              {distinctCampanas.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-700 mb-1">2. Coordinador</label>
            <select
              value={coordinadorFilter}
              onChange={(e) => setCoordinadorFilter(e.target.value)}
              disabled={!campanaFilter}
              className={`px-3 py-1.5 text-xs border rounded-lg text-gray-700 transition-colors focus:ring-1 focus:ring-cyan-500 ${
                !campanaFilter ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed' : 'border-gray-300 bg-white hover:bg-gray-50'
              }`}
            >
              <option value="">Todos</option>
              {filteredCoordinadores.map((coord) => (<option key={coord} value={coord}>{coord}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-700 mb-1">3. Supervisor</label>
            <select
              value={supervisorFilter}
              onChange={(e) => setSupervisorFilter(e.target.value)}
              disabled={!coordinadorFilter}
              className={`px-3 py-1.5 text-xs border rounded-lg text-gray-700 transition-colors focus:ring-1 focus:ring-cyan-500 ${
                !coordinadorFilter ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed' : 'border-gray-300 bg-white hover:bg-gray-50'
              }`}
            >
              <option value="">Todos</option>
              {filteredSupervisores.map((sup) => (<option key={sup} value={sup}>{sup}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-700 mb-1">4. Estado</label>
            <select
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value)}
              disabled={!supervisorFilter}
              className={`px-3 py-1.5 text-xs border rounded-lg text-gray-700 transition-colors focus:ring-1 focus:ring-cyan-500 ${
                !supervisorFilter ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed' : 'border-gray-300 bg-white hover:bg-gray-50'
              }`}
            >
              {filteredEstados.map((est) => (<option key={est} value={est}>{est}</option>))}
            </select>
          </div>
        </div>
      </div>

      {/* ✨ TABLA CON SCROLL INTERNO - Altura fija con overflow */}
      <div className="overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gradient-to-r from-cyan-600 to-teal-700 text-white sticky top-0 z-10">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`px-2 py-2 text-left uppercase tracking-wider text-[10px] ${column.sortable ? 'cursor-pointer hover:bg-cyan-700/20 transition-colors' : ''}`}
                    onClick={() => { if (column.key !== 'seleccion' && column.sortable) requestSort(column.key); }}
                  >
                    <div className={`flex items-center gap-1 ${column.key === 'seleccion' ? 'justify-center' : ''}`}>
                      {column.key === 'seleccion' ? (
                        <input
                          type="checkbox"
                          checked={selectedItems.length === data.length && data.length > 0}
                          ref={selectAllRef}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                          className="h-3 w-3 cursor-pointer text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
                        />
                      ) : (
                        <>
                          {column.label}
                          {column.sortable && (
                            <svg
                              className={`h-2 w-2 transition-transform ${sortConfig.key === column.key ? (sortConfig.direction === 'asc' ? 'rotate-180' : '') : 'text-cyan-200'}`}
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M12 16l-6-6h12l-6 6zm0-10l-6 6h12l-6-6z" />
                            </svg>
                          )}
                        </>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-8 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <svg className="animate-spin h-5 w-5 text-cyan-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="text-[10px] text-gray-600 font-medium">Cargando...</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-8 text-center">
                    <div className="text-red-500 bg-red-50 p-3 rounded-lg max-w-md mx-auto">
                      <p className="text-[10px] font-medium">{error}</p>
                      <button onClick={fetchData} className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-[10px] hover:bg-red-700">Reintentar</button>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-8 text-center">
                    <div className="text-gray-500">
                      <p className="mt-2 text-[10px] font-medium">No hay agentes en la dotación</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className="hover:bg-cyan-50/50 transition-colors duration-150">
                    <td className="px-2 py-1.5 whitespace-nowrap text-center">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => handleSelectItem(item.id)}
                        className="h-3 w-3 cursor-pointer text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
                      />
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-700 font-mono text-[10px]">{item.id?.substring(0, 8) || 'N/A'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-700 text-[10px]">{item.PERIODO || 'N/A'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap font-mono font-medium text-gray-900 text-[10px]">{item.DNI}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap font-medium text-gray-900 text-[10px]">{item.NOMBRE}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-700 text-[10px]">{item.APELLIDO}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-700 text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${
                        item.ESTADO === 'ACTIVO' || item.ESTADO === 'ACTIVO_R' ? 'bg-green-100 text-green-700' :
                        item.ESTADO === 'BAJA' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {item.ESTADO || 'PENDIENTE'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-700 text-[10px]">{item.MODALIDAD || 'N/A'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-700 text-[10px]">{item.HORARIO || 'N/A'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-700 text-[10px]">{item.TURNO || 'N/A'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-700 text-[10px]">
                      {formatDate(item.FECHA_ING)}
                      <div className="text-[9px] text-gray-500">{calculateSeniority(item.FECHA_ING)}</div>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-700 text-[10px]">{formatDate(item.FECHA_BAJ)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-700 text-[10px]">{item.TIPO_PLANIL || 'N/A'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-700 font-mono bg-gray-50 text-[10px]">{item.DNI_SUP || 'N/A'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-700 text-[10px]">{item.SUPERVISOR || 'N/A'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-700 text-[10px]">{item.COORDINADOR || 'N/A'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-700 text-[10px]">{item.CELULAR || 'N/A'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-700 text-[10px]">{item.CORREO || 'N/A'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-700 text-[10px]">{item.CAMPANA || 'N/A'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-700 text-[10px]">{item.SUBMOTIVO1 || 'N/A'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-700 text-[10px]">{item.SUBMOTIVO2 || 'N/A'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-700 text-[10px]">{formatDate(item.created_at)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-700 text-[10px]">{formatDate(item.updated_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      {totalItems > 0 && !loading && (
        <div className="p-2 border-t border-gray-200 bg-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-[10px]">
          <div className="text-gray-700">
            Mostrando <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> a{' '}
            <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalItems)}</span> de{' '}
            <span className="font-medium">{totalItems}</span> agentes
          </div>
          <div className="flex flex-wrap items-center justify-center gap-0.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-1.5 py-1 border border-gray-300 rounded text-[10px] font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Anterior
            </button>
            {[...Array(Math.min(5, Math.ceil(totalItems / itemsPerPage)))].map((_, index) => {
              const totalPages = Math.ceil(totalItems / itemsPerPage);
              const page = Math.max(1, currentPage - 2) + index;
              if (page > totalPages) return null;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-1.5 py-1 rounded text-[10px] font-medium transition-colors ${
                    currentPage === page ? 'bg-cyan-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(Math.ceil(totalItems / itemsPerPage), p + 1))}
              disabled={currentPage === Math.ceil(totalItems / itemsPerPage)}
              className="px-1.5 py-1 border border-gray-300 rounded text-[10px] font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Acciones (selección) */}
      {selectedItems.length > 0 && (
        <div className="p-2 bg-gradient-to-r from-cyan-50 to-teal-50 border-t border-gray-200 flex items-center justify-between">
          <div className="text-[10px] text-gray-700">
            Seleccionados: <span className="font-semibold text-cyan-700">{selectedItems.length}</span>
          </div>
          <button
            onClick={openBulkModal}
            className="px-2 py-1 bg-cyan-600 text-white rounded text-[10px] font-medium flex items-center gap-1 hover:bg-cyan-700"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M16 3l5 5" />
            </svg>
            Editar en bloque
          </button>
        </div>
      )}

      {/* ─── MODAL EDICIÓN MASIVA ─────────────────────────────────────────── */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeBulkModal} />
          <div className="relative w-full md:max-w-4xl bg-white rounded-t-2xl md:rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-cyan-600 to-teal-700 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M16 3l5 5" />
                </svg>
                <h3 className="font-semibold">Edición masiva • {selectedItems.length} seleccionado(s)</h3>
              </div>
              <button onClick={closeBulkModal} className="text-white/80 hover:text-white">✕</button>
            </div>
            {/* Body */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto flex-1">
              <div className="md:col-span-2 text-[10px] text-gray-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex-shrink-0">
                <p className="font-semibold text-blue-800 mb-1">💡 Instrucciones:</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                  <li>Marca <b>"Aplicar"</b> en cada campo que deseas actualizar</li>
                  <li>Los campos no marcados NO serán modificados</li>
                  <li>Al seleccionar <b>DNI Líder</b>, se autocompletan: <b>Supervisor</b> y <b>Coordinador</b></li>
                  <li>✅ <b>Coordinador editable:</b> Puedes cambiar el coordinador manualmente sin afectar otros campos</li>
                  <li>🕐 <b>Horario inteligente:</b> Al seleccionar <b>Horario</b>, se completan automáticamente <b>Ingreso, Turno, Horas y Modalidad</b></li>
                  <li><b>Visibilidad dinámica:</b> Si <b>Estado = BAJA</b>, solo verás campos de baja</li>
                </ul>
              </div>
              {BULK_FIELDS.map((field) => (
                shouldShowField(field.key) && (
                  <div key={field.key} className="flex items-start gap-2 p-2 border border-gray-200 rounded-lg flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={!!bulkApply[field.key]}
                      onChange={(e) => toggleBulkApply(field.key, e.target.checked)}
                      className="mt-1 h-3.5 w-3.5 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
                      disabled={field.auto}
                    />
                    <div className="flex-1 min-w-0">
                      <label className="block text-[10px] font-medium text-gray-700 mb-1">
                        {field.label}
                        {field.auto && <span className="ml-1 text-[9px] text-emerald-600">(Auto)</span>}
                        {field.key === 'COORDINADOR' && <span className="ml-1 text-[9px] text-blue-600">(Editable)</span>}
                      </label>
                      {field.type === 'select' && field.key === 'HORARIO' && (
                        <select
                          value={bulkForm[field.key] ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setBulkField(field.key, v);
                            setBulkApply(prev => ({ ...prev, [field.key]: true }));
                            const auto = autoFillHorarioFields(v);
                            if (Object.keys(auto).length > 0) {
                              setBulkForm(prev => ({ ...prev, ...auto }));
                              setBulkApply(prev => ({ ...prev, INGRESO: true, TURNO: true, HORAS: true, MODALIDAD: true }));
                            } else {
                              setBulkForm(prev => ({ ...prev, INGRESO: '', TURNO: '', HORAS: '', MODALIDAD: '' }));
                              setBulkApply(prev => ({ ...prev, INGRESO: false, TURNO: false, HORAS: false, MODALIDAD: false }));
                            }
                          }}
                          className="w-full px-2 py-1 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-cyan-500 bg-white"
                        >
                          <option value="">--Seleccionar--</option>
                          {field.options.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                        </select>
                      )}
                      {field.type === 'select' && field.key !== 'HORARIO' && field.auto && (
                        <select disabled value={bulkForm[field.key] ?? ''} className="w-full px-2 py-1 text-[10px] border border-gray-300 rounded bg-gray-100 text-gray-500 cursor-not-allowed">
                          <option value="">--Auto-completado--</option>
                          {field.options.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                        </select>
                      )}
                      {field.type === 'select' && field.key !== 'HORARIO' && !field.auto && (
                        <select
                          value={bulkForm[field.key] ?? ''}
                          onChange={(e) => setBulkField(field.key, e.target.value)}
                          className="w-full px-2 py-1 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-cyan-500 bg-white"
                        >
                          <option value="">--Seleccionar--</option>
                          {field.options.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                        </select>
                      )}
                      {field.type === 'text' && (
                        <input
                          type="text"
                          value={bulkForm[field.key] ?? ''}
                          onChange={(e) => {
                            setBulkField(field.key, e.target.value);
                            if (field.key === 'COORDINADOR') {
                              setBulkApply(prev => ({ ...prev, COORDINADOR: true }));
                            }
                          }}
                          placeholder={field.placeholder || ''}
                          className="w-full px-2 py-1 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-cyan-500"
                        />
                      )}
                      {field.type === 'date' && (
                        <input
                          type="date"
                          value={(bulkForm[field.key] ?? '')?.slice(0, 10)}
                          onChange={(e) => setBulkField(field.key, e.target.value)}
                          className="w-full px-2 py-1 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-cyan-500"
                        />
                      )}
                      {field.type === 'select-dynamic' && (
                        <select
                          value={bulkForm[field.key] ?? ''}
                          onChange={(e) => setBulkField(field.key, e.target.value)}
                          className="w-full px-2 py-1 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-cyan-500 bg-white"
                        >
                          <option value="">--Seleccionar--</option>
                          {distinctCampanas.map((c) => (<option key={c} value={c}>{c}</option>))}
                        </select>
                      )}
                      {field.type === 'leader' && (
                        <select
                          value={bulkForm.DNI_SUP ?? ''}
                          onChange={(e) => handleBulkLeaderSelect(e.target.value)}
                          className="w-full px-2 py-1 text-[10px] border border-cyan-400 rounded focus:ring-1 focus:ring-cyan-500 bg-white"
                        >
                          <option value="">-- Seleccionar Líder --</option>
                          {(estructuraData || []).map((e) => (
                            <option key={e.dni} value={e.dni}>{e.supervisor} • {e.dni}</option>
                          ))}
                        </select>
                      )}
                      {field.key === 'SUBMOTIVO1' && (
                        <select
                          value={bulkForm.SUBMOTIVO1 ?? ''}
                          onChange={(e) => handleBulkSubmotivo1Change(e.target.value)}
                          className="w-full px-2 py-1 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-cyan-500 bg-white"
                        >
                          <option value="">--Seleccionar--</option>
                          <option value="Voluntario">Voluntario</option>
                          <option value="Involuntario">Involuntario</option>
                          <option value="Otros">Otros</option>
                        </select>
                      )}
                      {field.key === 'SUBMOTIVO2' && (
                        <select
                          value={bulkForm.SUBMOTIVO2 ?? ''}
                          onChange={(e) => handleBulkSubmotivo2Change(e.target.value)}
                          disabled={!bulkForm.SUBMOTIVO1}
                          className={`w-full px-2 py-1 text-[10px] border rounded focus:ring-1 focus:ring-cyan-500 bg-white ${
                            !bulkForm.SUBMOTIVO1 ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed' : 'border-gray-300'
                          }`}
                        >
                          <option value="" disabled>--Seleccionar--</option>
                          {bulkForm.SUBMOTIVO1 === 'Voluntario' && MOTIVOS_VOLUNTARIO.map((m) => (<option key={m} value={m}>{m}</option>))}
                          {bulkForm.SUBMOTIVO1 === 'Involuntario' && MOTIVOS_INVOLUNTARIO.map((m) => (<option key={m} value={m}>{m}</option>))}
                          {bulkForm.SUBMOTIVO1 === 'Otros' && <option value="Otros">Otros</option>}
                        </select>
                      )}
                    </div>
                  </div>
                )
              ))}
            </div>
            {/* Footer */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
              <div className="text-[10px] text-gray-600">
                Campos marcados serán actualizados en <b>{selectedItems.length}</b> registro(s)
              </div>
              <div className="flex gap-2">
                <button onClick={closeBulkModal} className="px-3 py-1.5 text-[10px] border border-gray-300 rounded-lg text-gray-700 hover:bg-white">Cancelar</button>
                <button
                  onClick={saveBulkModal}
                  disabled={isSaving}
                  className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-teal-700 text-white rounded-lg hover:opacity-90 text-[10px] font-medium disabled:opacity-50"
                >
                  {isSaving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
