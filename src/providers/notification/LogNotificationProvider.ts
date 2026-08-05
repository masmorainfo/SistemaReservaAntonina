import { NotificationProvider, NotificacaoInput } from "./NotificationProvider";

export class LogNotificationProvider implements NotificationProvider {
  nome = "log";
  private readonly enviados: NotificacaoInput[] = [];

  async enviar(input: NotificacaoInput): Promise<void> {
    console.info(`[notificacao] ${input.telefone}: ${input.mensagem}`);
    this.enviados.push(input);
  }

  /** Retorna uma cópia das notificações enviadas, sem expor o array interno. */
  obterEnviados(): NotificacaoInput[] {
    return [...this.enviados];
  }
}
