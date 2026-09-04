// LA GEOGRAFÍA DE MUSICART — un solo sitio para los países (Fase 11).
//
// Antes esta tabla vivía dentro de `origin-guard.ts` con 54 países: los que un
// oyente sabe pedir en español. Servía para su trabajo (leer "artistas
// venezolanos" en un pedido), pero el Atlas necesita otra cosa: el MUNDO
// ENTERO, ordenado, para poder ofrecerlo. Así que la geografía se saca aquí y
// la barrera del origen pasa a leer de este archivo.
//
// Qué guarda cada país y para qué:
//   · `code`     — ISO 3166-1 alfa-2. Es la llave de todo: MusicBrainz y
//                  Wikidata hablan en este idioma, así que con el código se
//                  puede VERIFICAR el origen de un artista de cualquier país,
//                  esté o no su gentilicio aquí abajo.
//   · `claves`   — raíces del gentilicio en español ("venezolan" cubre
//                  venezolano/a/os/as). Sirven para dos cosas: detectar el país
//                  en un pedido escrito a mano y leer la primera frase de la
//                  Wikipedia en español.
//   · `clavesEn` — lo mismo para la Wikipedia en inglés.
//   · `ambiguo`  — el gentilicio también nombra un idioma ("en inglés" NO es un
//                  pedido de país).
//   · `areas`    — nombres de área de MusicBrainz cuando no coinciden con el
//                  nombre del país (Reino Unido → england, scotland…).
//
// Un país sin gentilicios sigue siendo perfectamente usable en el Atlas: solo
// pierde la detección en texto libre y la lectura de la Wikipedia, que son dos
// de las cuatro cosas. Preferimos un país sin gentilicio a un gentilicio
// inventado.
//
// DOS COLISIONES A PROPÓSITO. En inglés, "Dominican" es de Dominica Y de la
// República Dominicana, y "Congolese" de los dos Congos. No se arregla dándole
// la palabra al país más grande: eso convertiría a un artista de Dominica en
// dominicano y lo haríamos rechazar por error. Se quedan las dos, y quien lee
// la frase (`paisesEnFrase`) ve DOS países, la declara ambigua y no concluye
// nada — que es exactamente lo que sabemos: que esa frase no distingue.

export type RegionId =
  | "norteamerica"
  | "centroamerica"
  | "caribe"
  | "sudamerica"
  | "europa-oeste"
  | "europa-sur"
  | "europa-norte"
  | "europa-este"
  | "africa-occidental"
  | "norte-africa-oriente-medio"
  | "africa-oriental-austral"
  | "asia-central"
  | "asia-oriental"
  | "asia-sur-sudeste"
  | "oceania";

export type Pais = {
  code: string;
  nombre: string;
  claves: string[];
  clavesEn: string[];
  ambiguo?: boolean;
  areas?: string[];
  region: RegionId;
};

type Extra = { ambiguo?: boolean; areas?: string[] };

/** Azúcar para que la tabla de abajo se lea como una tabla y no como código. */
function p(
  code: string,
  nombre: string,
  claves: string[],
  clavesEn: string[],
  extra: Extra = {},
): Omit<Pais, "region"> {
  return { code, nombre, claves, clavesEn, ...extra };
}

export const REGIONES: { id: RegionId; nombre: string; sumario: string }[] = [
  { id: "norteamerica", nombre: "Norteamérica", sumario: "Donde se inventó casi todo lo que suena hoy." },
  { id: "centroamerica", nombre: "Centroamérica", sumario: "El puente: cumbia, marimba y punta." },
  { id: "caribe", nombre: "El Caribe", sumario: "La isla que más música ha exportado por metro cuadrado." },
  { id: "sudamerica", nombre: "Sudamérica", sumario: "Del tango al tropicalismo, pasando por el rock en español." },
  { id: "europa-oeste", nombre: "Europa occidental", sumario: "El otro motor del siglo XX." },
  { id: "europa-sur", nombre: "Europa del sur", sumario: "Flamenco, fado, canzone: la voz por delante." },
  { id: "europa-norte", nombre: "Europa del norte", sumario: "El frío, el metal y el pop más preciso del mundo." },
  { id: "europa-este", nombre: "Europa del este y los Balcanes", sumario: "Metales, ritmos impares y siglos de frontera." },
  { id: "africa-occidental", nombre: "África occidental", sumario: "La raíz de la que salieron el blues y casi todo lo demás." },
  { id: "norte-africa-oriente-medio", nombre: "Norte de África y Oriente Medio", sumario: "El maqam, el raï y la canción árabe." },
  { id: "africa-oriental-austral", nombre: "África oriental y austral", sumario: "Del jazz etíope al mbaqanga sudafricano." },
  { id: "asia-central", nombre: "Asia central y el Cáucaso", sumario: "La ruta de la seda, todavía sonando." },
  { id: "asia-oriental", nombre: "Asia oriental", sumario: "Del city pop al k-pop, con siglos debajo." },
  { id: "asia-sur-sudeste", nombre: "Asia meridional y el sudeste", sumario: "El raga, el gamelán y la psicodelia tropical." },
  { id: "oceania", nombre: "Oceanía", sumario: "El fin del mapa tiene su propio canon." },
];

const POR_REGION: Record<RegionId, Omit<Pais, "region">[]> = {
  norteamerica: [
    p("US", "Estados Unidos", ["estados unidos", "estadounidense", "norteamerican", "gringo", "eeuu"], ["american"]),
    p("CA", "Canadá", ["canada", "canadiense"], ["canadian"]),
    p("MX", "México", ["mexico", "mejico", "mexican"], ["mexican"]),
  ],
  centroamerica: [
    p("GT", "Guatemala", ["guatemala", "guatemaltec"], ["guatemalan"]),
    p("BZ", "Belice", ["belice", "belicen"], ["belizean"]),
    p("SV", "El Salvador", ["salvador", "salvadoren"], ["salvadoran", "salvadorean"]),
    p("HN", "Honduras", ["honduras", "hondur"], ["honduran"]),
    p("NI", "Nicaragua", ["nicaragua", "nicaraguen"], ["nicaraguan"]),
    p("CR", "Costa Rica", ["costa rica", "costarricense"], ["costa rican"]),
    p("PA", "Panamá", ["panama", "panamen"], ["panamanian"]),
  ],
  caribe: [
    p("CU", "Cuba", ["cuba", "cuban"], ["cuban"]),
    p("PR", "Puerto Rico", ["puerto rico", "puertorriquen", "boricua"], ["puerto rican"]),
    p("DO", "República Dominicana", ["dominican"], ["dominican"], { areas: ["dominican republic"] }),
    p("HT", "Haití", ["haiti", "haitian"], ["haitian"]),
    p("JM", "Jamaica", ["jamaica", "jamaiquin", "jamaican"], ["jamaican"]),
    p("TT", "Trinidad y Tobago", ["trinidad", "trinitense"], ["trinidadian"], { areas: ["trinidad and tobago"] }),
    p("BB", "Barbados", ["barbados", "barbadense"], ["barbadian"]),
    p("BS", "Bahamas", ["bahamas", "bahamen"], ["bahamian"]),
    p("AG", "Antigua y Barbuda", ["antigua"], ["antiguan"], { areas: ["antigua and barbuda"] }),
    p("GD", "Granada", ["granadin"], ["grenadian"], { areas: ["grenada"] }),
    p("LC", "Santa Lucía", ["santa lucia"], ["saint lucian"], { areas: ["saint lucia"] }),
    p("VC", "San Vicente y las Granadinas", ["san vicente"], ["vincentian"], { areas: ["saint vincent and the grenadines"] }),
    p("DM", "Dominica", [], ["dominican"], { areas: ["dominica"] }),
    p("KN", "San Cristóbal y Nieves", ["san cristobal"], ["kittitian"], { areas: ["saint kitts and nevis"] }),
  ],
  sudamerica: [
    p("CO", "Colombia", ["colombia", "colombian"], ["colombian"]),
    p("VE", "Venezuela", ["venezuela", "venezolan"], ["venezuelan"]),
    p("EC", "Ecuador", ["ecuador", "ecuatorian"], ["ecuadorian", "ecuadorean"]),
    p("PE", "Perú", ["peru", "peruan"], ["peruvian"]),
    p("BO", "Bolivia", ["bolivia", "bolivian"], ["bolivian"]),
    p("BR", "Brasil", ["brasil", "brasilen", "brasiler"], ["brazilian"], { areas: ["brazil"] }),
    p("AR", "Argentina", ["argentina", "argentin"], ["argentine", "argentinian"]),
    p("CL", "Chile", ["chile", "chilen"], ["chilean"]),
    p("UY", "Uruguay", ["uruguay"], ["uruguayan"]),
    p("PY", "Paraguay", ["paraguay"], ["paraguayan"]),
    p("GY", "Guyana", ["guyana", "guyanes"], ["guyanese"]),
    p("SR", "Surinam", ["surinam"], ["surinamese"], { areas: ["suriname"] }),
  ],
  "europa-oeste": [
    p("GB", "Reino Unido", ["reino unido", "britanic", "ingles", "inglaterra", "escoces", "escocia", "gales"], ["british", "english", "scottish", "welsh"], { ambiguo: true, areas: ["united kingdom", "england", "scotland", "wales", "northern ireland"] }),
    p("IE", "Irlanda", ["irlanda", "irlandes"], ["irish"], { areas: ["ireland"] }),
    p("FR", "Francia", ["francia", "frances"], ["french"], { ambiguo: true, areas: ["france"] }),
    p("DE", "Alemania", ["alemania", "aleman"], ["german"], { ambiguo: true, areas: ["germany"] }),
    p("NL", "Países Bajos", ["holanda", "holandes", "neerlandes", "paises bajos"], ["dutch"], { areas: ["netherlands"] }),
    p("BE", "Bélgica", ["belgica", "belga"], ["belgian"], { areas: ["belgium"] }),
    p("CH", "Suiza", ["suiza", "suizo"], ["swiss"], { areas: ["switzerland"] }),
    p("AT", "Austria", ["austria", "austriac"], ["austrian"]),
    p("LU", "Luxemburgo", ["luxemburgo", "luxemburgues"], ["luxembourgish"], { areas: ["luxembourg"] }),
  ],
  "europa-sur": [
    p("ES", "España", ["espana", "espanol"], ["spanish"], { ambiguo: true, areas: ["spain", "espana"] }),
    p("PT", "Portugal", ["portugal", "portugues"], ["portuguese"], { ambiguo: true }),
    p("IT", "Italia", ["italia", "italian"], ["italian"], { ambiguo: true, areas: ["italy", "italia"] }),
    p("GR", "Grecia", ["grecia", "griego"], ["greek"], { ambiguo: true, areas: ["greece"] }),
    p("MT", "Malta", ["malta", "maltes"], ["maltese"]),
    p("CY", "Chipre", ["chipre", "chipriota"], ["cypriot"], { areas: ["cyprus"] }),
  ],
  "europa-norte": [
    p("SE", "Suecia", ["suecia", "sueco"], ["swedish"], { areas: ["sweden"] }),
    p("NO", "Noruega", ["noruega", "noruego"], ["norwegian"], { areas: ["norway"] }),
    p("DK", "Dinamarca", ["dinamarca", "danes"], ["danish"], { areas: ["denmark"] }),
    p("FI", "Finlandia", ["finlandia", "finlandes"], ["finnish"], { areas: ["finland"] }),
    p("IS", "Islandia", ["islandia", "islandes"], ["icelandic"], { areas: ["iceland"] }),
    p("EE", "Estonia", ["estonia", "estonio"], ["estonian"]),
    p("LV", "Letonia", ["letonia", "leton"], ["latvian"], { areas: ["latvia"] }),
    p("LT", "Lituania", ["lituania", "lituan"], ["lithuanian"], { areas: ["lithuania"] }),
  ],
  "europa-este": [
    p("PL", "Polonia", ["polonia", "polaco"], ["polish"], { areas: ["poland"] }),
    p("CZ", "Chequia", ["chequia", "checoslovaquia", "checo"], ["czech"], { areas: ["czech republic", "czechia"] }),
    p("SK", "Eslovaquia", ["eslovaquia", "eslovac"], ["slovak"], { areas: ["slovakia"] }),
    p("HU", "Hungría", ["hungria", "hungar"], ["hungarian"], { areas: ["hungary"] }),
    p("RO", "Rumanía", ["rumania", "ruman"], ["romanian"], { areas: ["romania"] }),
    p("BG", "Bulgaria", ["bulgaria", "bulgar"], ["bulgarian"]),
    p("RS", "Serbia", ["serbia", "serbio"], ["serbian"]),
    p("HR", "Croacia", ["croacia", "croat"], ["croatian"], { areas: ["croatia"] }),
    p("SI", "Eslovenia", ["eslovenia", "esloven"], ["slovenian"], { areas: ["slovenia"] }),
    p("BA", "Bosnia y Herzegovina", ["bosnia", "bosnio"], ["bosnian"], { areas: ["bosnia and herzegovina"] }),
    p("ME", "Montenegro", ["montenegro", "montenegrin"], ["montenegrin"]),
    p("MK", "Macedonia del Norte", ["macedonia", "macedonio"], ["macedonian"], { areas: ["north macedonia", "macedonia"] }),
    p("AL", "Albania", ["albania", "albanes"], ["albanian"]),
    p("UA", "Ucrania", ["ucrania", "ucranian"], ["ukrainian"], { areas: ["ukraine"] }),
    p("BY", "Bielorrusia", ["bielorrusia", "bielorrus"], ["belarusian"], { areas: ["belarus"] }),
    p("MD", "Moldavia", ["moldavia", "moldav"], ["moldovan"], { areas: ["moldova"] }),
    p("RU", "Rusia", ["rusia", "ruso"], ["russian"], { ambiguo: true, areas: ["russia"] }),
  ],
  "africa-occidental": [
    p("SN", "Senegal", ["senegal", "senegales"], ["senegalese"]),
    p("ML", "Malí", ["mali", "maliense"], ["malian"]),
    p("NG", "Nigeria", ["nigeria", "nigerian"], ["nigerian"]),
    p("GH", "Ghana", ["ghana", "ghanes"], ["ghanaian"]),
    p("CI", "Costa de Marfil", ["costa de marfil", "marfilen"], ["ivorian"], { areas: ["cote d'ivoire", "ivory coast"] }),
    p("GN", "Guinea", ["guinea", "guinean"], ["guinean"]),
    p("BF", "Burkina Faso", ["burkina"], ["burkinabe"]),
    p("BJ", "Benín", ["benin", "beniyn"], ["beninese"]),
    p("TG", "Togo", ["togo", "togoles"], ["togolese"]),
    p("NE", "Níger", ["niger", "nigerin"], ["nigerien"]),
    p("SL", "Sierra Leona", ["sierra leona"], ["sierra leonean"], { areas: ["sierra leone"] }),
    p("LR", "Liberia", ["liberia", "liberian"], ["liberian"]),
    p("GM", "Gambia", ["gambia", "gambian"], ["gambian"]),
    p("GW", "Guinea-Bisáu", ["guinea bisau", "guinea bissau"], ["bissau-guinean"], { areas: ["guinea-bissau"] }),
    p("CV", "Cabo Verde", ["cabo verde", "caboverdian"], ["cape verdean"]),
    p("MR", "Mauritania", ["mauritania", "mauritan"], ["mauritanian"]),
  ],
  "norte-africa-oriente-medio": [
    p("MA", "Marruecos", ["marruecos", "marroqui"], ["moroccan"], { areas: ["morocco"] }),
    p("DZ", "Argelia", ["argelia", "argelin"], ["algerian"], { areas: ["algeria"] }),
    p("TN", "Túnez", ["tunez", "tunecin"], ["tunisian"], { areas: ["tunisia"] }),
    p("LY", "Libia", ["libia", "libio"], ["libyan"], { areas: ["libya"] }),
    p("EG", "Egipto", ["egipto", "egipcio"], ["egyptian"], { areas: ["egypt"] }),
    p("SD", "Sudán", ["sudan", "sudanes"], ["sudanese"]),
    p("IL", "Israel", ["israel", "israeli"], ["israeli"]),
    p("PS", "Palestina", ["palestina", "palestin"], ["palestinian"], { areas: ["palestine"] }),
    p("LB", "Líbano", ["libano", "libanes"], ["lebanese"], { areas: ["lebanon"] }),
    p("SY", "Siria", ["siria", "sirio"], ["syrian"], { areas: ["syria"] }),
    p("JO", "Jordania", ["jordania", "jordan"], ["jordanian"], { areas: ["jordan"] }),
    p("IQ", "Irak", ["irak", "iraqui"], ["iraqi"], { areas: ["iraq"] }),
    p("IR", "Irán", ["iran", "irani", "persa"], ["iranian", "persian"]),
    p("SA", "Arabia Saudí", ["arabia saudi", "saudi"], ["saudi"], { areas: ["saudi arabia"] }),
    p("AE", "Emiratos Árabes Unidos", ["emiratos"], ["emirati"], { areas: ["united arab emirates"] }),
    p("KW", "Kuwait", ["kuwait", "kuwaiti"], ["kuwaiti"]),
    p("QA", "Catar", ["catar", "qatar"], ["qatari"], { areas: ["qatar"] }),
    p("BH", "Baréin", ["barein", "bahrein"], ["bahraini"], { areas: ["bahrain"] }),
    p("OM", "Omán", ["oman", "omani"], ["omani"]),
    p("YE", "Yemen", ["yemen", "yemeni"], ["yemeni"]),
    p("TR", "Turquía", ["turquia", "turco"], ["turkish"], { ambiguo: true, areas: ["turkey"] }),
  ],
  "africa-oriental-austral": [
    p("ET", "Etiopía", ["etiopia", "etiope"], ["ethiopian"], { areas: ["ethiopia"] }),
    p("ER", "Eritrea", ["eritrea", "eritreo"], ["eritrean"]),
    p("DJ", "Yibuti", ["yibuti"], ["djiboutian"], { areas: ["djibouti"] }),
    p("SO", "Somalia", ["somalia", "somali"], ["somali"]),
    p("KE", "Kenia", ["kenia", "keniat"], ["kenyan"], { areas: ["kenya"] }),
    p("TZ", "Tanzania", ["tanzania", "tanzan"], ["tanzanian"]),
    p("UG", "Uganda", ["uganda", "ugandes"], ["ugandan"]),
    p("RW", "Ruanda", ["ruanda", "ruandes"], ["rwandan"], { areas: ["rwanda"] }),
    p("BI", "Burundi", ["burundi", "burundes"], ["burundian"]),
    p("CD", "República Democrática del Congo", ["congo", "congoleñ", "congolen"], ["congolese"], { areas: ["democratic republic of the congo", "congo"] }),
    p("CG", "Congo", [], ["congolese"], { areas: ["republic of the congo"] }),
    p("CM", "Camerún", ["camerun", "camerunes"], ["cameroonian"], { areas: ["cameroon"] }),
    p("GA", "Gabón", ["gabon", "gabones"], ["gabonese"]),
    p("GQ", "Guinea Ecuatorial", ["guinea ecuatorial", "ecuatoguinean"], ["equatoguinean"], { areas: ["equatorial guinea"] }),
    p("CF", "República Centroafricana", ["centroafrican"], ["central african"], { areas: ["central african republic"] }),
    p("TD", "Chad", ["chad", "chadian"], ["chadian"]),
    p("AO", "Angola", ["angola", "angolen"], ["angolan"]),
    p("ZM", "Zambia", ["zambia", "zamban"], ["zambian"]),
    p("ZW", "Zimbabue", ["zimbabue", "zimbabuense"], ["zimbabwean"], { areas: ["zimbabwe"] }),
    p("MW", "Malaui", ["malaui", "malawi"], ["malawian"], { areas: ["malawi"] }),
    p("MZ", "Mozambique", ["mozambique", "mozambiquen"], ["mozambican"]),
    p("BW", "Botsuana", ["botsuana", "botswana"], ["botswanan"], { areas: ["botswana"] }),
    p("NA", "Namibia", ["namibia", "namibio"], ["namibian"]),
    p("ZA", "Sudáfrica", ["sudafrica", "sudafrican"], ["south african"], { areas: ["south africa"] }),
    p("LS", "Lesoto", ["lesoto"], ["basotho"], { areas: ["lesotho"] }),
    p("SZ", "Esuatini", ["suazilandia", "esuatini"], ["swazi"], { areas: ["eswatini", "swaziland"] }),
    p("MG", "Madagascar", ["madagascar", "malgache"], ["malagasy"]),
    p("MU", "Mauricio", ["mauricio"], ["mauritian"], { areas: ["mauritius"] }),
    p("SC", "Seychelles", ["seychelles"], ["seychellois"]),
    p("KM", "Comoras", ["comoras"], ["comorian"], { areas: ["comoros"] }),
    p("ST", "Santo Tomé y Príncipe", ["santo tome"], ["sao tomean"], { areas: ["sao tome and principe"] }),
  ],
  "asia-central": [
    p("KZ", "Kazajistán", ["kazajistan", "kazajo"], ["kazakh"], { areas: ["kazakhstan"] }),
    p("UZ", "Uzbekistán", ["uzbekistan", "uzbeko"], ["uzbek"], { areas: ["uzbekistan"] }),
    p("TM", "Turkmenistán", ["turkmenistan", "turkmen"], ["turkmen"], { areas: ["turkmenistan"] }),
    p("KG", "Kirguistán", ["kirguistan", "kirgui"], ["kyrgyz"], { areas: ["kyrgyzstan"] }),
    p("TJ", "Tayikistán", ["tayikistan", "tayiko"], ["tajik"], { areas: ["tajikistan"] }),
    p("AF", "Afganistán", ["afganistan", "afgan"], ["afghan"], { areas: ["afghanistan"] }),
    p("GE", "Georgia", ["georgia", "georgian"], ["georgian"]),
    p("AM", "Armenia", ["armenia", "armenio"], ["armenian"]),
    p("AZ", "Azerbaiyán", ["azerbaiyan", "azeri"], ["azerbaijani"], { areas: ["azerbaijan"] }),
  ],
  "asia-oriental": [
    p("CN", "China", ["china", "chino"], ["chinese"], { ambiguo: true }),
    p("JP", "Japón", ["japon", "japones"], ["japanese"], { ambiguo: true, areas: ["japan"] }),
    p("KR", "Corea del Sur", ["corea", "coreano"], ["korean", "south korean"], { ambiguo: true, areas: ["south korea", "korea"] }),
    p("KP", "Corea del Norte", ["norcorean"], ["north korean"], { areas: ["north korea"] }),
    p("TW", "Taiwán", ["taiwan", "taiwanes"], ["taiwanese"]),
    p("HK", "Hong Kong", ["hong kong", "hongkones"], ["hong kong"]),
    p("MN", "Mongolia", ["mongolia", "mongol"], ["mongolian"]),
  ],
  "asia-sur-sudeste": [
    p("IN", "India", ["india", "indio", "hindu"], ["indian"]),
    p("PK", "Pakistán", ["pakistan", "paquistan"], ["pakistani"], { areas: ["pakistan"] }),
    p("BD", "Bangladés", ["banglades", "bengali"], ["bangladeshi"], { areas: ["bangladesh"] }),
    p("LK", "Sri Lanka", ["sri lanka", "cingales"], ["sri lankan"]),
    p("NP", "Nepal", ["nepal", "nepali"], ["nepalese"]),
    p("BT", "Bután", ["butan"], ["bhutanese"], { areas: ["bhutan"] }),
    p("MV", "Maldivas", ["maldivas"], ["maldivian"], { areas: ["maldives"] }),
    p("MM", "Birmania", ["birmania", "birman", "myanmar"], ["burmese"], { areas: ["myanmar", "burma"] }),
    p("TH", "Tailandia", ["tailandia", "tailandes"], ["thai"], { areas: ["thailand"] }),
    p("VN", "Vietnam", ["vietnam", "vietnamit"], ["vietnamese"]),
    p("LA", "Laos", ["laos", "laosian"], ["lao"]),
    p("KH", "Camboya", ["camboya", "camboyan"], ["cambodian"], { areas: ["cambodia"] }),
    p("MY", "Malasia", ["malasia", "malay"], ["malaysian"], { areas: ["malaysia"] }),
    p("SG", "Singapur", ["singapur"], ["singaporean"], { areas: ["singapore"] }),
    p("ID", "Indonesia", ["indonesia", "indonesio"], ["indonesian"]),
    p("PH", "Filipinas", ["filipinas", "filipin"], ["filipino", "philippine"], { areas: ["philippines"] }),
    p("BN", "Brunéi", ["brunei"], ["bruneian"], { areas: ["brunei"] }),
    p("TL", "Timor Oriental", ["timor"], ["timorese"], { areas: ["east timor", "timor-leste"] }),
  ],
  oceania: [
    p("AU", "Australia", ["australia", "australian"], ["australian"]),
    p("NZ", "Nueva Zelanda", ["nueva zelanda", "neozelandes"], ["new zealand"], { areas: ["new zealand"] }),
    p("PG", "Papúa Nueva Guinea", ["papua"], ["papua new guinean"], { areas: ["papua new guinea"] }),
    p("FJ", "Fiyi", ["fiyi", "fiji"], ["fijian"], { areas: ["fiji"] }),
    p("SB", "Islas Salomón", ["islas salomon"], ["solomon islander"], { areas: ["solomon islands"] }),
    p("VU", "Vanuatu", ["vanuatu"], ["ni-vanuatu"]),
    p("WS", "Samoa", ["samoa", "samoan"], ["samoan"]),
    p("TO", "Tonga", ["tonga", "tongan"], ["tongan"]),
    p("KI", "Kiribati", ["kiribati"], ["i-kiribati"]),
    p("MH", "Islas Marshall", ["islas marshall"], ["marshallese"], { areas: ["marshall islands"] }),
    p("FM", "Micronesia", ["micronesia"], ["micronesian"]),
    p("PW", "Palaos", ["palaos"], ["palauan"], { areas: ["palau"] }),
    p("NR", "Nauru", ["nauru"], ["nauruan"]),
    p("TV", "Tuvalu", ["tuvalu"], ["tuvaluan"]),
  ],
};

/** Todos los países, con su región puesta. */
export const PAISES: Pais[] = REGIONES.flatMap((r) =>
  POR_REGION[r.id].map((pais) => ({ ...pais, region: r.id })),
);

const POR_CODIGO = new Map(PAISES.map((p) => [p.code, p]));

export function paisPorCodigo(code: string): Pais | null {
  return POR_CODIGO.get(code.toUpperCase()) ?? null;
}

/** Los países de una región, en el orden en que están escritos arriba. */
export function paisesDeRegion(region: RegionId): Pais[] {
  return PAISES.filter((p) => p.region === region);
}

/**
 * Nombre en español de un código ISO. Si no está en la tabla (Wikidata puede
 * devolver cualquier cosa), lo pregunta al catálogo del idioma antes de
 * rendirse: decir "es de CV" en vez de "es de Cabo Verde" es un tecnicismo
 * gratuito.
 */
export function nombreDePais(code: string | null): string | null {
  if (!code) return null;
  const conocido = POR_CODIGO.get(code.toUpperCase());
  if (conocido) return conocido.nombre;
  try {
    return new Intl.DisplayNames(["es"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
