// Constantes compartilhadas entre servidor e navegador (sem segredos).

export type AdvKey = "alex" | "marcos" | "matra";
export type Fonte = AdvKey | "sem";
export type Tipo = "motor" | "peca" | "misto" | "definir";
export type TipoLead = "motor" | "peca" | "?";
export type Situacao = "ativa" | "pausada" | "encerrada";
export type Nivel = "campanha" | "conjunto" | "anuncio";

export const NAVY = "#0E2A52";
export const ADV_KEYS: AdvKey[] = ["alex", "marcos", "matra"];
export const ADV: Record<AdvKey, { nome: string; cor: string }> = {
  alex: { nome: "Alex", cor: "#2563C9" },
  marcos: { nome: "Marcos", cor: "#B4501A" },
  matra: { nome: "Matra", cor: "#0F7F6E" },
};
export const SEM = { nome: "Sem anúncio identificado", cor: "#8A94A6" };

export const TIPO_NOME: Record<Tipo, string> = { motor: "Motor", peca: "Peça", misto: "Misto", definir: "Definir" };
export const SIT_NOME: Record<Situacao, string> = { ativa: "Ativa", pausada: "Pausada", encerrada: "Encerrada" };
export const NIVEL_NOME: Record<Nivel, string> = { campanha: "Campanha", conjunto: "Conjunto", anuncio: "Anúncio" };

// Etapas do Funil de vendas (PRINCIPAL) — ids do Kommo.
export const ST = {
  NAO_RESPONDE: 112337923,
  FORA: 112337927,
  SEM_ESTOQUE: 112337931,
  COTANDO: 112623063,
  MOTOR: 112623067,
  NEGOCIACAO: 112623071,
  REMARKETING: 112623083,
  NUTRICAO: 114312119,
  GANHO: 142,
  PERDIDO: 143,
} as const;

export const QUALIFICADO = [ST.SEM_ESTOQUE, ST.COTANDO, ST.MOTOR, ST.NEGOCIACAO, ST.GANHO];
export const COTACAO = [ST.COTANDO, ST.MOTOR, ST.NEGOCIACAO, ST.GANHO];
export const NEGOCIACAO = [ST.NEGOCIACAO, ST.GANHO];
export const ETAPAS = ["Leads", "Qualificados", "Cotação", "Negociação", "Venda"];

// DDD → UF e região
export const DDD_UF: Record<string, string> = {};
const faixa = (uf: string, ...ddds: number[]) => ddds.forEach((d) => (DDD_UF[String(d)] = uf));
faixa("SP", 11, 12, 13, 14, 15, 16, 17, 18, 19);
faixa("RJ", 21, 22, 24); faixa("ES", 27, 28); faixa("MG", 31, 32, 33, 34, 35, 37, 38);
faixa("PR", 41, 42, 43, 44, 45, 46); faixa("SC", 47, 48, 49); faixa("RS", 51, 53, 54, 55);
faixa("DF", 61); faixa("GO", 62, 64); faixa("TO", 63); faixa("MT", 65, 66); faixa("MS", 67);
faixa("AC", 68); faixa("RO", 69); faixa("BA", 71, 73, 74, 75, 77); faixa("SE", 79);
faixa("PE", 81, 87); faixa("AL", 82); faixa("PB", 83); faixa("RN", 84); faixa("CE", 85, 88);
faixa("PI", 86, 89); faixa("PA", 91, 93, 94); faixa("AM", 92, 97); faixa("RR", 95); faixa("AP", 96); faixa("MA", 98, 99);

export const DDD_REGIAO: Record<string, string> = {
  "11": "São Paulo (capital)", "12": "São José dos Campos", "13": "Santos", "14": "Bauru", "15": "Sorocaba",
  "16": "Ribeirão Preto", "17": "S. José do Rio Preto", "18": "Presidente Prudente", "19": "Campinas",
  "21": "Rio de Janeiro", "22": "Campos dos Goytacazes", "24": "Volta Redonda", "27": "Vitória", "28": "Cachoeiro",
  "31": "Belo Horizonte", "32": "Juiz de Fora", "33": "Governador Valadares", "34": "Uberlândia", "35": "Sul de Minas",
  "37": "Divinópolis", "38": "Montes Claros", "41": "Curitiba e região", "42": "Ponta Grossa", "43": "Londrina",
  "44": "Maringá", "45": "Cascavel / Foz", "46": "Sudoeste do PR", "47": "Joinville / Blumenau", "48": "Florianópolis",
  "49": "Oeste de SC", "51": "Porto Alegre", "53": "Pelotas", "54": "Caxias do Sul", "55": "Santa Maria",
  "61": "Brasília", "62": "Goiânia", "63": "Palmas", "64": "Rio Verde", "65": "Cuiabá", "66": "Rondonópolis",
  "67": "Campo Grande", "68": "Rio Branco", "69": "Porto Velho", "71": "Salvador", "73": "Ilhéus", "74": "Juazeiro",
  "75": "Feira de Santana", "77": "Vitória da Conquista", "79": "Aracaju", "81": "Recife", "82": "Maceió",
  "83": "João Pessoa", "84": "Natal", "85": "Fortaleza", "86": "Teresina", "87": "Petrolina", "88": "Juazeiro do Norte",
  "89": "Picos", "91": "Belém", "92": "Manaus", "93": "Santarém", "94": "Marabá", "95": "Boa Vista", "96": "Macapá",
  "97": "Interior do AM", "98": "São Luís", "99": "Imperatriz",
};

// Posição de cada estado no mapa em blocos: [UF, coluna, linha]
export const ESTADOS_GRID: [string, number, number][] = [
  ["RR", 1, 0], ["AP", 3, 0],
  ["AM", 1, 1], ["PA", 2, 1], ["MA", 3, 1], ["CE", 4, 1], ["RN", 5, 1],
  ["AC", 0, 2], ["RO", 1, 2], ["MT", 2, 2], ["TO", 3, 2], ["PI", 4, 2], ["PB", 5, 2], ["PE", 6, 2],
  ["MS", 2, 3], ["GO", 3, 3], ["DF", 4, 3], ["BA", 5, 3], ["AL", 6, 3],
  ["PR", 2, 4], ["SP", 3, 4], ["MG", 4, 4], ["ES", 5, 4], ["SE", 6, 4],
  ["SC", 2, 5], ["RJ", 4, 5],
  ["RS", 2, 6],
];

export const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
export const money = (n: number) => "R$ " + Math.round(n).toLocaleString("pt-BR");
export const pct = (a: number, b: number) =>
  b > 0 ? ((a / b) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%" : "—";
