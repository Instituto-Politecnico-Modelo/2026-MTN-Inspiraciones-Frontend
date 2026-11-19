import { StateSchema, type DemoState, type Discipline, type Post, type User } from './model'

export const imageCredits: Record<string, string> = {
  corriente: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262',
  equilibrio: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61',
  taller: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f',
  fragmentos: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5',
  color: 'https://images.unsplash.com/photo-1549490349-8643362247b5',
  proceso: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b',
}

export function createSeed(now = new Date().toISOString()): DemoState {
  const at = (days: number) => new Date(Date.parse(now) + days * 86400000).toISOString()
  const person = (id: string, name: string, handle: string, disciplines: Discipline[], bio: string, role: User['role'] = 'artist'): User => ({
    id, name, handle, disciplines, bio, role,
    email: `${id}@trama.demo`, status: id === 'ines' ? 'suspended' : 'active',
    location: 'Buenos Aires, Argentina', website: '', avatar: '', inspirations: ['Procesos creativos'],
    joinedAt: at(-30), suspensionReason: id === 'ines' ? 'Autoría pendiente de revisión en esta demostración.' : '',
  })
  const users = [
    person('mora', 'Mora Vidal', 'moravidal', ['Ilustración', 'Cerámica'], 'Encuentro historias en los objetos, las texturas y las cosas de todos los días. Dibujo, hago cerámica y sigo aprendiendo a mirar.'),
    person('lara', 'Lara Sosa', 'larasosa', ['Pintura', 'Collage'], 'Entre manchas, recortes y accidentes felices. El color como punto de partida.'),
    person('mateo', 'Mateo Rivas', 'mateorivas', ['Cerámica', 'Escultura'], 'Objetos para habitar lo cotidiano. Trabajo con arcilla, tiempo y un poco de paciencia.'),
    person('nico', 'Nico Salas', 'nicosalas', ['Música'], 'Grabo lo que pasa alrededor. A veces se convierte en una canción.'),
    person('julia', 'Julia Pardo', 'juliapardo', ['Ilustración', 'Fotografía'], 'Un cuaderno siempre abierto. Explorando el dibujo y sus posibilidades.'),
    person('elena', 'Elena Costa', 'elenacosta', ['Collage', 'Música'], 'Imágenes encontradas, sonidos propios. Me interesan los encuentros inesperados.'),
    person('ines', 'Inés Duarte', 'inesduarte', ['Pintura'], 'Pintura, materia y pequeñas observaciones.'),
    person('admin', 'Equipo Trama', 'equipo.trama', ['Diseño'], 'Cuidamos este espacio de encuentro y creación.', 'admin'),
  ]
  const work = (id: number, authorId: string, title: string, asset: string, discipline: Discipline, description: string, width = 900, height = 1100): Post => ({
    id: `obra-${id}`, authorId, title, description, alt: description, discipline,
    technique: discipline === 'Pintura' ? 'Técnica mixta' : discipline === 'Cerámica' ? 'Modelado' : 'Exploración libre',
    kind: 'image', src: `/media/${asset}`, cover: '', width, height, duration: 0,
    license: asset.endsWith('.svg') ? 'Ilustración original de la demo' : 'Licencia Unsplash',
    credit: asset.endsWith('.svg') ? 'Ilustración original creada para esta demostración.' : 'Fotografía de referencia de Unsplash. El perfil, el título y el relato son ficticios; no representan la autoría de la fotografía.',
    creditUrl: imageCredits[asset.replace('.jpg', '')] ?? '',
    status: 'published', createdAt: at(-(id % 7)), likes: id % 2 === 0 ? ['julia', 'lara'] : ['mateo'],
    comments: [], challengeId: null,
  })
  const posts = [
    work(1, 'lara', 'Corriente dual', 'corriente.jpg', 'Pintura', 'Dejar que un color encuentre al otro. Un estudio sobre el movimiento y los encuentros que no estaban planeados.', 900, 1140),
    work(2, 'mateo', 'Un equilibrio imperfecto', 'equilibrio.jpg', 'Cerámica', 'Formas, materia y el espacio que queda entre ellas. Una referencia para volver a mirar lo cotidiano.', 900, 600),
    work(3, 'mora', 'Una línea, muchas formas', 'linea.svg', 'Ilustración', 'Un trazo continuo dibuja una figura abierta sobre papel. Prueba de una ilustración hecha sin levantar la mano.', 800, 1040),
    { ...work(4, 'nico', 'Luz de tarde', 'sonido.svg', 'Música', 'Pieza instrumental de ejemplo: un motivo suave de sintetizador, sin voz ni palabras.', 900, 600), kind: 'audio' as const, src: '/media/luz-de-tarde.wav', cover: '/media/sonido.svg', duration: 8, technique: 'Síntesis', license: 'Audio original de la demo · CC0', credit: 'Audio instrumental sintetizado para probar el reproductor.', creditUrl: '' },
    work(5, 'julia', 'Lo que crece despacio', 'botanica.svg', 'Ilustración', 'Hojas azules y verdes se cruzan sobre un papel cálido. Una pequeña colección de formas botánicas.', 800, 1000),
    work(6, 'mora', 'Objetos que se encuentran', 'objetos.svg', 'Cerámica', 'Estudio ilustrado de dos recipientes de arcilla y una rama. Volúmenes simples que comparten el mismo espacio.', 900, 800),
    work(7, 'lara', 'Fragmentos de un día', 'fragmentos.jpg', 'Pintura', 'Una referencia visual para pensar en capas, texturas y pequeñas decisiones de color.', 900, 1175),
    work(8, 'julia', 'El taller también cuenta', 'taller.jpg', 'Fotografía', 'Materiales, pinceles y pruebas. A veces la inspiración aparece antes de empezar la obra.', 900, 600),
    { ...work(9, 'elena', 'Pequeñas resonancias', 'resonancia.svg', 'Música', 'Sample instrumental de ejemplo: notas breves de percusión sintética, sin voces.', 900, 600), kind: 'audio' as const, src: '/media/resonancias.wav', cover: '/media/resonancia.svg', duration: 6, technique: 'Sample', license: 'Audio original de la demo · CC0', credit: 'Sample sintetizado para esta demostración; sin grabaciones de terceros.', creditUrl: '' },
    work(10, 'elena', 'Un lugar para el color', 'color.jpg', 'Collage', 'Color, ritmo y superposición. Fotografía de referencia para un ejercicio de composición.', 900, 1350),
    work(11, 'ines', 'Notas de un proceso', 'proceso.jpg', 'Pintura', 'Una pausa en el proceso creativo. Materiales y texturas como punto de partida.', 900, 900),
    work(12, 'mora', 'Herbario cotidiano', 'herbario.svg', 'Ilustración', 'Siluetas botánicas en cobalto, recortadas sobre un fondo claro. Mirar de nuevo las plantas del barrio.', 800, 1080),
  ]
  posts[0].alt = 'Pintura abstracta de textura espesa, con amarillo, naranja, rojo y una gran mancha turquesa.'
  posts[1].alt = 'Platos y cuencos de cerámica esmaltada en tonos celestes, apilados sobre un estante de madera.'
  posts[6].alt = 'Referencia pictórica de un gran ramo: flores rojas, blancas, azules y amarillas, hojas e insectos sobre un fondo oscuro.'
  posts[7].alt = 'Pinceles con pintura roja y naranja sobre una superficie clara, junto a manchas de pintura amarilla, verde y azul.'
  posts[9].alt = 'Composición abstracta con pliegues fluidos y brillantes en magenta, violeta y celeste.'
  posts[10].alt = 'Pinceles anchos usados, manchados de rojo, azul y turquesa, sobre una mesa salpicada de pintura.'
  posts[0].comments = [{ id: 'comentario-1', authorId: 'julia', text: 'Me encanta cómo dialogan los colores. ¡Gracias por compartir el proceso!', createdAt: at(-1) }]
  posts[4].challengeId = 'desafio-linea'
  const unreviewed = { note: '', resolvedAt: null, resolvedBy: null }
  return StateSchema.parse({
    version: 1, revision: 0, createdAt: now, users, posts,
    folders: [
      { id: 'carpeta-color', ownerId: 'mora', name: 'Color y forma', postIds: ['obra-1', 'obra-7'] },
      { id: 'carpeta-objetos', ownerId: 'mora', name: 'Objetos con historia', postIds: ['obra-2'] },
    ],
    follows: [{ followerId: 'mora', followingId: 'lara' }, { followerId: 'mora', followingId: 'mateo' }, { followerId: 'julia', followingId: 'mora' }],
    blocks: [],
    challenges: [
      { id: 'desafio-linea', title: 'Todo empieza con una línea', description: 'Elegí algo que tengas cerca y dibujalo sin levantar la mano del papel. No buscamos un resultado perfecto: nos interesa descubrir a dónde te lleva el trazo. Compartí una imagen de tu proceso o de la obra terminada. Una obra propia por participación, sin jurado ni premios en esta demo.', disciplines: ['Ilustración', 'Pintura', 'Diseño'], kinds: ['image'], startsAt: at(-2), endsAt: at(5), cover: '/media/linea.svg', archived: false, createdBy: 'admin', requestId: null },
      { id: 'desafio-texturas', title: 'Escuchar las texturas', description: 'Encontrá una textura en tu entorno y transformala en una imagen o en un sonido propio. Podés trabajar con papel, arcilla, fotografía o síntesis sonora. Acompañá tu obra con una breve explicación del proceso. No hay clasificación ni premios.', disciplines: ['Fotografía', 'Música', 'Collage', 'Cerámica'], kinds: ['image', 'audio'], startsAt: at(-1), endsAt: at(10), cover: '/media/objetos.svg', archived: false, createdBy: 'admin', requestId: null },
      { id: 'desafio-proximo', title: 'Una paleta, otro mundo', description: 'Creá una pieza con solo tres colores. Elegí el medio que prefieras y contanos por qué elegiste esa combinación. Podrás participar cuando abra la convocatoria.', disciplines: ['Pintura', 'Ilustración', 'Diseño'], kinds: ['image'], startsAt: at(7), endsAt: at(14), cover: '/media/botanica.svg', archived: false, createdBy: 'admin', requestId: null },
      { id: 'desafio-cerrado', title: 'Postales de lo cotidiano', description: 'Una invitación a encontrar algo extraordinario en un rincón de todos los días. Esta convocatoria de ejemplo ya terminó; la consigna se conserva para consultarla.', disciplines: ['Fotografía', 'Collage'], kinds: ['image'], startsAt: at(-21), endsAt: at(-7), cover: '/media/herbario.svg', archived: false, createdBy: 'admin', requestId: null },
    ],
    requests: [
      { id: 'solicitud-1', authorId: 'julia', title: 'Lo que queda de la lluvia', description: 'Propongo salir a observar después de la lluvia y crear una imagen a partir de un reflejo, una textura o una marca que dejó el agua.', discipline: 'Fotografía', status: 'pending', createdAt: at(-1), ...unreviewed },
      { id: 'solicitud-2', authorId: 'lara', title: 'Un retrato sin rostro', description: 'Representar a alguien a través de sus objetos, sin mostrar su cara. Una propuesta abierta a pintura, ilustración y collage.', discipline: 'Collage', status: 'pending', createdAt: at(-2), ...unreviewed },
      { id: 'solicitud-3', authorId: 'nico', title: 'Paisajes sonoros del barrio', description: 'Crear una breve pieza sonora inspirada en el lugar que habitamos. Usar sonidos propios y acompañar la pieza con una descripción accesible.', discipline: 'Música', status: 'approved', createdAt: at(-4), note: 'Propuesta aprobada. Falta definir las fechas y publicarla.', resolvedAt: at(-2), resolvedBy: 'admin' },
    ],
    reports: [
      { id: 'reporte-1', postId: 'obra-10', authorId: 'mora', reason: 'Autoría o derechos', description: 'Quisiera que se revise el crédito de esta imagen de ejemplo. No queda claro quién creó la fotografía original.', status: 'pending', createdAt: at(-1), ...unreviewed },
      { id: 'reporte-2', postId: 'obra-7', authorId: 'mateo', reason: 'Otro motivo', description: 'Solicitud de revisión de ejemplo para probar las acciones de moderación de la comunidad.', status: 'pending', createdAt: at(-2), ...unreviewed },
    ],
    appeals: [
      { id: 'apelacion-1', authorId: 'ines', description: 'Solicito una nueva revisión. Puedo aportar información sobre el proceso y la autoría de mi publicación de ejemplo.', status: 'pending', createdAt: at(-1), ...unreviewed },
    ],
    audit: [],
  })
}

export const places = [
  { id: 'taller-pasaje', name: 'Taller del Pasaje', kind: 'Taller', area: 'Villa Crespo', description: 'Espacio ficticio de cerámica y experimentación con materiales.', image: '/media/objetos.svg', x: 39, y: 55 },
  { id: 'casa-papel', name: 'Casa de Papel', kind: 'Espacio cultural', area: 'Chacarita', description: 'Lugar de ejemplo para dibujar, compartir referencias y conocer procesos.', image: '/media/taller.jpg', x: 27, y: 27 },
  { id: 'patio-abierto', name: 'Patio Abierto', kind: 'Galería', area: 'Palermo', description: 'Galería ficticia de pequeño formato, pensada para esta demostración.', image: '/media/herbario.svg', x: 70, y: 35 },
]
