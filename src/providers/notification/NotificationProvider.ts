export interface NotificacaoInput {
  telefone: string;
  mensagem: string;
}

export interface NotificationProvider {
  nome: string;
  enviar(input: NotificacaoInput): Promise<void>;
}
