export const LIMITE_TENTATIVAS_LOGIN = 5;
export const JANELA_BLOQUEIO_MS = 15 * 60 * 1000;

// Teto de entradas no mapa: acima deste tamanho, só abre espaço podando
// entradas já expiradas — nunca descarta uma entrada ainda válida para dar
// lugar a uma nova. Descartar a "mais antiga" pareceria razoável, mas abriria
// uma brecha real: um atacante poderia inundar o mapa com e-mails
// inexistentes só para forçar a remoção do bloqueio de uma conta real que já
// estivesse sendo rastreada, resetando o contador dela e ganhando um novo
// burst de tentativas. Preferimos deixar tentativas excedentes sem
// rastreamento (fail-open só pra essa tentativa específica) a permitir que
// alguém force a saída de uma entrada alheia.
export const LIMITE_MAPA = 1000;

interface RegistroTentativas {
  tentativas: number;
  resetaEm: number;
}

const tentativasPorEmail = new Map<string, RegistroTentativas>();

function podarExpirados(agora: number): void {
  if (tentativasPorEmail.size < LIMITE_MAPA) return;

  for (const [chave, registro] of tentativasPorEmail) {
    if (agora >= registro.resetaEm) {
      tentativasPorEmail.delete(chave);
    }
  }
}

export function estaBloqueado(email: string, agora: number = Date.now()): boolean {
  const registro = tentativasPorEmail.get(email);
  if (!registro) return false;

  if (agora >= registro.resetaEm) {
    tentativasPorEmail.delete(email);
    return false;
  }

  return registro.tentativas >= LIMITE_TENTATIVAS_LOGIN;
}

// Síncrona e sem nenhum await entre a checagem (estaBloqueado) e o
// registro: quem chama deve invocar as duas em sequência, antes de
// qualquer operação assíncrona (consulta ao banco, hash de senha). Isso
// torna "checar e reservar uma tentativa" atômico mesmo sob requisições
// concorrentes — sem isso, várias tentativas em paralelo passariam pela
// checagem antes que qualquer uma delas tivesse registrado sua falha.
export function registrarTentativaFalha(email: string, agora: number = Date.now()): void {
  const registro = tentativasPorEmail.get(email);

  if (!registro || agora >= registro.resetaEm) {
    podarExpirados(agora);
    if (tentativasPorEmail.size >= LIMITE_MAPA) {
      // Mapa cheio de entradas ainda válidas: não há como abrir espaço sem
      // descartar uma delas (ver comentário em LIMITE_MAPA). Esta tentativa
      // específica fica sem rastreamento em vez disso.
      return;
    }
    tentativasPorEmail.set(email, { tentativas: 1, resetaEm: agora + JANELA_BLOQUEIO_MS });
    return;
  }

  tentativasPorEmail.set(email, { ...registro, tentativas: registro.tentativas + 1 });
}

export function limparTentativas(email: string): void {
  tentativasPorEmail.delete(email);
}
